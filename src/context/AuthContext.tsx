import { appUrl } from '../utils/appPath';
import { markAuthBootstrapComplete } from '../utils/authBootstrap';
import { ToasterService } from '../Services/ToasterService';
import { createContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import axios from 'axios';
import placeholderImage from '../images/img-placeholder.png';
import {
  clearSessionExpiredRedirect,
  clearSessionExpiredFlag,
  clearSessionExpiredDraft,
  getCurrentAppLocation,
  hasSessionExpiredFlag,
  isSessionExpiredResponse,
  saveReturnPath,
  saveSessionExpiredRedirect,
  saveSessionExpiredDraft,
} from '../utils/sessionRecovery';
import { AccessInfo, NO_ACCESS, TENANT_HEADER, decodeAccess, getSelectedTenant, setSelectedTenant } from '../access/access';

// Saves and deletes get a confirmation or error toast when the page shows none itself (F10)
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const wantsFeedback = (method: string | undefined, url: string) =>
  MUTATING_METHODS.includes((method || 'GET').toUpperCase()) &&
  url.includes('/v1/api/') && !url.includes('/v1/api/auth/');
const successText = (method: string | undefined) =>
  (method || '').toUpperCase() === 'DELETE' ? 'Deleted successfully' : 'Saved successfully';
const errorText = (data: any, status?: number) =>
  data?.error || data?.message || (status ? `The request failed (HTTP ${status})` : 'Could not reach the server');

// Unwrapped fetch, so token refreshes are not intercepted themselves
const nativeFetch = window.fetch.bind(window);

// "Keep me logged in" off: the refresh cookie dies with the browser, so every page load checks it
const SESSION_PERSISTENT_KEY = 'sessionPersistent';

/**
 * ok: renewed. rejected: the server refused the session (signed out, expired, password changed).
 * unavailable: the server couldn't be reached (restart, outage); the session may still be fine.
 */
type RefreshResult =
  | { status: 'ok'; token: string; user?: unknown }
  | { status: 'rejected' }
  | { status: 'unavailable' };

let refreshInFlight: Promise<RefreshResult> | null = null;

/** Gets a new access token using the HttpOnly refresh cookie set at login. Concurrent callers share one request. */
const refreshAccessToken = (): Promise<RefreshResult> => {
  if (!refreshInFlight) {
    refreshInFlight = nativeFetch('/v1/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(async (res): Promise<RefreshResult> => {
        if (!res.ok) {
          return res.status >= 400 && res.status < 500 ? { status: 'rejected' } : { status: 'unavailable' };
        }
        const body = await res.json().catch(() => null);
        const token: string | undefined = body?.token;
        if (!token) return { status: 'unavailable' };
        localStorage.setItem('accessToken', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        window.dispatchEvent(new CustomEvent('app-token-refreshed', { detail: { user: body?.user } }));
        return { status: 'ok', token, user: body?.user };
      })
      .catch((): RefreshResult => ({ status: 'unavailable' }))
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

// A failed renewal because the server is down must not end the session; tell the user instead
const notifyServerUnavailable = () =>
  ToasterService.warning("Can't reach the server", "You're still signed in. Please try again in a moment.");

const tokenPayload = (token: string | null): Record<string, any> | null => {
  try {
    const part = token?.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(Array.from(json, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
  } catch {
    return null;
  }
};

// Expired, or about to expire within a few seconds
const isTokenExpired = (token: string | null) => {
  const exp = tokenPayload(token)?.exp;
  return typeof exp !== 'number' || exp * 1000 <= Date.now() + 5000;
};

// The tenant comes from the token on the server. Only a Super Admin who picked a
// tenant sends X-Tenant-Id; without it they work platform-wide (all tenants).
const selectedTenantHeader = (): string | null => {
  const access = decodeAccess(localStorage.getItem('accessToken'));
  return access.superAdmin ? getSelectedTenant() : null;
};

// Global Axios Request Interceptor to dynamically attach token
axios.interceptors.request.use(
  (config) => {
    const isAuthEndpoint = config.url?.includes('/v1/api/auth/');
    const token = localStorage.getItem('accessToken');
    if (token && !isAuthEndpoint) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Authentication failures are handled by the sign-in/sign-up forms, not
    // by the global expired-session modal.
    (config as any).skipSessionExpiredHandling = isAuthEndpoint;
    (config as any)._startedAt = (config as any)._startedAt ?? Date.now();

    if (!isAuthEndpoint) {
      const tenantId = selectedTenantHeader();
      if (tenantId) {
        config.headers[TENANT_HEADER] = tenantId;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Identical GETs already in flight (several widgets or dropdowns loading the same list) share one
// request. Only in-flight calls are shared, nothing is cached; each caller still parses its own copy
// because axios transforms the response after the adapter.
const baseAdapter = axios.getAdapter(axios.defaults.adapter);
const inFlightGets = new Map<string, ReturnType<typeof baseAdapter>>();
axios.defaults.adapter = (config) => {
  const cancellable = Boolean(config.signal || config.cancelToken);
  if ((config.method || 'get').toLowerCase() !== 'get' || cancellable) {
    return baseAdapter(config);
  }
  const key = [
    axios.getUri(config),
    config.responseType ?? '',
    String(config.headers?.['Authorization'] ?? ''),
    String(config.headers?.[TENANT_HEADER] ?? ''),
  ].join('|');
  const pending = inFlightGets.get(key);
  if (pending) {
    // On failure, send this caller's own request so its error (and 401 retry) carries its own config
    return pending.then((response) => ({ ...response, config }), () => baseAdapter(config));
  }
  const request = baseAdapter(config).finally(() => inFlightGets.delete(key));
  inFlightGets.set(key, request);
  return request;
};


interface User {
  id?: string;
  userId: string;
  username: string;
  fullName: string;
  superAdmin: boolean;
  tenantId: string | null;
  roles: string[];
  permissions: string[];
  active: boolean;
  role?: string;
  userType?: string;
  email?: string;
}

interface LoginResponse {
  token: string;
  user: User;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  // Modules and permissions from the current token
  access: AccessInfo;
  isLoggedIn: boolean;
  loading: boolean;
  profileImage: string;
  // False while profileImage is only the placeholder, so screens can show initials instead
  hasProfileImage: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  // After the user changes their password: the server ends older sessions, so sign this one in again
  reauthenticate: (newPassword: string) => Promise<void>;
  signup: (fullName: string, role: string, email: string, password: string) => Promise<any>;
  logout: (options?: { preserveSessionRecovery?: boolean }) => void;
  updateUser: (userData: User) => void;
  updateProfileImage: (imageUrl: string) => void;
  refreshUserData: () => Promise<void>;
  refreshProfileImage: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  access: NO_ACCESS,
  isLoggedIn: false,
  loading: false,
  profileImage: placeholderImage,
  hasProfileImage: false,
  login: async () => { throw new Error('Login function not implemented'); },
  reauthenticate: async () => {},
  signup: async () => { throw new Error('Signup function not implemented'); },
  logout: () => {},
  updateUser: () => {},
  updateProfileImage: () => {},
  refreshUserData: async () => {},
  refreshProfileImage: async () => {},
});

// const INACTIVITY_TIMEOUT = 6000000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessInfo>(() => decodeAccess(localStorage.getItem('accessToken')));
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState(placeholderImage);
  const [hasProfileImage, setHasProfileImage] = useState(false);
  const profileImageUrlRef = useRef<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const sessionExpiredRef = useRef(false);

  const applyProfileImage = useCallback((blobUrl: string | null) => {
    if (profileImageUrlRef.current && profileImageUrlRef.current !== blobUrl) {
      URL.revokeObjectURL(profileImageUrlRef.current);
    }
    profileImageUrlRef.current = blobUrl;
    setProfileImage(blobUrl ?? placeholderImage);
    setHasProfileImage(Boolean(blobUrl));
  }, []);

  // The one place the photo is fetched (on load, after login, after an upload); every screen reads it from here
  const loadProfileImage = useCallback(async (userId: string | number, token: string) => {
    try {
      const response = await fetch(`/v1/api/user/${userId}/image?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      applyProfileImage(response.ok ? URL.createObjectURL(await response.blob()) : null);
    } catch {
      applyProfileImage(null);
    }
  }, [applyProfileImage]);

  const completeAuthBootstrap = useCallback(() => {
    setLoading(false);
    markAuthBootstrapComplete();
  }, []);

  const normalizeUser = useCallback((raw: any): User => {
    const roles = Array.isArray(raw?.roles) ? raw.roles : [];
    const role = raw?.role;
    const userType = raw?.userType;
    const superAdmin =
      raw?.superAdmin === true ||
      roles.includes("SUPER_ADMIN") ||
      role === "SUPER_ADMIN" ||
      userType === "SUPER_ADMIN";

    return {
      id: raw?.id,
      userId: raw?.userId ?? raw?.id ?? "",
      username: raw?.username ?? "",
      fullName: raw?.fullName ?? raw?.name ?? "",
      superAdmin,
      tenantId: raw?.tenantId ?? null,
      roles,
      permissions: Array.isArray(raw?.permissions) ? raw.permissions : [],
      active: raw?.active ?? true,
      role,
      userType,
      email: raw?.email ?? raw?.username ?? "",
    };
  }, []);

  const logout = useCallback((options?: { preserveSessionRecovery?: boolean }) => {
    if (options?.preserveSessionRecovery) {
      clearSessionExpiredFlag();
    } else {
      clearSessionExpiredRedirect();
      clearSessionExpiredDraft();
    }

    // Clears the HttpOnly refresh cookie (scripts can't remove it themselves). keepalive lets the
    // request finish even when the page navigates away straight after (e.g. to the sign-in page).
    nativeFetch('/v1/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true })
      .catch(() => undefined);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem(SESSION_PERSISTENT_KEY);
    setSelectedTenant(null);
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setAccess(NO_ACCESS);
    applyProfileImage(null);
    setSessionExpired(false);
    sessionExpiredRef.current = false;
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
     // inactivityTimerRef.current = null;
    }
  }, [applyProfileImage]);

  const handleSessionExpired = useCallback(() => {
    if (sessionExpiredRef.current) {
      return;
    }

    sessionExpiredRef.current = true;
    const expiredPath = getCurrentAppLocation();
    saveSessionExpiredRedirect(expiredPath);
    saveSessionExpiredDraft(expiredPath);
    window.dispatchEvent(new CustomEvent("app-session-expired", { detail: { path: expiredPath } }));
    setSessionExpired(true);
  }, []);

  const updateUser = useCallback((userData: User) => {
    const normalized = normalizeUser(userData);
    setUser(normalized);
    localStorage.setItem('user', JSON.stringify(normalized));
  }, [normalizeUser]);

  const updateProfileImage = useCallback((imageUrl: string) => {
    applyProfileImage(imageUrl);
  }, [applyProfileImage]);

  const refreshUserData = useCallback(async (): Promise<void> => {
    try {
      const token = localStorage.getItem('accessToken');
      const currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');
      const userId = currentUser?.id || currentUser?.userId;
      
      if (!token || !userId) return;

      const response = await fetch(`/v1/api/user/getUserById/${userId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const userData: User = await response.json();
        updateUser(userData);
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  }, [user, updateUser]);

  const refreshProfileImage = useCallback(async (): Promise<void> => {
    const currentUser = user || JSON.parse(localStorage.getItem('user') || 'null');
    const userId = currentUser?.id || currentUser?.userId;
    
    if (!userId) {
      console.error("No user ID found for image fetch");
      return;
    }

    const authToken = localStorage.getItem('accessToken');
    if (!authToken) {
      console.error("No authentication token found");
      return;
    }
    await loadProfileImage(userId, authToken);
  }, [user, loadProfileImage]);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;

    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // inactivityTimerRef.current = setTimeout(() => {
    //   console.log('User inactive for 1 minute. Logging out...');
    //   logout();
    // }, INACTIVITY_TIMEOUT);
  }, [user, logout]);

  // Setup activity listeners
  useEffect(() => {
    if (!user) return;

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [user, resetInactivityTimer]);

  // Initialize user and profile image on mount - ONLY ONCE
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }

    const initializeAuth = async () => {
      if (!storedToken) {
        completeAuthBootstrap();
        return;
      }

      let token = storedToken;
      let rawUser: any = null;
      try {
        rawUser = storedUser ? JSON.parse(storedUser) : null;
      } catch {
        rawUser = null;
      }

      // Renew first when the access token has expired, the user is missing, or the session is
      // browser-only (its cookie is gone after the browser was closed)
      const browserOnly = localStorage.getItem(SESSION_PERSISTENT_KEY) === 'false';
      const expired = isTokenExpired(token);
      if (expired || !rawUser || browserOnly) {
        const result = await refreshAccessToken();
        if (result.status === 'ok') {
          token = result.token;
          rawUser = { ...(rawUser ?? {}), ...((result.user as object) ?? {}) };
        } else if ((result.status === 'rejected' && expired) || !rawUser) {
          // A still-valid access token is kept even when the renewal is refused (e.g. a server still
          // on an older version); the session then ends when that token expires
          // Nothing to recover: show sign-in straight away and come back to this page afterwards
          saveReturnPath(getCurrentAppLocation());
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          localStorage.removeItem(SESSION_PERSISTENT_KEY);
          delete axios.defaults.headers.common['Authorization'];
          setAccess(NO_ACCESS);
          completeAuthBootstrap();
          return;
        }
        // unavailable: keep the stored session; requests renew it once the server is back
      }

      const userData = normalizeUser(rawUser);
      setUser(userData);
      setAccess(decodeAccess(token));
      localStorage.setItem('user', JSON.stringify(userData));

      // Fetch profile image after setting user; the page doesn't wait for it
      const userId = userData?.id || userData?.userId;
      if (userId) {
        void loadProfileImage(userId, token);
      }

      completeAuthBootstrap();
    };

    initializeAuth();
  }, [completeAuthBootstrap, normalizeUser, loadProfileImage]); // all stable - runs only once on mount

  // A refreshed token may carry changed permissions, modules, name or role
  useEffect(() => {
    const onRefreshed = (event: Event) => {
      setAccess(decodeAccess(localStorage.getItem('accessToken')));
      const fresh = (event as CustomEvent<{ user?: unknown }>).detail?.user;
      if (fresh && typeof fresh === 'object') {
        setUser((current) => {
          if (!current) return current;
          const merged = normalizeUser({ ...current, ...fresh });
          localStorage.setItem('user', JSON.stringify(merged));
          return merged;
        });
      }
    };
    window.addEventListener('app-token-refreshed', onRefreshed);
    return () => window.removeEventListener('app-token-refreshed', onRefreshed);
  }, [normalizeUser]);

  // Other tabs of this site share the session: follow a sign-out there, a sign-in (as anyone), or a renewal
  const userRef = useRef<User | null>(null);
  const loadingRef = useRef(true);
  useEffect(() => {
    userRef.current = user;
    loadingRef.current = loading;
  }, [user, loading]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== 'accessToken' || loadingRef.current) return;
      const current = userRef.current;
      if (!event.newValue) {
        if (current) logout(); // signed out in another tab
        return;
      }
      const subject = tokenPayload(event.newValue)?.sub;
      if (!current || sessionExpiredRef.current || (subject && subject !== current.username)) {
        // Signed in (again, or as someone else) in another tab: continue with that session
        clearSessionExpiredFlag();
        window.location.reload();
        return;
      }
      setAccess(decodeAccess(event.newValue)); // the other tab renewed the token
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [logout]);

  useEffect(() => {
    if (hasSessionExpiredFlag()) {
      setSessionExpired(true);
      sessionExpiredRef.current = true;
    }
  }, []);

  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        const config = response.config as any;
        if (wantsFeedback(config?.method, String(config?.url ?? ''))) {
          ToasterService.notifyIfPageSilent('success', successText(config.method), config._startedAt ?? Date.now());
        }
        return response;
      },
      async (error) => {
        if ((error?.config as any)?.skipSessionExpiredHandling) {
          return Promise.reject(error);
        }

        const status = error?.response?.status;
        // Expired access token: renew once with the refresh cookie and replay the request
        const config = error?.config as any;
        if (status === 401 && config && !config._retriedAfterRefresh) {
          config._retriedAfterRefresh = true;
          const result = await refreshAccessToken();
          if (result.status === 'ok') {
            config.headers = { ...(config.headers || {}), Authorization: `Bearer ${result.token}` };
            return axios(config);
          }
          if (result.status === 'unavailable') {
            notifyServerUnavailable();
            return Promise.reject(error);
          }
        }
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message;

        if (isSessionExpiredResponse(status, message)) {
          handleSessionExpired();
        } else if (config && wantsFeedback(config.method, String(config.url ?? ''))) {
          ToasterService.notifyIfPageSilent('error', errorText(error?.response?.data, status), config._startedAt ?? Date.now());
        }

        return Promise.reject(error);
      }
    );

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      // Most pages call fetch() directly: attach a Super Admin's selected tenant to API calls
      const [input, init] = args;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const tenantId = selectedTenantHeader();
      if (tenantId && url.includes('/v1/api/') && !url.includes('/v1/api/auth/')) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has(TENANT_HEADER)) headers.set(TENANT_HEADER, tenantId);
        args = [input, { ...init, headers }];
      }

      const startedAt = Date.now();
      const method = args[1]?.method ?? (args[0] instanceof Request ? args[0].method : 'GET');
      let response = await originalFetch(...args);

      // Expired access token: renew once with the refresh cookie and replay with the new token
      if (response.status === 401 && url.includes('/v1/api/') && !url.includes('/v1/api/auth/')) {
        const result = await refreshAccessToken();
        if (result.status === 'ok') {
          const [retryInput, retryInit] = args;
          const headers = new Headers(retryInit?.headers ?? (retryInput instanceof Request ? retryInput.headers : undefined));
          headers.set('Authorization', `Bearer ${result.token}`);
          response = await originalFetch(retryInput, { ...retryInit, headers });
        } else if (result.status === 'unavailable') {
          notifyServerUnavailable();
          return response;
        }
      }

      if (!response.ok) {
        let message = "";
        let data: any;

        try {
          const clonedResponse = response.clone();
          data = await clonedResponse.json();
          message = data?.message || data?.error || "";
        } catch (error) {
          try {
            message = await response.clone().text();
          } catch (innerError) {}
        }

        if (isSessionExpiredResponse(response.status, message)) {
          handleSessionExpired();
        } else if (wantsFeedback(method, url)) {
          ToasterService.notifyIfPageSilent('error', errorText(data, response.status), startedAt);
        }
      } else if (wantsFeedback(method, url)) {
        ToasterService.notifyIfPageSilent('success', successText(method), startedAt);
      }

      return response;
    };

    return () => {
      axios.interceptors.response.eject(responseInterceptor);
      window.fetch = originalFetch;
    };
  }, [handleSessionExpired]);

  // rememberMe false: the session ends when the browser is closed
  const login = async (username: string, password: string, rememberMe = true): Promise<LoginResponse> => {
    try {
      const res = await axios.post('/v1/api/auth/login', {
        username,
        password,
        rememberMe,
      });

      // Never log the response: it contains the access token
      if (res.data.token && res.data.user) {
        const { token, user } = res.data;
        const normalizedUser = normalizeUser(user);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        localStorage.setItem(SESSION_PERSISTENT_KEY, String(rememberMe));
        setSelectedTenant(null);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(normalizedUser);
        setAccess(decodeAccess(token));
        clearSessionExpiredFlag();
        setSessionExpired(false);
        sessionExpiredRef.current = false;
        window.dispatchEvent(new Event("app-login-success"));
        
        // Fetch profile image after login
        const loggedInId = normalizedUser.id || normalizedUser.userId;
        if (loggedInId) {
          void loadProfileImage(loggedInId, token);
        }
        
        return { token, user: normalizedUser };
      } else {
        throw new Error('No token received from server');
      }
    } catch (error: any) {
      // Not logged: the request inside the error holds the password
      let errorMessage = 'Login failed';
      
      if (error.response) {
        errorMessage = error.response.data?.message || 
                      error.response.data?.error || 
                      `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      throw new Error(errorMessage);
    }
  };

  // A password change ends every session started before it (server side), including this one;
  // sign in again with the new password so this tab carries on, keeping the "Keep me logged in" choice
  const reauthenticate = async (newPassword: string): Promise<void> => {
    const username = user?.username;
    if (!username) return;
    await login(username, newPassword, localStorage.getItem(SESSION_PERSISTENT_KEY) !== 'false');
  };

  const signup = async (fullName: string, role: string, email: string, password: string) => {
    try {
      const res = await axios.post('/v1/api/auth/register', { 
        fullName, 
        role, 
        email, 
        password 
      });
      
      if (res.data.token && res.data.user) {
        const { token, user } = res.data;
        const normalizedUser = normalizeUser(user);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(normalizedUser);
        setAccess(decodeAccess(token));

        return {
          success: true, 
          token, 
          user: normalizedUser,
          message: "Signup successful!"
        };
      } else {
        throw new Error('No token received from server');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      const errorMessage = error.response?.data?.message || error.message || 'Signup failed';
      return { 
        success: false, 
        message: errorMessage 
      };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      access,
      isLoggedIn: !!user,
      loading, 
      profileImage,
      hasProfileImage,
      login,
      reauthenticate,
      signup,
      logout,
      updateUser,
      updateProfileImage,
      refreshUserData,
      refreshProfileImage
    }}>
      {children}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-gray-900">Session Expired</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your session is out. Please login again. We saved your current page and unsaved draft data locally.
            </p>
            <button
              type="button"
              onClick={() => {
                logout({ preserveSessionRecovery: true });
                window.location.href = appUrl("/signin");
              }}
              className="mt-6 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

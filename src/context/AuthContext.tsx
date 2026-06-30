import { createContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  clearSessionExpiredRedirect,
  clearSessionExpiredFlag,
  clearSessionExpiredDraft,
  getCurrentAppLocation,
  hasSessionExpiredFlag,
  isSessionExpiredResponse,
  saveSessionExpiredRedirect,
  saveSessionExpiredDraft,
} from '../utils/sessionRecovery';

const getTenantIdFromToken = (token: string): string | null => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.tenantId || null;
  } catch (error) {
    console.error('Error parsing token for tenantId:', error);
    return null;
  }
};

// Function to get tenantId from available sources
const getTenantId = (): string | null => {
  // Check stored user first
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      if (user?.tenantId) return user.tenantId;
    } catch (e) {}
  }
  
  // Then check token
  const token = localStorage.getItem('accessToken');
  if (token) {
    return getTenantIdFromToken(token);
  }
  
  return null;
};

// Global Axios Request Interceptor to dynamically attach token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Skip for auth endpoints
    const isAuthEndpoint = config.url?.includes('/signin');
    
    if (!isAuthEndpoint) {
      const tenantId = getTenantId();
      
      if (tenantId) {
        // Tenant-aware APIs expect this as a header. Adding it globally as
        // a query parameter breaks endpoints such as /v1/api/product-categories.
        config.headers['X-Tenant-ID'] = tenantId;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


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
  isLoggedIn: boolean;
  loading: boolean;
  profileImage: string;
  login: (username: string, password: string) => Promise<LoginResponse>;
  signup: (fullName: string, role: string, email: string, password: string) => Promise<any>;
  logout: (options?: { preserveSessionRecovery?: boolean }) => void;
  updateUser: (userData: User) => void;
  updateProfileImage: (imageUrl: string) => void;
  refreshUserData: () => Promise<void>;
  refreshProfileImage: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: false,
  profileImage: "src/images/img-placeholder.png",
  login: async () => { throw new Error('Login function not implemented'); },
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
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState("src/images/img-placeholder.png");
  const [sessionExpired, setSessionExpired] = useState(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const sessionExpiredRef = useRef(false);

  const completeAuthBootstrap = useCallback(() => {
    setLoading(false);
    window.dispatchEvent(new Event("app-auth-bootstrap-complete"));
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

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setProfileImage("src/images/img-placeholder.png");
    setSessionExpired(false);
    sessionExpiredRef.current = false;
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
     // inactivityTimerRef.current = null;
    }
  }, []);

  const handleSessionExpired = useCallback(() => {
    if (sessionExpiredRef.current) {
      return;
    }

    sessionExpiredRef.current = true;
    saveSessionExpiredRedirect(getCurrentAppLocation());
    saveSessionExpiredDraft(getCurrentAppLocation());
    setSessionExpired(true);
  }, []);

  const updateUser = useCallback((userData: User) => {
    const normalized = normalizeUser(userData);
    setUser(normalized);
    localStorage.setItem('user', JSON.stringify(normalized));
  }, [normalizeUser]);

  const updateProfileImage = useCallback((imageUrl: string) => {
    setProfileImage(imageUrl);
  }, []);

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

    try {
      const authToken = localStorage.getItem('accessToken');
      if (!authToken) {
        console.error("No authentication token found");
        return;
      }

      const response = await fetch(`/v1/api/user/${userId}/image?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
        setProfileImage(imageUrl);
      } else {
        console.log("No profile image found, using default");
        setProfileImage("src/images/img-placeholder.png");
      }
    } catch (error) {
      console.error("Error fetching user image:", error);
      setProfileImage("src/images/img-placeholder.png");
    }
  }, [user]);

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
      if (storedToken && storedUser) {
        const userData = normalizeUser(JSON.parse(storedUser));
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Fetch profile image after setting user
        const userId = userData?.id || userData?.userId;
        if (userId && storedToken) {
          try {
            const response = await fetch(`/v1/api/user/${userId}/image?t=${Date.now()}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${storedToken}`,
              },
            });

            if (response.ok) {
              const imageBlob = await response.blob();
              const imageUrl = URL.createObjectURL(imageBlob);
              setProfileImage(imageUrl);
            }
          } catch (error) {
            console.error("Error fetching initial user image:", error);
          }
        }
        
        completeAuthBootstrap();
      } else if (storedToken) {
        try {
          const res = await axios.get('/api/me');
          const userData = normalizeUser(res.data.user);
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err) {
          console.error('Session expired');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          setUser(null);
        } finally {
          completeAuthBootstrap();
        }
      } else {
        completeAuthBootstrap();
      }
    };

    initializeAuth();
  }, [completeAuthBootstrap, normalizeUser]); // Empty dependency array - runs only once on mount

  useEffect(() => {
    if (hasSessionExpiredFlag()) {
      setSessionExpired(true);
      sessionExpiredRef.current = true;
    }
  }, []);

  useEffect(() => {
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if ((error?.config as any)?.skipSessionExpiredHandling) {
          return Promise.reject(error);
        }

        const status = error?.response?.status;
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message;

        if (isSessionExpiredResponse(status, message)) {
          handleSessionExpired();
        }

        return Promise.reject(error);
      }
    );

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (!response.ok) {
        let message = "";

        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          message = data?.message || data?.error || "";
        } catch (error) {
          try {
            message = await response.clone().text();
          } catch (innerError) {}
        }

        if (isSessionExpiredResponse(response.status, message)) {
          handleSessionExpired();
        }
      }

      return response;
    };

    return () => {
      axios.interceptors.response.eject(responseInterceptor);
      window.fetch = originalFetch;
    };
  }, [handleSessionExpired]);

  const login = async (username: string, password: string): Promise<LoginResponse> => {
    try {
      console.log('Sending login request with:', { username });
      
      const res = await axios.post('/v1/api/auth/login', { 
        username,
        password 
      });
      
      console.log('Login response:', res.data);
      
      if (res.data.token && res.data.user) {
        const { token, user } = res.data;
        const normalizedUser = normalizeUser(user);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(normalizedUser);
        clearSessionExpiredRedirect();
        setSessionExpired(false);
        sessionExpiredRef.current = false;
        window.dispatchEvent(new Event("app-login-success"));
        
        // Fetch profile image after login
        setTimeout(() => {
          refreshProfileImage();
        }, 100);
        
        return { token, user: normalizedUser };
      } else {
        throw new Error('No token received from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
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
      isLoggedIn: !!user, 
      loading, 
      profileImage,
      login, 
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
                window.location.href = "/signin";
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

import { useState, useContext, useEffect, useCallback, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { ToasterService } from "../../Services/ToasterService";

interface UserDetails {
  country?: string;
  city?: string;
  imageName?: string;
  imageType?: string;
}

interface UserData {
  id?: string;
  userId?: string;
  username?: string;
  email?: string;
  fullName?: string;
  active?: string;
  role?: string;
  userDetails?: UserDetails;
}

interface PasswordValidation {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  specialChar: boolean;
}

const API_ENDPOINTS = [
  '/v1/api/user',
  '/v1/api/user/getUserById',
  '/v1/api/user/profile'
];

const getInitials = (fullName: string): string => {
  if (!fullName) return "U";
  
  const names = fullName.trim().split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

const generateInitialsImage = (fullName: string, size: number = 200): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return "src/images/img-placeholder.png";

  const tealColor = '#14B8A6'; // Beautiful teal color

  ctx.fillStyle = tealColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.4}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const initials = getInitials(fullName);
  ctx.fillText(initials, size / 2, size / 2);

  return canvas.toDataURL('image/png');
};

export default function ResetPasswordCard() {
  const [showPopup, setShowPopup] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<PasswordValidation>({
    length: false,
    uppercase: false,
    number: false,
    specialChar: false,
  });
  const { user, isLoggedIn, loading } = useContext(AuthContext);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userError, setUserError] = useState("");
  const [userLocation, setUserLocation] = useState({
    country: "",
    city: ""
  });
  const [profileImage, setProfileImage] = useState("src/images/img-placeholder.png");
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [isDefaultImage, setIsDefaultImage] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  const getAuthToken = useCallback(() => {
    return localStorage.getItem('accessToken');
  }, []);

  const getStoredUser = useCallback((): UserData | null => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }, []);

  const fetchUserImage = useCallback(async () => {
    const storedUser = getStoredUser();
    const userId = user?.id || user?.userId || storedUser?.id || storedUser?.userId;
    
    if (!userId) {
      console.error("No user ID found for image fetch");
      return;
    }

    try {
      const authToken = getAuthToken();
      const response = await fetch(`/v1/api/user/${userId}/image`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
        setProfileImage(imageUrl);
        setIsDefaultImage(false);
      } else {
        console.log("No profile image found, using default");
        // Generate initials image when no profile image is found
        const displayName = getDisplayName();
        const initialsImage = generateInitialsImage(displayName);
        setProfileImage(initialsImage);
        setIsDefaultImage(true);
      }
    } catch (error) {
      console.error("Error fetching user image:", error);
      // Generate initials image on error
      const displayName = getDisplayName();
      const initialsImage = generateInitialsImage(displayName);
      setProfileImage(initialsImage);
      setIsDefaultImage(true);
    }
  }, [user, getAuthToken, getStoredUser]);

  const fetchUserProfile = useCallback(async () => {
    const storedUser = getStoredUser();
    const userId = user?.id || user?.userId || storedUser?.id || storedUser?.userId;
    
    if (!userId) {
      setIsFetchingLocation(false);
      return;
    }

    setIsFetchingLocation(true);
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error("No authentication token");
      }

      let userData: UserData | null = null;

      for (const baseEndpoint of API_ENDPOINTS) {
        try {
          const endpoint = `${baseEndpoint}/${userId}`;
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            userData = await response.json();
            setUserData(userData);
            break;
          }
        } catch (error) {
          console.warn(`Endpoint failed:`, error);
        }
      }

      if (userData) {
        setUserLocation({
          country: userData.userDetails?.country || "Not set",
          city: userData.userDetails?.city || "Not set"
        });
      } else {
        const fallbackUser = getStoredUser();
        if (fallbackUser) {
          setUserLocation({
            country: fallbackUser.userDetails?.country || "Not set",
            city: fallbackUser.userDetails?.city || "Not set"
          });
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      const fallbackUser = getStoredUser();
      if (fallbackUser) {
        setUserLocation({
          country: fallbackUser.userDetails?.country || "Not set",
          city: fallbackUser.userDetails?.city || "Not set"
        });
      }
    } finally {
      setIsFetchingLocation(false);
    }
  }, [user, getAuthToken, getStoredUser]);

  useEffect(() => {
    fetchUserProfile();
    fetchUserImage();
  }, [user, fetchUserProfile, fetchUserImage]);

  useEffect(() => {
    if (showPopup) {
      if (!user) {
        setUserError("Please log in to reset your password.");
      } else if (!user.userId) {
        setUserError("User ID not available. Please try logging in again.");
      } else {
        setUserError("");
      }
    }
  }, [showPopup, user]);

  const validatePassword = useCallback((password: string): boolean => {
    const newErrors = {
      length: password.length < 8,
      uppercase: !/[A-Z]/.test(password),
      number: !/[0-9]/.test(password),
      specialChar: !/[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setPasswordErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  }, []);

  const validateConfirmPassword = useCallback((confirmPass: string): boolean => {
    if (confirmPass !== newPassword) {
      setConfirmPasswordError("Passwords do not match");
      return false;
    }
    setConfirmPasswordError("");
    return true;
  }, [newPassword]);

  const handleSave = async () => {
    if (!user) {
      alert("Please log in to reset your password.");
      return;
    }
    if (!user.userId) {
      alert("User ID not available. Please try logging in again.");
      window.location.href = "/signin"; 
      return;
    }
   
    const isNewPasswordValid = validatePassword(newPassword);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword);

    if (!isNewPasswordValid || !isConfirmPasswordValid) {
      return;
    }

    setIsLoading(true);

    try {
      const token = getAuthToken();
      
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const url = `/v1/api/user/update/${user.userId}/${newPassword}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        throw new Error("Authentication failed. Please log in again.");
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to reset password';
        
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          errorMessage = errorText || response.statusText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      await response.json();
      setShowPopup(false);
      resetForm();
      ToasterService.success("Password reset successfully!");
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes("Authentication failed") || error.message.includes("Unauthorized")) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          ToasterService.error("Session expired. Please log in again.");
          window.location.reload();
        } else {
          ToasterService.error(error.message || "Failed to reset password. Please try again.");
        }
      } else {
        ToasterService.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrors({
      length: false,
      uppercase: false,
      number: false,
      specialChar: false,
    });
    setConfirmPasswordError("");
    setUserError("");
  };

  const handleClose = () => {
    setShowPopup(false);
    resetForm();
  };

  const canResetPassword = useMemo(() => 
    user && user.userId && isLoggedIn, 
    [user, isLoggedIn]
  );

  const isResetDisabled = useMemo(() => 
    !newPassword || 
    !confirmPassword || 
    Object.values(passwordErrors).some(Boolean) || 
    !!confirmPasswordError || 
    isLoading ||
    !canResetPassword,
    [newPassword, confirmPassword, passwordErrors, confirmPasswordError, isLoading, canResetPassword]
  );

  const getDisplayName = useCallback(() => {
    return userData?.fullName || user?.fullName || user?.username || "Guest User";
  }, [userData, user]);

  const getDisplayRole = useCallback(() => {
    return userData?.role || user?.role || "Team Manager";
  }, [userData, user]);

  return (
    <>
      {/* User Profile Card - Full Width */}
      <div className="w-full bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col items-center w-full space-y-6">
          {/* Profile Section */}
          <div className="flex flex-col items-center w-full space-y-4">
            {/* Profile Image with Hover and Click Effects */}
            <div className="relative group">
              <div className="w-20 h-20 overflow-hidden border-4 border-white shadow-sm rounded-full dark:border-gray-800 cursor-pointer transition-all duration-300 group-hover:shadow-2xl group-hover:scale-105 bg-gray-100">
                {isDefaultImage ? (
                  // Show the generated initials image
                  <img 
                    src={profileImage} 
                    alt="user" 
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-125"
                  />
                ) : (
                  // Show uploaded image
                  <img 
                    src={profileImage} 
                    alt="user" 
                    className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-125"
                    onError={(e) => {
                      e.currentTarget.src = "src/images/img-placeholder.png";
                    }}
                  />
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <svg 
                    className="w-6 h-6 text-white transform scale-75 transition-transform duration-300 group-hover:scale-100" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="text-center space-y-2 order-3 w-full">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                {getDisplayName()}
              </h4>
              <div className="flex flex-col items-center space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getDisplayRole()}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {isFetchingLocation ? (
                        <span className="inline-block w-16 h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      ) : (
                        userLocation.city
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {isFetchingLocation ? (
                        <span className="inline-block w-20 h-3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      ) : (
                        userLocation.country
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Password Button */}
          {!isLoggedIn ? (
            <div className="w-full text-center py-3 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please log in to reset your password
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowPopup(true)}
              disabled={loading || isFetchingLocation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 18 18">
                <path fillRule="evenodd" clipRule="evenodd" d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z" />
              </svg>
              <span>
                {isFetchingLocation ? "Loading..." : "Reset Password"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {showPopup && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 backdrop-blur-sm"
            onClick={handleClose}
          />
          
          {/* Modal - Centered properly */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg transform transition-all">
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white/90">
                  Reset Your Password
                </h4>
              </div>

              <div className="px-6 py-4">
                {userError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {userError}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
                  {/* New Password Field */}
                  <div className="space-y-2">
                    <Label className="dark:text-gray-300">New Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          validatePassword(e.target.value);
                        }}
                        placeholder="Enter new password"
                        disabled={isLoading || !canResetPassword}
                        className="w-full pl-3 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                        disabled={isLoading || !canResetPassword}
                      >
                        {showNewPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Password Requirements */}
                    {newPassword && Object.values(passwordErrors).some(Boolean) && (
                      <div className="space-y-1 pt-2">
                        <ul className="space-y-1">
                          {passwordErrors.length && (
                            <li className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Minimum 8 characters
                            </li>
                          )}
                          {passwordErrors.uppercase && (
                            <li className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              At least one uppercase letter
                            </li>
                          )}
                          {passwordErrors.number && (
                            <li className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              At least one number
                            </li>
                          )}
                          {passwordErrors.specialChar && (
                            <li className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              At least one special character
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label className="dark:text-gray-300">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          validateConfirmPassword(e.target.value);
                        }}
                        placeholder="Confirm new password"
                        disabled={isLoading || !canResetPassword}
                        className={`w-full pl-3 pr-10 py-2.5 border rounded focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none ${
                          confirmPasswordError ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                        } dark:bg-gray-700 dark:text-white`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                        disabled={isLoading || !canResetPassword}
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {confirmPasswordError && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {confirmPasswordError}
                      </div>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="px-5 py-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Close
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isResetDisabled}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Resetting...</span>
                        </div>
                      ) : (
                        "Reset Password"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
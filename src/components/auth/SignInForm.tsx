import React, { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { clearSessionExpiredRedirect, getSessionExpiredRedirect } from "../../utils/sessionRecovery";
import './Login.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

type FormValues = {
  email: string;  // Changed from 'username' to 'email'
  password: string;
};

const SignInForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      console.log("Attempting login with:", data.email);

      const result = await login(data.email, data.password);
      console.log("Login successful:", result);

      // Store tokens and user data
      if (result.token) {
        localStorage.setItem("accessToken", result.token);
      }
      if (result.user) {
        localStorage.setItem("user", JSON.stringify(result.user));
      }

      // Small delay to ensure state updates
      const redirectPath = getSessionExpiredRedirect() || "/";
      clearSessionExpiredRedirect();

      setTimeout(() => {
        navigate(redirectPath);
      }, 100);

    } catch (err: any) {
      console.error("Login error:", err);

      let errorMessage = "Login failed! Check your credentials.";

      if (err.response?.status === 403) {
        errorMessage = "Access denied. Please check your email and password.";
      } else if (err.response?.status === 401) {
        errorMessage = "Invalid email or password.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 shadow-2xl rounded-3xl p-8 sm:p-10 relative overflow-hidden">
      <div className="w-full relative z-10 space-y-6 transition-all duration-300">

        {/* Header Section */}
        <div className="space-y-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white text-center tracking-tight">
            My Trading
          </h1>
          <p className="text-center text-sm font-semibold text-cyan-700 dark:text-cyan-400">
            Welcome Back!
          </p>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
            Enter your email and password to sign in
          </p>
        </div>

        {/* Display API Error */}
        {apiError && (
          <div className="bg-red-50/90 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 dark:text-gray-400 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors">
                <i className="fas fa-envelope text-base"></i>
              </div>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 rounded-xl border ${errors.email ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:ring-cyan-400/50 dark:focus:border-cyan-400 transition-all duration-300 shadow-sm`}
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Please enter a valid email",
                  },
                })}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-1">
                <i className="fas fa-info-circle text-xs"></i> {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 dark:text-gray-400 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors">
                <i className="fas fa-lock text-base"></i>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Your Password"
                autoComplete="current-password"
                className={`w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-900 rounded-xl border ${errors.password ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:ring-cyan-400/50 dark:focus:border-cyan-400 transition-all duration-300 shadow-sm`}
                {...register("password", {
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters",
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400 focus:outline-none transition-colors"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-base`}></i>
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-1">
                <i className="fas fa-info-circle text-xs"></i> {errors.password.message}
              </p>
            )}
          </div>

          {/* Checkbox & Forgot Password */}
          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => setIsChecked(!isChecked)}
                  className="peer appearance-none w-4 h-4 border-2 border-gray-400 dark:border-gray-500 rounded checked:bg-cyan-600 checked:border-cyan-600 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 dark:focus:ring-offset-gray-900 bg-white dark:bg-gray-900"
                />
                <i className="fas fa-check absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200"></i>
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                Keep me logged in
              </span>
            </label>
            <Link
              to="/forgetpassword"
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 mt-1 h-[46px] bg-gradient-to-r from-cyan-500 via-cyan-600 to-sky-600 hover:from-cyan-600 hover:via-cyan-700 hover:to-sky-700 text-white !text-white font-extrabold rounded-2xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-600/40 transform hover:-translate-y-0.5 transition-all duration-300 group relative flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
          >
            <span className="text-white !text-white tracking-wider uppercase text-xs font-extrabold text-center">
              {isLoading ? "Signing In..." : "Sign In"}
            </span>
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin text-white !text-white absolute left-4 text-xs"></i>
            ) : (
              <i className="fas fa-arrow-right text-xs text-white !text-white absolute right-4 transform group-hover:translate-x-1.5 transition-transform duration-200"></i>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700/50 text-center space-y-2">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            <Link to="/termsandconditions" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
              Terms & Conditions
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInForm;

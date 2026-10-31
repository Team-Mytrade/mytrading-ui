import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext, SSO_REMEMBER_KEY } from "../../context/AuthContext";
import { clearSessionExpiredRedirect, getSessionExpiredRedirect } from "../../utils/sessionRecovery";
import { t } from "../../i18n/i18n";
import { ToasterService } from "../../Services/ToasterService";
import MfaSignInSteps from "./MfaSignInSteps";
import { applyBrandColor } from "../../company/brand";
import '../../styles/Login.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

type FormValues = {
  email: string;
  password: string;
};

const SignInForm: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>();
  const [searchParams] = useSearchParams();
  // Single sign-on providers of the email's company (Microsoft, Google), once the email is typed
  const [providers, setProviders] = useState<string[]>([]);
  const email = watch("email") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // The password was right and a code is owed (two-step sign-in)
  const [mfa, setMfa] = useState<{ setup: boolean; mfaToken: string } | null>(null);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  // At a company's own address (gulf.mytrade.app): its name, logo, colour and SSO buttons; null at the main address
  const [company, setCompany] = useState<{ companyName: string; brandColor: string | null; hasLogo: boolean; ssoProviders: string[] } | null>(null);
  const host = window.location.host;

  useEffect(() => {
    axios.get("/v1/api/user/public/branding", { params: { host } })
      .then((r) => {
        if (r.status !== 200 || !r.data?.companyName) return;
        setCompany(r.data);
        if (r.data.brandColor) applyBrandColor(r.data.brandColor);
      })
      .catch(() => setCompany(null));
  }, [host]);
  const shownProviders = Array.from(new Set([...(company?.ssoProviders ?? []), ...providers]));

  // Coming back from a single sign-on that didn't work
  useEffect(() => {
    const ssoError = searchParams.get("ssoError");
    if (ssoError) setApiError(ssoError);
  }, [searchParams]);

  useEffect(() => {
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setProviders([]);
      return;
    }
    const timer = window.setTimeout(() => {
      axios.get<{ providers: string[] }>("/v1/api/auth/sso/discover", { params: { email: value } })
        .then((r) => setProviders(Array.isArray(r.data?.providers) ? r.data.providers : []))
        .catch(() => setProviders([]));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [email]);

  const signInWith = (provider: string) => {
    try {
      sessionStorage.setItem(SSO_REMEMBER_KEY, String(isChecked));
    } catch {
      // Private mode: a browser-only session
    }
    window.location.assign(`/v1/api/auth/sso/start?${new URLSearchParams({ email: email.trim(), provider, remember: String(isChecked), host })}`);
  };

  const goIn = (notice?: string) => {
    if (notice) ToasterService.warning(t(notice));
    const redirectPath = getSessionExpiredRedirect() || "/";
    clearSessionExpiredRedirect();
    navigate(redirectPath);
  };

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      // "Keep me logged in" off: the session ends when the browser is closed
      const result = await login(data.email, data.password, isChecked);
      if (result.mfa) {
        setMfa(result.mfa);
        return;
      }
      goIn();

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
    <div className="w-full max-w-md bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] rounded-3xl p-8 sm:p-10 relative overflow-hidden">
      <div className="w-full relative z-10 space-y-6 transition-all duration-300">

        {/* Header Section */}
        <div className="space-y-1.5 pb-4 border-b border-gray-100 dark:border-gray-800">
          {company?.hasLogo && (
            <img src={`/v1/api/user/public/branding/logo?host=${encodeURIComponent(host)}`} alt={company.companyName}
              className="mx-auto mb-2 max-h-14 max-w-[70%] object-contain" />
          )}
          <h1 className="text-3xl font-black text-gray-900 dark:text-white text-center tracking-tight">
            {company ? company.companyName : t("My Trading")}
          </h1>
          <p className="text-center text-sm font-semibold text-cyan-700 dark:text-cyan-400">
            {t("Welcome Back!")}
          </p>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="bg-red-50/90 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {t(apiError)}
          </div>
        )}

        {mfa ? (
          <MfaSignInSteps mfa={mfa} rememberMe={isChecked} onDone={goIn} onCancel={() => setMfa(null)} />
        ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Email or Username Field */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
              {t("Email or Username")} <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 dark:text-gray-400 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors">
                <i className="fas fa-envelope text-base"></i>
              </div>
              <input
                id="email"
                type="text"
                placeholder={t("you@example.com or username")}
                autoComplete="username"
                disabled={isLoading}
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 rounded-xl border ${errors.email ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:ring-cyan-400/50 dark:focus:border-cyan-400 transition-all duration-300 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
                {...register("email", {
                  required: "Email or Username is required",
                  validate: (value) => {
                    if (!value) return "Email or Username is required";
                    if (value.includes("@")) {
                      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                      return emailRegex.test(value) || "Please enter a valid email";
                    }
                    return true;
                  }
                })}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-1">
                <i className="fas fa-info-circle text-xs"></i> {t(String(errors.email.message ?? ""))}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
              {t("Password")} <span className="text-red-500">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 dark:text-gray-400 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors">
                <i className="fas fa-lock text-base"></i>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("Your Password")}
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={`w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-900 rounded-xl border ${errors.password ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'} text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 dark:focus:ring-cyan-400/50 dark:focus:border-cyan-400 transition-all duration-300 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed`}
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
                disabled={isLoading}
                aria-label={t(showPassword ? "Hide password" : "Show password")}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-base`} aria-hidden="true"></i>
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-1">
                <i className="fas fa-info-circle text-xs"></i> {t(String(errors.password.message ?? ""))}
              </p>
            )}
          </div>

          {/* Checkbox & Forgot Password */}
          <div className="flex items-center justify-between pt-0.5">
            <label htmlFor="keep-logged-in" className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  id="keep-logged-in"
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => setIsChecked(!isChecked)}
                  disabled={isLoading}
                  className="peer appearance-none w-[18px] h-[18px] border-2 border-gray-400 dark:border-gray-500 rounded checked:bg-cyan-600 checked:border-cyan-600 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-1 dark:focus:ring-offset-gray-900 bg-white dark:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <i className="fas fa-check absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[11px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity duration-200" aria-hidden="true"></i>
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                {t("Keep me logged in")}
              </span>
            </label>
            <Link
              to="/forgetpassword"
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors"
            >
              {t("Forgot Password?")}
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 mt-1 h-[46px] bg-gradient-to-r from-cyan-500 via-cyan-600 to-sky-600 hover:from-cyan-600 hover:via-cyan-700 hover:to-sky-700 text-white !text-white font-extrabold rounded-2xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-600/40 transform hover:-translate-y-0.5 transition-all duration-300 group relative flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
          >
            <span className="text-white !text-white tracking-wider uppercase text-xs font-extrabold text-center">
              {t(isLoading ? "Signing In..." : "Sign In")}
            </span>
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin text-white !text-white absolute left-4 text-xs"></i>
            ) : (
              <i className="fas fa-arrow-right text-xs text-white !text-white absolute right-4 transform group-hover:translate-x-1.5 transition-transform duration-200"></i>
            )}
          </button>
        </form>
        )}

        {/* Single sign-on: the company of this email signs in with Microsoft or Google */}
        {!mfa && shownProviders.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />{t("or")}<span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>
            {shownProviders.map((provider) => (
              <button key={provider} type="button" onClick={() => signInWith(provider)} disabled={isLoading || !email.includes("@")}
                title={email.includes("@") ? undefined : t("Enter your work email first")}
                className="flex h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white text-sm font-bold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800">
                <i className={`fab ${provider === "MICROSOFT" ? "fa-microsoft" : "fa-google"}`} aria-hidden="true"></i>
                {t(provider === "MICROSOFT" ? "Continue with Microsoft" : "Continue with Google")}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700/50 text-center space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <Link
              to="/termsandconditions"
              className="font-semibold text-cyan-600 dark:text-cyan-400 underline underline-offset-2 hover:text-cyan-800 dark:hover:text-cyan-300 transition-colors"
            >
              {t("Terms & Conditions")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInForm;

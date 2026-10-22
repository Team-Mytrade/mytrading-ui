import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

/** Opened from the emailed reset link (?token=...). The token works once and expires after 30 minutes. */
const ResetPasswordForm = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/v1/api/auth/reset_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (response.ok) {
        setDone(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data?.error || Object.values(data ?? {})[0]?.toString() || "Reset link is invalid or has expired.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "form-control w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-teal-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  return (
    <div className="auth-left min-h-screen bg-gray-50 dark:bg-gray-900 overflow-y-auto flex justify-center items-center p-10 no-scrollbar">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 space-y-6">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center">Set a new password</h1>

        {!token ? (
          <p className="text-center text-red-500">
            This reset link is incomplete. Request a new one from{" "}
            <Link to="/forgetpassword" className="text-teal-500 font-medium">Forgot Password</Link>.
          </p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              Your password has been reset.
            </div>
            <Link to="/signin" className="text-teal-500 hover:text-teal-400 font-medium">Go to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="text-gray-700 dark:text-gray-200">New password</label>
              <input type="password" autoComplete="new-password" className={inputClass} value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="text-gray-700 dark:text-gray-200">Confirm new password</label>
              <input type="password" autoComplete="new-password" className={inputClass} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <small className="text-red-500">{error}</small>}
            <button
              type="submit"
              disabled={isLoading || !password || !confirm}
              className={`w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold rounded-lg shadow-lg ${isLoading || !password || !confirm ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isLoading ? "Saving..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordForm;

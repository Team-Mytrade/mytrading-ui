import { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { clearSessionExpiredRedirect, getSessionExpiredRedirect } from "../../utils/sessionRecovery";
import { t } from "../../i18n/i18n";

/** Where single sign-on comes back to: the server set the session cookie; this signs the app in and goes on. */
export default function SsoComplete() {
  const { completeSso } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Once, even when React runs effects twice in development
    if (started.current) return;
    started.current = true;
    completeSso()
      .then(() => {
        const redirectPath = getSessionExpiredRedirect() || "/";
        clearSessionExpiredRedirect();
        navigate(redirectPath, { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [completeSso, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg dark:bg-gray-900">
        {error ? (
          <>
            <p className="text-sm text-red-600">{t(error)}</p>
            <Link to="/signin" className="mt-4 inline-block text-xs font-semibold text-cyan-600 hover:underline">{t("Back to sign-in")}</Link>
          </>
        ) : (
          <p className="text-sm text-slate-600 dark:text-gray-300">{t("Signing you in…")}</p>
        )}
      </div>
    </div>
  );
}

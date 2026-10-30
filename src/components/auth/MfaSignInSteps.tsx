import React, { useContext, useEffect, useState } from "react";
import { AuthContext, MfaSetup } from "../../context/AuthContext";
import { t } from "../../i18n/i18n";

interface Props {
  mfa: { setup: boolean; mfaToken: string };
  rememberMe: boolean;
  // Signed in; notice: e.g. how many recovery codes are left
  onDone: (notice?: string) => void;
  onCancel: () => void;
}

const INPUT =
  "w-full px-4 py-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-600 text-center text-lg tracking-[0.3em] font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500";
const BUTTON =
  "w-full h-[46px] rounded-2xl bg-gradient-to-r from-cyan-500 via-cyan-600 to-sky-600 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-cyan-500/20 disabled:opacity-60";
const LINK = "text-xs font-semibold text-cyan-600 hover:text-cyan-800 dark:text-cyan-400";

/**
 * The second step of sign-in: the code from the authenticator app (or a recovery code); or, when the company
 * requires two-step sign-in and the app isn't set up yet, the QR code, its first code and the recovery codes.
 */
const MfaSignInSteps: React.FC<Props> = ({ mfa, rememberMe, onDone, onCancel }) => {
  const { completeMfa, startMfaSetup, finishMfaSetup } = useContext(AuthContext);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mfa.setup) return;
    startMfaSetup(mfa.mfaToken).then(setSetup).catch((err) => setError(err.message));
  }, [mfa, startMfaSetup]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mfa.setup) {
        const result = await finishMfaSetup(mfa.mfaToken, code.trim(), rememberMe);
        // Signed in; the codes are shown once before going on
        setRecoveryCodes(result.recoveryCodes ?? []);
      } else {
        const result = await completeMfa(mfa.mfaToken, code.trim(), rememberMe);
        onDone(result.notice);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([`myTrading recovery codes\n\n${(recoveryCodes ?? []).join("\n")}\n\nEach code works once.\n`], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mytrading-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (recoveryCodes) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("Save your recovery codes")}</h2>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {t("If you lose your phone, each of these codes lets you sign in once. Keep them somewhere safe; they won't be shown again.")}
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 font-mono text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
          {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="flex gap-3">
          <button type="button" className={LINK} onClick={download}>{t("Download")}</button>
          <button type="button" className={LINK} onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n"))}>{t("Copy")}</button>
        </div>
        <button type="button" className={BUTTON} onClick={() => onDone()}>{t("I've saved them, continue")}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mfa.setup ? (
        <>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("Set up two-step sign-in")}</h2>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {t("Your company requires a code from an authenticator app (Microsoft Authenticator, Google Authenticator…) at sign-in. Scan this QR code with the app, then enter the 6-digit code it shows.")}
          </p>
          {setup ? (
            <div className="flex flex-col items-center gap-2">
              <img src={setup.qrDataUri} alt={t("QR code for the authenticator app")} className="h-44 w-44 rounded-lg border border-gray-200 bg-white p-1" />
              <p className="text-[11px] text-gray-500">{t("Can't scan? Enter this key in the app:")}</p>
              <code className="select-all break-all rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800 dark:text-gray-100">{setup.secret}</code>
            </div>
          ) : !error && <p className="text-center text-xs text-gray-500">{t("Loading...")}</p>}
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("Two-step sign-in")}</h2>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {t(useRecovery ? "Enter one of your recovery codes. Each works once." : "Enter the 6-digit code from your authenticator app.")}
          </p>
        </>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-2 text-xs font-medium text-red-600 dark:border-red-800/50 dark:bg-red-900/30 dark:text-red-400">
          {t(error)}
        </div>
      )}

      <input
        autoFocus
        className={INPUT}
        value={code}
        onChange={(e) => setCode(useRecovery ? e.target.value.toUpperCase().slice(0, 11) : e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode={useRecovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        placeholder={useRecovery ? "XXXXX-XXXXX" : "000000"}
        aria-label={t(useRecovery ? "Recovery code" : "Code")}
      />
      <button type="submit" className={BUTTON} disabled={busy || (useRecovery ? code.replace("-", "").length !== 10 : code.length !== 6) || (mfa.setup && !setup)}>
        {t(busy ? "Checking..." : "Continue")}
      </button>
      <div className="flex justify-between">
        {!mfa.setup ? (
          <button type="button" className={LINK} onClick={() => { setUseRecovery(!useRecovery); setCode(""); setError(null); }}>
            {t(useRecovery ? "Use the authenticator app" : "Use a recovery code")}
          </button>
        ) : <span />}
        <button type="button" className={LINK} onClick={onCancel}>{t("Back to sign-in")}</button>
      </div>
    </form>
  );
};

export default MfaSignInSteps;

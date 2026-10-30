import { useEffect, useState } from "react";
import axios from "axios";
import { ShieldCheck } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { CARD, CARD_TITLE, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { ADD_BUTTON_COLORS } from "../../components/common/AddButton";
import { t } from "../../i18n/i18n";

const API = "/v1/api/user/mfa/me";

interface Status {
  enabled: boolean;
  required: boolean;
  asked: boolean;
  policy: string;
  recoveryCodesLeft: number;
  available: boolean;
}

interface Setup {
  secret: string;
  otpauthUri: string;
  qrDataUri: string;
}

const CODE_INPUT =
  "w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm tracking-[0.25em] text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

/**
 * The signed-in user's two-step sign-in: turning the authenticator app on (QR code, first code, recovery codes),
 * new recovery codes, and turning it off (unless the company requires it). Each change needs a current code.
 */
export default function TwoStepSignInCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [action, setAction] = useState<"disable" | "recovery" | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => axios.get<Status>(API).then((r) => setStatus(r.data)).catch(() => setStatus(null));
  useEffect(() => {
    load();
  }, []);

  const run = async (work: () => Promise<void>, failed: string) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      ToasterService.error(errorText(err, t(failed)));
    } finally {
      setBusy(false);
    }
  };

  const start = () => run(async () => {
    const res = await axios.post<Setup>(`${API}/setup`);
    setSetup(res.data);
    setCode("");
  }, "Could not start the set-up.");

  const enable = () => run(async () => {
    const res = await axios.post<{ recoveryCodes: string[] }>(`${API}/enable`, { code });
    setSetup(null);
    setCodes(res.data.recoveryCodes);
    setCode("");
    ToasterService.success(t("Two-step sign-in is on."));
    await load();
  }, "That code doesn't match.");

  const confirm = () => run(async () => {
    if (action === "recovery") {
      const res = await axios.post<{ recoveryCodes: string[] }>(`${API}/recovery-codes`, { code });
      setCodes(res.data.recoveryCodes);
    } else {
      await axios.post(`${API}/disable`, { code });
      ToasterService.success(t("Two-step sign-in is off."));
    }
    setAction(null);
    setCode("");
    await load();
  }, "That code doesn't match.");

  const download = () => {
    const blob = new Blob([`myTrading recovery codes\n\n${(codes ?? []).join("\n")}\n\nEach code works once.\n`], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mytrading-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!status) return null;

  return (
    <section className={`${CARD} p-4`}>
      <h3 className={`${CARD_TITLE} mb-3 flex items-center gap-2`}>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        {t("Two-step sign-in")}
      </h3>

      <p className="text-sm text-slate-700 dark:text-gray-300">
        {status.enabled
          ? t(status.asked ? "On: sign-in asks for a code from your authenticator app." : "Set up, but your company has turned two-step sign-in off.")
          : t(status.required ? "Your company requires it; you'll set it up at your next sign-in, or now." : "Off: your password alone signs you in.")}
      </p>
      {status.enabled && (
        <p className="mt-1 text-xs text-slate-500">{t("Recovery codes left")}: {status.recoveryCodesLeft}</p>
      )}
      {!status.available && !status.enabled && (
        <p className="mt-1 text-xs text-slate-500">{t("Not available: your company has it turned off, or the server isn't set up for it yet.")}</p>
      )}

      {codes && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">{t("Save your recovery codes")}</p>
          <p>{t("If you lose your phone, each of these codes lets you sign in once. Keep them somewhere safe; they won't be shown again.")}</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="mt-2 flex gap-3">
            <button type="button" className="font-semibold underline" onClick={download}>{t("Download")}</button>
            <button type="button" className="font-semibold underline" onClick={() => setCodes(null)}>{t("Done")}</button>
          </div>
        </div>
      )}

      {setup && (
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <img src={setup.qrDataUri} alt={t("QR code for the authenticator app")} className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-1" />
          <div className="space-y-2 text-xs text-slate-600 dark:text-gray-300">
            <p>{t("Scan the QR code with your authenticator app (Microsoft Authenticator, Google Authenticator…), then enter the 6-digit code it shows.")}</p>
            <p>{t("Can't scan? Enter this key in the app:")} <code className="select-all break-all rounded bg-slate-100 px-1.5 py-0.5 dark:bg-white/10">{setup.secret}</code></p>
            <div className="flex items-center gap-2">
              <input className={CODE_INPUT} value={code} inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
                aria-label={t("Code")} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <button type="button" className={`${SECONDARY_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={busy || code.length !== 6} onClick={enable}>
                {t("Turn on")}
              </button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setSetup(null)}>{t("Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {action && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-gray-300">
          <span>{t("Enter a current code from your app:")}</span>
          <input className={CODE_INPUT} value={code} inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
            aria-label={t("Code")} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <button type="button" className={SECONDARY_BUTTON} disabled={busy || code.length !== 6} onClick={confirm}>
            {t(action === "recovery" ? "Make new codes" : "Turn off")}
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => { setAction(null); setCode(""); }}>{t("Cancel")}</button>
        </div>
      )}

      {!setup && !action && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!status.enabled && status.available && (
            <button type="button" className={`${SECONDARY_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={busy} onClick={start}>{t("Set up two-step sign-in")}</button>
          )}
          {status.enabled && (
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAction("recovery")}>{t("New recovery codes")}</button>
          )}
          {status.enabled && !status.required && (
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAction("disable")}>{t("Turn off")}</button>
          )}
        </div>
      )}
    </section>
  );
}

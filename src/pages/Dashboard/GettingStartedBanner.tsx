import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Rocket, X } from "lucide-react";
import { useSetupGuide } from "../../company/useSetupGuide";
import { SETUP_STEPS } from "../../company/setupGuide";
import { DASH_CARD } from "./dashboardKit";
import { t } from "../../i18n/i18n";

/** On the Command Center for a company's administrator until every step is done or skipped, or it is hidden. */
export default function GettingStartedBanner() {
  const navigate = useNavigate();
  const guide = useSetupGuide({ onlyWhenShown: true });
  const [hiding, setHiding] = useState(false);

  if (!guide.allowed || guide.loading || !guide.results || guide.setup?.dismissed || guide.progress.complete || guide.progress.offered === 0) {
    return null;
  }
  const next = SETUP_STEPS.find((s) => guide.results![s.key].status === "todo");
  const hide = async () => {
    setHiding(true);
    try {
      await guide.setDismissed(true);
    } catch {
      setHiding(false);
    }
  };

  return (
    <section className={`mb-3 flex flex-none flex-wrap items-center gap-3 px-4 py-3 ${DASH_CARD}`} aria-label={t("Getting started")}>
      <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] dark:bg-cyan-950/40 dark:text-cyan-300">
        <Rocket size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("Finish setting up your company")}</p>
        <p className="truncate text-xs text-gray-500">
          {t("{done} of {total} steps done", { done: guide.progress.settled, total: guide.progress.offered })}
          {next ? ` · ${t("Next: {step}", { step: t(next.title) })}` : ""}
        </p>
      </div>
      <button type="button" onClick={() => navigate("/getting-started")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-700">
        {t("Continue setup")} <ArrowRight size={14} className="rtl:rotate-180" />
      </button>
      <button type="button" onClick={hide} disabled={hiding} title={t("Hide from the Command Center")} aria-label={t("Hide from the Command Center")}
        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-800">
        <X size={14} />
      </button>
    </section>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Circle, HelpCircle, MinusCircle, RefreshCw, Rocket, RotateCcw } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { SETUP_STEPS, type SetupStepKey, type StepDefinition, type StepResult } from "../../company/setupGuide";
import { useSetupGuide } from "../../company/useSetupGuide";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON, TOOL_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const BADGE: Record<StepResult["status"], { text: string; className: string }> = {
  done: { text: "Done", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  skipped: { text: "Skipped", className: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300" },
  todo: { text: "To do", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  unknown: { text: "Couldn't check", className: "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400" },
  unavailable: { text: "Not in your plan or access", className: "bg-slate-100 text-slate-400 dark:bg-gray-800 dark:text-gray-500" },
};

const StatusIcon = ({ status }: { status: StepResult["status"] }) => {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "skipped" || status === "unavailable") return <MinusCircle className="h-5 w-5 text-slate-300" />;
  if (status === "unknown") return <HelpCircle className="h-5 w-5 text-slate-300" />;
  return <Circle className="h-5 w-5 text-amber-400" />;
};

/**
 * Getting started (backlog 7.0.5): the first-run guide for a company's administrator. Each step links to the page
 * that does it; its status is read from the services, so it is done the moment the work is.
 */
export default function GettingStartedPage() {
  const navigate = useNavigate();
  const guide = useSetupGuide();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<unknown>, message?: string) => {
    setBusy(key);
    try {
      await work();
      if (message) ToasterService.success(t(message));
    } catch (e) {
      ToasterService.error(t(errorText(e, "Could not save")));
    } finally {
      setBusy(null);
    }
  };

  if (!guide.allowed) {
    return (
      <>
        <PageMeta title={t("Getting started")} description="First-run guide" />
        <PageBreadcrumb pageTitle="Getting started" />
        <div className={PAGE_BODY}>
          <div className={`${CARD} p-6 text-sm text-slate-500`}>{t("Only a Tenant Administrator can set up the company.")}</div>
        </div>
      </>
    );
  }

  const { results, progress, setup } = guide;
  const firstOpen = SETUP_STEPS.find((s) => results?.[s.key].status === "todo");
  const percent = progress.offered ? Math.round((progress.settled / progress.offered) * 100) : 0;

  const stepCard = (step: StepDefinition, index: number) => {
    const result = results?.[step.key] ?? { status: "unknown" as const };
    const offered = result.status !== "unavailable";
    const stored = setup?.steps?.[step.key];
    const key = (k: SetupStepKey, what: string) => `${k}:${what}`;
    return (
      <li key={step.key} className={`${CARD} p-4 ${firstOpen?.key === step.key ? "ring-1 ring-cyan-400" : ""} ${offered ? "" : "opacity-60"}`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex flex-none flex-col items-center gap-1">
            <StatusIcon status={result.status} />
            <span className="text-[10px] font-semibold text-slate-400">{index + 1}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <step.icon className="h-4 w-4 text-[rgb(var(--brand-600,0_151_167))]" />
              <h3 className={CARD_TITLE}>{t(step.title)}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[result.status].className}`}>{t(BADGE[result.status].text)}</span>
              {result.detail && <span className="text-xs text-slate-500">{t(result.detail.text, result.detail.values)}</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{t(step.description)}</p>
            {offered && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className={result.status === "todo" ? PRIMARY_BUTTON : SECONDARY_BUTTON} onClick={() => navigate(step.route)}>
                  {t(step.action)} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
                {step.confirm && result.status === "todo" && (
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null}
                    onClick={() => run(key(step.key, "done"), () => guide.setStep(step.key, "DONE"))}>
                    <CheckCircle2 className="h-4 w-4" /> {t(step.confirm)}
                  </button>
                )}
                {step.skip && result.status === "todo" && (
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null}
                    onClick={() => run(key(step.key, "skip"), () => guide.setStep(step.key, "SKIPPED"))}>
                    {t(step.skip)}
                  </button>
                )}
                {/* A confirmed or skipped step can be reopened; one read as done stays done */}
                {stored && (result.status === "skipped" || (result.status === "done" && stored === "DONE" && step.confirm)) && (
                  <button type="button" className={TOOL_BUTTON} disabled={busy !== null}
                    onClick={() => run(key(step.key, "reopen"), () => guide.setStep(step.key, null))}>
                    <RotateCcw className="h-3.5 w-3.5" /> {t("Do it again")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <PageMeta title={t("Getting started")} description="First-run guide" />
      <PageBreadcrumb
        pageTitle="Getting started"
        actions={(
          <button type="button" className={TOOL_BUTTON} disabled={guide.loading} onClick={() => guide.reload()}>
            <RefreshCw className={`h-3.5 w-3.5 ${guide.loading ? "animate-spin" : ""}`} /> {t("Check again")}
          </button>
        )}
      />
      <div className={PAGE_BODY}>
        <div className="mx-auto max-w-3xl space-y-4">
          <section className={`${CARD} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] dark:bg-cyan-950/40 dark:text-cyan-300">
                  <Rocket className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    {progress.complete ? t("Your company is set up") : t("Set up your company")}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {guide.loading && !results ? t("Checking…")
                      : t("{done} of {total} steps done", { done: progress.settled, total: progress.offered })}
                  </p>
                </div>
              </div>
              {setup && (
                <button type="button" className={TOOL_BUTTON} disabled={busy !== null}
                  onClick={() => run("dismiss", () => guide.setDismissed(!setup.dismissed),
                    setup.dismissed ? "The guide is back on the Command Center" : "The guide is hidden from the Command Center")}>
                  {t(setup.dismissed ? "Show on the Command Center" : "Hide from the Command Center")}
                </button>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800" role="progressbar"
              aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            {guide.failed && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("Steps you confirmed or skipped couldn't be loaded; what the services show is still checked.")}
              </p>
            )}
          </section>

          <ol className="space-y-3">{SETUP_STEPS.map(stepCard)}</ol>
        </div>
      </div>
    </>
  );
}

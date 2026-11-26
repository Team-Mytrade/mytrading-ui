import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ClipboardCheck, HelpCircle, MinusCircle, RefreshCw, XCircle } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AuthContext } from "../../context/AuthContext";
import { getSelectedTenant, hasPermission } from "../../access/access";
import { useCompany } from "../../company/companyApi";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "../../company/format";
import { AREAS, runGoLiveCheck, type CheckResult, type CheckStatus, type GoLiveReport, type Sample } from "../../company/goLiveCheck";
import { CARD, CARD_TITLE, PAGE_BODY, SECONDARY_BUTTON, TOOL_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const BADGE: Record<CheckStatus, { text: string; className: string }> = {
  pass: { text: "Passed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  must: { text: "Must fix", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  should: { text: "Look at", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  unavailable: { text: "Not checked", className: "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400" },
  notNeeded: { text: "Not needed", className: "bg-slate-100 text-slate-400 dark:bg-gray-800 dark:text-gray-500" },
};

const StatusIcon = ({ status }: { status: CheckStatus }) => {
  if (status === "pass") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "must") return <XCircle className="h-5 w-5 text-red-500" />;
  if (status === "should") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  if (status === "notNeeded") return <MinusCircle className="h-5 w-5 text-slate-300" />;
  return <HelpCircle className="h-5 w-5 text-slate-300" />;
};

const REASONS: Record<string, string> = {
  NAME: "same name as {others}", TAX_NUMBER: "same tax number as {others}", PHONE: "same phone as {others}",
  EMAIL: "same e-mail as {others}", BARCODE: "same barcode as {others}",
};

// PURCHASE_RECEIPT → "Purchase receipt"
const words = (value: string | null) => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : "");

// "Switch (SW-1)", or the record's number when the catalogue couldn't name it
const label = (s: Sample) => {
  if (s.name && s.code) return `${s.name} (${s.code})`;
  return s.name || s.code || (s.id != null ? `#${s.id}` : "");
};

/** How one failing record reads, by check. */
const describe = (code: string, s: Sample): string => {
  switch (code) {
    case "DUPLICATE_PRODUCTS": case "DUPLICATE_CUSTOMERS": case "DUPLICATE_VENDORS":
      return `${label(s)}: ${t(REASONS[s.kind ?? ""] ?? "entered twice", { others: s.detail ?? "" })}`;
    case "STOCK_WITHOUT_COST":
      return `${label(s)} · ${s.detail}: ${t("{n} on hand", { n: formatNumber(s.value) })}`;
    case "NEGATIVE_STOCK":
      return `${label(s)} · ${s.detail}: ${formatNumber(s.value)}`;
    case "EXPIRED_STOCK": {
      // "Jebel Ali · 2026-11-20": the warehouse and the expiry date
      const [where, expired] = (s.detail ?? "").split(" · ");
      return `${label(s)} · ${t("Batch {batch}", { batch: s.kind ?? "" })} · ${where} · ${t("expired {date}", { date: formatDate(expired) })}: `
        + t("{n} left", { n: formatNumber(s.value) });
    }
    case "STOCK_NOT_IN_BOOKS":
      return `${s.code ?? `#${s.id}`} · ${t(words(s.kind))} · ${formatDate(s.detail)}: ${formatMoney(s.value)}`;
    case "LEDGER_NOT_BALANCED": case "OPENING_BALANCE_LEFT":
      return `${s.code ?? ""} ${s.name ?? ""}: ${formatMoney(s.value)}`.trim();
    default:
      return label(s);
  }
};

/**
 * Settings → Go-live check (ADO-2): run before the company starts working in the system, and again after each import.
 * Every check says how many records fail it, the first ones by name, why it matters and where to fix it.
 */
export default function GoLiveCheckPage() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const { company, loading: companyLoading } = useCompany();
  const allowed = hasPermission(access, "USERS:ADMIN") && (!access.superAdmin || !!getSelectedTenant());
  const [report, setReport] = useState<GoLiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!allowed || companyLoading) return;
    setLoading(true);
    try {
      setReport(await runGoLiveCheck(access, company));
    } finally {
      setLoading(false);
    }
  }, [allowed, companyLoading, access, company]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <>
        <PageMeta title={t("Go-live check")} description="Go-live data health check" />
        <PageBreadcrumb pageTitle="Go-live check" />
        <div className={PAGE_BODY}>
          <div className={`${CARD} p-6 text-sm text-slate-500`}>{t("Only a Tenant Administrator can run the go-live check.")}</div>
        </div>
      </>
    );
  }

  const row = (r: CheckResult) => {
    const { definition: d } = r;
    const failing = r.status === "must" || r.status === "should";
    const expanded = open[d.code] ?? r.status === "must";
    return (
      <li key={d.code} className="py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-none"><StatusIcon status={r.status} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">{t(d.title)}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[r.status].className}`}>{t(BADGE[r.status].text)}</span>
              {failing && !r.compare && !r.amount && (
                <span className="text-xs text-slate-500">{t("{count} of {total}", { count: formatNumber(r.count), total: formatNumber(r.total) })}</span>
              )}
              {failing && r.amount && (
                <span className="text-xs text-slate-500">{t(r.amount.label)}: {formatMoney(r.amount.value)}</span>
              )}
              {r.status === "pass" && r.total > 0 && !r.compare && !r.amount && (
                <span className="text-xs text-slate-400">{t("{total} checked", { total: formatNumber(r.total) })}</span>
              )}
              {r.reason && <span className="text-xs text-slate-400">{t(r.reason)}</span>}
            </div>
            {(failing || r.status === "pass") && r.compare && (
              <p className="mt-1 text-xs text-slate-600 dark:text-gray-300">
                {t(r.compare.leftLabel)} {formatMoney(r.compare.left)} · {t(r.compare.rightLabel)} {formatMoney(r.compare.right)}
                {failing && <> · <span className="font-medium">{t("Difference")} {formatMoney(r.compare.difference)}</span></>}
              </p>
            )}
            {failing && <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">{t(d.why)}</p>}
            {failing && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className={SECONDARY_BUTTON} onClick={() => navigate(d.route)}>
                  {t(d.fix)} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
                {r.samples.length > 0 && (
                  <button type="button" className={TOOL_BUTTON} aria-expanded={expanded}
                    onClick={() => setOpen((o) => ({ ...o, [d.code]: !expanded }))}>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    {t(expanded ? "Hide the list" : "Show the list")}
                  </button>
                )}
              </div>
            )}
            {failing && expanded && r.samples.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs text-slate-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {r.samples.map((s, i) => <li key={`${s.id}-${i}`} dir="auto">{describe(d.code, s)}</li>)}
                {r.count > r.samples.length && (
                  <li className="text-slate-400">{t("…and {n} more", { n: formatNumber(r.count - r.samples.length) })}</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </li>
    );
  };

  const verdict = !report ? null
    : report.must > 0 ? { text: "Not ready to go live", tone: "text-red-600 dark:text-red-400" }
      : report.should > 0 ? { text: "Ready to go live, with a few things to look at", tone: "text-amber-600 dark:text-amber-400" }
        : { text: "Ready to go live", tone: "text-emerald-600 dark:text-emerald-400" };

  return (
    <>
      <PageMeta title={t("Go-live check")} description="Go-live data health check" />
      <PageBreadcrumb
        pageTitle="Go-live check"
        actions={(
          <button type="button" className={TOOL_BUTTON} disabled={loading} onClick={() => load()}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {t("Check again")}
          </button>
        )}
      />
      <div className={PAGE_BODY}>
        <div className="mx-auto max-w-3xl space-y-4">
          <section className={`${CARD} p-4`}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] dark:bg-cyan-950/40 dark:text-cyan-300">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className={`text-base font-semibold ${verdict?.tone ?? "text-slate-900 dark:text-white"}`}>
                  {loading && !report ? t("Checking…") : verdict ? t(verdict.text) : ""}
                </h2>
                {report && (
                  <p className="text-xs text-slate-500">
                    {t("{must} must be fixed, {should} to look at, {passed} of {checked} checks passed",
                      { must: report.must, should: report.should, passed: report.passed, checked: report.checked })}
                    {report.checkedAt && <> · {t("Checked {when}", { when: formatDateTime(report.checkedAt) })}</>}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">
              {t("Run it after importing your opening data and before the first real transaction. It only reads: nothing is changed.")}
            </p>
          </section>

          {report && AREAS.map(({ area, icon: Icon }) => {
            const rows = report.results.filter((r) => r.definition.area === area);
            if (rows.every((r) => r.status === "unavailable" && r.reason === "Not in your company's plan")) return null;
            return (
              <section key={area} className={`${CARD} px-4 pt-3`}>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-gray-800">
                  <Icon className="h-4 w-4 text-[rgb(var(--brand-600,0_151_167))]" />
                  <h2 className={CARD_TITLE}>{t(area)}</h2>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-gray-800">{rows.map(row)}</ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Briefcase,
  CalendarCheck,
  ChevronLeft,
  CircleHelp,
  ExternalLink,
  FlaskConical,
  FileText,
  Home,
  Keyboard,
  Package,
  Receipt,
  Route as RouteIcon,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import { canAccessPath } from "../../access/access";
import { t } from "../../i18n/i18n";
import HelpContent, { helpSections, SampleBadge } from "../../help/HelpContent";
import { FLOW_EXAMPLES } from "../../help/examples";
import { HELP_FLOWS, HELP_MODULES, HELP_TOPICS, helpFlowById, helpTopicById, searchHelp } from "../../help";
import { localizeFlow, localizeFlowExample, localizeTopic, textDirection, useHelpTranslation } from "../../help/translations";
import type { HelpFlow, HelpTopic } from "../../help/types";

// Help Center (backlog 8.1): the user manual (end-to-end flows), every page's help by module, and search.
// Lists only the pages the signed-in person can open.

// The app's standard card (tables, stat cards, dashboards): soft green with a raised shadow, #272727 in dark mode.
// Set here for every element (links and headers too), since the global card rule only reaches plain divs.
const CARD =
  "rounded-2xl border border-[#dcedc8] bg-[#f1f8e9] shadow-[0_2px_4px_rgba(15,23,42,0.06),0_10px_24px_rgba(15,23,42,0.08)] dark:border-[#363636] dark:bg-[#272727] dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_8px_20px_rgba(0,0,0,0.25)]";
// Gradients straight from the company's brand colour (Tailwind's gradient stops don't read the brand variables)
const HERO: React.CSSProperties = {
  backgroundImage: "linear-gradient(135deg, rgb(var(--cyan-700, 14 116 144)) 0%, rgb(var(--cyan-500, 6 182 212)) 55%, rgb(var(--cyan-400, 34 211 238)) 100%)",
};
const TINT: React.CSSProperties = { backgroundImage: "linear-gradient(135deg, rgb(var(--cyan-500, 6 182 212) / 0.12) 0%, transparent 60%)" };
const SOFT_LINK = "text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400";

const MODULE_ICONS: Record<string, React.ElementType> = {
  Home,
  Common: Boxes,
  CRM: Users,
  Sales: ShoppingCart,
  Purchase: ShoppingBag,
  Inventory: Package,
  Delivery: Truck,
  Invoice: Receipt,
  HRMS: Briefcase,
  "Payroll Reports": Wallet,
  Attendance: CalendarCheck,
  Reports: BarChart3,
  Settings,
};
const moduleIcon = (module: string) => MODULE_ICONS[module] ?? FileText;

const ModuleBadge = ({ module }: { module: string }) => {
  const Icon = moduleIcon(module);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(module)}
    </span>
  );
};

const BackToHelp = () => (
  <Link to="/help" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400">
    <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
    {t("Help Center")}
  </Link>
);

/* ------------------------------------------------ A business flow ------------------------------------------------ */

const FlowView = ({ flow: english }: { flow: HelpFlow }) => {
  const translation = useHelpTranslation();
  const { flow, translated } = localizeFlow(english, translation);
  const sample = FLOW_EXAMPLES[english.id] ? localizeFlowExample(english.id, FLOW_EXAMPLES[english.id], translation).example : null;
  const roles = [...new Set(flow.steps.map((s) => s.who).filter(Boolean))] as string[];
  return (
    <div className="space-y-5" {...textDirection(translated)}>
      <header className={`${CARD} overflow-hidden`}>
        <div className="p-6" style={TINT}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
            <RouteIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Business flow")}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{flow.title}</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600 dark:text-gray-300">{flow.summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10">
              {t("{count} steps", { count: flow.steps.length })}
            </span>
            {roles.map((r) => (
              <span key={r} className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-white/5 dark:text-gray-300">
                {r}
              </span>
            ))}
          </div>
          {sample && (
            <div className="mt-5 space-y-1.5 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-500/25 dark:bg-violet-500/[0.07]">
              <SampleBadge company={sample.company} />
              <p className="text-sm leading-relaxed text-slate-700 dark:text-gray-200">{sample.story}</p>
            </div>
          )}
        </div>
      </header>

      <ol className={`${CARD} p-6`}>
        {flow.steps.map((step, i) => {
          const last = i === flow.steps.length - 1;
          return (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {!last && <span aria-hidden="true" className="absolute start-[17px] top-10 bottom-1 w-0.5 rounded bg-cyan-200 dark:bg-cyan-500/30" />}
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white shadow-sm shadow-cyan-500/30">{i + 1}</span>
              <div className="min-w-0 flex-1 rounded-xl border border-slate-200 p-4 transition hover:border-cyan-300 dark:border-[#333] dark:hover:border-cyan-500/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">{step.title}</h3>
                    {step.who && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-gray-300">{step.who}</span>}
                  </div>
                  {step.route && (
                    <Link to={step.route} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:underline dark:text-cyan-400">
                      {t("Open page")}
                      <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-gray-300">{step.detail}</p>
                {sample?.steps[i] && (
                  <p className="mt-2.5 flex gap-2 rounded-lg bg-violet-50/80 px-3 py-2 text-[13px] leading-relaxed text-slate-700 dark:bg-violet-500/[0.08] dark:text-gray-200">
                    <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden="true" />
                    <span>{sample.steps[i]}</span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/* ------------------------------------------------ One page's help ------------------------------------------------ */

const TopicView = ({ topic: english }: { topic: HelpTopic }) => {
  const { topic, translated } = localizeTopic(english, useHelpTranslation());
  const sections = helpSections(english);
  return (
    <div className="space-y-5">
      <header className={`${CARD} overflow-hidden`} {...textDirection(translated)}>
        <div className="flex flex-wrap items-start justify-between gap-4 p-6" style={TINT}>
          <div className="min-w-0 max-w-3xl">
            <ModuleBadge module={english.module} />
            <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{topic.title}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-gray-300">{topic.summary}</p>
          </div>
          <Link
            to={english.route}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-400 bg-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-950 shadow-sm transition hover:border-cyan-600 hover:bg-cyan-400"
          >
            {t("Open this page")}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className={`${CARD} p-6`}>
          <HelpContent topic={english} variant="page" hideSummary />
        </div>
        {sections.length > 1 && (
          <nav aria-label={t("On this page")} className="hidden lg:block">
            <div className={`${CARD} sticky top-24 p-4`}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">{t("On this page")}</p>
              <ul className="space-y-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={(e) => {
                        // The router owns the hash: scroll instead of changing the address
                        e.preventDefault();
                        document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="block rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-700 dark:text-gray-300 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-300"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------ The front page ------------------------------------------------ */

// The app's global field style forces a 32px box with a focus ring; the hero's search sits in its own frame instead
const bareInput = (el: HTMLInputElement | null) => {
  if (!el) return;
  for (const [prop, value] of [["height", "44px"], ["min-height", "44px"], ["border", "0"], ["box-shadow", "none"], ["background", "transparent"], ["padding", "0"], ["font-size", "15px"]])
    el.style.setProperty(prop, value, "important");
};

export default function HelpCenterPage() {
  const { topicId, flowId } = useParams();
  const { access } = useContext(AuthContext);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<string | null>(null);
  const translation = useHelpTranslation();

  // A new topic or flow starts at the top
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [topicId, flowId]);

  const found = useMemo(() => searchHelp(query, translation), [query, translation]);
  const allowed = useMemo(() => HELP_TOPICS.filter((topic) => canAccessPath(access, topic.route)), [access]);
  const visible = useMemo(() => found.topics.filter((topic) => canAccessPath(access, topic.route)), [found, access]);
  const modules = useMemo(() => HELP_MODULES.filter((m) => allowed.some((x) => x.module === m)), [allowed]);
  const searching = query.trim().length > 0;
  const shownModules = module ? [module] : modules;

  const topic = topicId ? helpTopicById(topicId) : null;
  const flow = flowId ? helpFlowById(flowId) : null;

  let body;
  if (flowId || topicId) {
    body = (
      <>
        <BackToHelp />
        {flow ? (
          <FlowView flow={flow} />
        ) : topic ? (
          <TopicView topic={topic} />
        ) : (
          <div className={`${CARD} p-10 text-center`}>
            <CircleHelp className="mx-auto h-10 w-10 text-slate-300 dark:text-gray-600" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-600 dark:text-gray-300">{t("This help topic doesn't exist.")}</p>
          </div>
        )}
      </>
    );
  } else {
    body = (
      <div className="space-y-6">
        {/* Hero: the question and the search */}
        <section className="relative overflow-hidden rounded-2xl px-6 py-10 text-white shadow-sm sm:px-10" style={HERO}>
          <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 start-1/3 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative mx-auto max-w-2xl text-center">
            <h1 className="text-2xl font-bold sm:text-3xl">{t("How can we help?")}</h1>
            <p className="mt-2 text-sm text-white/85 sm:text-base">{t("Step-by-step guides for every page and the business flows that connect them.")}</p>
            <div className="mt-6 flex items-center gap-3 rounded-[14px] bg-white px-4 shadow-lg ring-1 ring-black/5 focus-within:ring-4 focus-within:ring-white/40 dark:bg-[#1f1f1f]">
              <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={bareInput}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search the help, e.g. credit limit, approve, invoice")}
                aria-label={t("Search the help")}
                className="w-full min-w-0 text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-white"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label={t("Clear search")} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/85">
              <span>{t("{count} page guides", { count: allowed.length })}</span>
              <span aria-hidden="true">•</span>
              <span>{t("{count} business flows", { count: HELP_FLOWS.length })}</span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                {t("Press")} <kbd className="rounded border border-white/40 bg-white/15 px-1.5 py-px font-mono text-[11px]">F1</kbd> {t("on any page for its help")}
              </span>
            </div>
          </div>
        </section>

        {/* Business flows */}
        {found.flows.length > 0 && !module && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-white/90">
                  <RouteIcon className="h-5 w-5 text-cyan-500" aria-hidden="true" />
                  {t("User manual: business flows")}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">{t("How the work moves from one page to the next, start to finish.")}</p>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {found.flows.map((english) => {
                const { flow: f, translated } = localizeFlow(english, translation);
                return (
                  <li key={f.id} {...textDirection(translated)}>
                    <Link
                      to={`/help/flow/${f.id}`}
                      className={`${CARD} group flex h-full flex-col p-4 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:hover:border-cyan-500/50`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
                          <RouteIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-cyan-600 dark:text-gray-100 dark:group-hover:text-cyan-400">{f.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-gray-400">{f.summary}</p>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-3 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-white/5 dark:text-gray-300">{t("{count} steps", { count: f.steps.length })}</span>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-500 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Pages by module */}
        <section>
          <div className="mb-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-white/90">
              <FileText className="h-5 w-5 text-cyan-500" aria-hidden="true" />
              {searching ? t("Matching pages") : t("Help for each page")}
            </h2>
          </div>
          {modules.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2" role="toolbar" aria-label={t("Filter by module")}>
              {[null, ...modules].map((m) => {
                const count = visible.filter((x) => !m || x.module === m).length;
                const active = module === m;
                return (
                  <button
                    key={m ?? "all"}
                    type="button"
                    onClick={() => setModule(m)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? "border-cyan-500 bg-cyan-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700 dark:border-[#3a3a3a] dark:bg-[#272727] dark:text-gray-300 dark:hover:text-cyan-300"
                    }`}
                  >
                    {m ? t(m) : t("All")}
                    <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-slate-100 dark:bg-white/10"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {visible.filter((x) => !module || x.module === module).length === 0 ? (
            <div className={`${CARD} p-10 text-center`}>
              <Search className="mx-auto h-10 w-10 text-slate-300 dark:text-gray-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-gray-200">{t("Nothing matches your search.")}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">{t("Try fewer or different words.")}</p>
            </div>
          ) : (
            // Flowing columns: a short module sits right under the one above it, no gap beside a long list
            <div className="gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
              {shownModules.map((m) => {
                const topics = visible.filter((x) => x.module === m);
                if (!topics.length) return null;
                const Icon = moduleIcon(m);
                return (
                  <div key={m} className={`${CARD} flex flex-col overflow-hidden`}>
                    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-[#333]">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="flex-1 text-sm font-semibold text-slate-800 dark:text-gray-100">{t(m)}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-gray-400">{topics.length}</span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-[#333]">
                      {topics.map((english) => {
                        const { topic: x, translated } = localizeTopic(english, translation);
                        return (
                          <li key={x.id} {...textDirection(translated)}>
                            <Link to={`/help/${x.id}`} className="group flex items-start gap-2 px-4 py-2.5 transition hover:bg-cyan-50/50 dark:hover:bg-cyan-500/[0.06]">
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-slate-800 group-hover:text-cyan-600 dark:text-gray-100 dark:group-hover:text-cyan-400">{x.title}</span>
                                <span className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-gray-400">{x.summary}</span>
                              </span>
                              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-cyan-500 rtl:-scale-x-100" aria-hidden="true" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-500 dark:text-gray-400">
          {t("Can't find it? Open the page you're working on and press F1, or ask your administrator.")}{" "}
          <Link to="/" className={SOFT_LINK}>
            {t("Back to home")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`${t("Help Center")} | MyTrading`} description={t("User manual and help for every page")} />
      <PageBreadcrumb pageTitle={t("Help Center")} />
      {body}
    </>
  );
}

import { Link } from "react-router";
import { ArrowUpRight, BookMarked, CheckCircle2, FileSpreadsheet, FlaskConical, Lightbulb, ListChecks, Route as RouteIcon, Tags, Users, Waypoints } from "lucide-react";
import { t } from "../i18n/i18n";
import { helpFlowById } from "./index";
import { HELP_EXAMPLES, SAMPLE_COMPANIES } from "./examples";
import { localizeExample, localizeFlow, localizeTopic, textDirection, useHelpTranslation, type HelpTranslation } from "./translations";
import type { HelpTerm, HelpTopic, SampleCompany } from "./types";

// One page's help: what it is for, who can do what, the tasks step by step, fields and statuses, rules, related pages
// and the flows it belongs to. Shown in the side panel (HelpButton) and in the Help Center.

// Cards of different heights: flowing columns on wide screens (no empty holes beside a short card), a stack otherwise
const cols = (wide: boolean) => (wide ? "gap-2 sm:columns-2 [&>*]:mb-2 [&>*]:break-inside-avoid" : "space-y-2");
const BODY = "text-sm leading-relaxed text-slate-600 dark:text-gray-300";

/** The sections a topic has, in order: the Help Center's "On this page" list and the anchors below. */
export const helpSections = (topic: HelpTopic): { id: string; label: string }[] =>
  [
    { id: "help-example", label: "Example", show: !!HELP_EXAMPLES[topic.id] },
    { id: "help-who", label: "Who uses this page", show: topic.who.length > 0 },
    { id: "help-tasks", label: "How to", show: topic.tasks.length > 0 },
    { id: "help-fields", label: "Fields", show: !!topic.fields?.length },
    { id: "help-statuses", label: "Statuses", show: !!topic.statuses?.length },
    { id: "help-rules", label: "Good to know", show: !!topic.rules?.length },
    { id: "help-related", label: "Related pages", show: !!topic.related?.length },
    { id: "help-flows", label: "Part of these flows", show: !!topic.flows?.length },
  ]
    .filter((s) => s.show)
    .map(({ id, label }) => ({ id, label: t(label) }));

const Heading = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white/90">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
    {children}
  </h3>
);

// A status name gets the colour people expect from the rest of the app (green done, amber waiting, red stopped)
const statusTone = (name: string) => {
  const n = name.toLowerCase();
  if (/(cancel|reject|block|fail|overdue|void|lost|hold|expired|inactive|absent)/.test(n))
    return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30";
  if (/(pending|draft|submitted|waiting|open|partial|requested|new|in progress|scheduled|late)/.test(n))
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
  if (/(approved|paid|active|complete|closed|delivered|confirmed|posted|received|present|won|done|issued|settled)/.test(n))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
  return "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10";
};

const Terms = ({ id, icon, title, terms, pills, wide }: { id: string; icon: React.ElementType; title: string; terms?: HelpTerm[]; pills?: boolean; wide: boolean }) =>
  terms && terms.length ? (
    <section id={id} className="scroll-mt-24">
      <Heading icon={icon}>{t(title)}</Heading>
      <dl className={cols(wide)}>
        {terms.map((term) => (
          <div key={term.name} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 dark:border-[#333] dark:bg-white/[0.02]">
            <dt className="mb-1">
              {pills ? (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusTone(term.name)}`}>{term.name}</span>
              ) : (
                <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">{term.name}</span>
              )}
            </dt>
            <dd className={BODY}>{term.meaning}</dd>
          </div>
        ))}
      </dl>
    </section>
  ) : null;

/** "Sample data · Gulf Electronics Trading LLC · Dubai, UAE · AED": which demo company an example is about. */
export const SampleBadge = ({ company = "GET" }: { company?: SampleCompany }) => {
  const c = SAMPLE_COMPANIES[company];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        {t("Sample data")}
      </span>
      <span className="font-semibold text-slate-700 dark:text-gray-200" dir="ltr">{c.name}</span>
      <span className="text-slate-500 dark:text-gray-400" dir="ltr">
        {c.place} · {c.currency}
      </span>
    </div>
  );
};

/** A topic's worked example with sample business data. */
const ExampleCard = ({ id, translation, wide }: { id: string; translation: HelpTranslation | null; wide: boolean }) => {
  const english = HELP_EXAMPLES[id];
  if (!english) return null;
  const { example, translated } = localizeExample(id, english, translation);
  return (
    <section id="help-example" className="scroll-mt-24" {...textDirection(translated)}>
      <Heading icon={FileSpreadsheet}>{t("Example")}</Heading>
      <div className="overflow-hidden rounded-xl border border-violet-200 dark:border-violet-500/25">
        <div className="space-y-2 bg-violet-50/70 px-4 py-3 dark:bg-violet-500/[0.07]">
          <SampleBadge company={example.company} />
          <p className="text-sm leading-relaxed text-slate-700 dark:text-gray-200">{example.story}</p>
        </div>
        {example.data && example.data.length > 0 && (
          <dl className={`grid border-t border-violet-100 dark:border-violet-500/20 ${wide ? "sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2" : ""}`}>
            {example.data.map((d) => (
              <div key={d.label} className="border-b border-violet-100 px-4 py-2 dark:border-violet-500/15">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-gray-400">{d.label}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-gray-100" dir="auto">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {example.result && (
          <p className="flex gap-2 border-t border-violet-100 px-4 py-2.5 text-sm leading-relaxed text-slate-700 dark:border-violet-500/20 dark:text-gray-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>{example.result}</span>
          </p>
        )}
      </div>
    </section>
  );
};

interface HelpContentProps {
  topic: HelpTopic;
  /** Called when a link is followed (the side panel closes itself). */
  onNavigate?: () => void;
  /** "page": the Help Center's wide layout (two columns for terms); "panel": the narrow side panel. */
  variant?: "page" | "panel";
  /** The summary is shown above already (Help Center header). */
  hideSummary?: boolean;
}

const HelpContent = ({ topic: english, onNavigate, variant = "panel", hideSummary }: HelpContentProps) => {
  const translation = useHelpTranslation();
  const { topic, translated } = localizeTopic(english, translation);
  const wide = variant === "page";
  return (
    <div className="space-y-8" {...textDirection(translated)}>
      {!hideSummary && (
        <p className="rounded-xl border-s-4 border-cyan-500 bg-cyan-50/60 px-4 py-3 text-[15px] leading-relaxed text-slate-700 dark:bg-cyan-500/10 dark:text-gray-200">
          {topic.summary}
        </p>
      )}

      <ExampleCard id={english.id} translation={translation} wide={wide} />

      {topic.who.length > 0 && (
        <section id="help-who" className="scroll-mt-24">
          <Heading icon={Users}>{t("Who uses this page")}</Heading>
          <ul className={cols(wide)}>
            {topic.who.map((w) => (
              <li key={w.role} className="flex gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 dark:border-[#333]">
                <span className="mt-0.5 h-fit shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-gray-100">{w.role}</span>
                <span className={BODY}>{w.can}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topic.tasks.length > 0 && (
        <section id="help-tasks" className="scroll-mt-24">
          <Heading icon={ListChecks}>{t("How to")}</Heading>
          <div className="space-y-3">
            {topic.tasks.map((task) => (
              <div key={task.title} className="rounded-xl border border-slate-200 p-4 dark:border-[#333]">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-gray-100">{task.title}</h4>
                  {task.who && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-gray-300">{task.who}</span>
                  )}
                </div>
                <ol className="relative space-y-2.5">
                  {task.steps.map((s, i) => (
                    <li key={i} className="relative flex gap-3">
                      {/* the line joining the step numbers */}
                      {i < task.steps.length - 1 && <span aria-hidden="true" className="absolute start-[11px] top-6 h-[calc(100%-6px)] w-0.5 bg-cyan-200 dark:bg-cyan-500/30" />}
                      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-[11px] font-bold text-white">{i + 1}</span>
                      <span className={`${BODY} pt-0.5`}>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      <Terms id="help-fields" icon={BookMarked} title="Fields" terms={topic.fields} wide={wide} />
      <Terms id="help-statuses" icon={Tags} title="Statuses" terms={topic.statuses} pills wide={wide} />

      {topic.rules && topic.rules.length > 0 && (
        <section id="help-rules" className="scroll-mt-24">
          <Heading icon={Lightbulb}>{t("Good to know")}</Heading>
          <ul className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/25 dark:bg-amber-500/[0.07]">
            {topic.rules.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-gray-200">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topic.related && topic.related.length > 0 && (
        <section id="help-related" className="scroll-mt-24">
          <Heading icon={Waypoints}>{t("Related pages")}</Heading>
          <ul className={cols(wide)}>
            {topic.related.map((r) => (
              <li key={r.route}>
                <Link
                  to={r.route}
                  onClick={onNavigate}
                  className="group flex h-full items-start justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 transition hover:border-cyan-300 hover:bg-cyan-50/40 dark:border-[#333] dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/[0.06]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 group-hover:text-cyan-600 dark:text-gray-100 dark:group-hover:text-cyan-400">{r.label}</span>
                    {r.why && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-gray-400">{r.why}</span>}
                  </span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-500 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topic.flows && topic.flows.length > 0 && (
        <section id="help-flows" className="scroll-mt-24">
          <Heading icon={RouteIcon}>{t("Part of these flows")}</Heading>
          <div className="flex flex-wrap gap-2">
            {topic.flows.map((id) => {
              const flow = helpFlowById(id);
              return flow ? (
                <Link
                  key={id}
                  to={`/help/flow/${id}`}
                  onClick={onNavigate}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
                >
                  <RouteIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {localizeFlow(flow, translation).flow.title}
                </Link>
              ) : null;
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default HelpContent;

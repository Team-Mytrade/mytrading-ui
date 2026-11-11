import { Link } from "react-router";
import { t } from "../i18n/i18n";
import { helpFlowById } from "./index";
import { localizeFlow, localizeTopic, textDirection, useHelpTranslation } from "./translations";
import type { HelpTerm, HelpTopic } from "./types";

// One page's help: what it is for, who can do what, the tasks step by step, fields and statuses, rules, related pages
// and the flows it belongs to. Shown in the side panel (HelpButton) and in the Help Center.

const H = "text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2";
const BODY = "text-sm text-gray-700 dark:text-gray-300";

const Terms = ({ title, terms }: { title: string; terms?: HelpTerm[] }) =>
  terms && terms.length ? (
    <section>
      <h3 className={H}>{t(title)}</h3>
      <dl className="space-y-2">
        {terms.map((term) => (
          <div key={term.name} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
            <dt className="text-sm font-medium text-gray-800 dark:text-gray-100">{term.name}</dt>
            <dd className={BODY}>{term.meaning}</dd>
          </div>
        ))}
      </dl>
    </section>
  ) : null;

interface HelpContentProps {
  topic: HelpTopic;
  /** Called when a link is followed (the side panel closes itself). */
  onNavigate?: () => void;
}

const HelpContent = ({ topic: english, onNavigate }: HelpContentProps) => {
  const translation = useHelpTranslation();
  const { topic, translated } = localizeTopic(english, translation);
  return (
  <div className="space-y-6" {...textDirection(translated)}>
    <p className={`${BODY} text-base`}>{topic.summary}</p>

    <section>
      <h3 className={H}>{t("Who uses this page")}</h3>
      <ul className="space-y-1.5">
        {topic.who.map((w) => (
          <li key={w.role} className={BODY}>
            <span className="font-medium text-gray-800 dark:text-gray-100">{w.role}:</span> {w.can}
          </li>
        ))}
      </ul>
    </section>

    <section>
      <h3 className={H}>{t("How to")}</h3>
      <div className="space-y-4">
        {topic.tasks.map((task) => (
          <div key={task.title}>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {task.title}
              {task.who && <span className="ms-2 text-xs font-normal text-gray-500 dark:text-gray-400">({task.who})</span>}
            </h4>
            <ol className="mt-1.5 list-decimal space-y-1 ps-5">
              {task.steps.map((s, i) => (
                <li key={i} className={BODY}>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>

    <Terms title="Fields" terms={topic.fields} />
    <Terms title="Statuses" terms={topic.statuses} />

    {topic.rules && topic.rules.length > 0 && (
      <section>
        <h3 className={H}>{t("Good to know")}</h3>
        <ul className="list-disc space-y-1 ps-5">
          {topic.rules.map((r, i) => (
            <li key={i} className={BODY}>
              {r}
            </li>
          ))}
        </ul>
      </section>
    )}

    {topic.related && topic.related.length > 0 && (
      <section>
        <h3 className={H}>{t("Related pages")}</h3>
        <ul className="space-y-1">
          {topic.related.map((r) => (
            <li key={r.route} className={BODY}>
              <Link to={r.route} onClick={onNavigate} className="font-medium text-brand-500 hover:underline dark:text-brand-400">
                {r.label}
              </Link>
              {r.why && <span className="text-gray-500 dark:text-gray-400"> — {r.why}</span>}
            </li>
          ))}
        </ul>
      </section>
    )}

    {topic.flows && topic.flows.length > 0 && (
      <section>
        <h3 className={H}>{t("Part of these flows")}</h3>
        <ul className="space-y-1">
          {topic.flows.map((id) => {
            const flow = helpFlowById(id);
            return flow ? (
              <li key={id} className={BODY}>
                <Link to={`/help/flow/${id}`} onClick={onNavigate} className="font-medium text-brand-500 hover:underline dark:text-brand-400">
                  {localizeFlow(flow, translation).flow.title}
                </Link>
              </li>
            ) : null;
          })}
        </ul>
      </section>
    )}
  </div>
  );
};

export default HelpContent;

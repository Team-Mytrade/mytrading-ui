import { useContext, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { BookOpen, ChevronLeft, Route as RouteIcon, Search } from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import { canAccessPath } from "../../access/access";
import { t } from "../../i18n/i18n";
import HelpContent from "../../help/HelpContent";
import { HELP_MODULES, helpFlowById, helpTopicById, searchHelp } from "../../help";
import type { HelpFlow, HelpTopic } from "../../help/types";

// Help Center (backlog 8.1): the user manual (end-to-end flows), every page's help by module, and search.
// Lists only the pages the signed-in person can open.

const CARD = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
const LINK = "font-medium text-brand-500 hover:underline dark:text-brand-400";

const BackToHelp = () => (
  <Link to="/help" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
    <ChevronLeft className="h-4 w-4" />
    {t("Help Center")}
  </Link>
);

const FlowView = ({ flow }: { flow: HelpFlow }) => (
  <div className={CARD} dir="ltr" lang="en">
    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{flow.title}</h2>
    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{flow.summary}</p>
    <ol className="mt-5 space-y-4">
      {flow.steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400">
            {i + 1}
          </span>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <div className="font-semibold text-gray-800 dark:text-gray-100">
              {step.route ? (
                <Link to={step.route} className={LINK}>
                  {step.title}
                </Link>
              ) : (
                step.title
              )}
              {step.who && <span className="ms-2 text-xs font-normal text-gray-500 dark:text-gray-400">({step.who})</span>}
            </div>
            <p>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

const TopicView = ({ topic }: { topic: HelpTopic }) => (
  <div className={CARD}>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{topic.title}</h2>
      <Link to={topic.route} className={`${LINK} text-sm`}>
        {t("Open this page")}
      </Link>
    </div>
    <HelpContent topic={topic} />
  </div>
);

export default function HelpCenterPage() {
  const { topicId, flowId } = useParams();
  const { access } = useContext(AuthContext);
  const [query, setQuery] = useState("");

  const found = useMemo(() => searchHelp(query), [query]);
  const visible = useMemo(() => found.topics.filter((topic) => canAccessPath(access, topic.route)), [found, access]);

  const topic = topicId ? helpTopicById(topicId) : null;
  const flow = flowId ? helpFlowById(flowId) : null;

  let body;
  if (flowId || topicId) {
    body = (
      <>
        <BackToHelp />
        {flow ? <FlowView flow={flow} /> : topic ? <TopicView topic={topic} /> : <p className="text-sm text-gray-600 dark:text-gray-300">{t("This help topic doesn't exist.")}</p>}
      </>
    );
  } else {
    body = (
      <div className="space-y-6">
        {/* The icon sits beside the box: the app's global input style (with !important) leaves no room inside it */}
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search the help, e.g. credit limit, approve, invoice")}
            aria-label={t("Search the help")}
            className="w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>

        {found.flows.length > 0 && (
          <section className={CARD}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white/90">
              <RouteIcon className="h-5 w-5 text-brand-500" />
              {t("User manual: business flows")}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {found.flows.map((f) => (
                <li key={f.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <Link to={`/help/flow/${f.id}`} className={LINK}>
                    {f.title}
                  </Link>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300" dir="ltr" lang="en">
                    {f.summary}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={CARD}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white/90">
            <BookOpen className="h-5 w-5 text-brand-500" />
            {t("Help for each page")}
          </h2>
          {visible.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">{t("Nothing matches your search.")}</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {HELP_MODULES.map((module) => {
                const topics = visible.filter((x) => x.module === module);
                return topics.length ? (
                  <div key={module}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t(module)}</h3>
                    <ul className="space-y-1.5">
                      {topics.map((x) => (
                        <li key={x.id} className="text-sm">
                          <Link to={`/help/${x.id}`} className={LINK}>
                            {x.title}
                          </Link>
                          <p className="text-gray-600 line-clamp-2 dark:text-gray-400" dir="ltr" lang="en">
                            {x.summary}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500 dark:text-gray-400">{t("Tip: press F1 on any page to open its help.")}</p>
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

import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowRight, Hourglass } from "lucide-react";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import { CARD, PAGE_BODY } from "./Payroll/hrmsUi";
import { comingSoonPage } from "../access/comingSoon";
import { t } from "../i18n/i18n";

/**
 * Developers only: true shows the unfinished demo pages (access/comingSoon.ts) instead of "Coming soon", in a local
 * `npm run dev` with VITE_SHOW_UNFINISHED_PAGES=true. Never on in a build that customers use.
 */
const SHOW_UNFINISHED_PAGES = import.meta.env.DEV && import.meta.env.VITE_SHOW_UNFINISHED_PAGES === "true";

/** "Coming soon" for a page that is not built yet: what it will be and the real pages to use meanwhile. */
export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const page = comingSoonPage(pathname);
  const name = page?.name ?? "This page";

  return (
    <>
      <PageMeta title={t(name)} description="This page is not available yet" />
      <PageBreadcrumb pageTitle={name} />
      <div className={PAGE_BODY}>
        <section className={`${CARD} mx-auto max-w-xl p-8 text-center`}>
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300">
            <Hourglass className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("Coming soon")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-gray-300">
            {t("This page is not available yet. It will be added in a later version of MyTrade.")}
          </p>
          {page?.seeInstead?.length ? (
            <div className="mt-6 text-start">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t("Meanwhile, use")}</p>
              <ul className="space-y-2">
                {page.seeInstead.map((s) => (
                  <li key={s.path}>
                    <Link
                      to={s.path}
                      className="group flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 hover:border-cyan-300 hover:bg-cyan-50/40 dark:border-[#333] dark:text-gray-100 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/[0.06]"
                    >
                      {t(s.label)}
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-500 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link to="/" className="mt-6 inline-block text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400">
            {t("Back to the Command Center")}
          </Link>
        </section>
      </div>
    </>
  );
}

/**
 * Route element for a page in COMING_SOON_PAGES: its real replacement (redirect), else "Coming soon". The unfinished
 * component is kept to be built later; only a developer with SHOW_UNFINISHED_PAGES sees it.
 */
export function Unfinished({ path, page }: { path: string; page: ReactNode }) {
  const entry = comingSoonPage(path);
  if (!entry) return <>{page}</>;
  if (entry.redirect) return <Navigate to={entry.redirect} replace />;
  return SHOW_UNFINISHED_PAGES ? <>{page}</> : <ComingSoonPage />;
}

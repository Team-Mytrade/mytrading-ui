import React, { useContext, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChartBarSquareIcon, ChevronRightIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { AuthContext } from "../../../context/AuthContext";
import { canAccessPath } from "../../../access/access";
import { pageForPlace, useCompanyPlace } from "../../../company/payrollRegion";
import { REPORTS, REPORT_MODULES, ReportEntry, ReportModule } from "./reportCatalogue";
import { t } from "../../../i18n/i18n";

const ReportCard: React.FC<{ report: ReportEntry }> = ({ report }) => (
  <Link to={report.path} className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700">{t(report.title)}</h3>
      {report.center && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">{t("Excel · PDF · Print")}</span>}
    </div>
    <p className="mt-1 text-xs leading-5 text-slate-500">{t(report.description)}</p>
  </Link>
);

/**
 * The business reports (backlog 8.2). Without a module: every report, grouped by module, with search (Reports → All
 * reports). With one: just that module's reports (Reports → Sales, Purchase, …). Only reports the user can open show.
 */
const ReportCenter: React.FC<{ module?: ReportModule }> = ({ module }) => {
  const { access } = useContext(AuthContext);
  const { region, country } = useCompanyPlace();
  const [search, setSearch] = useState("");
  const current = REPORT_MODULES.find((m) => m.module === module);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const open = REPORTS.filter((r) => canAccessPath(access, r.path) && pageForPlace(r.path, { region, country })).filter(
      (r) => !query || [r.title, r.description, t(r.title), t(r.description)].some((text) => text.toLowerCase().includes(query))
    );
    return REPORT_MODULES.filter((m) => !module || m.module === module)
      .map((m) => ({ ...m, reports: open.filter((r) => r.module === m.module) }))
      .filter((m) => m.reports.length > 0);
  }, [access, search, module, region, country]);

  const title = current ? `${t(current.title)} — ${t("Reports")}` : t("All reports");

  return (
    <>
      <PageMeta title={title} description={current?.description ?? "All business reports"} />
      <PageBreadcrumb pageTitle={title} />

      <div className="w-full max-w-none space-y-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {current ? t(current.description) : t("Pick a report. You see the reports your rights let you open.")}
            {current && (
              <Link to="/reports" className="ms-2 font-medium text-cyan-700 hover:underline">
                {t("All reports")}
              </Link>
            )}
          </p>
          <label className="relative w-full max-w-xs">
            <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search reports")}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white ps-9 pe-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </label>
        </div>

        {groups.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white py-10 text-center">
            <ChartBarSquareIcon className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">{t(search ? "No report matches your search." : "You don't have access to any report yet.")}</p>
          </div>
        )}

        {groups.map((g) => (
          <section key={g.module}>
            {!module && (
              <div className="mb-2 flex items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{t(g.title)}</h2>
                  <p className="text-xs text-slate-500">{t(g.description)}</p>
                </div>
                <Link to={g.path} className="inline-flex items-center gap-0.5 text-xs font-medium text-cyan-700 hover:underline">
                  {t("Only these")}
                  <ChevronRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.reports.map((r) => (
                <ReportCard key={r.path} report={r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
};

export default ReportCenter;

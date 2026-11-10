import React, { useContext, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChartBarSquareIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { AuthContext } from "../../../context/AuthContext";
import { canAccessPath } from "../../../access/access";
import { REPORTS, REPORT_FAMILIES } from "./reportCatalogue";
import { t } from "../../../i18n/i18n";

/** All business reports in one place, grouped by family; only the ones the user can open are listed. */
const ReportCenter: React.FC = () => {
  const { access } = useContext(AuthContext);
  const [search, setSearch] = useState("");

  const families = useMemo(() => {
    const query = search.trim().toLowerCase();
    const open = REPORTS.filter((r) => canAccessPath(access, r.path)).filter(
      (r) => !query || [r.title, r.description, t(r.title), t(r.description)].some((text) => text.toLowerCase().includes(query))
    );
    return REPORT_FAMILIES.map((f) => ({ ...f, reports: open.filter((r) => r.family === f.family) })).filter((f) => f.reports.length > 0);
  }, [access, search]);

  return (
    <>
      <PageMeta title={t("Report Center")} description="All business reports" />
      <PageBreadcrumb pageTitle="Report Center" />

      <div className="w-full max-w-none space-y-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t("Pick a report. You see the reports your rights let you open.")}</p>
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

        {families.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white py-10 text-center">
            <ChartBarSquareIcon className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm text-slate-500">{t(search ? "No report matches your search." : "You don't have access to any report yet.")}</p>
          </div>
        )}

        {families.map((f) => (
          <section key={f.family}>
            <div className="mb-2">
              <h2 className="text-base font-semibold text-slate-900">{t(f.family)}</h2>
              <p className="text-xs text-slate-500">{t(f.description)}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {f.reports.map((r) => (
                <Link
                  key={r.path}
                  to={r.path}
                  className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700">{t(r.title)}</h3>
                    {r.center && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">{t("Excel · PDF · Print")}</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{t(r.description)}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
};

export default ReportCenter;

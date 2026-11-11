import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { UsersIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, labelOf, monthLabel } from "../../Invoice/invoiceShared";
import { BarList, ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, SelectField, TotalCard, initialPeriod, num, useSyncedParams } from "./reportKit";
import { t } from "../../../i18n/i18n";

interface Person {
  id: number;
  employeeCode?: string | null;
  name: string;
  department: string;
  designation?: string | null;
  employmentType?: string | null;
  joiningDate?: string | null;
  leavingDate?: string | null;
  monthsOfService?: number | null;
}

interface Report {
  totals: { opening: number; joiners: number; leavers: number; closing: number; turnoverPercent: number; inactiveWithoutDate: number; byEmploymentType: Record<string, number> };
  departments: { department: string; opening: number; joiners: number; leavers: number; closing: number }[];
  months: { month: string; joiners: number; leavers: number; headcount: number }[];
  joiners: Person[];
  leavers: Person[];
}

type DeptRow = Report["departments"][number] & { id: string };
const MODULES = ["HRM"];
// The service's own label, never a department's name, is translated
const dept = (name: string) => (name === "No department" ? t(name) : name);

/** Headcount, joiners and leavers in a period (backlog 8.2.1.6), by department and month. */
const Headcount: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "this-year"));
  const [department, setDepartment] = useState(params.get("department") ?? "");
  const [departments, setDepartments] = useState<string[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Report>("/v1/api/common/employee/reports/headcount", {
        params: { from: period.from, to: period.to, department: department || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && res.data.totals ? res.data : null);
      // Remember the departments seen, so the filter keeps them while one is chosen
      setDepartments((known) => Array.from(new Set([...known, ...(res.data?.departments ?? []).map((d) => d.department)])).sort());
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the headcount"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, department]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, department });

  const totals = report?.totals;
  const rows: DeptRow[] = useMemo(() => (report?.departments ?? []).map((d) => ({ ...d, id: d.department })), [report]);
  const chart = useMemo(
    () => (report?.months ?? []).map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.headcount, display: `${m.headcount} · +${m.joiners} −${m.leavers}` })),
    [report]
  );
  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };
  const columns: ColumnDef<DeptRow>[] = [
    { key: "department", label: "Department", sortable: true, render: (r) => <span className="text-sm font-semibold text-slate-900">{dept(r.department)}</span> },
    { key: "opening", label: "Opening", ...right, render: (r) => <span className="text-sm text-slate-700">{r.opening}</span> },
    { key: "joiners", label: "Joiners", ...right, render: (r) => <span className="text-sm text-green-700">{r.joiners ? `+${r.joiners}` : "—"}</span> },
    { key: "leavers", label: "Leavers", ...right, render: (r) => <span className="text-sm text-red-600">{r.leavers ? `−${r.leavers}` : "—"}</span> },
    { key: "closing", label: "Closing", ...right, render: (r) => <span className="text-sm font-semibold text-slate-900">{r.closing}</span> },
  ];
  const exportColumns: ReportColumn<DeptRow>[] = [
    { label: "Department", value: (r) => (r.id === "totals" ? r.department : dept(r.department)) },
    { label: "Opening", value: (r) => r.opening, format: "number" },
    { label: "Joiners", value: (r) => r.joiners, format: "number" },
    { label: "Leavers", value: (r) => r.leavers, format: "number" },
    { label: "Closing", value: (r) => r.closing, format: "number" },
  ];
  const totalsRow = totals ? { id: "totals", department: t("Total"), opening: totals.opening, joiners: totals.joiners, leavers: totals.leavers, closing: totals.closing } : undefined;
  const details = department ? [{ label: "Department", value: dept(department) }] : [];

  const people = (title: string, list: Person[], leaving: boolean) => (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        {t(title)} ({list.length})
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-slate-400">{t("None in this period")}</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="ms-2 text-xs text-slate-500">{[p.employeeCode, dept(p.department), p.designation, p.employmentType ? labelOf(p.employmentType) : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="text-xs text-slate-600">
                {dateLabel(leaving ? p.leavingDate : p.joiningDate)}
                {leaving && p.monthsOfService != null ? ` · ${p.monthsOfService} ${t("months of service")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <PageMeta title={t("Headcount")} description="Headcount, joiners and leavers by department and month" />
      <PageBreadcrumb pageTitle="Headcount" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || !report} report={{ title: "Headcount", period, columns: exportColumns, rows, totals: totalsRow, details }} />}>
          <PeriodPicker value={period} onChange={setPeriod} />
          {departments.length > 0 && <SelectField label="Department" value={department} options={departments.map((d) => ({ value: d, label: dept(d) }))} allLabel="All departments" onChange={setDepartment} />}
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TotalCard label="Opening" value={String(totals?.opening ?? 0)} hint={dateLabel(period.from)} />
          <TotalCard label="Joiners" tone="green" value={`+${totals?.joiners ?? 0}`} />
          <TotalCard label="Leavers" tone="red" value={`−${totals?.leavers ?? 0}`} />
          <TotalCard label="Closing" tone="cyan" value={String(totals?.closing ?? 0)} hint={dateLabel(period.to)} />
          <TotalCard
            label="Turnover"
            value={`${num(totals?.turnoverPercent).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`}
            hint={Object.entries(totals?.byEmploymentType ?? {}).map(([k, v]) => `${labelOf(k)} ${v}`).join(" · ") || undefined}
          />
        </div>

        {(totals?.inactiveWithoutDate ?? 0) > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {`${totals?.inactiveWithoutDate} ${t("inactive employees have no exit date, so they are left out. Record their exit to count them.")}`}
          </p>
        )}

        <BarList title="Headcount at each month's end" rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          defaultSortKey="closing"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <UsersIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {people("Joiners", report?.joiners ?? [], false)}
          {people("Leavers", report?.leavers ?? [], true)}
        </div>

        <p className="text-xs text-slate-500">
          {t("Someone counts from their joining date to their last working day (or exit date). Turnover is leavers out of the average of the opening and closing headcount.")}
        </p>
      </div>
    </>
  );
};

export default Headcount;

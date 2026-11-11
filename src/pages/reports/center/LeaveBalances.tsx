import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, ReportColumn, SelectField, TotalCard, count, num, useSyncedParams } from "./reportKit";
import { t } from "../../../i18n/i18n";

interface Balance {
  entitled: number;
  used: number;
  pending: number;
  available: number;
}

interface EmployeeRow {
  employeeId: number;
  employeeCode?: string | null;
  employeeName: string;
  balances: Record<string, Balance>;
  available: number;
  yearClosed: boolean;
}

interface Report {
  year?: number | null;
  years: number[];
  types: { code: string; name: string; employees: number; entitled: number; used: number; pending: number; available: number }[];
  rows: EmployeeRow[];
}

type Row = EmployeeRow & { id: string };
const MODULES = ["ATTENDANCE"];
const days = (n?: number) => num(n).toLocaleString(undefined, { maximumFractionDigits: 1 });

/** Every employee's leave of one leave year by type (backlog 8.2.1.6): entitled, taken, waiting and left. */
const LeaveBalances: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [year, setYear] = useState(params.get("year") ?? "");
  const [leaveType, setLeaveType] = useState(params.get("leaveType") ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Report>("/v1/api/attendance/reports/leave-balances", {
        params: { year: year || undefined, leaveType: leaveType || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the leave balances"));
    } finally {
      setLoading(false);
    }
  }, [year, leaveType]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { year, leaveType });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: String(r.employeeId) })), [report]);
  const types = report?.types ?? [];
  const typeName = (code: string) => types.find((x) => x.code === code)?.name ?? code;

  const columns: ColumnDef<Row>[] = [
    {
      key: "employeeName",
      label: "Employee",
      sortable: true,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.employeeName}</span>
          <span className="block text-xs text-slate-500">{[r.employeeCode, r.yearClosed ? t("Year closed") : null].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    ...types.map(
      (type): ColumnDef<Row> => ({
        key: `t-${type.code}`,
        label: type.name,
        sortable: true,
        headerClassName: "text-right",
        className: "text-right",
        sortValueGetter: (r) => num(r.balances[type.code]?.available),
        render: (r) => {
          const b = r.balances[type.code];
          return b ? (
            <span className="text-sm" title={`${t("Entitled")} ${days(b.entitled)} · ${t("Taken")} ${days(b.used)} · ${t("Waiting")} ${days(b.pending)}`}>
              <span className={`font-semibold ${num(b.available) <= 0 ? "text-red-600" : "text-slate-900"}`}>{days(b.available)}</span>
              <span className="block text-xs text-slate-500">{`${days(b.used)} ${t("of")} ${days(b.entitled)} ${t("taken")}`}</span>
            </span>
          ) : (
            <span className="text-sm text-slate-300">—</span>
          );
        },
      })
    ),
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Employee", value: (r) => r.employeeName },
    { label: "Code", value: (r) => r.employeeCode ?? "" },
    ...types.flatMap((type) => [
      { label: `${type.name} — ${t("Entitled")}`, value: (r: Row) => num(r.balances[type.code]?.entitled), format: "number" } as ReportColumn<Row>,
      { label: `${type.name} — ${t("Taken")}`, value: (r: Row) => num(r.balances[type.code]?.used), format: "number" } as ReportColumn<Row>,
      { label: `${type.name} — ${t("Waiting")}`, value: (r: Row) => num(r.balances[type.code]?.pending), format: "number" } as ReportColumn<Row>,
      { label: `${type.name} — ${t("Left")}`, value: (r: Row) => num(r.balances[type.code]?.available), format: "number" } as ReportColumn<Row>,
    ]),
  ];
  const totalsRow: Row | undefined = report
    ? { id: "totals", employeeId: 0, employeeName: t("Total"), available: 0, yearClosed: false, balances: Object.fromEntries(types.map((x) => [x.code, { entitled: x.entitled, used: x.used, pending: x.pending, available: x.available }])) }
    : undefined;
  const details = [
    ...(report?.year ? [{ label: "Leave year", value: String(report.year) }] : []),
    ...(leaveType ? [{ label: "Leave type", value: typeName(leaveType) }] : []),
  ];
  const exportPeriod = { preset: "custom" as const, from: report?.year ? `${report.year}-01-01` : "", to: report?.year ? `${report.year}-12-31` : "" };

  return (
    <>
      <PageMeta title={t("Leave Balances")} description="Every employee's leave by type for a leave year" />
      <PageBreadcrumb pageTitle="Leave Balances" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Leave Balances", period: exportPeriod, columns: exportColumns, rows, totals: totalsRow, details }} />}
        >
          <SelectField
            label="Leave year"
            value={year || String(report?.year ?? "")}
            options={(report?.years ?? []).map((y) => ({ value: String(y), label: String(y) }))}
            allLabel="Latest"
            onChange={setYear}
          />
          {types.length > 0 && <SelectField label="Leave type" value={leaveType} options={types.map((x) => ({ value: x.code, label: x.name }))} allLabel="All leave types" onChange={setLeaveType} />}
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {types.slice(0, 4).map((type, i) => (
            <TotalCard
              key={type.code}
              label={type.name}
              tone={(["cyan", "green", "slate", "slate"] as const)[i]}
              value={`${days(type.available)} ${t("days left")}`}
              hint={`${days(type.used)} ${t("of")} ${days(type.entitled)} ${t("taken")} · ${count(type.employees, "employee", "employees")}`}
            />
          ))}
        </div>

        <p className="text-xs text-slate-500">
          {t("Each cell shows the days left, and below it the days taken of those entitled (allocated, carried forward and adjusted). Leave waiting for approval is already taken off what is left. Point at a cell for the details.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable
          searchFields={["employeeName", "employeeCode"]}
          searchPlaceholder={t("Search employees")}
          defaultSortKey="employeeName"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <CalendarDaysIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No leave balances for this year")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default LeaveBalances;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, money, monthLabel } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, ReportWarnings, SelectField, TotalCard, count, initialPeriod, num, useSyncedParams } from "./reportKit";
import { t } from "../../../i18n/i18n";

type GroupBy = "EMPLOYEE" | "DEPARTMENT" | "MONTH";

const GROUPS: { value: GroupBy; label: string; column: string }[] = [
  { value: "EMPLOYEE", label: "By employee", column: "Employee" },
  { value: "DEPARTMENT", label: "By department", column: "Department" },
  { value: "MONTH", label: "By month", column: "Month" },
];

interface RegisterRow {
  key: string;
  code?: string | null;
  label: string;
  department?: string | null;
  employees: number;
  payslips: number;
  gross: number;
  deductions: number;
  net: number;
  employerContributions: number;
  lossOfPay: number;
  months: Record<string, number>;
}

interface Register {
  months: string[];
  rows: RegisterRow[];
  totals: { employees: number; payslips: number; gross: number; deductions: number; net: number; employerContributions: number; lossOfPay: number; awaitingApproval: number };
  currencies: string[];
  warnings: string[];
}

type Row = RegisterRow & { id: string };
const MODULES = ["HRM"];
const ownLabel = (label: string) => (label === "No department" ? t(label) : label);

/** What each employee was paid, month by month (backlog 8.2.1.6), from approved payroll runs. */
const PayrollRegister: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params, "this-year"));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "EMPLOYEE");
  const [department, setDepartment] = useState(params.get("department") ?? "");
  const [departments, setDepartments] = useState<string[]>([]);
  const [report, setReport] = useState<Register | null>(null);
  const [loading, setLoading] = useState(false);
  const from = period.from.slice(0, 7), to = period.to.slice(0, 7);

  const load = useCallback(async () => {
    if (!from || !to) return;
    try {
      setLoading(true);
      const res = await axios.get<Register>("/v1/api/payroll/reports/register", {
        params: { from, to, groupBy, department: department || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
      if (groupBy === "DEPARTMENT" && !department) setDepartments((res.data?.rows ?? []).map((r) => r.label).sort());
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the payroll register"));
    } finally {
      setLoading(false);
    }
  }, [from, to, groupBy, department]);

  useEffect(() => {
    load();
  }, [load]);

  // The department list comes from the register grouped by department
  useEffect(() => {
    if (departments.length > 0 || !from || !to) return;
    axios
      .get<Register>("/v1/api/payroll/reports/register", { params: { from, to, groupBy: "DEPARTMENT" }, skipSessionExpiredHandling: true } as object)
      .then((r) => setDepartments((r.data?.rows ?? []).map((x) => x.label).sort()))
      .catch(() => setDepartments([]));
  }, [from, to, departments.length]);

  useSyncedParams(setParams, { from: period.from, to: period.to, groupBy, department });

  const group = GROUPS.find((g) => g.value === groupBy) ?? GROUPS[0];
  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.key })), [report]);
  const months = report?.months ?? [];
  const totals = report?.totals;
  const label = (r: RegisterRow) => (groupBy === "MONTH" ? monthLabel(r.label) : ownLabel(r.label));
  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };

  const columns: ColumnDef<Row>[] = [
    {
      key: "label",
      label: group.column,
      sortable: true,
      sortValueGetter: (r) => (groupBy === "MONTH" ? r.key : label(r)),
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{label(r)}</span>
          <span className="block text-xs text-slate-500">
            {groupBy === "EMPLOYEE" ? [r.code, r.department ? ownLabel(r.department) : null].filter(Boolean).join(" · ") : count(r.employees, "employee", "employees")}
          </span>
        </span>
      ),
    },
    // Net pay of each month, for an employee or a department
    ...(groupBy !== "MONTH" && months.length <= 12
      ? months.map(
          (m): ColumnDef<Row> => ({
            key: `m-${m}`,
            label: monthLabel(m),
            ...right,
            sortValueGetter: (r) => num(r.months?.[m]),
            render: (r) => <span className="text-xs text-slate-600">{r.months?.[m] == null ? "—" : money(r.months[m])}</span>,
          })
        )
      : []),
    { key: "gross", label: "Gross", ...right, sortValueGetter: (r) => num(r.gross), render: (r) => <span className="text-sm text-slate-700">{money(r.gross)}</span> },
    { key: "deductions", label: "Deductions", ...right, sortValueGetter: (r) => num(r.deductions), render: (r) => <span className="text-sm text-red-600">{money(r.deductions)}</span> },
    { key: "net", label: "Net pay", ...right, sortValueGetter: (r) => num(r.net), render: (r) => <span className="text-sm font-semibold text-slate-900">{money(r.net)}</span> },
    { key: "employerContributions", label: "Employer contributions", ...right, sortValueGetter: (r) => num(r.employerContributions), render: (r) => <span className="text-sm text-slate-600">{money(r.employerContributions)}</span> },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: group.column, value: (r) => (r.key === "totals" ? r.label : label(r)) },
    ...(groupBy === "EMPLOYEE" ? [{ label: "Code", value: (r: Row) => r.code ?? "" }, { label: "Department", value: (r: Row) => (r.department ? ownLabel(r.department) : "") }] : []),
    ...(groupBy !== "MONTH" ? months.map((m) => ({ label: monthLabel(m), value: (r: Row) => num(r.months?.[m]), format: "money" }) as ReportColumn<Row>) : []),
    { label: "Payslips", value: (r) => r.payslips, format: "number" },
    { label: "Gross", value: (r) => num(r.gross), format: "money" },
    { label: "Deductions", value: (r) => num(r.deductions), format: "money" },
    { label: "Net pay", value: (r) => num(r.net), format: "money" },
    { label: "Employer contributions", value: (r) => num(r.employerContributions), format: "money" },
  ];
  const totalsRow: Row | undefined = totals
    ? { id: "totals", key: "totals", label: t("Total"), employees: totals.employees, payslips: totals.payslips, gross: totals.gross, deductions: totals.deductions, net: totals.net, employerContributions: totals.employerContributions, lossOfPay: totals.lossOfPay, months: Object.fromEntries(months.map((m) => [m, rows.reduce((s, r) => s + num(r.months?.[m]), 0)])) }
    : undefined;
  const details = [{ label: "Grouped", value: t(group.label) }, ...(department ? [{ label: "Department", value: ownLabel(department) }] : [])];
  const currency = report?.currencies?.length === 1 ? report.currencies[0] : undefined;
  const fmt = (v?: number) => money(v, currency);

  return (
    <>
      <PageMeta title={t("Payroll Register")} description="Pay by employee and month from approved payroll runs" />
      <PageBreadcrumb pageTitle="Payroll Register" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Payroll Register", period, columns: exportColumns, rows, totals: totalsRow, details }} />}>
          <PeriodPicker value={period} onChange={setPeriod} />
          {departments.length > 0 && <SelectField label="Department" value={department} options={departments.map((d) => ({ value: d, label: ownLabel(d) }))} allLabel="All departments" onChange={setDepartment} />}
        </FilterBar>

        <div className="flex flex-wrap gap-2" role="tablist">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="tab"
              aria-selected={g.value === groupBy}
              onClick={() => setGroupBy(g.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${g.value === groupBy ? "bg-cyan-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {t(g.label)}
            </button>
          ))}
        </div>

        <ReportWarnings warnings={report?.warnings} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Gross" tone="cyan" value={fmt(totals?.gross)} hint={count(totals?.payslips, "payslip", "payslips")} />
          <TotalCard label="Deductions" tone="red" value={fmt(totals?.deductions)} hint={num(totals?.lossOfPay) > 0 ? `${t("Loss of pay")} ${fmt(totals?.lossOfPay)}` : undefined} />
          <TotalCard label="Net pay" tone="green" value={fmt(totals?.net)} hint={count(totals?.employees, "employee", "employees")} />
          <TotalCard label="Employer contributions" value={fmt(totals?.employerContributions)} hint={t("On top of gross pay")} />
        </div>

        <p className="text-xs text-slate-500">
          {t("Salaries of processed payroll runs in the months of the period; a run still waiting for approval is left out. The month columns show net pay (up to 12 months on screen; the export has them all).")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          searchable={groupBy === "EMPLOYEE"}
          searchFields={["label", "code", "department"]}
          searchPlaceholder={t("Search employees")}
          defaultSortKey={groupBy === "MONTH" ? "label" : "net"}
          defaultSortOrder={groupBy === "MONTH" ? "asc" : "desc"}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BanknotesIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No payroll in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default PayrollRegister;

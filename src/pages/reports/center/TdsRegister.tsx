import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ReceiptPercentIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, money, monthLabel } from "../../Invoice/invoiceShared";
import { Field, FilterBar, ReportWarnings, TotalCard, count, num, useSyncedParams } from "./reportKit";
import { t } from "../../../i18n/i18n";

type DepositStatus = "NOTHING_DEDUCTED" | "NOT_DUE" | "DUE" | "OVERDUE" | "DEPOSITED" | "DEPOSITED_LATE" | "SHORT";
type PanStatus = "VALID" | "MISSING" | "INVALID" | null;

interface Deposit {
  amount: number;
  bsrCode: string;
  challanNumber: string;
  depositDate: string;
  recordedBy?: string | null;
}

interface MonthTotal {
  month: string;
  dueDate: string;
  employees: number;
  tds: number;
  deposit: Deposit | null;
  status: DepositStatus;
}

interface Year {
  financialYear: string;
  months: MonthTotal[];
  deducted: number;
  deposited: number;
  outstanding: number;
  employeesWithoutPan: number;
}

interface Line {
  employeeId: number;
  code?: string | null;
  name: string;
  pan?: string | null;
  panStatus: PanStatus;
  gross: number;
  tds: number;
  regime?: string | null;
  fromOldSystem: boolean;
}

interface MonthRegister extends MonthTotal {
  gross: number;
  lines: Line[];
  warnings: string[];
}

const API = "/v1/api/payroll/tds";
const inputClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20";

const STATUS: Record<DepositStatus, { label: string; tone: string }> = {
  NOTHING_DEDUCTED: { label: "No tax deducted", tone: "bg-slate-100 text-slate-500" },
  NOT_DUE: { label: "Not due yet", tone: "bg-slate-100 text-slate-700" },
  DUE: { label: "To pay", tone: "bg-amber-100 text-amber-800" },
  OVERDUE: { label: "Overdue", tone: "bg-red-100 text-red-700" },
  DEPOSITED: { label: "Paid", tone: "bg-green-100 text-green-700" },
  DEPOSITED_LATE: { label: "Paid late", tone: "bg-amber-100 text-amber-800" },
  SHORT: { label: "Paid short", tone: "bg-red-100 text-red-700" },
};

const PAN: Record<string, string> = { MISSING: "No PAN", INVALID: "PAN not valid" };

/** The financial year a date falls in: April to March, e.g. "2026-27". */
const financialYearOf = (d = new Date()) => {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};
const yearsBack = (n: number) => {
  const start = Number(financialYearOf().slice(0, 4));
  return Array.from({ length: n }, (_, i) => `${start - i}-${String((start - i + 1) % 100).padStart(2, "0")}`);
};
// "7 Nov 2026": day and month order can't be misread (due dates are always the 7th or the 30th)
const day = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

const StatusBadge: React.FC<{ status: DepositStatus }> = ({ status }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[status].tone}`}>{t(STATUS[status].label)}</span>
);

interface Deductor {
  tan?: string | null;
  responsiblePerson?: string | null;
  responsibleFatherName?: string | null;
  responsibleDesignation?: string | null;
  signingPlace?: string | null;
}

/**
 * The deductor on Form 16 and the TDS return: the company's TAN and the person responsible for deducting tax, who
 * signs Form 16's verification. Shown filled in, with Edit; a missing TAN is called out.
 */
const DeductorCard: React.FC = () => {
  const [saved, setSaved] = useState<Deductor | null>(null);
  const [form, setForm] = useState<Deductor | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get<Deductor>(`${API}/deductor`).then((r) => setSaved(r.data ?? {})).catch(() => setSaved(null));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      setBusy(true);
      const r = await axios.put<Deductor>(`${API}/deductor`, form);
      setSaved(r.data);
      setForm(null);
      ToasterService.success(t("Deductor details saved"));
    } catch (err) {
      ToasterService.error(apiError(err, "The deductor details could not be saved"));
    } finally {
      setBusy(false);
    }
  };

  if (!saved) return null;
  const fields: { key: keyof Deductor; label: string; hint?: string }[] = [
    { key: "tan", label: "TAN", hint: "4 letters, 5 digits, a letter" },
    { key: "responsiblePerson", label: "Person responsible" },
    { key: "responsibleFatherName", label: "Their father's name" },
    { key: "responsibleDesignation", label: "Designation" },
    { key: "signingPlace", label: "Place" },
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-transparent dark:bg-[#191919]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("Deductor details")}</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400">{t("On Form 16 and the TDS return: the company's TAN and who signs the certificate.")}</p>
        </div>
        {!form && (
          <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300"
            onClick={() => setForm({ ...saved })}>{t("Edit")}</button>
        )}
      </div>
      {form ? (
        <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <input className={`${inputClass} ${f.key === "tan" ? "font-mono uppercase" : ""}`} value={form[f.key] ?? ""} placeholder={f.hint}
                maxLength={f.key === "tan" ? 10 : 100} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </Field>
          ))}
          <button type="submit" disabled={busy} className="h-10 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            {busy ? t("Saving…") : t("Save")}
          </button>
          <button type="button" className="h-10 rounded-lg px-3 text-sm text-slate-600 dark:text-gray-300" onClick={() => setForm(null)}>{t("Cancel")}</button>
        </form>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5">
          {fields.map((f) => (
            <div key={f.key}>
              <dt className="text-[11px] text-slate-500 dark:text-gray-400">{t(f.label)}</dt>
              <dd className={`${saved[f.key] ? "text-slate-800 dark:text-gray-200" : "text-red-600"} ${f.key === "tan" ? "font-mono" : ""}`}>
                {saved[f.key] || t("not set")}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

interface ReturnQuarter {
  financialYear: string;
  quarter: number;
  months: string;
  dueDate: string;
  challans: { serial: number }[];
  deductions: { employeeId: number }[];
  taxDeducted: number;
  taxDeposited: number;
  employees: number;
  problems: string[];
  warnings: string[];
}

/**
 * The quarterly TDS return on salaries (24Q) for the chosen year: pick a quarter, see what it holds and what to fix
 * before filing, and download the working (deductor, challans, deductees, and the salary details in Q4) for the
 * Return Preparation Utility.
 */
const ReturnCard: React.FC<{ year: string }> = ({ year }) => {
  const [quarter, setQuarter] = useState<number | null>(null);
  const [data, setData] = useState<ReturnQuarter | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    if (!quarter) return;
    setLoading(true);
    axios.get<ReturnQuarter>(`${API}/return`, { params: { year, quarter } })
      .then((r) => setData(r.data ?? null))
      .catch((err) => ToasterService.error(apiError(err, "The quarter could not be loaded")))
      .finally(() => setLoading(false));
  }, [year, quarter]);

  const download = async () => {
    if (!quarter) return;
    try {
      const res = await axios.get<Blob>(`${API}/return/export`, { params: { year, quarter }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `24Q-${year}-Q${quarter}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(apiError(err, "The working could not be downloaded"));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-transparent dark:bg-[#191919]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("Quarterly return (24Q)")}</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400">{t("The quarter's challans and deductions, checked, as a working for the Return Preparation Utility.")}</p>
        </div>
        <div className="flex gap-1.5" role="tablist">
          {[1, 2, 3, 4].map((q) => (
            <button key={q} type="button" role="tab" aria-selected={quarter === q} onClick={() => setQuarter(q)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${quarter === q ? "bg-cyan-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300"}`}>
              Q{q}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="mt-3 text-sm text-slate-500">{t("Loading…")}</p>}
      {data && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-700 dark:text-gray-300">
            <span><span className="text-slate-500">{t("Months")}</span> {data.months}</span>
            <span><span className="text-slate-500">{t("Due by")}</span> {day(data.dueDate)}</span>
            <span><span className="text-slate-500">{t("Employees")}</span> {data.employees}</span>
            <span><span className="text-slate-500">{t("Deducted")}</span> {money(data.taxDeducted)}</span>
            <span><span className="text-slate-500">{t("Deposited")}</span> {money(data.taxDeposited)}</span>
            <span><span className="text-slate-500">{t("Challans")}</span> {data.challans.length}</span>
            <button type="button" onClick={download} disabled={data.deductions.length === 0}
              className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300">
              {t("Download working (Excel)")}
            </button>
          </div>
          {data.problems.length === 0 && data.deductions.length > 0 ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">{t("No problems found: ready to prepare the return.")}</p>
          ) : data.problems.length > 0 && (
            <ul className="list-disc space-y-0.5 rounded-md border-l-4 border-red-500 bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800 dark:bg-[#222] dark:text-red-300">
              {data.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {data.warnings.length > 0 && <ReportWarnings warnings={data.warnings} />}
          {data.deductions.length === 0 && <p className="text-sm text-slate-500">{t("No tax deducted in this quarter.")}</p>}
          <p className="text-[11px] text-slate-500 dark:text-gray-400">
            {t("The official upload file (FVU) is made in the Return Preparation Utility from this working; the receipt numbers it gives go on Form 16 Part A.")}
          </p>
        </div>
      )}
    </section>
  );
};

/**
 * TDS register (docs/HRMS-TENANT-DATA-MIGRATION.md §8.1): the income tax deducted from salaries each month, with each
 * employee's PAN, for finance to pay to the income-tax department by the due date; the challan is recorded here.
 */
const TdsRegister: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [year, setYear] = useState(() => params.get("year") || financialYearOf());
  const [month, setMonth] = useState(params.get("month") ?? "");
  const [summary, setSummary] = useState<Year | null>(null);
  const [register, setRegister] = useState<MonthRegister | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({ amount: "", bsrCode: "", challanNumber: "", depositDate: "" });
  const [saving, setSaving] = useState(false);

  const loadYear = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Year>(`${API}/year`, { params: { year } });
      setSummary(res.data && Array.isArray(res.data.months) ? res.data : null);
    } catch (err) {
      setSummary(null);
      ToasterService.error(apiError(err, "Failed to load the TDS register"));
    } finally {
      setLoading(false);
    }
  }, [year]);

  const loadMonth = useCallback(async () => {
    if (!month) {
      setRegister(null);
      return;
    }
    try {
      const res = await axios.get<MonthRegister>(`${API}/month`, { params: { month } });
      setRegister(res.data && Array.isArray(res.data.lines) ? res.data : null);
    } catch (err) {
      setRegister(null);
      ToasterService.error(apiError(err, "Failed to load the month's TDS"));
    }
  }, [month]);

  useEffect(() => {
    loadYear();
  }, [loadYear]);
  useEffect(() => {
    loadMonth();
    setPaying(false);
  }, [loadMonth]);
  useSyncedParams(setParams, { year, month });

  const openPayment = () => {
    if (!register) return;
    const d = register.deposit;
    setForm({
      amount: String(d?.amount ?? register.tds ?? ""),
      bsrCode: d?.bsrCode ?? "",
      challanNumber: d?.challanNumber ?? "",
      depositDate: d?.depositDate ?? new Date().toISOString().slice(0, 10),
    });
    setPaying(true);
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axios.post(`${API}/deposits`, { month, amount: Number(form.amount), bsrCode: form.bsrCode, challanNumber: form.challanNumber, depositDate: form.depositDate });
      ToasterService.success(t("Payment recorded"));
      setPaying(false);
      await Promise.all([loadMonth(), loadYear()]);
    } catch (err) {
      ToasterService.error(apiError(err, "The payment could not be recorded"));
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async () => {
    if (!window.confirm(t("Take off the payment recorded for this month?"))) return;
    try {
      await axios.delete(`${API}/deposits/${month}`);
      ToasterService.success(t("Payment taken off"));
      await Promise.all([loadMonth(), loadYear()]);
    } catch (err) {
      ToasterService.error(apiError(err, "The payment could not be taken off"));
    }
  };

  const download = async () => {
    try {
      const res = await axios.get<Blob>(`${API}/month/export`, { params: { month }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tds-register-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(apiError(err, "The register could not be downloaded"));
    }
  };

  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };
  const monthRows = useMemo(() => (summary?.months ?? []).map((m) => ({ ...m, id: m.month })), [summary]);
  const monthColumns: ColumnDef<MonthTotal & { id: string }>[] = [
    {
      key: "month",
      label: "Month",
      sortable: true,
      sortValueGetter: (r) => r.month,
      render: (r) => (
        <button type="button" className="text-sm font-semibold text-cyan-700 hover:underline" onClick={() => setMonth(r.month)}>
          {monthLabel(r.month)}
        </button>
      ),
    },
    { key: "employees", label: "Employees", ...right, sortValueGetter: (r) => r.employees, render: (r) => <span className="text-sm">{r.employees}</span> },
    { key: "tds", label: "TDS deducted", ...right, sortValueGetter: (r) => num(r.tds), render: (r) => <span className="text-sm font-semibold">{money(r.tds)}</span> },
    { key: "dueDate", label: "Due by", sortable: true, sortValueGetter: (r) => r.dueDate, render: (r) => <span className="text-sm text-slate-600">{day(r.dueDate)}</span> },
    { key: "paid", label: "Paid", ...right, sortValueGetter: (r) => num(r.deposit?.amount), render: (r) => <span className="text-sm">{r.deposit ? money(r.deposit.amount) : "—"}</span> },
    {
      key: "challan",
      label: "Challan",
      render: (r) => (
        <span className="text-xs text-slate-600">{r.deposit ? `${day(r.deposit.depositDate)} · BSR ${r.deposit.bsrCode} · ${r.deposit.challanNumber}` : "—"}</span>
      ),
    },
    { key: "status", label: "Status", sortable: true, sortValueGetter: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const lineRows = useMemo(() => (register?.lines ?? []).map((l) => ({ ...l, id: String(l.employeeId) })), [register]);
  const lineColumns: ColumnDef<Line & { id: string }>[] = [
    {
      key: "name",
      label: "Employee",
      sortable: true,
      sortValueGetter: (r) => r.name,
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{r.name}</span>
          <span className="block text-xs text-slate-500">{[r.code, r.fromOldSystem ? t("From the old system") : null].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      key: "pan",
      label: "PAN",
      sortable: true,
      sortValueGetter: (r) => r.pan ?? "",
      render: (r) =>
        r.panStatus && PAN[r.panStatus] ? (
          <span className="text-sm">
            {r.pan && <span className="font-mono text-slate-700">{r.pan} </span>}
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{t(PAN[r.panStatus])}</span>
          </span>
        ) : (
          <span className="font-mono text-sm text-slate-700">{r.pan ?? "—"}</span>
        ),
    },
    { key: "regime", label: "Regime", sortable: true, render: (r) => <span className="text-xs text-slate-600">{r.regime ?? "—"}</span> },
    { key: "gross", label: "Taxable salary", ...right, sortValueGetter: (r) => num(r.gross), render: (r) => <span className="text-sm text-slate-700">{money(r.gross)}</span> },
    { key: "tds", label: "TDS", ...right, sortValueGetter: (r) => num(r.tds), render: (r) => <span className="text-sm font-semibold">{money(r.tds)}</span> },
  ];

  return (
    <>
      <PageMeta title={t("TDS Register")} description="Income tax deducted from salaries, by employee with PAN, and its payment" />
      <PageBreadcrumb pageTitle="TDS Register" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar>
          <Field label="Financial year">
            <select
              className={`${inputClass} min-w-[9rem]`}
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setMonth("");
              }}
            >
              {yearsBack(6).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="TDS deducted" tone="cyan" value={money(summary?.deducted)} hint={t("April to March")} />
          <TotalCard label="Paid to the department" tone="green" value={money(summary?.deposited)} />
          <TotalCard label="Still to pay" tone={num(summary?.outstanding) > 0 ? "red" : "slate"} value={money(summary?.outstanding)} />
          <TotalCard label="Employees without a valid PAN" tone={num(summary?.employeesWithoutPan) > 0 ? "red" : "slate"} value={String(summary?.employeesWithoutPan ?? 0)} />
        </div>

        <DeductorCard />
        <ReturnCard year={year} />

        <p className="text-xs text-slate-500">
          {t("Tax deducted from processed salaries, months brought in from the old system included. Each month's tax is due by the 7th of the next month, and March's by 30 April. Open a month to see each employee and record the challan.")}
        </p>

        <ReusableTable
          data={monthRows}
          columns={monthColumns}
          pageSize={12}
          loading={loading}
          defaultSortKey="month"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ReceiptPercentIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No tax deducted in this year")}</p>
            </div>
          }
        />

        {register && (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {monthLabel(register.month)} <StatusBadge status={register.status} />
                </h2>
                <p className="text-xs text-slate-500">
                  {count(register.employees, "employee", "employees")} · {t("TDS")} {money(register.tds)} · {t("Due by")} {day(register.dueDate)}
                  {register.deposit && ` · ${t("Paid")} ${money(register.deposit.amount)} ${t("on")} ${day(register.deposit.depositDate)}, BSR ${register.deposit.bsrCode}, ${t("challan")} ${register.deposit.challanNumber}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50" onClick={download} disabled={register.lines.length === 0}>
                  {t("Download Excel")}
                </button>
                {register.tds > 0 && (
                  <button type="button" className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700" onClick={openPayment}>
                    {register.deposit ? t("Correct payment") : t("Record payment")}
                  </button>
                )}
                {register.deposit && (
                  <button type="button" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50" onClick={removePayment}>
                    {t("Take off payment")}
                  </button>
                )}
                <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50" onClick={() => setMonth("")}>
                  {t("Close")}
                </button>
              </div>
            </div>

            {paying && (
              <form onSubmit={savePayment} className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
                <Field label="Amount paid">
                  <input className={inputClass} type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>
                <Field label="BSR code (7 digits)">
                  <input className={inputClass} inputMode="numeric" maxLength={7} required value={form.bsrCode} onChange={(e) => setForm({ ...form, bsrCode: e.target.value })} />
                </Field>
                <Field label="Challan serial number">
                  <input className={inputClass} inputMode="numeric" maxLength={5} required value={form.challanNumber} onChange={(e) => setForm({ ...form, challanNumber: e.target.value })} />
                </Field>
                <Field label="Date paid">
                  <input className={inputClass} type="date" required value={form.depositDate} onChange={(e) => setForm({ ...form, depositDate: e.target.value })} />
                </Field>
                <button type="submit" disabled={saving} className="h-10 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                  {saving ? t("Saving…") : t("Save")}
                </button>
                <button type="button" className="h-10 rounded-lg px-3 text-sm text-slate-600" onClick={() => setPaying(false)}>
                  {t("Cancel")}
                </button>
              </form>
            )}

            <ReportWarnings warnings={register.warnings} />

            <ReusableTable
              data={lineRows}
              columns={lineColumns}
              pageSize={25}
              searchable
              searchFields={["name", "code", "pan"]}
              searchPlaceholder={t("Search employees or PAN")}
              defaultSortKey="name"
              defaultSortOrder="asc"
              emptyState={<p className="py-6 text-center text-sm text-gray-500">{t("No tax deducted this month")}</p>}
            />
          </section>
        )}
      </div>
    </>
  );
};

export default TdsRegister;

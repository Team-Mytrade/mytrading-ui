import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowUturnLeftIcon,
  BanknotesIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { INVOICE_API, PAYMENT_METHOD_OPTIONS, apiError, dateLabel, money, monthLabel, paymentMethodLabel, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import { defaultBankAccountId, useBankAccounts } from "./bankShared";
import BankAccountField from "./BankAccountField";
import { t } from "../../i18n/i18n";

interface StatementLine {
  invoiceId: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  customerName?: string;
  salesValue: number;
  fullCommission: number;
  earnedShare: number;
  earnedToDate: number;
  previouslyApproved: number;
  amount: number;
  note?: string;
}

type StatementStatus = "DRAFT" | "APPROVED" | "PAID" | "PAYROLL";

interface Statement {
  id?: number | null;
  salesPersonId: number;
  salesPersonName?: string;
  employeeId?: number | null;
  month: string;
  status: StatementStatus;
  basis: string;
  currency?: string;
  amount: number;
  salesValue: number;
  lines: StatementLine[];
  postedOn?: string | null;
  approvedAt?: string | null;
  paidOn?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  payrollMonth?: string | null;
  blockedBy?: string | null;
}

interface MonthView {
  month: string;
  monthEnd: string;
  ended: boolean;
  basis: string;
  currency?: string;
  statements: Statement[];
}

interface Rate {
  id: number;
  salesPersonId?: number | null;
  salesPersonName?: string | null;
  productId?: number | null;
  productCode?: string | null;
  productName?: string | null;
  ratePercent: number;
  effectiveFrom: string;
  notes?: string | null;
}

interface SalesPerson {
  id: number;
  name: string;
  code?: string | null;
  active?: boolean | null;
  employeeId?: number | null;
}

interface Product {
  id: number;
  productCode?: string;
  productName?: string;
  active?: boolean;
}

// A table row: drafts have no statement id yet
type Row = Omit<Statement, "id"> & { id: string; statementId?: number | null };
const statementOf = (row: Row): Statement => ({ ...row, id: row.statementId });

const API = `${INVOICE_API}/commission`;
const STATUS: Record<StatementStatus, { label: string; tone: string }> = {
  DRAFT: { label: "To approve", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Approved, unpaid", tone: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  PAID: { label: "Paid", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PAYROLL: { label: "With salaries", tone: "bg-violet-50 text-violet-700 border-violet-200" },
};
const BASIS_OPTIONS = [
  { id: "COLLECTED", name: "As the customer pays (collected)" },
  { id: "INVOICED", name: "When the invoice is issued (invoiced)" },
];

const thisMonth = () => todayInput().slice(0, 7);
const lastMonth = () => {
  const [year, month] = thisMonth().split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const nextMonth = () => {
  const [year, month] = thisMonth().split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const percent = (value: number) => `${Math.round(Number(value || 0) * 1000) / 10}%`;
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: unknown })?.content) ? ((data as { content: T[] }).content) : [];

const emptyRate = () => ({ salesPersonId: "", productId: "", ratePercent: "", effectiveFrom: `${thisMonth()}-01`, notes: "" });

/**
 * Sales commission: each invoice's sales person earns a rate on its value before tax, when the invoice is issued or as
 * the customer pays (the company's rule). A month's statement is what was earned by the month's end less what was
 * approved before; approving books it as owed, and it is then paid from the bank or with the salaries.
 */
const SalesCommission: React.FC = () => {
  const { canApprove } = usePermissions();
  const { access } = useContext(AuthContext);
  const admin = hasPermission(access, "INVOICE:ADMIN");
  const bankAccounts = useBankAccounts();

  const [month, setMonth] = useState(lastMonth);
  const [view, setView] = useState<MonthView | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [shown, setShown] = useState<Statement | null>(null);
  const [paying, setPaying] = useState<Statement | null>(null);
  const [payForm, setPayForm] = useState({ paidOn: todayInput(), paymentMethod: "BANK_TRANSFER", bankAccountId: "", reference: "" });
  const [toPayroll, setToPayroll] = useState<Statement | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(thisMonth);
  const [confirm, setConfirm] = useState<{ kind: "undo" | "undoPayment" | "takeBack"; statement: Statement } | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [rateForm, setRateForm] = useState(emptyRate);
  const [deletingRate, setDeletingRate] = useState<Rate | null>(null);

  const loadMonth = useCallback(async (key: string) => {
    try {
      setLoading(true);
      const res = await axios.get<MonthView>(`${API}/statements`, { params: { month: key } });
      setView(res.data);
    } catch (err) {
      setView(null);
      ToasterService.error(apiError(err, "Could not work out the commission"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRates = useCallback(async () => {
    try {
      const res = await axios.get<Rate[]>(`${API}/rates`);
      setRates(asArray<Rate>(res.data));
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the commission rates"));
    }
  }, []);

  useEffect(() => {
    void loadMonth(month);
  }, [loadMonth, month]);

  useEffect(() => {
    void loadRates();
    axios.get<SalesPerson[]>(`${API}/sales-persons`).then((r) => setSalesPersons(asArray<SalesPerson>(r.data))).catch(() => setSalesPersons([]));
    axios.get("/v1/api/common/products").then((r) => setProducts(asArray<Product>(r.data))).catch(() => setProducts([]));
  }, [loadRates]);

  const currency = view?.currency;
  const rows: Row[] = useMemo(
    () => (view?.statements ?? []).map((s) => ({ ...s, id: s.id ? `s${s.id}` : `p${s.salesPersonId}`, statementId: s.id })),
    [view]
  );
  const totals = useMemo(() => {
    const sum = (status: StatementStatus[]) => rows.filter((r) => status.includes(r.status)).reduce((total, r) => total + Number(r.amount || 0), 0);
    return { toApprove: sum(["DRAFT"]), unpaid: sum(["APPROVED"]), paid: sum(["PAID", "PAYROLL"]) };
  }, [rows]);

  const refresh = async () => {
    await loadMonth(month);
  };

  const approve = async (statement: Statement) => {
    setBusy(true);
    try {
      const { data } = await axios.post<Statement>(`${API}/statements`, { month: statement.month, salesPersonId: statement.salesPersonId });
      ToasterService.success(`${t("Approved")}: ${data.salesPersonName ?? ""}`, `${money(data.amount, data.currency)} ${t("booked as sales commission owed")}`);
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not approve the commission"));
    } finally {
      setBusy(false);
    }
  };

  const openPayment = (statement: Statement) => {
    const method = "BANK_TRANSFER";
    setPayForm({ paidOn: todayInput(), paymentMethod: method, bankAccountId: bankAccounts ? defaultBankAccountId(bankAccounts, method) : "", reference: "" });
    setPaying(statement);
  };

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paying?.id) return;
    setBusy(true);
    try {
      await axios.post(`${API}/statements/${paying.id}/payment`, {
        paidOn: payForm.paidOn || null,
        paymentMethod: payForm.paymentMethod,
        bankAccountId: payForm.bankAccountId ? Number(payForm.bankAccountId) : null,
        reference: payForm.reference.trim() || null,
      });
      ToasterService.success(`${t("Commission paid to")} ${paying.salesPersonName ?? ""}`);
      setPaying(null);
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the payment"));
    } finally {
      setBusy(false);
    }
  };

  const sendToPayroll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!toPayroll?.id) return;
    setBusy(true);
    try {
      await axios.post(`${API}/statements/${toPayroll.id}/payroll`, { month: payrollMonth });
      ToasterService.success(`${t("Sent to the payroll of")} ${monthLabel(payrollMonth)}`,
        t("It is paid with the salary and shown on the payslip as Sales commission."));
      setToPayroll(null);
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not send it to payroll"));
    } finally {
      setBusy(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirm?.statement.id) return;
    const { kind, statement } = confirm;
    setBusy(true);
    try {
      if (kind === "undo") await axios.delete(`${API}/statements/${statement.id}`);
      else if (kind === "undoPayment") await axios.delete(`${API}/statements/${statement.id}/payment`);
      else await axios.delete(`${API}/statements/${statement.id}/payroll`);
      ToasterService.success(kind === "undo" ? "Approval taken back" : kind === "undoPayment" ? "Payment taken back" : "Taken back from payroll");
      setConfirm(null);
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not change the statement"));
    } finally {
      setBusy(false);
    }
  };

  const saveBasis = async (basis: string) => {
    try {
      await axios.put(`${API}/settings`, { basis });
      ToasterService.success("Commission rule saved");
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the rule"));
    }
  };

  const openRate = (rate?: Rate) => {
    setEditingRate(rate ?? null);
    setRateForm(rate ? {
      salesPersonId: rate.salesPersonId ? String(rate.salesPersonId) : "",
      productId: rate.productId ? String(rate.productId) : "",
      ratePercent: String(rate.ratePercent),
      effectiveFrom: rate.effectiveFrom,
      notes: rate.notes ?? "",
    } : emptyRate());
    setRateOpen(true);
  };

  const saveRate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (rateForm.ratePercent === "") return ToasterService.error("Enter the rate");
    const product = products.find((p) => String(p.id) === rateForm.productId);
    const body = {
      salesPersonId: rateForm.salesPersonId ? Number(rateForm.salesPersonId) : null,
      productId: rateForm.productId ? Number(rateForm.productId) : null,
      productCode: product?.productCode ?? (editingRate?.productId === Number(rateForm.productId) ? editingRate?.productCode : null) ?? null,
      productName: product?.productName ?? (editingRate?.productId === Number(rateForm.productId) ? editingRate?.productName : null) ?? null,
      ratePercent: Number(rateForm.ratePercent),
      effectiveFrom: rateForm.effectiveFrom,
      notes: rateForm.notes.trim() || null,
    };
    setBusy(true);
    try {
      if (editingRate) await axios.put(`${API}/rates/${editingRate.id}`, body);
      else await axios.post(`${API}/rates`, body);
      ToasterService.success(editingRate ? "Rate saved" : "Rate added");
      setRateOpen(false);
      await loadRates();
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the rate"));
    } finally {
      setBusy(false);
    }
  };

  const deleteRate = async () => {
    if (!deletingRate) return;
    try {
      await axios.delete(`${API}/rates/${deletingRate.id}`);
      ToasterService.success("Rate deleted");
      setDeletingRate(null);
      await loadRates();
      await refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the rate"));
    }
  };

  const iconButton = "rounded-lg p-1.5 text-slate-400";
  const columns: ColumnDef<Row>[] = [
    {
      key: "salesPersonName", label: "Sales person", sortable: true,
      render: (row) => (
        <span className="text-sm">
          <span className="font-medium text-slate-800">{row.salesPersonName || `#${row.salesPersonId}`}</span>
          <span className="block text-xs text-slate-500">{row.lines.length} {t("invoice(s)")}</span>
        </span>
      ),
    },
    {
      key: "salesValue", label: "Sales value", headerClassName: "text-right", className: "text-right",
      render: (row) => <span className="text-sm text-slate-600">{money(row.salesValue, row.currency)}</span>,
    },
    {
      key: "amount", label: "Commission", headerClassName: "text-right", className: "text-right", sortable: true,
      render: (row) => (
        <span className={`text-sm font-semibold ${Number(row.amount) < 0 ? "text-rose-600" : "text-slate-900"}`}>{money(row.amount, row.currency)}</span>
      ),
    },
    {
      key: "status", label: "Status",
      render: (row) => (
        <span className="text-sm">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS[row.status].tone}`}>{t(STATUS[row.status].label)}</span>
          <span className="block text-xs text-slate-500">
            {row.status === "DRAFT" && row.blockedBy ? t(row.blockedBy) : null}
            {row.status === "PAID" ? `${dateLabel(row.paidOn)} · ${paymentMethodLabel(row.paymentMethod)}${row.paymentReference ? ` ${row.paymentReference}` : ""}` : null}
            {row.status === "PAYROLL" && row.payrollMonth ? `${t("Payroll")} ${monthLabel(row.payrollMonth)}` : null}
          </span>
        </span>
      ),
    },
    {
      key: "actions", label: "Actions", headerClassName: "text-right", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <button type="button" onClick={() => setShown(statementOf(row))} className={`${iconButton} hover:bg-cyan-50 hover:text-cyan-600`}
            title={t("Invoices on it")} aria-label={t("Invoices on it")}><EyeIcon className="h-4 w-4" /></button>
          {canApprove && row.status === "DRAFT" && !row.blockedBy && (
            <button type="button" onClick={() => void approve(statementOf(row))} disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
              title={t("Approve")}><CheckCircleIcon className="h-4 w-4" /> {t("Approve")}</button>
          )}
          {canApprove && row.status === "APPROVED" && Number(row.amount) !== 0 && (
            <button type="button" onClick={() => openPayment(statementOf(row))} className={`${iconButton} hover:bg-emerald-50 hover:text-emerald-600`}
              title={t(Number(row.amount) < 0 ? "Record money paid back" : "Record payment")} aria-label={t("Record payment")}><BanknotesIcon className="h-4 w-4" /></button>
          )}
          {canApprove && row.status === "APPROVED" && Number(row.amount) > 0 && (
            <button type="button" onClick={() => { setPayrollMonth(thisMonth()); setToPayroll(statementOf(row)); }} className={`${iconButton} hover:bg-violet-50 hover:text-violet-600`}
              title={t("Pay with salary")} aria-label={t("Pay with salary")}><BriefcaseIcon className="h-4 w-4" /></button>
          )}
          {canApprove && row.status !== "DRAFT" && (
            <button type="button"
              onClick={() => setConfirm({ kind: row.status === "APPROVED" ? "undo" : row.status === "PAID" ? "undoPayment" : "takeBack", statement: statementOf(row) })}
              className={`${iconButton} hover:bg-amber-50 hover:text-amber-600`}
              title={t(row.status === "APPROVED" ? "Undo approval" : row.status === "PAID" ? "Undo payment" : "Take back from payroll")}
              aria-label={t("Undo")}><ArrowUturnLeftIcon className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  const rateColumns: ColumnDef<Rate>[] = [
    { key: "salesPersonName", label: "Sales person", sortable: true, render: (row) => <span className="text-sm text-slate-700">{row.salesPersonName || t("Everyone")}</span> },
    {
      key: "productName", label: "Product", sortable: true,
      render: (row) => <span className="text-sm text-slate-700">{row.productId ? [row.productCode, row.productName].filter(Boolean).join(" · ") : t("All sales")}</span>,
    },
    { key: "ratePercent", label: "Rate %", headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm font-semibold text-slate-900">{Number(row.ratePercent)}%</span> },
    { key: "effectiveFrom", label: "From", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.effectiveFrom)}</span> },
    { key: "notes", label: "Notes", render: (row) => <span className="text-xs text-slate-500">{row.notes || ""}</span> },
    {
      key: "actions", label: "Actions", headerClassName: "text-right", className: "text-right",
      render: (row) => admin ? (
        <div className="flex justify-end gap-0.5">
          <button type="button" onClick={() => openRate(row)} className={`${iconButton} hover:bg-cyan-50 hover:text-cyan-600`}
            title={t("Edit")} aria-label={t("Edit")}><PencilSquareIcon className="h-4 w-4" /></button>
          <button type="button" onClick={() => setDeletingRate(row)} className={`${iconButton} hover:bg-red-50 hover:text-red-600`}
            title={t("Delete")} aria-label={t("Delete")}><TrashIcon className="h-4 w-4" /></button>
        </div>
      ) : null,
    },
  ];

  const salesPersonOptions = salesPersons
    .filter((p) => p.active !== false || String(p.id) === rateForm.salesPersonId)
    .map((p) => ({ id: String(p.id), name: p.code ? `${p.name} (${p.code})` : p.name }));
  const productOptions = products
    .filter((p) => p.active !== false || String(p.id) === rateForm.productId)
    .map((p) => ({ id: String(p.id), name: [p.productCode, p.productName].filter(Boolean).join(" · ") || `#${p.id}` }));
  if (editingRate?.productId && !productOptions.some((p) => p.id === String(editingRate.productId))) {
    productOptions.push({ id: String(editingRate.productId), name: [editingRate.productCode, editingRate.productName].filter(Boolean).join(" · ") });
  }

  const confirmText = confirm && {
    undo: ["Undo approval", "Take back this approval? Its entry is reversed and the month can be approved again."],
    undoPayment: ["Undo payment", "Take back this payment? Its entry is reversed and the commission is owed again."],
    takeBack: ["Take back from payroll", "Take it back from payroll? This works only while that month's salary isn't paid yet."],
  }[confirm.kind];
  const confirmWho = confirm ? `${confirm.statement.salesPersonName ?? ""} · ${monthLabel(confirm.statement.month)} · ${money(confirm.statement.amount, confirm.statement.currency)}` : "";

  return (
    <>
      <PageMeta title={t("Sales Commission")} description="Commission earned by sales people, approved monthly and paid" />
      <PageBreadcrumb
        pageTitle="Sales Commission"
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t("Month")}
            <input type="month" value={month} max={thisMonth()} onChange={(event) => event.target.value && setMonth(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-cyan-500" />
          </label>
        }
      />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label={t("To approve")} value={money(totals.toApprove, currency)} gradient="from-amber-50 to-orange-50" borderColor="border-amber-100" labelColor="text-amber-600" />
          <StatsCard label={t("Approved, unpaid")} value={money(totals.unpaid, currency)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Paid or with salaries")} value={money(totals.paid, currency)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
        </div>
        <p className="text-xs text-slate-500">
          {t("Each invoice's sales person earns their rate on its value before tax, at the rate on the invoice date.")}{" "}
          {t(view?.basis === "INVOICED" ? "It is earned when the invoice is issued, less credit notes." : "It is earned as the customer pays (post-dated cheques once cleared), less credit notes.")}{" "}
          {t("A month's statement is what was earned by the month's end less what was approved before, so credit notes, cancelled invoices and bounced receipts come back as negative lines. A month left unapproved rolls into the next one approved.")}
        </p>
        {view && !view.ended && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("This month hasn't ended: the figures are so far, and can be approved once it is over.")}
          </p>
        )}
        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={10}
          searchable
          searchPlaceholder={t("Search sales persons…")}
          searchFields={["salesPersonName"]}
          loading={loading}
          emptyState={<p className="py-8 text-center text-sm text-gray-500">{t("No commission earned or adjusted in this month. Check the rates below, and that invoices have a sales person.")}</p>}
        />

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{t("Rates")}</h3>
              <p className="text-xs text-slate-500">
                {t("The most specific rate wins: the sales person on the product, then the product, then the sales person, then everyone. A later start date replaces an earlier one; to change a rate from a date, add a new one.")}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-72">
                <FloatingSelect1 label={t("Commission is earned")} name="basis" value={view?.basis ?? "COLLECTED"} options={BASIS_OPTIONS}
                  includeEmptyOption={false} disabled={!admin} onChange={(event) => void saveBasis(event.target.value)} />
              </div>
              {admin && <AddButton onClick={() => openRate()} label={t("Add rate")} />}
            </div>
          </div>
          <ReusableTable
            data={rates}
            columns={rateColumns}
            pageSize={10}
            emptyState={<p className="py-6 text-center text-sm text-gray-500">{t("No rates yet: nobody earns commission.")}</p>}
          />
        </div>
      </div>

      {/* The invoices on a statement */}
      <PaginatedPopup
        isOpen={Boolean(shown)}
        title={`${shown?.salesPersonName ?? ""} · ${shown ? monthLabel(shown.month) : ""}`}
        subtitle={shown ? `${t(STATUS[shown.status].label)} · ${money(shown.amount, shown.currency)}` : ""}
        onClose={() => setShown(null)}
        maxWidthClassName="max-w-5xl"
        content={
          <div className="max-h-[65dvh] overflow-auto px-4 py-4 sm:px-5">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">{t("Invoice")}</th>
                  <th className="px-3 py-2 text-left">{t("Customer")}</th>
                  <th className="px-3 py-2 text-right">{t("Sales value")}</th>
                  <th className="px-3 py-2 text-right">{t("Full commission")}</th>
                  <th className="px-3 py-2 text-right">{t("Earned")}</th>
                  <th className="px-3 py-2 text-right">{t("Approved before")}</th>
                  <th className="px-3 py-2 text-right">{t("This statement")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(shown?.lines ?? []).map((line) => (
                  <tr key={line.invoiceId}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{line.invoiceNumber}</div>
                      <div className="text-xs text-slate-500">{dateLabel(line.invoiceDate)}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {line.customerName}
                      {line.note && <div className="text-xs text-slate-500">{line.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{money(line.salesValue, shown?.currency)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{money(line.fullCommission, shown?.currency)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {money(line.earnedToDate, shown?.currency)}
                      <div className="text-xs text-slate-400">{percent(line.earnedShare)}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{money(line.previouslyApproved, shown?.currency)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${Number(line.amount) < 0 ? "text-rose-600" : "text-slate-900"}`}>{money(line.amount, shown?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />

      {/* Paying an approved statement */}
      <PaginatedPopup
        isOpen={Boolean(paying)}
        title={`${t("Pay commission")} · ${paying?.salesPersonName ?? ""}`}
        subtitle={paying ? `${monthLabel(paying.month)} · ${money(paying.amount, paying.currency)}` : ""}
        onClose={() => setPaying(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={recordPayment} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingInput label={t("Paid on")} name="paidOn" type="date" value={payForm.paidOn} max={todayInput()}
                onChange={(event) => setPayForm((f) => ({ ...f, paidOn: event.target.value }))} />
              <FloatingSelect1 label={t("Method")} name="paymentMethod" value={payForm.paymentMethod} options={PAYMENT_METHOD_OPTIONS} includeEmptyOption={false}
                onChange={(event) => {
                  const paymentMethod = event.target.value;
                  setPayForm((f) => ({ ...f, paymentMethod, bankAccountId: defaultBankAccountId(bankAccounts ?? [], paymentMethod) }));
                }} />
              <BankAccountField accounts={bankAccounts} label={t("Paid from")} value={payForm.bankAccountId}
                onChange={(bankAccountId) => setPayForm((f) => ({ ...f, bankAccountId }))} />
              <FloatingInput label={t("Reference (UTR, cheque no.)")} name="reference" value={payForm.reference}
                onChange={(event) => setPayForm((f) => ({ ...f, reference: event.target.value }))} />
              {paying && Number(paying.amount) < 0 && (
                <p className="text-xs text-amber-700 sm:col-span-2">{t("This statement takes commission back: record the money the sales person paid back.")}</p>
              )}
            </div>
            <DialogFooter onCancel={() => setPaying(null)} submitLabel={t("Record payment")} busy={busy} />
          </form>
        }
      />

      {/* Paying it with the salary */}
      <PaginatedPopup
        isOpen={Boolean(toPayroll)}
        title={`${t("Pay with salary")} · ${toPayroll?.salesPersonName ?? ""}`}
        subtitle={toPayroll ? `${monthLabel(toPayroll.month)} · ${money(toPayroll.amount, toPayroll.currency)}` : ""}
        onClose={() => setToPayroll(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={sendToPayroll} className="flex flex-col">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <FloatingSelect1 label={t("Payroll month")} name="payrollMonth" value={payrollMonth} includeEmptyOption={false}
                options={[lastMonth(), thisMonth(), nextMonth()].map((key) => ({ id: key, name: monthLabel(key) }))}
                onChange={(event) => setPayrollMonth(event.target.value)} />
              <p className="text-xs text-slate-500">
                {t("It is added to that month's payroll as a Sales commission earning on their payslip. The payroll run books it against Sales commission payable. The sales person must be linked to an employee (Sales → Sales Persons).")}
              </p>
            </div>
            <DialogFooter onCancel={() => setToPayroll(null)} submitLabel={t("Send to payroll")} busy={busy} />
          </form>
        }
      />

      {/* Rate */}
      <PaginatedPopup
        isOpen={rateOpen}
        title={editingRate ? t("Edit rate") : t("Add rate")}
        subtitle={t("Percent of each invoice line's value before tax.")}
        onClose={() => setRateOpen(false)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={saveRate} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1 label={t("Sales person")} name="salesPersonId" value={rateForm.salesPersonId} options={salesPersonOptions}
                emptyOptionLabel="Everyone" onChange={(event) => setRateForm((f) => ({ ...f, salesPersonId: event.target.value }))} />
              <FloatingSelect1 label={t("Product")} name="productId" value={rateForm.productId} options={productOptions}
                emptyOptionLabel="All sales" onChange={(event) => setRateForm((f) => ({ ...f, productId: event.target.value }))} />
              <FloatingInput label={t("Rate %")} name="ratePercent" type="number" step="0.01" min="0" max="100" required value={rateForm.ratePercent}
                onChange={(event) => setRateForm((f) => ({ ...f, ratePercent: event.target.value }))} />
              <FloatingInput label={t("For invoices from")} name="effectiveFrom" type="date" required value={rateForm.effectiveFrom}
                onChange={(event) => setRateForm((f) => ({ ...f, effectiveFrom: event.target.value }))} />
              <div className="col-span-full">
                <FloatingInput label={t("Notes")} name="notes" value={rateForm.notes}
                  onChange={(event) => setRateForm((f) => ({ ...f, notes: event.target.value }))} />
              </div>
              {editingRate && (
                <p className="col-span-full text-xs text-amber-700">
                  {t("Changing a rate also changes invoices already approved at it: the difference goes into the next statement. To change it from a date, add a new rate instead.")}
                </p>
              )}
            </div>
            <DialogFooter onCancel={() => setRateOpen(false)} submitLabel={t(editingRate ? "Save" : "Add rate")} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirmText ? t(confirmText[0]) : ""}
        message={confirmText ? `${t(confirmText[1])} (${confirmWho})` : ""}
        confirmLabel={t("Take back")}
        variant="danger"
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingRate)}
        title={t("Delete rate")}
        message={`${t("Delete this rate? Invoices already approved at it are adjusted in the next statement.")} (${deletingRate ? Number(deletingRate.ratePercent) : ""}%)`}
        confirmLabel={t("Delete")}
        variant="danger"
        onConfirm={deleteRate}
        onCancel={() => setDeletingRate(null)}
      />
    </>
  );
};

export default SalesCommission;

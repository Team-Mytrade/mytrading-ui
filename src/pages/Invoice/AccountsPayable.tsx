import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BanknotesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { INVOICE_API, PAYMENT_METHOD_OPTIONS, apiError, dateLabel, daysOverdue, money, todayInput } from "./invoiceShared";
import { ArStatusBadge, DialogFooter } from "./invoiceUi";
import { ApAging, DebitNote, DebitNotesList, PayablesAging } from "./PayablesAging";
import { defaultBankAccountId, useBankAccounts } from "./bankShared";
import BankAccountField from "./BankAccountField";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/accounts-payable`;
const PAGE_SIZE = 10;

interface Payable {
  id: number;
  purchaseInvoice?: { id: number; invoiceNumber?: string; invoiceDate?: string; currency?: string; referenceNumber?: string };
  vendor?: { id: number; name?: string };
  invoiceAmount: number;
  amountPaid: number;
  debitNoteAmount?: number | null;
  balance: number;
  accountsPayableStatus: string;
  lastPaymentDate?: string;
  dueDate?: string;
}

const AccountsPayable: React.FC = () => {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const [rows, setRows] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("OPEN_ONLY");
  const [paying, setPaying] = useState<Payable | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amountPaid: "", paymentDate: todayInput(), paymentMethod: "BANK_TRANSFER", bankAccountId: "", paymentReference: "" });
  const bankAccounts = useBankAccounts();
  const setBankAccount = useCallback((bankAccountId: string) => setForm((current) => ({ ...current, bankAccountId })), []);

  const [aging, setAging] = useState<ApAging | null>(null);
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const [payables, agingRes, notes] = await Promise.all([
        axios.get<Payable[]>(API_URL),
        axios.get<ApAging>(`${API_URL}/aging`).catch(() => null),
        axios.get<DebitNote[]>(`${INVOICE_API}/debit-notes`).catch(() => null),
      ]);
      setRows(Array.isArray(payables.data) ? payables.data : []);
      setAging(agingRes?.data ?? null);
      setDebitNotes(Array.isArray(notes?.data) ? notes.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load payables"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openPay = (row: Payable) => {
    setForm({
      amountPaid: String(row.balance),
      paymentDate: todayInput(),
      paymentMethod: "BANK_TRANSFER",
      bankAccountId: defaultBankAccountId(bankAccounts ?? [], "BANK_TRANSFER"),
      paymentReference: "",
    });
    setPaying(row);
  };

  // A payment here is a vendor payment against the bill, so it is listed under Vendor Payments too
  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paying) return;
    const amount = Number(form.amountPaid);
    if (!amount || amount <= 0) return ToasterService.error("Enter the amount paid");
    if (amount - Number(paying.balance) > 0.001) return ToasterService.error(`Only ${money(paying.balance)} is due on this bill`);
    setBusy(true);
    try {
      await axios.post(`${INVOICE_API}/vendor-payments`, {
        vendor: { id: paying.vendor?.id },
        invoice: { id: paying.purchaseInvoice?.id },
        amountPaid: amount,
        paymentDate: form.paymentDate || null,
        paymentMethod: form.paymentMethod,
        bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
        paymentReference: form.paymentReference.trim() || null,
      });
      ToasterService.success(`${money(amount)} paid to ${paying.vendor?.name ?? "the vendor"}`);
      setPaying(null);
      await fetchRows();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the payment"));
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    if (statusFilter === "OPEN_ONLY") return rows.filter((row) => Number(row.balance) > 0);
    return rows.filter((row) => row.accountsPayableStatus === statusFilter);
  }, [rows, statusFilter]);

  const stats = useMemo(() => {
    const open = rows.filter((row) => Number(row.balance) > 0);
    const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    return {
      due: open.reduce((sum, row) => sum + Number(row.balance || 0), 0),
      overdue: open.filter((row) => daysOverdue(row.dueDate) > 0).reduce((sum, row) => sum + Number(row.balance || 0), 0),
      dueThisWeek: open.filter((row) => row.dueDate && row.dueDate <= week && daysOverdue(row.dueDate) === 0).length,
      bills: open.length,
    };
  }, [rows]);

  const columns: ColumnDef<Payable>[] = [
    {
      key: "vendor",
      label: "Vendor",
      sortable: true,
      sortValueGetter: (row) => row.vendor?.name ?? "",
      filterValueGetter: (row) => row.vendor?.name ?? "",
      render: (row) => <span className="text-sm font-medium text-slate-800">{row.vendor?.name ?? "—"}</span>,
    },
    {
      key: "purchaseInvoice",
      label: "Bill",
      sortable: true,
      sortValueGetter: (row) => row.purchaseInvoice?.invoiceNumber ?? "",
      filterValueGetter: (row) => row.purchaseInvoice?.invoiceNumber ?? "",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.purchaseInvoice?.invoiceNumber ?? "—"}
          <span className="block text-xs text-slate-400">{dateLabel(row.purchaseInvoice?.invoiceDate)}</span>
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Due",
      sortable: true,
      render: (row) => {
        const late = Number(row.balance) > 0 ? daysOverdue(row.dueDate) : 0;
        return (
          <span className="text-sm text-slate-600">
            {dateLabel(row.dueDate)}
            {late > 0 && <span className="block text-xs font-semibold text-red-600">{late} days late</span>}
          </span>
        );
      },
    },
    { key: "invoiceAmount", label: "Amount", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm">{money(row.invoiceAmount, row.purchaseInvoice?.currency)}</span> },
    { key: "amountPaid", label: "Paid", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm text-slate-600">{money(row.amountPaid, row.purchaseInvoice?.currency)}</span> },
    {
      key: "debitNoteAmount",
      label: "Credited",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => <span className="text-sm text-amber-700">{Number(row.debitNoteAmount) > 0 ? money(row.debitNoteAmount, row.purchaseInvoice?.currency) : "—"}</span>,
    },
    { key: "balance", label: "Balance", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm font-semibold text-slate-900">{money(row.balance, row.purchaseInvoice?.currency)}</span> },
    { key: "accountsPayableStatus", label: "Status", sortable: true, render: (row) => <ArStatusBadge status={row.accountsPayableStatus} /> },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          {Number(row.balance) > 0 && canCreate && (
            <button type="button" onClick={() => openPay(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title={t("Pay")}>
              <BanknotesIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Accounts Payable")} description="What is owed to vendors, by bill" />
      <PageBreadcrumb pageTitle="Accounts Payable" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("To pay")} value={money(stats.due)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Overdue")} value={money(stats.overdue)} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
          <StatsCard label={t("Due in 7 days")} value={stats.dueThisWeek} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
          <StatsCard label={t("Open bills")} value={stats.bills} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[["OPEN_ONLY", "To pay"], ["OVERDUE", "Overdue"], ["PARTIALLY_PAID", "Partly paid"], ["PAID", "Paid"], ["ALL", "All"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${statusFilter === value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-1 text-sm text-gray-500">{t("Nothing to pay")}</p>
              <p className="text-xs text-gray-400">
                {t("Payables are created from")}{" "}
                <button type="button" className="text-cyan-700 hover:underline" onClick={() => navigate("/purchaseInvoices")}>{t("purchase invoices")}</button>.
              </p>
            </div>
          }
        />

        <PayablesAging aging={aging} />
        <DebitNotesList notes={debitNotes} />
      </div>

      <PaginatedPopup
        isOpen={Boolean(paying)}
        title={`${t("Pay")} ${paying?.vendor?.name ?? "vendor"}`}
        subtitle={`${t("Bill")} ${paying?.purchaseInvoice?.invoiceNumber ?? ""} · ${money(paying?.balance, paying?.purchaseInvoice?.currency)} due ${dateLabel(paying?.dueDate)}`}
        onClose={() => setPaying(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={pay} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingInput label={t("Amount paid")} name="amountPaid" type="number" required value={form.amountPaid}
                onChange={(event) => setForm((current) => ({ ...current, amountPaid: event.target.value }))} />
              <FloatingInput label={t("Payment date")} name="paymentDate" type="date" value={form.paymentDate}
                onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} />
              <FloatingSelect1 label={t("Method")} name="paymentMethod" value={form.paymentMethod} options={PAYMENT_METHOD_OPTIONS} includeEmptyOption={false}
                onChange={(event) => {
                  const paymentMethod = event.target.value;
                  setForm((current) => ({ ...current, paymentMethod, bankAccountId: defaultBankAccountId(bankAccounts ?? [], paymentMethod) }));
                }} />
              <BankAccountField accounts={bankAccounts} label={t("Paid from")} value={form.bankAccountId} onChange={setBankAccount} />
              <FloatingInput label={t("Reference (UTR, cheque no.)")} name="paymentReference" value={form.paymentReference}
                onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setPaying(null)} submitLabel={t("Record payment")} busy={busy} />
          </form>
        }
      />
    </>
  );
};

export default AccountsPayable;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
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
import { INVOICE_API, PAYMENT_METHOD_OPTIONS, apiError, chequeStatusLabel, dateLabel, money, paymentMethodLabel, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import { defaultBankAccountId, useBankAccounts } from "./bankShared";
import BankAccountField from "./BankAccountField";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/vendor-payments`;
const PAGE_SIZE = 10;

interface VendorPayment {
  id: number;
  paymentReference?: string;
  paymentDate?: string;
  vendor?: { id: number; name?: string };
  invoice?: { id: number; invoiceNumber?: string; currency?: string };
  amountPaid?: number;
  paymentMethod?: string;
  // Bank account / cash box it was paid from (none on older payments)
  bankAccountId?: number | null;
  paidBy?: string;
  /** The amount in the company's currency at the payment's rate (what the totals add up). */
  companyAmount?: number | null;
  // A post-dated cheque (dated after the payment date): ISSUED, CLEARED or CANCELLED (no longer pays the bill)
  chequeDate?: string | null;
  chequeStatus?: string | null;
  // Over the company's payment approval limit: PENDING until someone else approves or rejects it
  approvalStatus?: string | null;
  rejectReason?: string | null;
  // Whether it pays its bill (not awaiting approval, rejected or a cancelled cheque)
  active?: boolean;
}

const awaiting = (payment: VendorPayment) => payment.approvalStatus === "PENDING" || payment.approvalStatus === "REJECTED";
// A cleared or cancelled cheque's payment stays as it is; one awaiting approval or rejected is withdrawn, not edited
const locked = (payment: VendorPayment) => payment.chequeStatus === "CLEARED" || payment.chequeStatus === "CANCELLED";

interface Vendor {
  id: number;
  name: string;
  currency?: string;
}

// Paid to a vendor ahead of their bills (or beyond the bills a payment paid), used on later bills
interface VendorAdvance {
  id: number;
  vendor?: { id: number; name?: string };
  advanceDate?: string;
  reference?: string;
  amount: number;
  appliedAmount: number;
  remainingAmount: number;
  currency?: string;
  applications?: { id: number; invoice?: { id: number; invoiceNumber?: string }; amount: number; appliedOn?: string }[];
}

const emptyPayForm = () => ({
  vendorId: "",
  total: "",
  currency: "",
  paymentDate: todayInput(),
  paymentMethod: "BANK_TRANSFER",
  bankAccountId: "",
  paymentReference: "",
  chequeDate: "",
  paidBy: "",
  // Amount per bill (purchase invoice id)
  amounts: {} as Record<string, string>,
});

interface Payable {
  id: number;
  purchaseInvoice?: { id: number; invoiceNumber?: string; currency?: string };
  vendor?: { id: number; name?: string };
  balance: number;
  companyBalance?: number | null;
  dueDate?: string;
}

const emptyForm = () => ({
  vendorId: "",
  invoiceId: "",
  amountPaid: "",
  paymentDate: todayInput(),
  paymentMethod: "BANK_TRANSFER",
  bankAccountId: "",
  paymentReference: "",
  chequeDate: "",
  paidBy: "",
});

const VendorPayments: React.FC = () => {
  const { canCreate, canUpdate, canDelete, canApprove } = usePermissions();
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(false);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendorPayment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<VendorPayment | null>(null);
  const [rejecting, setRejecting] = useState<VendorPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const bankAccounts = useBankAccounts();
  const setBankAccount = useCallback((bankAccountId: string) => setForm((current) => ({ ...current, bankAccountId })), []);
  // One payment across a vendor's bills (the rest kept as an advance), and the advances
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState(emptyPayForm);
  const setPayBankAccount = useCallback((bankAccountId: string) => setPayForm((current) => ({ ...current, bankAccountId })), []);
  const [advances, setAdvances] = useState<VendorAdvance[]>([]);
  const [applying, setApplying] = useState<VendorAdvance | null>(null);
  const [applyForm, setApplyForm] = useState({ invoiceId: "", amount: "", appliedOn: todayInput() });
  const [deletingAdvance, setDeletingAdvance] = useState<VendorAdvance | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentRes, vendorRes, payableRes, advanceRes] = await Promise.all([
        axios.get<VendorPayment[]>(API_URL),
        // Vendors are the common list Purchase uses too
        axios.get<Vendor[]>("/v1/api/common/vendors"),
        axios.get<Payable[]>(`${INVOICE_API}/accounts-payable`),
        axios.get<VendorAdvance[]>(`${INVOICE_API}/vendor-advances`),
      ]);
      setPayments(Array.isArray(paymentRes.data) ? paymentRes.data : []);
      setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
      setPayables(Array.isArray(payableRes.data) ? payableRes.data : []);
      setAdvances(Array.isArray(advanceRes.data) ? advanceRes.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load vendor payments"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Bills of the chosen vendor that still have something due. When editing, the bill being
  // edited counts this payment's amount as still available.
  const billOptions = useMemo(() => {
    if (!form.vendorId) return [];
    return payables
      .filter((row) => String(row.vendor?.id) === form.vendorId)
      .map((row) => {
        const own = editing && editing.invoice?.id === row.purchaseInvoice?.id ? Number(editing.amountPaid || 0) : 0;
        return { row, available: Number(row.balance || 0) + own };
      })
      .filter(({ available }) => available > 0);
  }, [payables, form.vendorId, editing]);

  const selectedBill = billOptions.find(({ row }) => String(row.purchaseInvoice?.id) === form.invoiceId);

  // A new payment: to a vendor, across their bills, the rest kept as an advance
  const openCreate = () => {
    const fresh = emptyPayForm();
    setPayForm({ ...fresh, bankAccountId: bankAccounts ? defaultBankAccountId(bankAccounts, fresh.paymentMethod) : "" });
    setPayOpen(true);
  };

  // The chosen vendor's unpaid bills, oldest due first, in the payment's currency
  const vendorBills = useMemo(() => payables
    .filter((row) => String(row.vendor?.id) === payForm.vendorId && Number(row.balance || 0) > 0)
    .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? ""))), [payables, payForm.vendorId]);
  const billCurrencies = useMemo(() => Array.from(new Set(vendorBills.map((row) => row.purchaseInvoice?.currency || ""))), [vendorBills]);
  const payCurrency = payForm.currency || billCurrencies[0] || "";
  const billsToPay = vendorBills.filter((row) => (row.purchaseInvoice?.currency || "") === payCurrency || billCurrencies.length <= 1);
  const allocated = billsToPay.reduce((sum, row) => sum + Number(payForm.amounts[String(row.purchaseInvoice?.id)] || 0), 0);
  const payTotal = Number(payForm.total || 0);
  const extra = Math.round((payTotal - allocated) * 1000) / 1000;

  const chooseVendor = (vendorId: string) => setPayForm((current) => ({ ...current, vendorId, currency: "", amounts: {} }));

  // Spreads the amount paid over the bills, the oldest due first
  const fillOldestFirst = () => {
    let rest = payTotal;
    const amounts: Record<string, string> = {};
    for (const row of billsToPay) {
      const take = Math.min(rest, Number(row.balance || 0));
      if (take > 0) amounts[String(row.purchaseInvoice?.id)] = String(Math.round(take * 1000) / 1000);
      rest -= take;
    }
    setPayForm((current) => ({ ...current, amounts }));
  };

  const payVendor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!payForm.vendorId) return ToasterService.error("Choose the vendor");
    if (!payTotal || payTotal <= 0) return ToasterService.error("Enter the amount paid");
    const over = billsToPay.find((row) => Number(payForm.amounts[String(row.purchaseInvoice?.id)] || 0) - Number(row.balance || 0) > 0.001);
    if (over) return ToasterService.error(`Only ${money(over.balance, over.purchaseInvoice?.currency)} is due on ${over.purchaseInvoice?.invoiceNumber ?? "that bill"}`);
    if (extra < -0.001) return ToasterService.error(`The bills take ${money(allocated, payCurrency)}, more than the ${money(payTotal, payCurrency)} paid`);
    const vendor = vendors.find((row) => String(row.id) === payForm.vendorId);
    setBusy(true);
    try {
      const { data } = await axios.post<{ payments: VendorPayment[]; advance: VendorAdvance | null }>(`${API_URL}/pay-bills`, {
        vendorId: Number(payForm.vendorId),
        paymentDate: payForm.paymentDate || null,
        totalAmount: payTotal,
        currency: payCurrency || vendor?.currency || null,
        paymentMethod: payForm.paymentMethod,
        bankAccountId: payForm.bankAccountId ? Number(payForm.bankAccountId) : null,
        paymentReference: payForm.paymentReference.trim() || null,
        paidBy: payForm.paidBy.trim() || null,
        chequeDate: payForm.paymentMethod === "CHEQUE" && payForm.chequeDate ? payForm.chequeDate : null,
        allocations: billsToPay
          .map((row) => ({ invoiceId: row.purchaseInvoice?.id, amount: Number(payForm.amounts[String(row.purchaseInvoice?.id)] || 0) }))
          .filter((line) => line.amount > 0),
      });
      const bills = data.payments?.length ?? 0;
      if (data.payments?.some((p) => p.approvalStatus === "PENDING")) {
        ToasterService.success(`${money(payTotal, payCurrency)} ${t("recorded; awaiting approval")}`,
          t("It is over the payment approval limit: the bills are paid once someone else approves it."));
        setPayOpen(false);
        await fetchAll();
        return;
      }
      ToasterService.success(`${money(payTotal, payCurrency)} paid`,
        [bills ? `${bills} ${t(bills === 1 ? "bill" : "bills")}` : "", data.advance ? `${money(data.advance.amount, data.advance.currency)} ${t("kept as an advance")}` : ""]
          .filter(Boolean).join(" · "));
      setPayOpen(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the payment"));
    } finally {
      setBusy(false);
    }
  };

  // Using an advance on one of the vendor's bills in the same currency
  const applyBills = useMemo(() => !applying ? [] : payables.filter((row) => String(row.vendor?.id) === String(applying.vendor?.id)
    && Number(row.balance || 0) > 0 && (!row.purchaseInvoice?.currency || !applying.currency || row.purchaseInvoice.currency === applying.currency)),
  [payables, applying]);

  const openApply = (advance: VendorAdvance) => {
    setApplying(advance);
    setApplyForm({ invoiceId: "", amount: "", appliedOn: todayInput() });
  };

  const chooseApplyBill = (invoiceId: string) => {
    const bill = applyBills.find((row) => String(row.purchaseInvoice?.id) === invoiceId);
    const amount = bill && applying ? Math.min(Number(bill.balance || 0), Number(applying.remainingAmount || 0)) : 0;
    setApplyForm((current) => ({ ...current, invoiceId, amount: amount ? String(amount) : current.amount }));
  };

  const applyAdvance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!applying) return;
    if (!applyForm.invoiceId) return ToasterService.error("Choose the bill");
    const amount = Number(applyForm.amount);
    if (!amount || amount <= 0) return ToasterService.error("Enter the amount to use");
    setBusy(true);
    try {
      await axios.post(`${INVOICE_API}/vendor-advances/${applying.id}/apply`,
        { invoiceId: Number(applyForm.invoiceId), amount, appliedOn: applyForm.appliedOn || null });
      ToasterService.success(`${money(amount, applying.currency)} ${t("of the advance used on the bill")}`);
      setApplying(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not use the advance"));
    } finally {
      setBusy(false);
    }
  };

  const unapply = async (applicationId: number) => {
    setBusy(true);
    try {
      await axios.delete(`${INVOICE_API}/vendor-advances/applications/${applicationId}`);
      ToasterService.success("Taken off the bill; it is due again");
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not take the advance off the bill"));
    } finally {
      setBusy(false);
    }
  };

  const removeAdvance = async () => {
    if (!deletingAdvance) return;
    setBusy(true);
    try {
      await axios.delete(`${INVOICE_API}/vendor-advances/${deletingAdvance.id}`);
      ToasterService.success("Advance deleted");
      setDeletingAdvance(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the advance"));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (payment: VendorPayment) => {
    setEditing(payment);
    setForm({
      vendorId: payment.vendor?.id ? String(payment.vendor.id) : "",
      invoiceId: payment.invoice?.id ? String(payment.invoice.id) : "",
      amountPaid: String(payment.amountPaid ?? ""),
      paymentDate: payment.paymentDate ?? todayInput(),
      paymentMethod: payment.paymentMethod || "BANK_TRANSFER",
      bankAccountId: payment.bankAccountId != null ? String(payment.bankAccountId) : "",
      paymentReference: payment.paymentReference ?? "",
      chequeDate: payment.chequeDate ?? "",
      paidBy: payment.paidBy ?? "",
    });
    setFormOpen(true);
  };

  const chooseBill = (invoiceId: string) => {
    const bill = billOptions.find(({ row }) => String(row.purchaseInvoice?.id) === invoiceId);
    setForm((current) => ({ ...current, invoiceId, amountPaid: bill && !editing ? String(bill.available) : current.amountPaid }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.vendorId) return ToasterService.error("Choose the vendor");
    if (!form.invoiceId) return ToasterService.error("Choose the bill being paid");
    const amount = Number(form.amountPaid);
    if (!amount || amount <= 0) return ToasterService.error("Enter the amount paid");
    if (selectedBill && amount - selectedBill.available > 0.001) {
      return ToasterService.error(`Only ${money(selectedBill.available)} is due on this bill`);
    }
    const common = {
      amountPaid: amount,
      paymentDate: form.paymentDate || null,
      paymentMethod: form.paymentMethod,
      bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
      paymentReference: form.paymentReference.trim() || null,
      paidBy: form.paidBy.trim() || null,
      chequeDate: form.paymentMethod === "CHEQUE" && form.chequeDate ? form.chequeDate : null,
    };
    setBusy(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/${editing.id}`, { ...common, vendorId: Number(form.vendorId), invoiceId: Number(form.invoiceId) });
        ToasterService.success("Payment updated");
      } else {
        const { data } = await axios.post<VendorPayment>(API_URL, { ...common, vendor: { id: Number(form.vendorId) }, invoice: { id: Number(form.invoiceId) } });
        if (data?.approvalStatus === "PENDING") {
          ToasterService.success(`${money(amount)} ${t("recorded; awaiting approval")}`,
            t("It is over the payment approval limit: the bill is paid once someone else approves it."));
        } else {
          ToasterService.success(`${money(amount)} paid`);
        }
      }
      setFormOpen(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the payment"));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (payment: VendorPayment) => {
    setBusy(true);
    try {
      await axios.post(`${API_URL}/${payment.id}/approve`);
      ToasterService.success(`${money(payment.amountPaid, payment.invoice?.currency)} ${t("approved and paid")}`);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not approve the payment"));
    } finally {
      setBusy(false);
    }
  };

  const reject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejecting) return;
    if (!rejectReason.trim()) return ToasterService.error("Say why the payment is rejected");
    setBusy(true);
    try {
      await axios.post(`${API_URL}/${rejecting.id}/reject`, { reason: rejectReason.trim() });
      ToasterService.success("Payment rejected; nothing was paid");
      setRejecting(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not reject the payment"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${deleting.id}`);
      ToasterService.success(awaiting(deleting) ? "Payment withdrawn" : "Payment deleted; the bill is due again");
      setDeleting(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the payment"));
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(
    () => (methodFilter === "ALL" ? payments : payments.filter((payment) => payment.paymentMethod === methodFilter)),
    [payments, methodFilter]
  );

  const stats = useMemo(() => {
    const month = todayInput().slice(0, 7);
    // Totals in the company's currency: payments at their rate, bills still owed at theirs
    // Only payments that pay their bill: not a cancelled cheque, nor one awaiting approval or rejected
    const standing = payments.filter((payment) => payment.active !== false && payment.chequeStatus !== "CANCELLED" && !awaiting(payment));
    const paid = (payment: VendorPayment) => Number(payment.companyAmount ?? payment.amountPaid ?? 0);
    return {
      count: standing.length,
      total: standing.reduce((sum, payment) => sum + paid(payment), 0),
      thisMonth: standing.filter((payment) => payment.paymentDate?.startsWith(month)).reduce((sum, payment) => sum + paid(payment), 0),
      toPay: payables.reduce((sum, row) => sum + Math.max(Number(row.companyBalance ?? row.balance ?? 0), 0), 0),
    };
  }, [payments, payables]);

  const columns: ColumnDef<VendorPayment>[] = [
    { key: "paymentDate", label: "Date", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.paymentDate)}</span> },
    {
      key: "vendor",
      label: "Vendor",
      sortable: true,
      sortValueGetter: (row) => row.vendor?.name ?? "",
      filterValueGetter: (row) => row.vendor?.name ?? "",
      render: (row) => <span className="text-sm font-medium text-slate-800">{row.vendor?.name ?? "—"}</span>,
    },
    {
      key: "invoice",
      label: "Bill",
      sortable: true,
      sortValueGetter: (row) => row.invoice?.invoiceNumber ?? "",
      filterValueGetter: (row) => row.invoice?.invoiceNumber ?? "",
      render: (row) => <span className="text-sm text-slate-700">{row.invoice?.invoiceNumber ?? "—"}</span>,
    },
    { key: "paymentMethod", label: "Method", sortable: true, render: (row) => <span className="text-sm text-slate-600">{paymentMethodLabel(row.paymentMethod)}</span> },
    {
      key: "paymentReference",
      label: "Reference",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.paymentReference || "—"}
          {row.chequeStatus ? (
            <span className={`block text-xs ${row.chequeStatus === "CANCELLED" ? "text-slate-400 line-through" : "text-amber-700"}`}>
              {t("Post-dated")} {dateLabel(row.chequeDate)} · {t(chequeStatusLabel(row.chequeStatus))}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "amountPaid",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.amountPaid || 0),
      render: (row) => (
        <span className={`text-sm font-semibold ${row.approvalStatus === "REJECTED" ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {money(row.amountPaid, row.invoice?.currency)}
          {row.approvalStatus === "PENDING" && <span className="block text-xs font-medium text-amber-700">{t("Awaiting approval")}</span>}
          {row.approvalStatus === "REJECTED" && (
            <span className="block text-xs font-medium text-red-600 no-underline" title={row.rejectReason ?? undefined}>
              {t("Rejected")}{row.rejectReason ? `: ${row.rejectReason}` : ""}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          {canApprove && row.approvalStatus === "PENDING" && (
            <>
              <button type="button" onClick={() => void approve(row)} disabled={busy}
                className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50" title={t("Approve payment")}>
                {t("Approve")}
              </button>
              <button type="button" onClick={() => { setRejectReason(""); setRejecting(row); }} disabled={busy}
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50" title={t("Reject payment")}>
                {t("Reject")}
              </button>
            </>
          )}
          {canUpdate && !locked(row) && !awaiting(row) && (
            <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit payment")}>
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (awaiting(row) || !locked(row)) && (
            <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title={t(awaiting(row) ? "Withdraw payment" : "Delete payment")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const advanceColumns: ColumnDef<VendorAdvance>[] = [
    { key: "advanceDate", label: "Date", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.advanceDate)}</span> },
    {
      key: "vendor",
      label: "Vendor",
      sortable: true,
      sortValueGetter: (row) => row.vendor?.name ?? "",
      filterValueGetter: (row) => row.vendor?.name ?? "",
      render: (row) => <span className="text-sm font-medium text-slate-800">{row.vendor?.name ?? "—"}</span>,
    },
    { key: "reference", label: "Reference", sortable: true, render: (row) => <span className="text-sm text-slate-600">{row.reference || "—"}</span> },
    {
      key: "amount", label: "Paid", sortable: true, headerClassName: "text-right", className: "text-right",
      render: (row) => <span className="text-sm text-slate-700">{money(row.amount, row.currency)}</span>,
    },
    {
      key: "remainingAmount", label: "Left", sortable: true, headerClassName: "text-right", className: "text-right",
      render: (row) => <span className={`text-sm font-semibold ${Number(row.remainingAmount) > 0 ? "text-emerald-700" : "text-slate-400"}`}>{money(row.remainingAmount, row.currency)}</span>,
    },
    {
      key: "applications",
      label: "Used on",
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.applications ?? []).length === 0 && <span className="text-xs text-slate-400">—</span>}
          {(row.applications ?? []).map((used) => (
            <span key={used.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {used.invoice?.invoiceNumber ?? "#"} · {money(used.amount, row.currency)}
              {canDelete && (
                <button type="button" onClick={() => unapply(used.id)} disabled={busy} className="text-slate-400 hover:text-red-600"
                  title={t("Take off this bill")} aria-label={t("Take off this bill")}>×</button>
              )}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          {canCreate && Number(row.remainingAmount) > 0 && (
            <button type="button" onClick={() => openApply(row)} className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
              title={t("Use on a bill")}>{t("Use on a bill")}</button>
          )}
          {canDelete && Number(row.appliedAmount) === 0 && (
            <button type="button" onClick={() => setDeletingAdvance(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title={t("Delete advance")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Vendor Payments")} description="Payments made to vendors against their bills" />
      <PageBreadcrumb pageTitle="Vendor Payments" actions={canCreate ? <AddButton onClick={openCreate} label={t("Pay vendor")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Payments")} value={stats.count} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Paid in total")} value={money(stats.total)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Paid this month")} value={money(stats.thisMonth)} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label={t("Still to pay")} value={money(stats.toPay)} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ id: "ALL", name: "All methods" }, ...PAYMENT_METHOD_OPTIONS].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMethodFilter(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${methodFilter === option.id ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.name}
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
              <UserGroupIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No vendor payments yet")}</p>
            </div>
          }
        />

        <div className="pt-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("Advances to vendors")}</h3>
          <p className="mb-2 text-xs text-slate-500 dark:text-gray-400">
            {t("Paid ahead of the bills, or beyond the bills a payment paid. Use what is left on the vendor's next bills.")}
          </p>
          <ReusableTable
            data={advances}
            columns={advanceColumns}
            pageSize={PAGE_SIZE}
            loading={loading}
            emptyState={<p className="py-6 text-center text-sm text-gray-500">{t("No advances to vendors")}</p>}
          />
        </div>
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title={t(editing ? "Edit vendor payment" : "Pay a bill")}
        subtitle={t("The payment settles the bill's payable")}
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1
                label={t("Vendor")}
                name="vendorId"
                required
                value={form.vendorId}
                options={vendors.map((vendor) => ({ id: String(vendor.id), name: vendor.name }))}
                onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value, invoiceId: "" }))}
              />
              <FloatingSelect1
                label={t("Bill")}
                name="invoiceId"
                required
                value={form.invoiceId}
                options={billOptions.map(({ row, available }) => ({
                  id: String(row.purchaseInvoice?.id),
                  name: `${row.purchaseInvoice?.invoiceNumber ?? row.id} · ${money(available, row.purchaseInvoice?.currency)} due ${dateLabel(row.dueDate)}`,
                }))}
                onChange={(event) => chooseBill(event.target.value)}
              />
              {form.vendorId && billOptions.length === 0 && (
                <p className="text-xs text-amber-700 sm:col-span-2">{t("This vendor has no unpaid bills. Add the bill under Purchase Invoices first.")}</p>
              )}
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
              <FloatingInput label={t(form.paymentMethod === "CHEQUE" ? "Cheque number" : "Reference (UTR, cheque no.)")} name="paymentReference" value={form.paymentReference}
                onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))} />
              {form.paymentMethod === "CHEQUE" && (
                <FloatingInput label={t("Cheque date")} name="chequeDate" type="date" value={form.chequeDate}
                  onChange={(event) => setForm((current) => ({ ...current, chequeDate: event.target.value }))} />
              )}
              {form.paymentMethod === "CHEQUE" && form.chequeDate && form.chequeDate > (form.paymentDate || todayInput()) && (
                <p className="text-xs text-amber-700 sm:col-span-2">
                  {t("Post-dated: the bill is paid now, and the cheque is owed in Post-dated cheques issued until it clears. Clear or cancel it under Banking → Cheques.")}
                </p>
              )}
              <FloatingInput label={t("Paid by")} name="paidBy" value={form.paidBy}
                onChange={(event) => setForm((current) => ({ ...current, paidBy: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={t(editing ? "Save changes" : "Record payment")} busy={busy} />
          </form>
        }
      />

      <PaginatedPopup
        isOpen={payOpen}
        title={t("Pay vendor")}
        subtitle={t("One payment across the vendor's bills; anything beyond them is kept as an advance")}
        onClose={() => setPayOpen(false)}
        maxWidthClassName="max-w-3xl"
        content={
          <form onSubmit={payVendor} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1 label={t("Vendor")} name="payVendorId" required value={payForm.vendorId}
                options={vendors.map((vendor) => ({ id: String(vendor.id), name: vendor.name }))}
                onChange={(event) => chooseVendor(event.target.value)} />
              <FloatingInput label={t("Amount paid")} name="payTotal" type="number" required value={payForm.total}
                onChange={(event) => setPayForm((current) => ({ ...current, total: event.target.value }))} />
              {billCurrencies.length > 1 && (
                <FloatingSelect1 label={t("Currency")} name="payCurrency" value={payCurrency} includeEmptyOption={false}
                  options={billCurrencies.map((code) => ({ id: code, name: code || t("Company currency") }))}
                  onChange={(event) => setPayForm((current) => ({ ...current, currency: event.target.value, amounts: {} }))} />
              )}
              {payForm.vendorId && (
                <div className="sm:col-span-2">
                  {billsToPay.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-600">
                      {t("This vendor has no unpaid bills: the whole amount is kept as an advance.")}
                    </p>
                  ) : (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Bills")}</span>
                        <button type="button" onClick={fillOldestFirst} disabled={!payTotal}
                          className="text-xs font-medium text-cyan-700 hover:underline disabled:opacity-40">{t("Fill oldest first")}</button>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs text-slate-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">{t("Bill")}</th>
                              <th className="px-3 py-2 font-medium">{t("Due")}</th>
                              <th className="px-3 py-2 text-right font-medium">{t("Owed")}</th>
                              <th className="px-3 py-2 text-right font-medium">{t("Pay now")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {billsToPay.map((row) => {
                              const id = String(row.purchaseInvoice?.id);
                              return (
                                <tr key={id}>
                                  <td className="px-3 py-2 text-slate-800">{row.purchaseInvoice?.invoiceNumber ?? row.id}</td>
                                  <td className="px-3 py-2 text-slate-500">{dateLabel(row.dueDate)}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{money(row.balance, row.purchaseInvoice?.currency)}</td>
                                  <td className="px-3 py-2 text-right">
                                    <input type="number" min={0} max={row.balance} step="any" value={payForm.amounts[id] ?? ""}
                                      aria-label={`${t("Pay now")} ${row.purchaseInvoice?.invoiceNumber ?? ""}`}
                                      onChange={(event) => setPayForm((current) => ({ ...current, amounts: { ...current.amounts, [id]: event.target.value } }))}
                                      className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:border-cyan-500 focus:outline-none" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {payTotal > 0 && (
                    <p className={`mt-2 text-sm ${extra < -0.001 ? "text-red-600" : "text-slate-600"}`}>
                      {t("Bills")}: {money(allocated, payCurrency)}
                      {extra > 0.001 && <> · {t("Kept as an advance")}: <strong>{money(extra, payCurrency)}</strong></>}
                      {extra < -0.001 && <> · {t("More than the amount paid")}</>}
                    </p>
                  )}
                </div>
              )}
              <FloatingInput label={t("Payment date")} name="payDate" type="date" value={payForm.paymentDate}
                onChange={(event) => setPayForm((current) => ({ ...current, paymentDate: event.target.value }))} />
              <FloatingSelect1 label={t("Method")} name="payMethod" value={payForm.paymentMethod} options={PAYMENT_METHOD_OPTIONS} includeEmptyOption={false}
                onChange={(event) => {
                  const paymentMethod = event.target.value;
                  setPayForm((current) => ({ ...current, paymentMethod, bankAccountId: defaultBankAccountId(bankAccounts ?? [], paymentMethod) }));
                }} />
              <BankAccountField accounts={bankAccounts} label={t("Paid from")} value={payForm.bankAccountId} onChange={setPayBankAccount} />
              <FloatingInput label={t(payForm.paymentMethod === "CHEQUE" ? "Cheque number" : "Reference (UTR, cheque no.)")} name="payReference" value={payForm.paymentReference}
                onChange={(event) => setPayForm((current) => ({ ...current, paymentReference: event.target.value }))} />
              {payForm.paymentMethod === "CHEQUE" && (
                <FloatingInput label={t("Cheque date")} name="payChequeDate" type="date" value={payForm.chequeDate}
                  onChange={(event) => setPayForm((current) => ({ ...current, chequeDate: event.target.value }))} />
              )}
              {payForm.paymentMethod === "CHEQUE" && payForm.chequeDate && payForm.chequeDate > (payForm.paymentDate || todayInput()) && (
                <p className="text-xs text-amber-700 sm:col-span-2">
                  {t("Post-dated: the bills are paid now, and the cheque is owed in Post-dated cheques issued until it clears. A post-dated cheque pays bills only, not an advance.")}
                </p>
              )}
              <FloatingInput label={t("Paid by")} name="payPaidBy" value={payForm.paidBy}
                onChange={(event) => setPayForm((current) => ({ ...current, paidBy: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setPayOpen(false)} submitLabel={t("Record payment")} busy={busy} />
          </form>
        }
      />

      <PaginatedPopup
        isOpen={Boolean(applying)}
        title={t("Use an advance on a bill")}
        subtitle={applying ? `${applying.vendor?.name ?? ""} · ${money(applying.remainingAmount, applying.currency)} ${t("left")}` : undefined}
        onClose={() => setApplying(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={applyAdvance} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <div className="sm:col-span-2">
                <FloatingSelect1 label={t("Bill")} name="applyInvoiceId" required value={applyForm.invoiceId}
                  options={applyBills.map((row) => ({
                    id: String(row.purchaseInvoice?.id),
                    name: `${row.purchaseInvoice?.invoiceNumber ?? row.id} · ${money(row.balance, row.purchaseInvoice?.currency)} due ${dateLabel(row.dueDate)}`,
                  }))}
                  onChange={(event) => chooseApplyBill(event.target.value)} />
                {applyBills.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">{t("This vendor has no unpaid bills in this currency.")}</p>
                )}
              </div>
              <FloatingInput label={t("Amount")} name="applyAmount" type="number" required value={applyForm.amount}
                onChange={(event) => setApplyForm((current) => ({ ...current, amount: event.target.value }))} />
              <FloatingInput label={t("Date")} name="applyDate" type="date" value={applyForm.appliedOn}
                onChange={(event) => setApplyForm((current) => ({ ...current, appliedOn: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setApplying(null)} submitLabel={t("Use on the bill")} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deletingAdvance)}
        title={t("Delete advance")}
        message={`Delete the ${money(deletingAdvance?.amount, deletingAdvance?.currency)} advance to ${deletingAdvance?.vendor?.name ?? "the vendor"}? Its entry in the books is reversed.`}
        confirmLabel={t("Delete")}
        variant="danger"
        onConfirm={removeAdvance}
        onCancel={() => setDeletingAdvance(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t(deleting && awaiting(deleting) ? "Withdraw payment" : "Delete payment")}
        message={deleting && awaiting(deleting)
          ? `${t("Withdraw the")} ${money(deleting.amountPaid)} ${t("payment to")} ${deleting.vendor?.name ?? ""}? ${t("It never paid anything, so nothing changes on the bill.")}`
          : `Delete the ${money(deleting?.amountPaid)} payment to ${deleting?.vendor?.name ?? "the vendor"}? Bill ${deleting?.invoice?.invoiceNumber ?? ""} will show that amount as due again.`}
        confirmLabel={t(deleting && awaiting(deleting) ? "Withdraw" : "Delete")}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />

      <PaginatedPopup
        isOpen={Boolean(rejecting)}
        title={t("Reject payment")}
        subtitle={rejecting ? `${rejecting.vendor?.name ?? ""} · ${money(rejecting.amountPaid, rejecting.invoice?.currency)} · ${rejecting.invoice?.invoiceNumber ?? ""}` : undefined}
        onClose={() => setRejecting(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={reject} className="flex flex-col">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <FloatingInput label={t("Why is it rejected?")} name="rejectReason" required value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)} />
              <p className="text-xs text-slate-500">{t("Nothing is paid; the payment stays on the list, marked rejected.")}</p>
            </div>
            <DialogFooter onCancel={() => setRejecting(null)} submitLabel={t("Reject payment")} busy={busy} danger />
          </form>
        }
      />
    </>
  );
};

export default VendorPayments;

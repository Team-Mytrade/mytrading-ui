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
import { INVOICE_API, PAYMENT_METHOD_OPTIONS, apiError, dateLabel, money, paymentMethodLabel, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import { defaultBankAccountId, useBankAccounts } from "./bankShared";
import BankAccountField from "./BankAccountField";

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
}

interface Vendor {
  id: number;
  name: string;
}

interface Payable {
  id: number;
  purchaseInvoice?: { id: number; invoiceNumber?: string; currency?: string };
  vendor?: { id: number; name?: string };
  balance: number;
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
  paidBy: "",
});

const VendorPayments: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
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
  const bankAccounts = useBankAccounts();
  const setBankAccount = useCallback((bankAccountId: string) => setForm((current) => ({ ...current, bankAccountId })), []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentRes, vendorRes, payableRes] = await Promise.all([
        axios.get<VendorPayment[]>(API_URL),
        // Vendors are the common list Purchase uses too
        axios.get<Vendor[]>("/v1/api/common/vendors"),
        axios.get<Payable[]>(`${INVOICE_API}/accounts-payable`),
      ]);
      setPayments(Array.isArray(paymentRes.data) ? paymentRes.data : []);
      setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
      setPayables(Array.isArray(payableRes.data) ? payableRes.data : []);
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

  const openCreate = () => {
    setEditing(null);
    const fresh = emptyForm();
    setForm({ ...fresh, bankAccountId: bankAccounts ? defaultBankAccountId(bankAccounts, fresh.paymentMethod) : "" });
    setFormOpen(true);
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
    };
    setBusy(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/${editing.id}`, { ...common, vendorId: Number(form.vendorId), invoiceId: Number(form.invoiceId) });
        ToasterService.success("Payment updated");
      } else {
        await axios.post(API_URL, { ...common, vendor: { id: Number(form.vendorId) }, invoice: { id: Number(form.invoiceId) } });
        ToasterService.success(`${money(amount)} paid`);
      }
      setFormOpen(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the payment"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${deleting.id}`);
      ToasterService.success("Payment deleted; the bill is due again");
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
    return {
      count: payments.length,
      total: payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0),
      thisMonth: payments.filter((payment) => payment.paymentDate?.startsWith(month)).reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0),
      toPay: payables.reduce((sum, row) => sum + Math.max(Number(row.balance || 0), 0), 0),
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
    { key: "paymentReference", label: "Reference", sortable: true, render: (row) => <span className="text-sm text-slate-600">{row.paymentReference || "—"}</span> },
    {
      key: "amountPaid",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.amountPaid || 0),
      render: (row) => <span className="text-sm font-semibold text-slate-900">{money(row.amountPaid, row.invoice?.currency)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title="Edit payment">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete payment">
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Vendor Payments" description="Payments made to vendors against their bills" />
      <PageBreadcrumb pageTitle="Vendor Payments" actions={canCreate ? <AddButton onClick={openCreate} label="Pay a bill" /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Payments" value={stats.count} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Paid in total" value={money(stats.total)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Paid this month" value={money(stats.thisMonth)} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label="Still to pay" value={money(stats.toPay)} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
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
              <p className="text-sm text-gray-500">No vendor payments yet</p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title={editing ? "Edit vendor payment" : "Pay a bill"}
        subtitle="The payment settles the bill's payable"
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1
                label="Vendor"
                name="vendorId"
                required
                value={form.vendorId}
                options={vendors.map((vendor) => ({ id: String(vendor.id), name: vendor.name }))}
                onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value, invoiceId: "" }))}
              />
              <FloatingSelect1
                label="Bill"
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
                <p className="text-xs text-amber-700 sm:col-span-2">This vendor has no unpaid bills. Add the bill under Purchase Invoices first.</p>
              )}
              <FloatingInput label="Amount paid" name="amountPaid" type="number" required value={form.amountPaid}
                onChange={(event) => setForm((current) => ({ ...current, amountPaid: event.target.value }))} />
              <FloatingInput label="Payment date" name="paymentDate" type="date" value={form.paymentDate}
                onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} />
              <FloatingSelect1 label="Method" name="paymentMethod" value={form.paymentMethod} options={PAYMENT_METHOD_OPTIONS} includeEmptyOption={false}
                onChange={(event) => {
                  const paymentMethod = event.target.value;
                  setForm((current) => ({ ...current, paymentMethod, bankAccountId: defaultBankAccountId(bankAccounts ?? [], paymentMethod) }));
                }} />
              <BankAccountField accounts={bankAccounts} label="Paid from" value={form.bankAccountId} onChange={setBankAccount} />
              <FloatingInput label="Reference (UTR, cheque no.)" name="paymentReference" value={form.paymentReference}
                onChange={(event) => setForm((current) => ({ ...current, paymentReference: event.target.value }))} />
              <FloatingInput label="Paid by" name="paidBy" value={form.paidBy}
                onChange={(event) => setForm((current) => ({ ...current, paidBy: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={editing ? "Save changes" : "Record payment"} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title="Delete payment"
        message={`Delete the ${money(deleting?.amountPaid)} payment to ${deleting?.vendor?.name ?? "the vendor"}? Bill ${deleting?.invoice?.invoiceNumber ?? ""} will show that amount as due again.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
};

export default VendorPayments;

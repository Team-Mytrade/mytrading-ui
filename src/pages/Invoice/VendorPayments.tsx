import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/vendor-payments)       */
/* ------------------------------------------------------------------ */

interface PurchaseInvoiceRef {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  purchaseInvoiceStatus?: string;
}

interface VendorRef {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  invoices?: PurchaseInvoiceRef[];
}

/** GET returns vendor and invoice as nested objects. */
interface VendorPayment {
  id: number;
  paymentReference?: string;
  paymentDate?: string;
  vendor?: VendorRef;
  invoice?: PurchaseInvoiceRef;
  amountPaid?: number;
  paymentMethod?: string;
  paidBy?: string;
  // Filled from vendor / invoice for the table, search and export
  vendorName?: string;
  invoiceNumber?: string;
}

/** POST body: vendor and invoice are sent as objects with their id. */
interface CreatePaymentPayload {
  paymentReference: string;
  paymentDate: string;
  vendor: { id: number };
  invoice?: { id: number };
  amountPaid: number;
  paymentMethod?: string;
  paidBy?: string;
}

/** PUT body: vendor and invoice are sent as plain ids (different from POST). */
interface UpdatePaymentPayload {
  paymentReference: string;
  paymentDate: string;
  vendorId: number;
  invoiceId?: number;
  amountPaid: number;
  paymentMethod?: string;
  paidBy?: string;
}

type PaymentForm = {
  paymentReference?: string;
  paymentDate?: string;
  vendorId?: string;
  invoiceId?: string;
  amountPaid?: string;
  paymentMethod?: string;
  paidBy?: string;
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/vendor-payments";
const VENDORS_URL = "/v1/api/invoice/vendors";
const PURCHASE_INVOICES_URL = "/v1/api/invoice/purchase-invoices";
const PAGE_SIZE = 10;

// No enum API for payment methods, so the list stays here
const PAYMENT_METHODS = [
  { code: "CASH", label: "Cash" },
  { code: "BANK_TRANSFER", label: "Bank Transfer" },
  { code: "CHECK", label: "Cheque" },
  { code: "CREDIT_CARD", label: "Credit Card" },
  { code: "OTHER", label: "Other" },
];
const methodLabel = (code?: string) => PAYMENT_METHODS.find((m) => m.code === code)?.label || code || "--";

const METHOD_TONE: Record<string, StatsCardTone> = {
  CASH: "green",
  BANK_TRANSFER: "blue",
  CHECK: "amber",
  CREDIT_CARD: "cyan",
};

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

/** Copies vendor name and invoice number to the top level for the table. */
const flatten = (p: VendorPayment): VendorPayment => ({
  ...p,
  vendorName: p.vendor?.name || p.vendorName,
  invoiceNumber: p.invoice?.invoiceNumber || p.invoiceNumber,
});

/** Number box for money: blocks - + e E, ignores mouse-wheel scrolling. */
const amountInputProps = {
  type: "number" as const,
  min: 0,
  step: "0.01",
  inputMode: "decimal" as const,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault(),
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const VendorPayments: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [vendors, setVendors] = useState<VendorRef[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoiceRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState<PaymentForm>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [paymentToDelete, setPaymentToDelete] = useState<VendorPayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Earlier payments to the chosen vendor: GET /vendor-payments/vendor/{vendorId}
  const [vendorHistory, setVendorHistory] = useState<VendorPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setPayments(asArray<VendorPayment>(res.data).map(flatten));
    } catch (err) {
      console.error("Error fetching vendor payments", err);
      ToasterService.error("Failed to load vendor payments");
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVendors = () =>
    axios
      .get(VENDORS_URL)
      .then((r) => setVendors(asArray<VendorRef>(r.data)))
      .catch(() => ToasterService.error("Failed to load vendors"));

  const fetchPurchaseInvoices = () =>
    axios
      .get(PURCHASE_INVOICES_URL)
      .then((r) => setPurchaseInvoices(asArray<PurchaseInvoiceRef>(r.data)))
      .catch(() => ToasterService.error("Failed to load purchase invoices"));

  useEffect(() => {
    fetchPayments();
    fetchVendors();
    fetchPurchaseInvoices();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchPayments();
      fetchVendors();
      fetchPurchaseInvoices();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Cards: Total + one per payment method found ---------------- */

  const cards = useMemo<StatsCardOption<VendorPayment>[]>(() => {
    const present = new Set(payments.map((p) => p.paymentMethod).filter(Boolean) as string[]);
    const ordered = [
      ...PAYMENT_METHODS.map((m) => m.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !PAYMENT_METHODS.some((m) => m.code === code)),
    ].slice(0, 5);
    return [
      { key: "ALL", label: "Total Payments", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: methodLabel(code),
        match: (p: VendorPayment) => p.paymentMethod === code,
        tone: METHOD_TONE[code] || "slate",
      })),
    ];
  }, [payments]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(payments, cards);

  /* ---------------- Form ---------------- */

  const selectedVendor = vendors.find((v) => String(v.id) === form.vendorId);

  /** The chosen vendor's invoices (from the vendor), or every purchase invoice if the vendor has none listed. */
  const invoiceChoices = selectedVendor?.invoices?.length ? selectedVendor.invoices : purchaseInvoices;
  const selectedInvoice = invoiceChoices.find((i) => String(i.id) === form.invoiceId);

  const openCreate = () => {
    setForm({ paymentDate: todayIso(), paymentMethod: "BANK_TRANSFER" });
    setEditingId(null);
    setShowFormModal(true);
  };

  const handleEdit = (payment: VendorPayment) => {
    setForm({
      paymentReference: payment.paymentReference || "",
      paymentDate: payment.paymentDate?.slice(0, 10),
      vendorId: payment.vendor?.id ? String(payment.vendor.id) : "",
      invoiceId: payment.invoice?.id ? String(payment.invoice.id) : "",
      amountPaid: payment.amountPaid != null ? String(payment.amountPaid) : "",
      paymentMethod: payment.paymentMethod || "",
      paidBy: payment.paidBy || "",
    });
    setEditingId(payment.id);
    setShowFormModal(true);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const paymentReference = form.paymentReference?.trim() || "";
    const amount = Number(form.amountPaid);
    if (!paymentReference) return ToasterService.error("Payment reference is required");
    if (!form.vendorId) return ToasterService.error("Choose a vendor");
    if (!form.paymentDate) return ToasterService.error("Payment date is required");
    if (!Number.isFinite(amount) || amount <= 0) return ToasterService.error("Amount paid must be more than 0");
    if (selectedInvoice?.totalAmount != null && amount > Number(selectedInvoice.totalAmount)) {
      return ToasterService.error(`Amount paid cannot be more than the invoice total (${formatMoney(Number(selectedInvoice.totalAmount))})`);
    }

    setSubmitting(true);
    try {
      if (editingId !== null) {
        const payload: UpdatePaymentPayload = {
          paymentReference,
          paymentDate: form.paymentDate,
          vendorId: Number(form.vendorId),
          invoiceId: form.invoiceId ? Number(form.invoiceId) : undefined,
          amountPaid: amount,
          paymentMethod: form.paymentMethod || undefined,
          paidBy: form.paidBy?.trim() || undefined,
        };
        await axios.put(`${API_URL}/${editingId}`, payload);
        ToasterService.success("Vendor payment updated successfully!");
      } else {
        const payload: CreatePaymentPayload = {
          paymentReference,
          paymentDate: form.paymentDate,
          vendor: { id: Number(form.vendorId) },
          invoice: form.invoiceId ? { id: Number(form.invoiceId) } : undefined,
          amountPaid: amount,
          paymentMethod: form.paymentMethod || undefined,
          paidBy: form.paidBy?.trim() || undefined,
        };
        await axios.post(API_URL, payload);
        ToasterService.success("Vendor payment added successfully!");
      }
      closeModal();
      fetchPayments();
    } catch (err) {
      console.error("Error saving vendor payment", err);
      ToasterService.error(apiError(err, "Failed to save vendor payment"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Vendor's earlier payments (inside the drawer) ---------------- */

  useEffect(() => {
    if (!showFormModal || !form.vendorId) {
      setVendorHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    axios
      .get(`${API_URL}/vendor/${form.vendorId}`)
      .then((res) => active && setVendorHistory(asArray<VendorPayment>(res.data).map(flatten)))
      .catch((err) => {
        console.error("Error loading vendor payments", err);
        if (active) setVendorHistory([]);
      })
      .finally(() => active && setHistoryLoading(false));
    return () => {
      active = false;
    };
  }, [showFormModal, form.vendorId]);

  const historyRows = vendorHistory.filter((p) => p.id !== editingId);
  const historyTotal = historyRows.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

  /* ---------------- Delete ---------------- */

  const confirmDelete = async () => {
    if (!paymentToDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${paymentToDelete.id}`);
      ToasterService.success("Vendor payment deleted successfully!");
      setPaymentToDelete(null);
      fetchPayments();
    } catch (err) {
      console.error("Error deleting vendor payment", err);
      ToasterService.error(apiError(err, "Failed to delete vendor payment"));
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- Table ---------------- */

  const tableColumns: ColumnDef<VendorPayment>[] = [
    {
      key: "paymentReference",
      label: "Payment Reference",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (p) => <span className="text-sm font-semibold text-slate-900 truncate">{p.paymentReference || "--"}</span>,
    },
    {
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">{p.vendorName ? p.vendorName.charAt(0).toUpperCase() : "V"}</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">{p.vendorName || "--"}</span>
        </div>
      ),
    },
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (p) => <span className="text-sm text-slate-600 truncate">{p.invoiceNumber || "--"}</span>,
    },
    {
      key: "amountPaid",
      label: "Amount Paid",
      sortable: true,
      filterable: false,
      headerClassName: "w-[13%] text-right",
      className: "w-[13%] text-right",
      sortValueGetter: (p) => Number(p.amountPaid || 0),
      detailFormatter: (p) => formatMoney(Number(p.amountPaid || 0)),
      exportValueGetter: (p) => formatMoney(Number(p.amountPaid || 0)),
      render: (p) => <span className="text-sm font-semibold text-slate-700">{formatMoney(Number(p.amountPaid || 0))}</span>,
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      filterOptions: PAYMENT_METHODS.map((m) => ({ label: m.label, value: m.code })),
      detailFormatter: (p) => methodLabel(p.paymentMethod),
      exportValueGetter: (p) => methodLabel(p.paymentMethod),
      render: (p) => (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-blue-50 text-blue-700 border-blue-200/40">
          {methodLabel(p.paymentMethod)}
        </span>
      ),
    },
    {
      key: "paymentDate",
      label: "Payment Date",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      exportValueGetter: (p) => (p.paymentDate ? formatDisplayDate(p.paymentDate) : ""),
      render: (p) => <span className="text-sm text-slate-600">{p.paymentDate ? formatDisplayDate(p.paymentDate) : "--"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => handleEdit(p)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title="Edit Payment">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setPaymentToDelete(p)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title="Delete Payment">
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Vendor Payments" description="Manage vendor payments" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Vendor Payments"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Vendor Payment" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="paymentDate"
            defaultSortOrder="desc"
            loading={isLoading}
            rowDetailsTitle={(p) => `Payment ${p.paymentReference || ""}`.trim()}
            rowDetailsSubtitle="Vendor payment details"
            // The nested vendor / invoice objects are long; their name and number are already shown
            hiddenDetailKeys={["vendor", "invoice"]}
            suspendRowDetails={showFormModal}
            rowDetailsActions={(p: VendorPayment) =>
              canUpdate ? (
                <button type="button" onClick={() => handleEdit(p)} className={ICON_BUTTON_CLASS} title="Edit" aria-label="Edit this record">
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <UserGroupIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No vendor payments found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all payments</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                      Create your first vendor payment
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        <Dragger
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Vendor Payment" : "Add Vendor Payment"}
          subtitle={editingId !== null ? "Update the payment details" : "Record a payment made to a vendor"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SearchableSelect
              label="Vendor"
              value={form.vendorId || ""}
              options={vendors.map((v) => ({ value: String(v.id), label: v.name || `Vendor ${v.id}` }))}
              // A different vendor means a different invoice list
              onChange={(value: string | number) => setForm({ ...form, vendorId: String(value ?? ""), invoiceId: "" })}
              placeholder={vendors.length ? "Search vendor" : "No vendors loaded"}
              required
            />
            <SearchableSelect
              label="Purchase Invoice"
              value={form.invoiceId || ""}
              options={invoiceChoices.map((i) => ({
                value: String(i.id),
                label: [i.invoiceNumber || `Invoice ${i.id}`, i.totalAmount != null ? formatMoney(Number(i.totalAmount)) : ""].filter(Boolean).join(" – "),
              }))}
              onChange={(value: string | number) => setForm({ ...form, invoiceId: String(value ?? "") })}
              placeholder={form.vendorId ? "Search invoice (optional)" : "Choose a vendor first"}
              emptyOptionLabel="None"
            />
            <FloatingInput label="Payment Reference" name="paymentReference" value={form.paymentReference || ""} onChange={handleChange} maxLength={100} required />
            <FloatingDatePicker label="Payment Date" name="paymentDate" value={form.paymentDate || ""} onChange={handleChange} maxDate={todayIso()} required />
            <FloatingInput label="Amount Paid" name="amountPaid" {...amountInputProps} value={form.amountPaid ?? ""} onChange={handleChange} required />
            <FloatingSelect
              label="Payment Method"
              name="paymentMethod"
              value={form.paymentMethod || ""}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              options={PAYMENT_METHODS.map((m) => ({ id: m.code, name: m.label }))}
            />
            <div className="md:col-span-2">
              <FloatingInput label="Paid By" name="paidBy" value={form.paidBy || ""} onChange={handleChange} maxLength={100} />
            </div>
          </div>

          {selectedInvoice && (
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4 dark:border-gray-700 dark:bg-gray-800/60">
              <div>
                <span className="block text-xs text-slate-500">Invoice Date</span>
                <strong className="text-slate-800 dark:text-gray-100">{selectedInvoice.invoiceDate ? formatDisplayDate(selectedInvoice.invoiceDate) : "--"}</strong>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Due Date</span>
                <strong className="text-slate-800 dark:text-gray-100">{selectedInvoice.dueDate ? formatDisplayDate(selectedInvoice.dueDate) : "--"}</strong>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Invoice Total</span>
                <strong className="text-slate-800 dark:text-gray-100">{formatMoney(Number(selectedInvoice.totalAmount || 0))}</strong>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Status</span>
                <strong className="text-slate-800 dark:text-gray-100">{selectedInvoice.purchaseInvoiceStatus || "--"}</strong>
              </div>
            </div>
          )}

          {/* Earlier payments to the chosen vendor */}
          {form.vendorId && (
            <div className="mt-2 border-t border-slate-100 pt-4 dark:border-gray-800">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                Earlier Payments to {selectedVendor?.name || "this vendor"}
              </h3>
              {historyLoading ? (
                <p className="text-sm text-slate-500">Loading payments…</p>
              ) : historyRows.length === 0 ? (
                <p className="text-sm text-slate-500">No earlier payments to this vendor.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {historyRows.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{p.paymentReference || "--"}</td>
                          <td className="px-3 py-2 text-slate-600">{p.paymentDate ? formatDisplayDate(p.paymentDate) : "--"}</td>
                          <td className="px-3 py-2 text-slate-600">{p.invoiceNumber || "--"}</td>
                          <td className="px-3 py-2 text-slate-600">{methodLabel(p.paymentMethod)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatMoney(Number(p.amountPaid || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-gray-800">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                          {historyRows.length} payment{historyRows.length === 1 ? "" : "s"} · Total paid
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{formatMoney(historyTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </Dragger>

        <DynamicPopup
          isPopupOpen={Boolean(paymentToDelete)}
          setIsPopupOpen={(open: boolean) => !open && setPaymentToDelete(null)}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Vendor Payment"
          subText={`Are you sure you want to delete payment "${paymentToDelete?.paymentReference || "this payment"}"? This action cannot be undone.`}
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setPaymentToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default VendorPayments;

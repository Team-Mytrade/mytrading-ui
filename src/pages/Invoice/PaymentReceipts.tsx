import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowUturnLeftIcon, BanknotesIcon, EyeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import {
  INVOICE_API,
  Invoice,
  PAYMENT_METHOD_OPTIONS,
  apiError,
  dateLabel,
  isOpenInvoice,
  labelOf,
  money,
  paymentMethodLabel,
  todayInput,
} from "./invoiceShared";
import { ActionButton, DialogFooter, StatusBadge } from "./invoiceUi";

const API_URL = `${INVOICE_API}/receipts`;
const PAGE_SIZE = 10;

const RECEIPT_STATUS_TONES: Record<string, string> = {
  POSTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REVERSED: "bg-gray-100 text-gray-500 border-gray-200 line-through",
};

interface Allocation {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  allocatedAmount: number;
  invoiceBalance?: number;
  invoiceStatus?: string;
}

interface Receipt {
  id: number;
  receiptNumber: string;
  paymentDate?: string;
  customerId: number;
  totalAmountReceived: number;
  totalAllocated: number;
  unallocatedAmount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  receivedBy?: string;
  notes?: string;
  allocations?: Allocation[];
  status: string;
  reversedAt?: string;
  reversalReason?: string;
}

const emptyForm = () => ({ customerId: "", paymentDate: todayInput(), amount: "", paymentMethod: "BANK_TRANSFER", referenceNumber: "", notes: "" });

const PaymentReceipts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate } = usePermissions();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [outstanding, setOutstanding] = useState<Invoice[]>([]);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [reverseReason, setReverseReason] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [receiptRes, invoiceRes] = await Promise.allSettled([axios.get<Receipt[]>(API_URL), axios.get<Invoice[]>(`${INVOICE_API}/invoices`)]);
    if (receiptRes.status === "fulfilled") setReceipts(Array.isArray(receiptRes.value.data) ? receiptRes.value.data : []);
    else ToasterService.error(apiError(receiptRes.reason, "Failed to load payment receipts"));
    if (invoiceRes.status === "fulfilled") setInvoices(Array.isArray(invoiceRes.value.data) ? invoiceRes.value.data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Customer names come with the invoices (receipts only carry the id)
  const customers = useMemo(() => {
    const byId = new Map<number, string>();
    invoices.forEach((invoice) => {
      if (invoice.customerId != null && invoice.status !== "DRAFT") byId.set(invoice.customerId, invoice.customerName || `Customer #${invoice.customerId}`);
    });
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ id: String(id), name }));
  }, [invoices]);
  const customerName = (id?: number) => customers.find((customer) => customer.id === String(id))?.name ?? `Customer #${id}`;

  const loadOutstanding = async (customerId: string, preselectInvoiceId?: number, presetAmount?: boolean) => {
    setOutstanding([]);
    setAllocations({});
    if (!customerId) return;
    try {
      const res = await axios.get<Invoice[]>(`${INVOICE_API}/invoices/outstanding`, { params: { customerId } });
      const open = (Array.isArray(res.data) ? res.data : [])
        .filter((invoice) => isOpenInvoice(invoice.status) && Number(invoice.balanceAmount || 0) > 0)
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
      setOutstanding(open);
      const preselected = open.find((invoice) => invoice.id === preselectInvoiceId);
      if (preselected) {
        setAllocations({ [preselected.id]: String(preselected.balanceAmount) });
        if (presetAmount) setForm((current) => ({ ...current, amount: String(preselected.balanceAmount) }));
      }
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the customer's open invoices"));
    }
  };

  const openForm = (customerId = "", invoiceId?: number) => {
    setForm({ ...emptyForm(), customerId });
    setShowForm(true);
    loadOutstanding(customerId, invoiceId, true);
  };

  // From an invoice: ?customerId=&invoiceId= opens the form for that invoice
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (!customerId || !canCreate) return;
    openForm(customerId, Number(searchParams.get("invoiceId")) || undefined);
    searchParams.delete("customerId");
    searchParams.delete("invoiceId");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountReceived = Number(form.amount) || 0;
  const totalAllocated = Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const advance = Math.max(0, amountReceived - totalAllocated);

  // Oldest due first, up to what was received
  const autoAllocate = () => {
    let left = amountReceived;
    const next: Record<number, string> = {};
    outstanding.forEach((invoice) => {
      const take = Math.min(left, Number(invoice.balanceAmount || 0));
      if (take > 0) {
        next[invoice.id] = String(Math.round(take * 100) / 100);
        left -= take;
      }
    });
    setAllocations(next);
  };

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.customerId) return ToasterService.error("Choose the customer");
    if (amountReceived <= 0) return ToasterService.error("Enter the amount received");
    if (totalAllocated - amountReceived > 0.001) return ToasterService.error("The allocations add up to more than the amount received");
    const over = outstanding.find((invoice) => (Number(allocations[invoice.id]) || 0) - Number(invoice.balanceAmount || 0) > 0.001);
    if (over) return ToasterService.error(`${over.invoiceNumber} has only ${money(over.balanceAmount)} due`);

    setBusy(true);
    try {
      const res = await axios.post<Receipt>(API_URL, {
        customerId: Number(form.customerId),
        paymentDate: form.paymentDate || null,
        totalAmountReceived: amountReceived,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber.trim() || null,
        notes: form.notes.trim() || null,
        allocations: Object.entries(allocations)
          .filter(([, value]) => Number(value) > 0)
          .map(([invoiceId, value]) => ({ invoiceId: Number(invoiceId), allocatedAmount: Number(value) })),
      });
      ToasterService.success(
        res.data.unallocatedAmount > 0
          ? `Receipt ${res.data.receiptNumber} recorded; ${money(res.data.unallocatedAmount)} kept as customer credit`
          : `Receipt ${res.data.receiptNumber} recorded`
      );
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the payment"));
    } finally {
      setBusy(false);
    }
  };

  const reverse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!reverseReason.trim()) return ToasterService.error("Enter why the payment is reversed");
    setBusy(true);
    try {
      const res = await axios.post<Receipt>(`${API_URL}/${selected.id}/reverse`, { reason: reverseReason.trim() });
      ToasterService.success(`Receipt ${res.data.receiptNumber} reversed; its invoices are open again`);
      setShowReverse(false);
      setSelected(res.data);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not reverse the payment"));
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const posted = receipts.filter((receipt) => receipt.status === "POSTED");
    const month = todayInput().slice(0, 7);
    return {
      count: posted.length,
      thisMonth: posted.filter((receipt) => receipt.paymentDate?.startsWith(month)).reduce((sum, receipt) => sum + Number(receipt.totalAmountReceived || 0), 0),
      advances: posted.reduce((sum, receipt) => sum + Number(receipt.unallocatedAmount || 0), 0),
      reversed: receipts.length - posted.length,
    };
  }, [receipts]);

  const columns: ColumnDef<Receipt>[] = [
    {
      key: "receiptNumber",
      label: "Receipt",
      sortable: true,
      render: (receipt) => <span className="text-sm font-semibold text-slate-900">{receipt.receiptNumber}</span>,
    },
    { key: "paymentDate", label: "Date", sortable: true, render: (receipt) => <span className="text-sm text-slate-600">{dateLabel(receipt.paymentDate)}</span> },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      sortValueGetter: (receipt) => customerName(receipt.customerId),
      filterValueGetter: (receipt) => customerName(receipt.customerId),
      render: (receipt) => <span className="text-sm text-slate-700">{customerName(receipt.customerId)}</span>,
    },
    {
      key: "paymentMethod",
      label: "Method",
      sortable: true,
      render: (receipt) => (
        <span className="text-sm text-slate-600">
          {paymentMethodLabel(receipt.paymentMethod)}
          {receipt.referenceNumber ? <span className="block text-xs text-slate-400">{receipt.referenceNumber}</span> : null}
        </span>
      ),
    },
    {
      key: "totalAmountReceived",
      label: "Received",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (receipt) => <span className="text-sm font-medium text-slate-800">{money(receipt.totalAmountReceived)}</span>,
    },
    {
      key: "unallocatedAmount",
      label: "Advance",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (receipt) => <span className="text-sm text-slate-600">{Number(receipt.unallocatedAmount) > 0 ? money(receipt.unallocatedAmount) : "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (receipt) => <StatusBadge status={receipt.status} tones={RECEIPT_STATUS_TONES} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (receipt) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => setSelected(receipt)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title="View receipt">
            <EyeIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Payment Receipts" description="Customer payments and how they settle invoices" />
      <PageBreadcrumb pageTitle="Payment Receipts" actions={canCreate ? <AddButton onClick={() => openForm()} label="Record payment" /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Received this month" value={money(stats.thisMonth)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Receipts" value={stats.count} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Kept as advance" value={money(stats.advances)} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
          <StatsCard label="Reversed" value={stats.reversed} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <ReusableTable
          data={receipts}
          columns={columns}
          pageSize={PAGE_SIZE}
          searchable
          searchPlaceholder="Search by receipt or reference…"
          searchFields={["receiptNumber", "referenceNumber", "paymentMethod"]}
          onRowClick={setSelected}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BanknotesIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">No payments recorded yet</p>
            </div>
          }
        />
      </div>

      {/* Record a payment */}
      <PaginatedPopup
        isOpen={showForm}
        title="Record payment"
        subtitle="Allocate the money to the customer's open invoices. Anything left over is kept as an advance they can use later."
        onClose={() => setShowForm(false)}
        maxWidthClassName="max-w-3xl"
        content={
          <form onSubmit={recordPayment} className="flex flex-col">
            <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingSelect1
                  label="Customer"
                  name="customerId"
                  required
                  value={form.customerId}
                  options={customers}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, customerId: event.target.value }));
                    loadOutstanding(event.target.value);
                  }}
                />
                <FloatingInput label="Amount received" name="amount" type="number" required value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                <FloatingInput label="Payment date" name="paymentDate" type="date" value={form.paymentDate}
                  onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} />
                <FloatingSelect1 label="Method" name="paymentMethod" value={form.paymentMethod} options={PAYMENT_METHOD_OPTIONS} includeEmptyOption={false}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} />
                <FloatingInput label="Reference (UTR, cheque no.)" name="referenceNumber" value={form.referenceNumber}
                  onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} />
                <FloatingInput label="Notes" name="notes" value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>

              {form.customerId && (
                <div className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <span className="text-sm font-semibold text-slate-800">Open invoices</span>
                    {outstanding.length > 0 && amountReceived > 0 && (
                      <button type="button" onClick={autoAllocate} className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline">
                        <SparklesIcon className="h-4 w-4" /> Allocate oldest first
                      </button>
                    )}
                  </div>
                  {outstanding.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-500">No open invoices. The whole amount will be kept as an advance.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-left">Due</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="w-40 px-3 py-2 text-right">Allocate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {outstanding.map((invoice) => (
                          <tr key={invoice.id}>
                            <td className="px-3 py-2 font-medium text-slate-800">{invoice.invoiceNumber}</td>
                            <td className="px-3 py-2 text-slate-600">{dateLabel(invoice.dueDate)} {invoice.status === "OVERDUE" && <span className="text-xs font-semibold text-red-600">overdue</span>}</td>
                            <td className="px-3 py-2 text-right">{money(invoice.balanceAmount, invoice.currencyCode)}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={allocations[invoice.id] ?? ""}
                                onChange={(event) => setAllocations((current) => ({ ...current, [invoice.id]: event.target.value }))}
                                className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm focus:border-cyan-500 focus:outline-none"
                                aria-label={`Amount for ${invoice.invoiceNumber}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-slate-100 px-3 py-2 text-sm">
                    <span className="text-slate-500">Allocated <strong className="text-slate-800">{money(totalAllocated)}</strong></span>
                    <span className={totalAllocated > amountReceived + 0.001 ? "font-semibold text-red-600" : "text-slate-500"}>
                      Advance <strong className="text-slate-800">{money(advance)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter onCancel={() => setShowForm(false)} submitLabel="Record payment" busy={busy} />
          </form>
        }
      />

      {/* Receipt detail */}
      <PaginatedPopup
        isOpen={Boolean(selected) && !showReverse}
        title={`Receipt ${selected?.receiptNumber ?? ""}`}
        subtitle={selected ? `${customerName(selected.customerId)} · ${dateLabel(selected.paymentDate)}` : ""}
        onClose={() => setSelected(null)}
        maxWidthClassName="max-w-2xl"
        content={
          selected ? (
            <div className="flex flex-col">
              <div className="space-y-4 px-4 py-4 sm:px-5">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-slate-500">Received</dt><dd className="font-semibold text-slate-900">{money(selected.totalAmountReceived)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Method</dt><dd className="text-slate-800">{paymentMethodLabel(selected.paymentMethod)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Reference</dt><dd className="text-slate-800">{selected.referenceNumber || "—"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Status</dt><dd><StatusBadge status={selected.status} tones={RECEIPT_STATUS_TONES} /></dd></div>
                </dl>
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">Allocated to</div>
                  {selected.allocations?.length ? (
                    <ul className="divide-y divide-slate-100 text-sm">
                      {selected.allocations.map((allocation) => (
                        <li key={allocation.id} className="flex items-center justify-between px-3 py-2">
                          <button type="button" className="font-medium text-cyan-700 hover:underline" onClick={() => navigate(`/invoices?invoiceId=${allocation.invoiceId}`)}>
                            {allocation.invoiceNumber}
                          </button>
                          <span>{money(allocation.allocatedAmount)} <span className="text-xs text-slate-500">· now {labelOf(allocation.invoiceStatus)}</span></span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-3 text-sm text-slate-500">Not allocated to invoices.</p>
                  )}
                  {Number(selected.unallocatedAmount) > 0 && (
                    <p className="border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
                      {money(selected.unallocatedAmount)} kept as customer credit (advance).
                    </p>
                  )}
                </div>
                {selected.notes && <p className="text-sm text-slate-600">{selected.notes}</p>}
                {selected.status === "REVERSED" && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    Reversed {dateLabel(selected.reversedAt)}: {selected.reversalReason}
                  </p>
                )}
              </div>
              {selected.status === "POSTED" && canCreate && (
                <div className="flex justify-end border-t border-gray-100 px-4 py-3 sm:px-5">
                  <ActionButton tone="danger" icon={ArrowUturnLeftIcon} label="Reverse payment" onClick={() => {
                    setReverseReason("");
                    setShowReverse(true);
                  }} />
                </div>
              )}
            </div>
          ) : undefined
        }
      />

      <PaginatedPopup
        isOpen={showReverse}
        title={`Reverse ${selected?.receiptNumber ?? ""}`}
        subtitle="For a bounced cheque or a payment recorded by mistake. The invoices it paid become due again and any advance it created is cancelled."
        onClose={() => setShowReverse(false)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={reverse} className="flex flex-col">
            <div className="px-4 py-4 sm:px-5">
              <FloatingTextarea label="Reason" name="reason" rows={3} required value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} />
            </div>
            <DialogFooter onCancel={() => setShowReverse(false)} submitLabel="Reverse payment" busy={busy} danger />
          </form>
        }
      />
    </>
  );
};

export default PaymentReceipts;

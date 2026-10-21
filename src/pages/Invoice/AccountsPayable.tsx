import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { BanknotesIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/accounts-payable)      */
/* ------------------------------------------------------------------ */

interface AccountPayable {
  id: number;
  invoiceAmount?: number;
  amountPaid?: number;
  balance?: number;
  accountsPayableStatus?: string;
  lastPaymentDate?: string;
  dueDate?: string;
  createdDate?: string;
  updatedDate?: string;
  // Not in the Swagger response; shown only if the backend sends them
  vendor?: { id: number; name?: string };
  vendorName?: string;
  purchaseInvoice?: { id: number; invoiceNumber?: string };
  invoiceNumber?: string;
}

/** Body of POST /accounts-payable/create (manual entry). Server fields are not sent. */
interface CreatePayablePayload {
  invoiceAmount: number;
  amountPaid: number;
  balance: number;
  accountsPayableStatus: string;
  dueDate?: string;
  lastPaymentDate?: string;
}

interface PurchaseInvoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  purchaseInvoiceStatus?: string;
  currency?: string;
  referenceNumber?: string;
  notes?: string;
}

interface Vendor {
  id: number;
  name?: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/accounts-payable";
const PURCHASE_INVOICES_URL = "/v1/api/invoice/purchase-invoices";
const VENDORS_URL = "/v1/api/invoice/vendors";
const PAGE_SIZE = 10;
const STATUS_FALLBACK = ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "OTHER"];

type CreateMode = "FROM_INVOICE" | "MANUAL";

const toneForStatus = (status?: string): StatsCardTone => {
  switch (status) {
    case "PAID":
      return "green";
    case "PARTIALLY_PAID":
      return "amber";
    case "OPEN":
      return "blue";
    case "OVERDUE":
      return "red";
    default:
      return "slate";
  }
};

const BADGE_CLASS: Record<StatsCardTone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  blue: "bg-blue-50 text-blue-700 border-blue-200/40",
  amber: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  red: "bg-red-50 text-red-700 border-red-200/40",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200/40",
  slate: "bg-gray-50 text-gray-700 border-gray-200/40",
};

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

/** Paise maths so 0.1 + 0.2 = 0.3 exactly. */
const toPaise = (value: unknown) => Math.round((Number(value) || 0) * 100);
const fromPaise = (paise: number) => paise / 100;

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

type CreateForm = {
  mode: CreateMode;
  purchaseInvoiceId?: string;
  invoiceAmount?: string;
  amountPaid?: string;
  dueDate?: string;
};

const AccountsPayable: React.FC = () => {
  const { canCreate, canUpdate } = usePermissions();

  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const payableStatuses = useInvoiceEnum("ACCOUNTS_PAYABLE_STATUS", STATUS_FALLBACK);
  const statusLabel = (code?: string) => payableStatuses.find((s) => s.code === code)?.label || code || "--";

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ mode: "FROM_INVOICE" });
  const [submitting, setSubmitting] = useState(false);

  // Vendor check inside the Add drawer: GET /vendor/{id} and /vendor/{id}/outstanding
  const [vendorId, setVendorId] = useState("");
  const [vendorPayables, setVendorPayables] = useState<AccountPayable[]>([]);
  const [vendorOutstanding, setVendorOutstanding] = useState<number | null>(null);
  const [vendorLoading, setVendorLoading] = useState(false);

  // Record payment: PUT /{id}/payment?paymentAmount=&paymentDate=
  const [payTarget, setPayTarget] = useState<AccountPayable | null>(null);
  const [payForm, setPayForm] = useState<{ paymentAmount: string; paymentDate: string }>({ paymentAmount: "", paymentDate: "" });
  const [paying, setPaying] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchPayables = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setPayables(
        asArray<AccountPayable>(res.data).map((ap) => ({
          ...ap,
          vendorName: ap.vendor?.name || ap.vendorName,
          invoiceNumber: ap.purchaseInvoice?.invoiceNumber || ap.invoiceNumber,
        }))
      );
    } catch (err) {
      console.error("Error fetching accounts payable", err);
      ToasterService.error("Failed to load accounts payable");
      setPayables([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPurchaseInvoices = () =>
    axios
      .get(PURCHASE_INVOICES_URL)
      .then((r) => setPurchaseInvoices(asArray<PurchaseInvoice>(r.data)))
      .catch(() => ToasterService.error("Failed to load purchase invoices"));

  const fetchVendors = () =>
    axios
      .get(VENDORS_URL)
      .then((r) => setVendors(asArray<Vendor>(r.data)))
      .catch(() => ToasterService.error("Failed to load vendors"));

  useEffect(() => {
    fetchPayables();
    fetchPurchaseInvoices();
    fetchVendors();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchPayables();
      fetchPurchaseInvoices();
      fetchVendors();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Cards: Total + one per status found ---------------- */

  const cards = useMemo<StatsCardOption<AccountPayable>[]>(() => {
    const present = new Set(payables.map((p) => p.accountsPayableStatus).filter(Boolean) as string[]);
    const ordered = [
      ...payableStatuses.map((s) => s.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !payableStatuses.some((s) => s.code === code)),
    ].slice(0, 5);
    return [
      { key: "ALL", label: "Total Payables", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: statusLabel(code),
        match: (p: AccountPayable) => p.accountsPayableStatus === code,
        tone: toneForStatus(code),
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payables, payableStatuses]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(payables, cards);

  /* ---------------- Create ---------------- */

  const openCreate = () => {
    setCreateForm({ mode: "FROM_INVOICE", amountPaid: "0" });
    setVendorId("");
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setCreateForm({ mode: "FROM_INVOICE" });
    setVendorId("");
  };

  const selectedInvoice = purchaseInvoices.find((pi) => String(pi.id) === createForm.purchaseInvoiceId);

  // Manual entry: balance and status are worked out from the amounts
  const manualAmountPaise = toPaise(createForm.invoiceAmount);
  const manualPaidPaise = toPaise(createForm.amountPaid);
  const manualBalancePaise = manualAmountPaise - manualPaidPaise;
  const manualStatus = manualPaidPaise === 0 ? "OPEN" : manualBalancePaise === 0 ? "PAID" : "PARTIALLY_PAID";

  const handleCreateChange = (e: ChangeEvent<HTMLInputElement>) =>
    setCreateForm({ ...createForm, [e.target.name]: e.target.value });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (createForm.mode === "FROM_INVOICE") {
        if (!selectedInvoice) {
          ToasterService.error("Choose a purchase invoice");
          return;
        }
        // POST /accounts-payable/invoice takes the purchase invoice itself
        await axios.post(`${API_URL}/invoice`, selectedInvoice);
        ToasterService.success(`Payable created for invoice ${selectedInvoice.invoiceNumber || ""}`);
      } else {
        if (manualAmountPaise <= 0) {
          ToasterService.error("Invoice amount must be more than 0");
          return;
        }
        if (manualBalancePaise < 0) {
          ToasterService.error("Amount paid cannot be more than the invoice amount");
          return;
        }
        const payload: CreatePayablePayload = {
          invoiceAmount: fromPaise(manualAmountPaise),
          amountPaid: fromPaise(manualPaidPaise),
          balance: fromPaise(manualBalancePaise),
          accountsPayableStatus: manualStatus,
          dueDate: createForm.dueDate || undefined,
          lastPaymentDate: manualPaidPaise > 0 ? todayIso() : undefined,
        };
        await axios.post(`${API_URL}/create`, payload);
        ToasterService.success("Payable created");
      }
      closeCreate();
      fetchPayables();
    } catch (err) {
      console.error("Error creating payable", err);
      ToasterService.error(apiError(err, "Failed to create payable"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Vendor check (inside the Add drawer) ---------------- */

  useEffect(() => {
    if (!showCreate || !vendorId) {
      setVendorPayables([]);
      setVendorOutstanding(null);
      return;
    }
    let active = true;
    setVendorLoading(true);
    Promise.all([
      axios.get(`${API_URL}/vendor/${vendorId}`),
      axios.get(`${API_URL}/vendor/${vendorId}/outstanding`),
    ])
      .then(([list, outstanding]) => {
        if (!active) return;
        setVendorPayables(asArray<AccountPayable>(list.data));
        setVendorOutstanding(Number(outstanding.data) || 0);
      })
      .catch((err) => {
        console.error("Error loading vendor payables", err);
        if (active) {
          ToasterService.error(apiError(err, "Failed to load the vendor's payables"));
          setVendorPayables([]);
          setVendorOutstanding(null);
        }
      })
      .finally(() => active && setVendorLoading(false));
    return () => {
      active = false;
    };
  }, [showCreate, vendorId]);

  /* ---------------- Record payment ---------------- */

  const canPay = (p: AccountPayable) => p.accountsPayableStatus !== "PAID" && Number(p.balance || 0) > 0;

  const openPayment = (p: AccountPayable) => {
    setPayTarget(p);
    setPayForm({ paymentAmount: "", paymentDate: todayIso() });
  };

  const closePayment = () => {
    setPayTarget(null);
    setPayForm({ paymentAmount: "", paymentDate: "" });
  };

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!payTarget || paying) return;
    const amountPaise = toPaise(payForm.paymentAmount);
    const balancePaise = toPaise(payTarget.balance);
    if (amountPaise <= 0) {
      ToasterService.error("Payment amount must be more than 0");
      return;
    }
    if (amountPaise > balancePaise) {
      ToasterService.error(`Payment cannot be more than the balance (${formatMoney(fromPaise(balancePaise))})`);
      return;
    }
    if (!payForm.paymentDate) {
      ToasterService.error("Payment date is required");
      return;
    }
    setPaying(true);
    try {
      await axios.put(`${API_URL}/${payTarget.id}/payment`, null, {
        params: { paymentAmount: fromPaise(amountPaise), paymentDate: payForm.paymentDate },
      });
      ToasterService.success(`Payment of ${formatMoney(fromPaise(amountPaise))} recorded`);
      closePayment();
      fetchPayables();
    } catch (err) {
      console.error("Error recording payment", err);
      ToasterService.error(apiError(err, "Failed to record payment"));
    } finally {
      setPaying(false);
    }
  };

  /* ---------------- Table ---------------- */

  // Vendor / Invoice columns appear only if the backend sends those fields
  const hasVendor = payables.some((p) => p.vendorName);
  const hasInvoice = payables.some((p) => p.invoiceNumber);

  const money = (key: "invoiceAmount" | "amountPaid" | "balance", label: string, bold = false): ColumnDef<AccountPayable> => ({
    key,
    label,
    sortable: true,
    filterable: false,
    headerClassName: "text-right",
    className: "text-right",
    sortValueGetter: (p) => Number(p[key] || 0),
    detailFormatter: (p) => formatMoney(Number(p[key] || 0)),
    exportValueGetter: (p) => formatMoney(Number(p[key] || 0)),
    render: (p) => (
      <span className={`text-sm ${bold ? "font-semibold text-slate-700" : "text-slate-600"}`}>{formatMoney(Number(p[key] || 0))}</span>
    ),
  });

  const date = (key: "dueDate" | "lastPaymentDate", label: string): ColumnDef<AccountPayable> => ({
    key,
    label,
    sortable: true,
    exportValueGetter: (p) => (p[key] ? formatDisplayDate(p[key] as string) : ""),
    render: (p) => <span className="text-sm text-slate-600">{p[key] ? formatDisplayDate(p[key] as string) : "--"}</span>,
  });

  const tableColumns: ColumnDef<AccountPayable>[] = [
    ...(hasVendor
      ? [
          {
            key: "vendorName",
            label: "Vendor",
            sortable: true,
            render: (p: AccountPayable) => <span className="text-sm font-semibold text-slate-900 truncate">{p.vendorName || "--"}</span>,
          },
        ]
      : []),
    ...(hasInvoice
      ? [
          {
            key: "invoiceNumber",
            label: "Invoice",
            sortable: true,
            render: (p: AccountPayable) => <span className="text-sm text-slate-600 truncate">{p.invoiceNumber || "--"}</span>,
          },
        ]
      : []),
    money("invoiceAmount", "Invoice Amount", true),
    money("amountPaid", "Amount Paid"),
    money("balance", "Balance", true),
    date("dueDate", "Due Date"),
    date("lastPaymentDate", "Last Payment"),
    {
      key: "accountsPayableStatus",
      label: "Status",
      sortable: true,
      filterOptions: payableStatuses.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (p) => statusLabel(p.accountsPayableStatus),
      exportValueGetter: (p) => statusLabel(p.accountsPayableStatus),
      render: (p) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[toneForStatus(p.accountsPayableStatus)]}`}>
          {statusLabel(p.accountsPayableStatus)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && canPay(p) && (
            <button
              type="button"
              onClick={() => openPayment(p)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600"
              title="Record payment"
            >
              <BanknotesIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const invoiceOptions = purchaseInvoices.map((pi) => ({
    value: String(pi.id),
    label: [pi.invoiceNumber || `Invoice ${pi.id}`, pi.totalAmount != null ? formatMoney(Number(pi.totalAmount)) : ""].filter(Boolean).join(" – "),
  }));

  return (
    <>
      <PageMeta title="Accounts Payable" description="Manage accounts payable" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Accounts Payable"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Payable" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="dueDate"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(p) => (p.invoiceNumber ? `Payable – ${p.invoiceNumber}` : "Payable Details")}
            rowDetailsSubtitle="Account payable details"
            suspendRowDetails={showCreate || Boolean(payTarget)}
            rowDetailsActions={(p: AccountPayable) =>
              canUpdate && canPay(p) ? (
                <button type="button" onClick={() => openPayment(p)} className={ICON_BUTTON_CLASS} title="Record payment" aria-label="Record payment">
                  <BanknotesIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No payables found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all payables</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                      Create your first payable
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Add payable: from a purchase invoice, or a manual entry */}
        <Dragger
          isOpen={showCreate}
          title="Add Payable"
          subtitle="Create a payable from a purchase invoice, or enter one manually"
          onClose={closeCreate}
          onSubmit={handleCreate}
          submitting={submitting}
          submitLabel="Create"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FloatingSelect
                label="Create From"
                name="mode"
                value={createForm.mode}
                includeEmptyOption={false}
                onChange={(e) => setCreateForm({ ...createForm, mode: e.target.value as CreateMode })}
                options={[
                  { id: "FROM_INVOICE", name: "Purchase invoice" },
                  { id: "MANUAL", name: "Manual entry" },
                ]}
              />
            </div>

            {createForm.mode === "FROM_INVOICE" ? (
              <>
                <div className="md:col-span-2">
                  <SearchableSelect
                    label="Purchase Invoice"
                    value={createForm.purchaseInvoiceId || ""}
                    options={invoiceOptions}
                    onChange={(value: string | number) => setCreateForm({ ...createForm, purchaseInvoiceId: String(value ?? "") })}
                    placeholder={purchaseInvoices.length ? "Search invoice" : "No purchase invoices loaded"}
                    required
                  />
                </div>
                {selectedInvoice && (
                  <div className="md:col-span-2 mb-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4 dark:border-gray-700 dark:bg-gray-800/60">
                    <div>
                      <span className="block text-xs text-slate-500">Invoice Date</span>
                      <strong className="text-slate-800 dark:text-gray-100">{selectedInvoice.invoiceDate ? formatDisplayDate(selectedInvoice.invoiceDate) : "--"}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">Due Date</span>
                      <strong className="text-slate-800 dark:text-gray-100">{selectedInvoice.dueDate ? formatDisplayDate(selectedInvoice.dueDate) : "--"}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">Total Amount</span>
                      <strong className="text-slate-800 dark:text-gray-100">{formatMoney(Number(selectedInvoice.totalAmount || 0))}</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">Reference</span>
                      <strong className="text-slate-800 dark:text-gray-100">{selectedInvoice.referenceNumber || "--"}</strong>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <FloatingInput label="Invoice Amount" name="invoiceAmount" {...amountInputProps} value={createForm.invoiceAmount ?? ""} onChange={handleCreateChange} required />
                <FloatingInput label="Amount Paid" name="amountPaid" {...amountInputProps} value={createForm.amountPaid ?? ""} onChange={handleCreateChange} />
                <FloatingDatePicker label="Due Date" name="dueDate" value={createForm.dueDate || ""} onChange={handleCreateChange} />
                <div className="mb-5 flex h-[52px] items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-4 text-sm dark:border-gray-700 dark:bg-gray-800">
                  <span className="text-gray-500">Balance</span>
                  <span className="flex items-center gap-2">
                    <strong className={manualBalancePaise < 0 ? "text-red-600" : "text-slate-800 dark:text-gray-100"}>
                      {formatMoney(fromPaise(manualBalancePaise))}
                    </strong>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[toneForStatus(manualStatus)]}`}>
                      {statusLabel(manualStatus)}
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Optional: check a vendor's payables before creating a new one */}
          <div className="mt-2 border-t border-slate-100 pt-4 dark:border-gray-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Vendor Payables</h3>
            <p className="mb-3 text-xs text-slate-400">Optional – see what you already owe a vendor.</p>
            <SearchableSelect
              label="Vendor"
              value={vendorId}
              options={vendors.map((v) => ({ value: String(v.id), label: v.name || `Vendor ${v.id}` }))}
              onChange={(value: string | number) => setVendorId(String(value ?? ""))}
              placeholder={vendors.length ? "Search vendor" : "No vendors loaded"}
            />
            {vendorId &&
              (vendorLoading ? (
                <p className="py-3 text-sm text-slate-500">Loading payables…</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
                    <span>Total outstanding to this vendor</span>
                    <strong>{formatMoney(vendorOutstanding ?? 0)}</strong>
                  </div>
                  {vendorPayables.length === 0 ? (
                    <p className="py-1 text-sm text-slate-500">No payables for this vendor.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-right">Invoice Amount</th>
                            <th className="px-3 py-2 text-right">Paid</th>
                            <th className="px-3 py-2 text-right">Balance</th>
                            <th className="px-3 py-2">Due Date</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                          {vendorPayables.map((p) => (
                            <tr key={p.id}>
                              <td className="px-3 py-2 text-right text-slate-600">{formatMoney(Number(p.invoiceAmount || 0))}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{formatMoney(Number(p.amountPaid || 0))}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatMoney(Number(p.balance || 0))}</td>
                              <td className="px-3 py-2 text-slate-600">{p.dueDate ? formatDisplayDate(p.dueDate) : "--"}</td>
                              <td className="px-3 py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[toneForStatus(p.accountsPayableStatus)]}`}>
                                  {statusLabel(p.accountsPayableStatus)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ))}
          </div>
        </Dragger>

        {/* Record payment (small form) */}
        <Dragger
          isOpen={Boolean(payTarget)}
          variant="modal"
          compact
          title="Record Payment"
          subtitle={payTarget ? `Balance due: ${formatMoney(Number(payTarget.balance || 0))}` : ""}
          onClose={closePayment}
          onSubmit={handlePayment}
          submitting={paying}
          submitLabel="Record Payment"
        >
          <div className="grid grid-cols-1 gap-3">
            <FloatingInput
              label="Payment Amount"
              name="paymentAmount"
              {...amountInputProps}
              max={Number(payTarget?.balance || 0)}
              value={payForm.paymentAmount}
              onChange={(e) => setPayForm({ ...payForm, paymentAmount: e.target.value })}
              required
            />
            <FloatingDatePicker
              label="Payment Date"
              name="paymentDate"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
              maxDate={todayIso()}
              required
            />
            {payTarget && (
              <button
                type="button"
                onClick={() => setPayForm({ ...payForm, paymentAmount: String(Number(payTarget.balance || 0)) })}
                className="justify-self-start text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Pay full balance ({formatMoney(Number(payTarget.balance || 0))})
              </button>
            )}
          </div>
        </Dragger>
      </div>
    </>
  );
};

export default AccountsPayable;

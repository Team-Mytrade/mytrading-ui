import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { BanknotesIcon, BuildingOffice2Icon, DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput } from "../../components/inputfeild/FloatingInput";
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
  // Not in the GET response yet (asked from backend); the columns appear by themselves when they arrive
  vendor?: { id: number; name?: string };
  vendorName?: string;
  purchaseInvoice?: { id: number; invoiceNumber?: string };
  invoiceNumber?: string;
}

/** Body of POST /accounts-payable/create. Server fields are never sent. */
interface CreatePayablePayload {
  invoiceAmount: number;
  amountPaid: number;
  balance: number;
  accountsPayableStatus: string;
  dueDate?: string;
  lastPaymentDate?: string;
  /** Not in the Swagger example, but the backend answers "Vendor is required" without it. */
  vendor: { id: number };
}

interface PurchaseInvoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  purchaseInvoiceStatus?: string;
  referenceNumber?: string;
  vendor?: { id?: number; name?: string } | null;
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
const STATUS_FALLBACK = ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE"];

/*
 * NOT USED (22 Oct):
 * - POST /accounts-payable/invoice – returned 201 but created no payable and overwrote the purchase invoice
 *   (createdDate / createdBy / tenantId = null). A purchase invoice is now only used to FILL the form,
 *   and the payable is saved with POST /create.
 * - POST /accounts-payable/pay/{invoiceId} – same job as PUT /{id}/payment (waiting for backend to say which one).
 */

const BADGE_CLASS: Record<StatsCardTone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  blue: "bg-blue-50 text-blue-700 border-blue-200/40",
  amber: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  red: "bg-red-50 text-red-700 border-red-200/40",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200/40",
  slate: "bg-gray-50 text-gray-700 border-gray-200/40",
};

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

/** Whole days from today to a "YYYY-MM-DD" date (negative = in the past). */
const daysFromToday = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = todayIso().split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000);
};

/** Unpaid and past its due date. Worked out here because the backend may not set OVERDUE itself. */
const isOverdue = (p: AccountPayable) =>
  p.accountsPayableStatus === "OVERDUE" || (Number(p.balance || 0) > 0 && Boolean(p.dueDate) && daysFromToday(String(p.dueDate)) < 0);

const canPay = (p: AccountPayable) => p.accountsPayableStatus !== "PAID" && Number(p.balance || 0) > 0;

/** Small label + value box used in the forms. */
const Stat = ({ label, value, tone = "text-slate-800 dark:text-gray-100" }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
    <span className="block text-xs text-slate-500 dark:text-gray-400">{label}</span>
    <strong className={`text-sm ${tone}`}>{value}</strong>
  </div>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type CreateForm = {
  vendorId: string;
  purchaseInvoiceId: string;
  invoiceAmount: string;
  amountPaid: string;
  dueDate: string;
};

const EMPTY_CREATE: CreateForm = { vendorId: "", purchaseInvoiceId: "", invoiceAmount: "", amountPaid: "0", dueDate: "" };

const AccountsPayable: React.FC = () => {
  const { canCreate, canUpdate } = usePermissions();

  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const payableStatuses = useInvoiceEnum("ACCOUNTS_PAYABLE_STATUS", STATUS_FALLBACK);
  const statusLabel = (code?: string) => payableStatuses.find((s) => s.code === code)?.label || code || "--";

  // Add payable (drawer)
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [submitting, setSubmitting] = useState(false);

  // What a vendor already owes: GET /vendor/{id} + /vendor/{id}/outstanding (Add drawer and Vendor Statement)
  const [statementVendorId, setStatementVendorId] = useState("");
  const [showStatement, setShowStatement] = useState(false);
  const [vendorPayables, setVendorPayables] = useState<AccountPayable[]>([]);
  const [vendorOutstanding, setVendorOutstanding] = useState<number | null>(null);
  const [vendorLoading, setVendorLoading] = useState(false);

  // Record payment: PUT /{id}/payment?paymentAmount=&paymentDate=
  const [payTarget, setPayTarget] = useState<AccountPayable | null>(null);
  const [payForm, setPayForm] = useState({ paymentAmount: "", paymentDate: "" });
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
      // Only the fields used here (the API also nests the vendor with all its invoices)
      .then((r) =>
        setPurchaseInvoices(
          asArray<PurchaseInvoice>(r.data).map((pi) => ({
            id: pi.id,
            invoiceNumber: pi.invoiceNumber,
            invoiceDate: pi.invoiceDate,
            dueDate: pi.dueDate,
            totalAmount: pi.totalAmount,
            purchaseInvoiceStatus: pi.purchaseInvoiceStatus,
            referenceNumber: pi.referenceNumber,
            vendor: pi.vendor ? { id: pi.vendor.id, name: pi.vendor.name } : null,
          }))
        )
      )
      .catch(() => ToasterService.error("Failed to load purchase invoices"));

  const fetchVendors = () =>
    axios
      .get(VENDORS_URL)
      .then((r) =>
        setVendors(
          asArray<Vendor>(r.data)
            .map((v) => ({ id: v.id, name: v.name }))
            .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        )
      )
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

  const vendorOptions = vendors.map((v) => ({ value: String(v.id), label: v.name || `Vendor ${v.id}` }));
  const vendorName = (id: string) => vendors.find((v) => String(v.id) === id)?.name || "";

  /* ---------------- Cards ---------------- */

  const cards = useMemo<StatsCardOption<AccountPayable>[]>(
    () => [
      { key: "ALL", label: "All Payables", match: () => true, tone: "cyan" },
      { key: "UNPAID", label: "Open / Partly Paid", match: (p) => canPay(p) && !isOverdue(p), tone: "blue" },
      { key: "OVERDUE", label: "Overdue", match: (p) => isOverdue(p), tone: "red" },
      { key: "PAID", label: "Paid", match: (p) => !canPay(p), tone: "green" },
    ],
    []
  );
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(payables, cards);

  // Money totals shown above the table
  const totals = useMemo(() => {
    const sum = (list: AccountPayable[], pick: (p: AccountPayable) => number) => fromPaise(list.reduce((t, p) => t + toPaise(pick(p)), 0));
    const open = payables.filter(canPay);
    return {
      outstanding: sum(open, (p) => Number(p.balance || 0)),
      overdue: sum(open.filter(isOverdue), (p) => Number(p.balance || 0)),
      dueThisWeek: sum(
        open.filter((p) => p.dueDate && daysFromToday(String(p.dueDate)) >= 0 && daysFromToday(String(p.dueDate)) <= 7),
        (p) => Number(p.balance || 0)
      ),
      paid: sum(payables, (p) => Number(p.amountPaid || 0)),
    };
  }, [payables]);

  /* ---------------- Vendor payables (Add drawer + Vendor Statement) ---------------- */

  // The vendor whose payables are shown: the one chosen in the Add drawer, or in the Vendor Statement popup.
  const lookupVendorId = showCreate ? createForm.vendorId : showStatement ? statementVendorId : "";

  const loadVendorPayables = (id: string) => {
    if (!id) {
      setVendorPayables([]);
      setVendorOutstanding(null);
      return () => undefined;
    }
    let active = true;
    setVendorLoading(true);
    Promise.all([axios.get(`${API_URL}/vendor/${id}`), axios.get(`${API_URL}/vendor/${id}/outstanding`)])
      .then(([list, outstanding]) => {
        if (!active) return;
        setVendorPayables(asArray<AccountPayable>(list.data));
        setVendorOutstanding(Number(outstanding.data) || 0);
      })
      .catch((err) => {
        console.error("Error loading vendor payables", err);
        if (!active) return;
        ToasterService.error(apiError(err, "Failed to load the vendor's payables"));
        setVendorPayables([]);
        setVendorOutstanding(null);
      })
      .finally(() => active && setVendorLoading(false));
    return () => {
      active = false;
    };
  };

  useEffect(() => loadVendorPayables(lookupVendorId), [lookupVendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- Add payable ---------------- */

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE);
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setCreateForm(EMPTY_CREATE);
  };

  // Purchase invoices of the chosen vendor that still need paying (invoices without a vendor are listed too).
  const vendorInvoices = purchaseInvoices.filter(
    (pi) =>
      (!pi.vendor?.id || String(pi.vendor.id) === createForm.vendorId) &&
      !["PAID", "CANCELLED"].includes(String(pi.purchaseInvoiceStatus || ""))
  );
  const selectedInvoice = purchaseInvoices.find((pi) => String(pi.id) === createForm.purchaseInvoiceId);

  const amountPaise = toPaise(createForm.invoiceAmount);
  const paidPaise = toPaise(createForm.amountPaid);
  const balancePaise = amountPaise - paidPaise;
  const newStatus = paidPaise === 0 ? "OPEN" : balancePaise === 0 ? "PAID" : "PARTIALLY_PAID";

  const handleCreateChange = (e: ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, [e.target.name]: e.target.value });

  /** Picking a purchase invoice fills the amount and due date (and the vendor, if the invoice has one). */
  const pickInvoice = (id: string) => {
    const invoice = purchaseInvoices.find((pi) => String(pi.id) === id);
    if (!invoice) {
      setCreateForm({ ...createForm, purchaseInvoiceId: "" });
      return;
    }
    setCreateForm({
      ...createForm,
      purchaseInvoiceId: id,
      vendorId: invoice.vendor?.id ? String(invoice.vendor.id) : createForm.vendorId,
      invoiceAmount: String(Number(invoice.totalAmount || 0)),
      dueDate: invoice.dueDate ? String(invoice.dueDate).slice(0, 10) : createForm.dueDate,
    });
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createForm.vendorId) return ToasterService.error("Choose the vendor this payable is for");
    if (amountPaise <= 0) return ToasterService.error("Amount must be more than 0");
    if (balancePaise < 0) return ToasterService.error("Already paid cannot be more than the amount");

    const payload: CreatePayablePayload = {
      invoiceAmount: fromPaise(amountPaise),
      amountPaid: fromPaise(paidPaise),
      balance: fromPaise(balancePaise),
      accountsPayableStatus: newStatus,
      dueDate: createForm.dueDate || undefined,
      lastPaymentDate: paidPaise > 0 ? todayIso() : undefined,
      vendor: { id: Number(createForm.vendorId) },
    };

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/create`, payload);
      ToasterService.success(`Payable of ${formatMoney(fromPaise(amountPaise))} created for ${vendorName(createForm.vendorId) || "the vendor"}`);
      closeCreate();
      fetchPayables();
    } catch (err) {
      console.error("Error creating payable", err);
      ToasterService.error(apiError(err, "Failed to create payable"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Record payment ---------------- */

  const openPayment = async (p: AccountPayable) => {
    setPayTarget(p);
    setPayForm({ paymentAmount: "", paymentDate: todayIso() });
    // GET /{id}: fresh balance, in case someone paid this payable since the list was loaded.
    try {
      const res = await axios.get<AccountPayable>(`${API_URL}/${p.id}`);
      if (res.data?.id) setPayTarget((current) => (current?.id === p.id ? { ...current, ...res.data } : current));
    } catch (err) {
      console.error("Error loading payable", err); // the list copy is still shown
    }
  };

  const closePayment = () => {
    setPayTarget(null);
    setPayForm({ paymentAmount: "", paymentDate: "" });
  };

  const payBalancePaise = toPaise(payTarget?.balance);
  const payAmountPaise = toPaise(payForm.paymentAmount);
  const afterPaymentPaise = payBalancePaise - payAmountPaise;

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!payTarget || paying) return;
    if (payAmountPaise <= 0) return ToasterService.error("Payment amount must be more than 0");
    if (payAmountPaise > payBalancePaise) return ToasterService.error(`Payment cannot be more than the balance (${formatMoney(fromPaise(payBalancePaise))})`);
    if (!payForm.paymentDate) return ToasterService.error("Payment date is required");

    setPaying(true);
    try {
      await axios.put(`${API_URL}/${payTarget.id}/payment`, null, {
        params: { paymentAmount: fromPaise(payAmountPaise), paymentDate: payForm.paymentDate },
      });
      ToasterService.success(`Payment of ${formatMoney(fromPaise(payAmountPaise))} recorded`);
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

  // Vendor / Invoice columns appear only when the backend sends those fields
  const hasVendor = payables.some((p) => p.vendorName);
  const hasInvoice = payables.some((p) => p.invoiceNumber);

  const tableColumns: ColumnDef<AccountPayable>[] = [
    ...(hasVendor
      ? [
          {
            key: "vendorName",
            label: "Vendor",
            sortable: true,
            render: (p: AccountPayable) => <span className="block truncate text-sm font-semibold text-slate-900">{p.vendorName || "--"}</span>,
          },
        ]
      : []),
    ...(hasInvoice
      ? [
          {
            key: "invoiceNumber",
            label: "Invoice",
            sortable: true,
            render: (p: AccountPayable) => <span className="block truncate text-sm text-slate-600">{p.invoiceNumber || "--"}</span>,
          },
        ]
      : []),
    {
      key: "invoiceAmount",
      label: "Amount",
      sortable: true,
      filterable: false,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (p) => Number(p.invoiceAmount || 0),
      detailFormatter: (p) => formatMoney(Number(p.invoiceAmount || 0)),
      exportValueGetter: (p) => formatMoney(Number(p.invoiceAmount || 0)),
      render: (p) => <span className="text-sm font-semibold text-slate-700">{formatMoney(Number(p.invoiceAmount || 0))}</span>,
    },
    {
      // Paid amount with a small progress bar (how much of the bill is paid)
      key: "amountPaid",
      label: "Paid",
      sortable: true,
      filterable: false,
      sortValueGetter: (p) => Number(p.amountPaid || 0),
      detailFormatter: (p) => formatMoney(Number(p.amountPaid || 0)),
      exportValueGetter: (p) => formatMoney(Number(p.amountPaid || 0)),
      render: (p) => {
        const total = Number(p.invoiceAmount || 0);
        const percent = total > 0 ? Math.min(100, Math.round((Number(p.amountPaid || 0) / total) * 100)) : 0;
        return (
          <div className="min-w-0">
            <span className="text-sm text-slate-600">{formatMoney(Number(p.amountPaid || 0))}</span>
            <div className="mt-1 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800" title={`${percent}% paid`}>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      filterable: false,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (p) => Number(p.balance || 0),
      detailFormatter: (p) => formatMoney(Number(p.balance || 0)),
      exportValueGetter: (p) => formatMoney(Number(p.balance || 0)),
      render: (p) => (
        <span className={`text-sm font-semibold ${Number(p.balance || 0) > 0 ? "text-slate-800" : "text-emerald-700"}`}>
          {formatMoney(Number(p.balance || 0))}
        </span>
      ),
    },
    {
      // Due date, with "Overdue by N days" / "Due in N days" under it for unpaid bills
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      exportValueGetter: (p) => (p.dueDate ? formatDisplayDate(p.dueDate) : ""),
      render: (p) => {
        if (!p.dueDate) return <span className="text-sm text-slate-400">--</span>;
        const days = daysFromToday(p.dueDate);
        const hint = !canPay(p)
          ? null
          : days < 0
            ? { text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, cls: "text-red-600" }
            : days === 0
              ? { text: "Due today", cls: "text-amber-600" }
              : days <= 7
                ? { text: `Due in ${days} day${days === 1 ? "" : "s"}`, cls: "text-amber-600" }
                : null;
        return (
          <div className="leading-snug">
            <span className="text-sm text-slate-600">{formatDisplayDate(p.dueDate)}</span>
            {hint && <span className={`block text-xs font-medium ${hint.cls}`}>{hint.text}</span>}
          </div>
        );
      },
    },
    {
      key: "lastPaymentDate",
      label: "Last Payment",
      sortable: true,
      exportValueGetter: (p) => (p.lastPaymentDate ? formatDisplayDate(p.lastPaymentDate) : ""),
      render: (p) => <span className="text-sm text-slate-600">{p.lastPaymentDate ? formatDisplayDate(p.lastPaymentDate) : "--"}</span>,
    },
    {
      key: "accountsPayableStatus",
      label: "Status",
      sortable: true,
      filterOptions: payableStatuses.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (p) => (isOverdue(p) && p.accountsPayableStatus !== "OVERDUE" ? `${statusLabel(p.accountsPayableStatus)} (overdue)` : statusLabel(p.accountsPayableStatus)),
      exportValueGetter: (p) => statusLabel(p.accountsPayableStatus),
      render: (p) => {
        const tone = isOverdue(p) ? "red" : toneForStatus(p.accountsPayableStatus);
        return (
          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASS[tone]}`}>
            {isOverdue(p) && p.accountsPayableStatus !== "OVERDUE" ? "Overdue" : statusLabel(p.accountsPayableStatus)}
          </span>
        );
      },
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

  /** Outstanding total + the vendor's payables (used in the Add drawer and the Vendor Statement popup). */
  const vendorPayablesBlock = (id: string) =>
    !id ? null : vendorLoading ? (
      <p className="py-3 text-sm text-slate-500">Loading payables…</p>
    ) : (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
          <span>
            Already owed to {vendorName(id) || "this vendor"}
            {vendorPayables.length > 0 && ` · ${vendorPayables.filter(canPay).length} unpaid of ${vendorPayables.length}`}
          </span>
          <strong>{formatMoney(vendorOutstanding ?? 0)}</strong>
        </div>
        {vendorPayables.length === 0 ? (
          <p className="text-sm text-slate-500">No payables for this vendor yet.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-right">Amount</th>
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
                    <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-gray-100">{formatMoney(Number(p.balance || 0))}</td>
                    <td className="px-3 py-2 text-slate-600">{p.dueDate ? formatDisplayDate(p.dueDate) : "--"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${BADGE_CLASS[isOverdue(p) ? "red" : toneForStatus(p.accountsPayableStatus)]}`}>
                        {isOverdue(p) && p.accountsPayableStatus !== "OVERDUE" ? "Overdue" : statusLabel(p.accountsPayableStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );

  return (
    <>
      <PageMeta title="Accounts Payable" description="What you owe your vendors" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Accounts Payable"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatementVendorId("");
                setShowStatement(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-800 dark:bg-gray-900 dark:text-cyan-300"
            >
              <DocumentMagnifyingGlassIcon className="h-4 w-4" />
              Vendor Statement
            </button>
            {canCreate && <AddButton className="-mr-5" label="Add Payable" onClick={openCreate} />}
          </div>
        }
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          {/* Money summary: what is owed, what is late, what is due soon */}
          {payables.length > 0 && (
            <div className="mb-[3px] grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat label="Total outstanding" value={formatMoney(totals.outstanding)} />
              <Stat label="Overdue" value={formatMoney(totals.overdue)} tone={totals.overdue > 0 ? "text-red-600" : undefined} />
              <Stat label="Due in the next 7 days" value={formatMoney(totals.dueThisWeek)} tone={totals.dueThisWeek > 0 ? "text-amber-600" : undefined} />
              <Stat label="Paid so far" value={formatMoney(totals.paid)} tone="text-emerald-700 dark:text-emerald-400" />
            </div>
          )}

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="dueDate"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(p) => (p.invoiceNumber ? `Payable – ${p.invoiceNumber}` : `Payable ${formatMoney(Number(p.invoiceAmount || 0))}`)}
            rowDetailsSubtitle="Account payable details"
            suspendRowDetails={showCreate || showStatement || Boolean(payTarget)}
            rowDetailsActions={(p: AccountPayable) =>
              canUpdate && canPay(p) ? (
                <button type="button" onClick={() => openPayment(p)} className={ICON_BUTTON_CLASS} title="Record payment" aria-label="Record payment">
                  <BanknotesIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BuildingOffice2Icon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No payables found</p>
                {selected !== "ALL" ? (
                  <p className="text-xs text-gray-400">Click the selected card again to show all payables</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
                      Create your first payable
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Add payable: vendor first, optionally fill from one of their purchase invoices */}
        <Dragger
          isOpen={showCreate}
          title="Add Payable"
          subtitle="Record money you owe a vendor"
          onClose={closeCreate}
          onSubmit={handleCreate}
          submitting={submitting}
          submitLabel="Create Payable"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <SearchableSelect
                label="Vendor"
                value={createForm.vendorId}
                options={vendorOptions}
                onChange={(value: string | number) =>
                  // A new vendor clears an invoice picked for the old one
                  setCreateForm({ ...createForm, vendorId: String(value ?? ""), purchaseInvoiceId: "" })
                }
                placeholder={vendors.length ? "Search vendor" : "No vendors loaded"}
                required
              />
            </div>

            <div className="md:col-span-2">
              <SearchableSelect
                label="Fill from purchase invoice (optional)"
                value={createForm.purchaseInvoiceId}
                options={vendorInvoices.map((pi) => ({
                  value: String(pi.id),
                  label: [pi.invoiceNumber || `Invoice ${pi.id}`, formatMoney(Number(pi.totalAmount || 0)), pi.dueDate ? `due ${formatDisplayDate(pi.dueDate)}` : ""]
                    .filter(Boolean)
                    .join(" · "),
                  keywords: [pi.referenceNumber || ""],
                }))}
                onChange={(value: string | number) => pickInvoice(String(value ?? ""))}
                placeholder={createForm.vendorId ? (vendorInvoices.length ? "Search invoice" : "No unpaid invoices for this vendor") : "Choose a vendor first"}
                emptyOptionLabel="Don't use an invoice"
              />
              {selectedInvoice && (
                <p className="-mt-3 mb-3 px-1 text-xs text-slate-500">
                  Amount and due date copied from invoice {selectedInvoice.invoiceNumber}. The payable is not linked to the invoice yet (waiting for backend).
                </p>
              )}
            </div>

            <FloatingInput label="Amount" name="invoiceAmount" {...amountInputProps} value={createForm.invoiceAmount} onChange={handleCreateChange} required />
            <FloatingDatePicker label="Due Date" name="dueDate" value={createForm.dueDate} onChange={handleCreateChange} />
            <FloatingInput label="Already Paid" name="amountPaid" {...amountInputProps} value={createForm.amountPaid} onChange={handleCreateChange} />
            <div className="mb-5 flex h-[52px] items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-4 text-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-gray-500">Balance</span>
              <span className="flex items-center gap-2">
                <strong className={balancePaise < 0 ? "text-red-600" : "text-slate-800 dark:text-gray-100"}>{formatMoney(fromPaise(balancePaise))}</strong>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${BADGE_CLASS[toneForStatus(newStatus)]}`}>
                  {statusLabel(newStatus)}
                </span>
              </span>
            </div>
          </div>

          {/* What this vendor already owes (GET /vendor/{id} + /outstanding) */}
          {createForm.vendorId && (
            <div className="mt-2 border-t border-slate-100 pt-4 dark:border-gray-800">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">This vendor's payables</h3>
              {vendorPayablesBlock(createForm.vendorId)}
            </div>
          )}
        </Dragger>

        {/* Vendor Statement: what one vendor is owed */}
        <Dragger
          isOpen={showStatement}
          variant="modal"
          title="Vendor Statement"
          subtitle="Everything you owe one vendor"
          onClose={() => setShowStatement(false)}
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            loadVendorPayables(statementVendorId);
          }}
          submitting={vendorLoading}
          submitLabel="Refresh"
        >
          <SearchableSelect
            label="Vendor"
            value={statementVendorId}
            options={vendorOptions}
            onChange={(value: string | number) => setStatementVendorId(String(value ?? ""))}
            placeholder={vendors.length ? "Search vendor" : "No vendors loaded"}
          />
          {vendorPayablesBlock(statementVendorId)}
        </Dragger>

        {/* Record payment (small form) */}
        <Dragger
          isOpen={Boolean(payTarget)}
          variant="modal"
          compact
          title="Record Payment"
          subtitle={payTarget?.vendorName ? `Payment to ${payTarget.vendorName}` : "Pay part or all of the balance"}
          onClose={closePayment}
          onSubmit={handlePayment}
          submitting={paying}
          submitLabel="Record Payment"
        >
          {payTarget && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              <Stat label="Amount" value={formatMoney(Number(payTarget.invoiceAmount || 0))} />
              <Stat label="Paid" value={formatMoney(Number(payTarget.amountPaid || 0))} />
              <Stat label="Balance" value={formatMoney(fromPaise(payBalancePaise))} tone="text-slate-900 dark:text-white" />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            <FloatingInput
              label="Payment Amount"
              name="paymentAmount"
              {...amountInputProps}
              max={fromPaise(payBalancePaise)}
              value={payForm.paymentAmount}
              onChange={(e) => setPayForm({ ...payForm, paymentAmount: e.target.value })}
              required
            />
            {payTarget && (
              <div className="-mt-3 mb-2 flex flex-wrap gap-2">
                {[
                  { label: "Full balance", paise: payBalancePaise },
                  { label: "Half", paise: Math.round(payBalancePaise / 2) },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setPayForm({ ...payForm, paymentAmount: String(fromPaise(option.paise)) })}
                    className="rounded-full border border-cyan-200 px-3 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-300"
                  >
                    {option.label} ({formatMoney(fromPaise(option.paise))})
                  </button>
                ))}
              </div>
            )}
            <FloatingDatePicker
              label="Payment Date"
              name="paymentDate"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
              maxDate={todayIso()}
              required
            />
            {payAmountPaise > 0 && (
              <p className={`text-sm ${afterPaymentPaise < 0 ? "text-red-600" : "text-slate-600 dark:text-gray-300"}`}>
                {afterPaymentPaise < 0
                  ? `That is ${formatMoney(fromPaise(-afterPaymentPaise))} more than the balance.`
                  : afterPaymentPaise === 0
                    ? "This pays the bill in full."
                    : `Balance after this payment: ${formatMoney(fromPaise(afterPaymentPaise))}`}
              </p>
            )}
          </div>
        </Dragger>
      </div>
    </>
  );
};

export default AccountsPayable;

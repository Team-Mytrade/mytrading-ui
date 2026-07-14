import React, { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  ArrowUturnLeftIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  InboxStackIcon,
  ChevronDownIcon,
  TrashIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import StatsCard from "../../components/common/Statscard";
import { exportListingPdf } from "../../components/common/export";
import PaginatedPopup from "../../components/common/unpopup";
import {
  FloatingDateRangePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ToasterService } from "../../Services/ToasterService";

type CreditCheckResponse = {
  sufficient: boolean;
  availableCredit: number;
  creditLimit?: number;
};

type CreditLog = {
  id: number;
  action: string;
  customerId: number;
  amount?: number;
  sufficient?: boolean;
  availableCredit?: number;
  outstandingBalance?: number;
  creditLimit?: number;
  createdAt: string;
};

type CreditForm = {
  customerId: string;
  orderAmount: string;
  outstandingAmount: string;
  clearingBalance: string;
};

type CreditMethod = "check" | "available" | "addOutstanding" | "clearOutstanding" | "create";

type CustomerOption = {
  id: number;
  customerName?: string;
  tradeName?: string;
};

type RawCreditTransaction = Record<string, unknown>;
type ExportFormat = "EXCEL" | "PDF";

const API_URL = "/v1/api/sales/credit";
const PAGE_SIZE = 10;
const CHART_COLORS = ["#0f766e", "#06b6d4", "#2563eb", "#f59e0b", "#ef4444"];

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "TENANT_1";
  } catch {
    return "TENANT_1";
  }
}

const emptyForm: CreditForm = {
  customerId: "",
  orderAmount: "",
  outstandingAmount: "",
  clearingBalance: "",
};

const methodOptions: { id: CreditMethod; name: string }[] = [
  { id: "check", name: "Check Credit" },
  { id: "available", name: "Get Available" },
  { id: "addOutstanding", name: "Add Outstanding" },
  { id: "clearOutstanding", name: "Clear Outstanding (Legacy)" },
  { id: "create", name: "Create Clear Entry" },
];

const methodConfig: Record<
  CreditMethod,
  {
    title: string;
    buttonLabel: string;
    buttonClassName: string;
    icon: typeof CheckBadgeIcon;
    toneClassName: string;
  }
> = {
  check: {
    title: "Credit check",
    buttonLabel: "Run Credit Check",
    buttonClassName: "bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-200",
    icon: CheckBadgeIcon,
    toneClassName: "border-cyan-100 bg-cyan-50 text-cyan-700",
  },
  available: {
    title: "Available credit",
    buttonLabel: "Load Available Credit",
    buttonClassName: "bg-teal-600 hover:bg-teal-700 focus:ring-teal-200",
    icon: EyeIcon,
    toneClassName: "border-teal-100 bg-teal-50 text-teal-700",
  },
  addOutstanding: {
    title: "Add outstanding",
    buttonLabel: "Add Outstanding",
    buttonClassName: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200",
    icon: BanknotesIcon,
    toneClassName: "border-blue-100 bg-blue-50 text-blue-700",
  },
  clearOutstanding: {
    title: "Clear outstanding",
    buttonLabel: "Clear Outstanding",
    buttonClassName: "bg-rose-600 hover:bg-rose-700 focus:ring-rose-200",
    icon: TrashIcon,
    toneClassName: "border-rose-100 bg-rose-50 text-rose-700",
  },
  create: {
    title: "Create clear entry",
    buttonLabel: "Create Entry",
    buttonClassName: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-200",
    icon: InboxStackIcon,
    toneClassName: "border-amber-100 bg-amber-50 text-amber-700",
  },
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (String(data?.error || data?.message || "").includes("feign.Response$Body.asInputStream")) {
      return "Backend updated the request but returned an empty downstream response. Please use Get Available to verify the credit balance.";
    }
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function customerOptionLabel(customer: CustomerOption) {
  return customer.customerName || customer.tradeName || "Unknown customer";
}

function customerDisplayName(customer?: CustomerOption) {
  return customer?.customerName || customer?.tradeName || "--";
}

function authHeaders(token: string | null) {
  if (!token) return undefined;
  const value = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return { Authorization: value };
}

function toNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function toBooleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function toStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeDateValue(value: Date, endOfDay = false) {
  const next = new Date(value);
  if (endOfDay) {
    next.setHours(23, 59, 59, 0);
  } else {
    next.setHours(0, 0, 0, 0);
  }
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  const hours = String(next.getHours()).padStart(2, "0");
  const minutes = String(next.getMinutes()).padStart(2, "0");
  const seconds = String(next.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from, to };
}

function extractFileName(contentDisposition?: string) {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match?.[1]?.replace(/"/g, "").trim() || null;
}

function mapTransaction(raw: RawCreditTransaction, fallbackCustomerId: number, index: number): CreditLog {
  const nestedCustomer = raw.customer as Record<string, unknown> | undefined;
  const customerId =
    toNumberValue(raw.customerId) ??
    toNumberValue(raw.customerID) ??
    toNumberValue(raw.customer_id) ??
    toNumberValue(nestedCustomer?.id) ??
    fallbackCustomerId;

  const action =
    toStringValue(raw.action) ??
    toStringValue(raw.type) ??
    toStringValue(raw.transactionType) ??
    toStringValue(raw.creditAction) ??
    "TRANSACTION";

  const amount =
    toNumberValue(raw.amount) ??
    toNumberValue(raw.clearingBalance) ??
    toNumberValue(raw.orderAmount) ??
    toNumberValue(raw.outstandingAmount) ??
    toNumberValue(raw.creditAmount) ??
    toNumberValue(raw.value);

  const availableCredit =
    toNumberValue(raw.avialbleCredit) ??
    toNumberValue(raw.availableCredit) ??
    toNumberValue(raw.currentCredit) ??
    toNumberValue(raw.remainingCredit) ??
    toNumberValue(raw.creditBalance) ??
    toNumberValue(raw.balance);

  const outstandingBalance =
    toNumberValue(raw.outstandingBalance) ??
    toNumberValue(raw.outstanding) ??
    toNumberValue(raw.pendingBalance);

  const creditLimit =
    toNumberValue(raw.creditLimit) ??
    toNumberValue(raw.limit) ??
    toNumberValue(raw.customerCreditLimit);

  const sufficient =
    toBooleanValue(raw.sufficient) ??
    toBooleanValue(raw.hasSufficientCredit) ??
    toBooleanValue(raw.isSufficient) ??
    toBooleanValue(raw.creditAvailable);

  const rawDate =
    toStringValue(raw.createdAt) ??
    toStringValue(raw.createdDate) ??
    toStringValue(raw.transactionDateTime) ??
    toStringValue(raw.transactionDate) ??
    toStringValue(raw.timestamp) ??
    toStringValue(raw.date);

  const createdAt = rawDate ? new Date(rawDate).toLocaleString() : new Date().toLocaleString();

  return {
    id: toNumberValue(raw.id) ?? toNumberValue(raw.transactionId) ?? Date.now() + index,
    action,
    customerId,
    amount,
    sufficient,
    availableCredit,
    outstandingBalance,
    creditLimit,
    createdAt,
  };
}

const CreditLimit: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = useMemo(() => authHeaders(token), [token]);
  const initialRange = getDefaultDateRange();

  const [form, setForm] = useState<CreditForm>(emptyForm);
  const [localLogs, setLocalLogs] = useState<CreditLog[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [search, setSearch] = useState("");
  const [lastAvailableCredit, setLastAvailableCredit] = useState<number | null>(null);
  const [lastCreditLimit, setLastCreditLimit] = useState<number | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<CreditMethod>("check");
  const [historyFrom, setHistoryFrom] = useState<Date | null>(initialRange.from);
  const [historyTo, setHistoryTo] = useState<Date | null>(initialRange.to);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("EXCEL");
  const [exportFrom, setExportFrom] = useState<Date | null>(null);
  const [exportTo, setExportTo] = useState<Date | null>(null);
  const [showCreditActions, setShowCreditActions] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await axios.get<CustomerOption[]>("/v1/api/crm/customers", { headers });
        setCustomers(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        ToasterService.error("Failed to load customers", getErrorMessage(error, "Please try again."));
      }
    };

    fetchCustomers();
  }, [headers]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleMethodSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (selectedMethod === "check") {
      void checkCredit();
      return;
    }

    if (selectedMethod === "available") {
      void getAvailableCredit();
      return;
    }

    if (selectedMethod === "addOutstanding") {
      void addOutstanding();
      return;
    }

    void clearOutstanding();
  };

  const pushLocalLog = (log: Omit<CreditLog, "id" | "createdAt">) => {
    setLocalLogs((current) => [
      {
        ...log,
        id: Date.now(),
        createdAt: new Date().toLocaleString(),
      },
      ...current,
    ]);
  };

  const validateBase = () => {
    if (!isPositiveNumber(form.customerId)) {
      ToasterService.error("Customer ID is required", "Enter a valid customer ID greater than zero.");
      return false;
    }
    return true;
  };

  const validateHistoryRange = () => {
    if (!historyFrom || !historyTo) {
      ToasterService.error("Date range is required", "Select both from and to dates for history actions.");
      return false;
    }

    if (historyFrom > historyTo) {
      ToasterService.error("Invalid date range", "The from date cannot be later than the to date.");
      return false;
    }

    return true;
  };

  const validateExportRange = () => {
    if ((exportFrom && !exportTo) || (!exportFrom && exportTo)) {
      ToasterService.error("Complete date range", "Select both from and to dates, or leave both empty.");
      return false;
    }

    if (exportFrom && exportTo && exportFrom > exportTo) {
      ToasterService.error("Invalid date range", "The from date cannot be later than the to date.");
      return false;
    }

    return true;
  };

  const fetchRecentTransactions = useCallback(
    async (silent = false) => {
      if (!isPositiveNumber(form.customerId)) return;

      try {
        setHistoryLoading(true);
        const customerId = Number(form.customerId);
        const res = await axios.get<RawCreditTransaction[] | { data?: RawCreditTransaction[] }>(
          `${API_URL}/getRecenTransactions/${customerId}`,
          { headers }
        );

        const payload = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
        const mapped = payload.map((item, index) => mapTransaction(item, customerId, index));
        setRecentTransactions(mapped);

        if (!mapped.length && !silent) {
          ToasterService.noData("No recent transactions", "The selected customer has no recent credit transactions.");
        }
      } catch (error) {
        if (!silent) {
          ToasterService.error("Failed to load recent transactions", getErrorMessage(error, "Please try again."));
        }
      } finally {
        setHistoryLoading(false);
      }
    },
    [form.customerId, headers]
  );

  useEffect(() => {
    if (!isPositiveNumber(form.customerId)) {
      setRecentTransactions([]);
      return;
    }
    void fetchRecentTransactions(true);
  }, [form.customerId, fetchRecentTransactions]);

  const checkCredit = async () => {
    if (!validateBase()) return;
    if (!isPositiveNumber(form.orderAmount)) {
      ToasterService.error("Order amount is required", "Enter a valid order amount greater than zero.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        tenantId: getStoredTenantId(),
        customerId: Number(form.customerId),
        orderAmount: Number(form.orderAmount),
      };
      const res = await axios.post<CreditCheckResponse>(`${API_URL}/check`, payload, { headers });
      const availableCredit = Number(res.data.availableCredit || 0);
      setLastAvailableCredit(availableCredit);
      setLastCreditLimit(toNumberValue(res.data.creditLimit) ?? null);
      pushLocalLog({
        action: "CHECK",
        customerId: payload.customerId,
        amount: payload.orderAmount,
        sufficient: res.data.sufficient,
        availableCredit,
        creditLimit: toNumberValue(res.data.creditLimit),
      });
      ToasterService.success(res.data.sufficient ? "Credit is sufficient" : "Credit is not sufficient");
      void fetchRecentTransactions(true);
    } catch (error) {
      ToasterService.error("Failed to check credit", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const getAvailableCredit = async (silent = false) => {
    if (!validateBase()) return;

    try {
      setLoading(true);
      const customerId = Number(form.customerId);
      const tenantId = getStoredTenantId();
      const res = await axios.get<number>(`${API_URL}/${customerId}/available`, {
        headers,
        params: { tenantId },
      });
      const availableCredit = Number(res.data || 0);
      setLastAvailableCredit(availableCredit);
      if (!silent) {
        pushLocalLog({
          action: "AVAILABLE",
          customerId,
          availableCredit,
        });
        ToasterService.success("Available credit loaded");
      }
    } catch (error) {
      if (!silent) {
        ToasterService.error("Failed to load available credit", getErrorMessage(error, "Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const addOutstanding = async () => {
    if (!validateBase()) return;
    if (!isPositiveNumber(form.outstandingAmount)) {
      ToasterService.error("Outstanding amount is required", "Enter a valid amount greater than zero.");
      return;
    }

    try {
      setLoading(true);
      const customerId = Number(form.customerId);
      const amount = Number(form.outstandingAmount);
      const tenantId = getStoredTenantId();
      await axios.put(`${API_URL}/${customerId}/add-outstanding`, null, {
        headers,
        params: { amount, tenantId },
        responseType: "text",
        transformResponse: [(data: unknown) => data],
        validateStatus: (status: number) => status >= 200 && status < 300,
      });
      pushLocalLog({
        action: "ADD_OUTSTANDING",
        customerId,
        amount,
      });
      ToasterService.success("Outstanding amount added");
      void getAvailableCredit(true);
      void fetchRecentTransactions(true);
      setForm((current) => ({ ...current, outstandingAmount: "" }));
    } catch (error) {
      ToasterService.error("Failed to add outstanding", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const clearOutstanding = async () => {
    if (!validateBase()) return;
    if (!isPositiveNumber(form.clearingBalance)) {
      ToasterService.error("Clearing balance is required", "Enter the balance amount to clear.");
      return;
    }

    try {
      setLoading(true);
      const customerId = Number(form.customerId);
      const tenantId = getStoredTenantId();
      const clearingBalance = Number(form.clearingBalance);
      const orderAmount = clearingBalance;
      await axios.put(`${API_URL}/${customerId}/clear-outstanding`, null, {
        headers,
        params: { tenantId, clearingBalance, orderAmount },
        responseType: "text",
        transformResponse: [(data: unknown) => data],
        validateStatus: (status: number) => status >= 200 && status < 300,
      });
      pushLocalLog({
        action: "CLEAR_OUTSTANDING",
        customerId,
        amount: clearingBalance,
      });
      ToasterService.success(selectedMethod === "create" ? "Clear entry created" : "Outstanding amount cleared");
      void getAvailableCredit(true);
      void fetchRecentTransactions(true);
      setForm((current) => ({ ...current, clearingBalance: "" }));
    } catch (error) {
      ToasterService.error("Failed to clear outstanding", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = async (fromDate?: Date | null, toDate?: Date | null) => {
    if (!validateBase()) return;

    try {
      setExportLoading(true);
      const customerId = Number(form.customerId);
      const from = fromDate ? normalizeDateValue(fromDate) : undefined;
      const to = toDate ? normalizeDateValue(toDate, true) : undefined;
      const response = await axios.get(`${API_URL}/export/${customerId}`, {
        headers,
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
        responseType: "blob",
      });

      const fileName =
        extractFileName(response.headers["content-disposition"]) ||
        (from && to
          ? `credit-history-${customerId}-${from.slice(0, 10)}-to-${to.slice(0, 10)}.xlsx`
          : `credit-history-${customerId}.xlsx`);

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      ToasterService.success("Credit history export started");
    } catch (error) {
      ToasterService.error("Failed to export credit history", getErrorMessage(error, "Please try again."));
    } finally {
      setExportLoading(false);
    }
  };

  const exportHistoryPdf = async (fromDate?: Date | null, toDate?: Date | null) => {
    if (!validateBase()) return;

    try {
      setExportLoading(true);
      const hasDateFilter = Boolean(fromDate && toDate);

      const exportRows = hasDateFilter
        ? filteredLogs.filter((log) => {
            const parsed = new Date(log.createdAt);
            if (Number.isNaN(parsed.getTime())) return true;

            const rangeStart = new Date(fromDate as Date);
            rangeStart.setHours(0, 0, 0, 0);
            const rangeEnd = new Date(toDate as Date);
            rangeEnd.setHours(23, 59, 59, 999);

            return parsed >= rangeStart && parsed <= rangeEnd;
          })
        : filteredLogs;

      if (!exportRows.length) {
        ToasterService.noData("No records to export", "No credit history found for the selected date range.");
        return;
      }

      await exportListingPdf<CreditLog>({
        title: "Credit History",
        subtitle: "Credit history export",
        reportLabel: "Sales Report",
        data: exportRows,
        fileName: "Credit_History",
        metadata: [
          { label: "Customer", value: selectedCustomer ? customerOptionLabel(selectedCustomer) : form.customerId || "Unknown" },
          {
            label: "Range",
            value:
              fromDate && toDate
                ? `${fromDate.toLocaleDateString()} to ${toDate.toLocaleDateString()}`
                : "All records",
          },
          { label: "Format", value: "PDF" },
          { label: "Total", value: exportRows.length },
        ],
        columns: [
          { header: "Action", key: "action" },
          { header: "Customer ID", key: "customerId" },
          { header: "Amount", key: "amount" },
          { header: "Available Credit", key: "availableCredit" },
          { header: "Outstanding", key: "outstandingBalance" },
          { header: "Credit Limit", key: "creditLimit" },
          {
            header: "Sufficient",
            accessor: (row) => (row.sufficient === undefined ? "--" : row.sufficient ? "Sufficient" : "Insufficient"),
          },
          { header: "Created At", key: "createdAt" },
        ],
      });

      ToasterService.success("Credit history PDF export started");
    } catch (error) {
      ToasterService.error("Failed to export PDF", getErrorMessage(error, "Please try again."));
    } finally {
      setExportLoading(false);
    }
  };

  const openExportPopup = () => {
    setExportFrom(null);
    setExportTo(null);
    setExportFormat("EXCEL");
    setShowExportPopup(true);
  };

  const closeExportPopup = () => {
    if (exportLoading) return;
    setShowExportPopup(false);
  };

  const handleExportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateBase() || !validateExportRange()) return;

    if (exportFrom && exportTo) {
      setHistoryFrom(exportFrom);
      setHistoryTo(exportTo);
    }

    if (exportFormat === "PDF") {
      await exportHistoryPdf(exportFrom, exportTo);
    } else {
      await exportHistory(exportFrom, exportTo);
    }

    setShowExportPopup(false);
  };

  const purgeHistory = async () => {
    if (!validateBase() || !validateHistoryRange()) return;

    try {
      setPurging(true);
      const customerId = Number(form.customerId);
      await axios.delete(`${API_URL}/purgeHistory/${customerId}`, {
        headers,
        params: {
          from: normalizeDateValue(historyFrom as Date),
          to: normalizeDateValue(historyTo as Date, true),
        },
      });
      setShowPurgeConfirm(false);
      setRecentTransactions([]);
      setLocalLogs([]);
      ToasterService.success("Credit history purged");
      void fetchRecentTransactions(true);
    } catch (error) {
      ToasterService.error("Failed to purge credit history", getErrorMessage(error, "Please try again."));
    } finally {
      setPurging(false);
    }
  };

  const baseLogs = recentTransactions.length ? recentTransactions : localLogs;

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return baseLogs;
    return baseLogs.filter((log) => {
      const customer = customers.find((item) => Number(item.id) === Number(log.customerId));
      return [log.action, log.customerId, customerDisplayName(customer), log.amount, log.availableCredit, log.sufficient]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [baseLogs, customers, search]);

  const stats = useMemo(
    () => ({
      actions: baseLogs.length,
      availableCredit: lastAvailableCredit ?? baseLogs[0]?.availableCredit ?? 0,
      sufficient: filteredLogs.filter((log) => log.sufficient === true).length,
      insufficient: filteredLogs.filter((log) => log.sufficient === false).length,
    }),
    [baseLogs, filteredLogs, lastAvailableCredit]
  );

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === form.customerId),
    [customers, form.customerId]
  );

  const trendChartData = useMemo(
    () =>
      baseLogs
        .slice(0, 6)
        .reverse()
        .map((log, index) => ({
          name: (() => {
            const parsed = new Date(log.createdAt);
            return Number.isNaN(parsed.getTime()) ? `Txn ${index + 1}` : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          })(),
          available: Number(log.availableCredit || 0),
          outstanding: Number(log.outstandingBalance || 0),
          amount: Number(log.amount || 0),
        })),
    [baseLogs]
  );

  const actionMixData = useMemo(() => {
    const grouped = baseLogs.reduce<Record<string, number>>((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [baseLogs]);

  const canPurgeDialogDescribeTarget = isPositiveNumber(form.customerId) && Boolean(historyFrom && historyTo);
  const activeMethod = methodConfig[selectedMethod];
  const ActiveMethodIcon = activeMethod.icon;
  const latestOutstanding = baseLogs[0]?.outstandingBalance;
  const latestResult = baseLogs.find((log) => log.sufficient !== undefined)?.sufficient;

  return (
    <>
      <PageMeta title="Credit Limit" description="Manage sales credit limit checks" />
      <PageBreadcrumb pageTitle="Credit Limit" />

      <div className="-mt-3 w-full max-w-none space-y-6 px-0 pb-8 pt-0">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 shadow-sm">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.45fr_1fr] lg:px-7">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                <CreditCardIcon className="h-4 w-4" />
                Sales Credit Control
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Customer credit
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Customer</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <UserCircleIcon className="h-5 w-5 shrink-0 text-cyan-600" />
                    <span className="truncate">{selectedCustomer ? customerOptionLabel(selectedCustomer) : "Choose a customer"}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active Action</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{activeMethod.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{activeMethod.buttonLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm sm:col-span-2 xl:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">History Window</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {historyFrom && historyTo
                      ? `${historyFrom.toLocaleDateString()} - ${historyTo.toLocaleDateString()}`
                      : "Select date range"}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 self-start sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Credit Limit</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {money(lastCreditLimit ?? baseLogs[0]?.creditLimit)}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Available Credit</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-700">{money(stats.availableCredit)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Recent Actions</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.actions}</div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest Outstanding</div>
                <div className="mt-2 text-2xl font-semibold text-amber-700">
                  {latestOutstanding === undefined ? "--" : money(latestOutstanding)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6">
          <form onSubmit={handleMethodSubmit} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Credit actions</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {activeMethod.title}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreditActions((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50"
                  >
                    <ChevronDownIcon className={`h-4 w-4 transition ${showCreditActions ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className={`${showCreditActions ? "block" : "hidden"} p-5 sm:p-6`}>
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                  <FloatingSelect
                    label="Customer"
                    name="customerId"
                    value={form.customerId}
                    onChange={handleChange}
                    options={customers.map((customer) => ({
                      id: String(customer.id),
                      name: customerOptionLabel(customer),
                    }))}
                    required
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70 ${activeMethod.buttonClassName}`}
                    >
                      <ActiveMethodIcon className="h-4 w-4" />
                      {activeMethod.buttonLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(emptyForm)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <ArrowUturnLeftIcon className="h-4 w-4" />
                      Reset Form
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Choose action</div>
                    <div className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                      {methodOptions.length} actions
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {methodOptions.map((option) => {
                      const optionConfig = methodConfig[option.id];
                      const OptionIcon = optionConfig.icon;
                      const isActive = selectedMethod === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedMethod(option.id)}
                          className={`group rounded-2xl border p-4 text-left transition ${
                            isActive
                              ? "border-cyan-300 bg-cyan-50/70 shadow-sm ring-2 ring-cyan-100"
                              : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${
                                isActive ? optionConfig.toneClassName : "border-slate-200 bg-slate-50 text-slate-500"
                              }`}
                            >
                              <OptionIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">{option.name}</h4>
                                {isActive && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-cyan-700 shadow-sm">
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr] xl:justify-end">
                  <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/70 p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Required Input
                        </div>
                      </div>
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-white ${activeMethod.toneClassName}`}>
                        <ActiveMethodIcon className="h-5 w-5" />
                      </div>
                    </div>

                    {(selectedMethod === "clearOutstanding" || selectedMethod === "create") && (
                      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>The backend currently uses the same amount for both `clearingBalance` and `orderAmount`.</span>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      {selectedMethod === "clearOutstanding" && (
                        <FloatingInput
                          label="Clear Amount"
                          name="clearingBalance"
                          type="number"
                          value={form.clearingBalance}
                          onChange={handleChange}
                        />
                      )}
                      {selectedMethod === "create" && (
                        <FloatingInput
                          label="Create Amount"
                          name="clearingBalance"
                          type="number"
                          value={form.clearingBalance}
                          onChange={handleChange}
                        />
                      )}
                      {selectedMethod === "check" && (
                        <FloatingInput
                          label="Order Amount"
                          name="orderAmount"
                          type="number"
                          value={form.orderAmount}
                          onChange={handleChange}
                        />
                      )}
                      {selectedMethod === "addOutstanding" && (
                        <FloatingInput
                          label="Outstanding Amount"
                          name="outstandingAmount"
                          type="number"
                          value={form.outstandingAmount}
                          onChange={handleChange}
                        />
                      )}
                        {selectedMethod === "available" && (
                        <div className="rounded-2xl border border-teal-100 bg-teal-50/40 px-4 py-4 text-sm leading-6 text-slate-600">
                          No input required
                        </div>
                        )}
                    </div>
                  </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">Credit trend</h4>
                    </div>
                    <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                      Last {trendChartData.length || 0} records
                    </div>
                  </div>

                  <div className="h-64">
                    {trendChartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendChartData} barGap={10}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Bar dataKey="available" fill="#0f766e" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="outstanding" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                        No chart data yet
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h4 className="text-base font-semibold text-slate-900">Action mix</h4>
                  </div>

                  <div className="h-52">
                    {actionMixData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={actionMixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={4}
                          >
                            {actionMixData.map((entry, index) => (
                              <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                        No action mix yet
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {actionMixData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {!showCreditActions && (
              <div className="px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Selected Customer
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedCustomer ? customerOptionLabel(selectedCustomer) : "Choose customer"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Selected Action
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{activeMethod.buttonLabel}</div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Recent credit actions</h3>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                {filteredLogs.length} items
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[680px]">
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => void fetchRecentTransactions()}
                  disabled={historyLoading || !isPositiveNumber(form.customerId)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={openExportPopup}
                  disabled={exportLoading || !isPositiveNumber(form.customerId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPurgeConfirm(true)}
                  disabled={purging || !isPositiveNumber(form.customerId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {historyLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading recent credit activity...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCardIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No credit actions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.slice(0, PAGE_SIZE).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:bg-cyan-50/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  {(() => {
                    const customer = customers.find((item) => Number(item.id) === Number(log.customerId));
                    return (
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                            {log.action}
                          </span>
                          <span className="text-sm font-medium text-slate-900">{customerDisplayName(customer)}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{log.createdAt}</div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Amount</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.amount === undefined ? "--" : money(log.amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Available</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.availableCredit === undefined ? "--" : money(log.availableCredit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Outstanding</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.outstandingBalance === undefined ? "--" : money(log.outstandingBalance)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Credit Limit</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.creditLimit === undefined ? "--" : money(log.creditLimit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Result</div>
                      <div className="mt-1">
                        {log.sufficient === undefined ? (
                          <span className="text-sm font-semibold text-slate-900">--</span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              log.sufficient ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {log.sufficient ? "Sufficient" : "Insufficient"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        isOpen={showPurgeConfirm}
        title="Purge Credit History"
        message={
          canPurgeDialogDescribeTarget
            ? `Delete credit history for ${customerDisplayName(selectedCustomer)} from ${historyFrom?.toLocaleDateString()} to ${historyTo?.toLocaleDateString()}?`
            : "Select a customer and valid date range before purging credit history."
        }
        confirmLabel={purging ? "Purging..." : "Purge"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void purgeHistory()}
        onCancel={() => setShowPurgeConfirm(false)}
      />

      <PaginatedPopup
        isOpen={showExportPopup}
        title="Export Credit History"
        subtitle="Select the date range and export format before downloading."
        onClose={closeExportPopup}
        onSubmit={handleExportSubmit}
        submitting={exportLoading}
        submitLabel={exportLoading ? "Exporting..." : "Submit Export"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Export Options",
            fields: [
              <FloatingDateRangePicker
                label="Export Date Range"
                startDate={exportFrom}
                endDate={exportTo}
                onChange={([start, end]) => {
                  setExportFrom(start);
                  setExportTo(end || start);
                }}
                placeholder=""
              />,
              <FloatingSelect
                label="Export Format"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                includeEmptyOption={false}
                options={[
                  { id: "EXCEL", name: "Excel Export" },
                  { id: "PDF", name: "PDF Export" },
                ]}
              />,
              <div className="md:col-span-2 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-4 text-sm leading-6 text-cyan-900">
                {exportFrom && exportTo
                  ? `Exporting ${exportFormat === "PDF" ? "PDF" : "Excel"} for ${exportFrom.toLocaleDateString()} to ${exportTo.toLocaleDateString()}.`
                  : `Exporting ${exportFormat === "PDF" ? "PDF" : "Excel"} for all available records.`}
              </div>,
            ],
          },
        ]}
      />
    </>
  );
};

export default CreditLimit;

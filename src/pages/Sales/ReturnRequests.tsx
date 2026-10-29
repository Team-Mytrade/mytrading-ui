import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  ReceiptRefundIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDateRangePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { toLocalIsoDate, todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { formatAmount } from "../../company/format";

import { t } from "../../i18n/i18n";
type ReturnItem = {
  id: number;
  salesOrderItemId: number;
  refundAmount: number;
  returnQuantity: number;
  remarks: string;
};

type Refund = {
  id: number;
  amount: number;
  refundDate: string;
  status: string;
  paymentMethod: string;
  returnRequestId?: number;
};

type ReturnRequest = {
  id: number;
  returnNumber?: string;
  salesOrderNumber?: string;
  customerId?: number;
  customerName?: string;
  requestDate: string;
  status: string;
  reason: ReturnReason | string;
  salesOrderId: number;
  remarks: string;
  items: ReturnItem[];
  refund?: Refund;
  // REFUND (default) or EXCHANGE: the same items are sent again instead of a refund
  resolution?: Resolution;
  completedAt?: string;
};

type Resolution = "REFUND" | "EXCHANGE";

type ScheduleOrderOption = {
  id?: number;
  salesOrderId?: number;
  orderId?: number;
  orderNumber?: string;
  salesOrderNumber?: string;
  customerId?: number;
  status?: string;
  quotationType?: "PRODUCT" | "SERVICE" | string;
  items?: Array<{
    id?: number;
    salesOrderItemId?: number;
    itemId?: number;
    productName?: string;
    productCode?: string;
    quantity?: number;
    deliveredQuantity?: number;
  }>;
};

type ReturnReason =
  | "DAMAGED_PRODUCT"
  | "WRONG_ITEM"
  | "CUSTOMER_CHANGED_MIND"
  | "LATE_DELIVERY"
  | "OTHER";

type ReturnForm = {
  requestDate: string;
  status: string;
  reason: ReturnReason;
  resolution: Resolution;
  salesOrderId: string;
  salesOrderNumber: string;
  remarks: string;
  itemSalesOrderItemId: string;
  itemRefundAmount: string;
  itemReturnQuantity: string;
  itemRemarks: string;
};

type RefundForm = {
  returnRequestId: string;
  amount: string;
  refundDate: string;
  status: string;
  paymentMethod: string;
};

const API_URL = "/v1/api/sales/returns";
// Full orders: the form needs each order's status and lines (the schedule summary only has id and number)
const ORDERS_API = "/v1/api/sales/sales-orders";
// Only goods that were delivered can come back
const RETURNABLE_ORDER_STATUSES = ["PARTIALLY_DELIVERED", "DELIVERED", "INVOICED"];
const PAGE_SIZE = 10;
const reasonOptions: ReturnReason[] = [
  "DAMAGED_PRODUCT",
  "WRONG_ITEM",
  "CUSTOMER_CHANGED_MIND",
  "LATE_DELIVERY",
  "OTHER",
];
const refundStatusOptions = ["PENDING", "PROCESSED", "FAILED"];
/**
 * Status moves the backend allows. A new return starts PENDING; it is approved or rejected, and an approved
 * return is completed (the backend also completes it once its refund is PROCESSED).
 */
const nextReturnStatuses: Record<string, string[]> = {
  REQUESTED: ["PENDING", "APPROVED", "REJECTED"],
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED", "REJECTED"],
};
const FINAL_RETURN_STATUSES = ["COMPLETED", "REJECTED"];
// The backend deletes only returns that are still open, or were rejected
const DELETABLE_RETURN_STATUSES = ["REQUESTED", "PENDING", "REJECTED"];
const paymentMethods = ["BANK_TRANSFER", "UPI", "CASH", "CREDIT_CARD", "DEBIT_CARD", "CHEQUE", "WALLET", "OTHER"];

/** yyyy-MM-ddTHH:mm in the user's own timezone, for datetime-local inputs (toISOString would be UTC). */
const toLocalDateTimeInput = (date: Date) => `${toLocalIsoDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const emptyReturnForm: ReturnForm = {
  requestDate: todayIso(),
  status: "PENDING",
  reason: "DAMAGED_PRODUCT",
  resolution: "REFUND",
  salesOrderId: "",
  salesOrderNumber: "",
  remarks: "",
  itemSalesOrderItemId: "",
  // Blank: the backend refunds the value of the returned quantity
  itemRefundAmount: "",
  itemReturnQuantity: "1",
  itemRemarks: "",
};

const emptyRefundForm: RefundForm = {
  returnRequestId: "",
  amount: "0",
  refundDate: toLocalDateTimeInput(new Date()),
  status: "PENDING",
  paymentMethod: "BANK_TRANSFER",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function toNumber(value: string) {
  return Number(value || 0);
}

function firstPositiveNumber(...values: Array<number | string | undefined | null>) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
}

/** The backend keeps the refund time as local wall-clock time (no zone), so send it as entered, not as UTC. */
function toIsoDateTime(value: string) {
  if (!value) return `${toLocalDateTimeInput(new Date())}:00`;
  return value.includes("T") ? `${value.slice(0, 16)}:00` : `${value}T00:00:00`;
}

function toDateValue(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputDateValue(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: number | string | undefined) {
  return formatAmount(value);
}

function toFriendlyLabel(value: string) {
  return value.replace(/_/g, " ");
}

function getScheduleOrderId(order: ScheduleOrderOption) {
  return firstPositiveNumber(order.id, order.salesOrderId, order.orderId);
}

function getScheduleOrderNumber(order: ScheduleOrderOption) {
  return order.orderNumber || order.salesOrderNumber || "";
}

function getScheduleItemId(item: { id?: number; salesOrderItemId?: number; itemId?: number }) {
  return firstPositiveNumber(item.id, item.salesOrderItemId, item.itemId);
}

function scheduleItemLabel(
  item: {
    id?: number;
    salesOrderItemId?: number;
    itemId?: number;
    productName?: string;
    productCode?: string;
    quantity?: number;
    deliveredQuantity?: number;
  },
  index: number
) {
  const resolvedId = getScheduleItemId(item);
  const name = item.productName || item.productCode || `Item #${resolvedId || index + 1}`;
  const qty =
    item.deliveredQuantity !== undefined
      ? ` · Delivered ${item.deliveredQuantity}`
      : item.quantity !== undefined
        ? ` · Qty ${item.quantity}`
        : "";
  return `${name}${qty}`;
}

const ReturnRequests: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const token = localStorage.getItem("accessToken");
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [form, setForm] = useState<ReturnForm>(emptyReturnForm);
  const [refundForm, setRefundForm] = useState<RefundForm>(emptyRefundForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [deleteReturn, setDeleteReturn] = useState<ReturnRequest | null>(null);
  const [scheduleOrders, setScheduleOrders] = useState<ScheduleOrderOption[]>([]);
  const [scheduleOrdersLoading, setScheduleOrdersLoading] = useState(false);
  const [scheduleOrdersError, setScheduleOrdersError] = useState(false);

  useEffect(() => {
    fetchReturns();
    fetchScheduleOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertReturn = (item: ReturnRequest) => {
    setReturns((current) => {
      const exists = current.some((row) => row.id === item.id);
      if (exists) return current.map((row) => (row.id === item.id ? item : row));
      return [item, ...current];
    });
  };

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await axios.get<ReturnRequest[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setReturns(data);
      if (!data.length) ToasterService.noData("No return requests found");
    } catch (error) {
      ToasterService.error("Failed to load return requests", getErrorMessage(error, "Please try again."));
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleOrders = async () => {
    try {
      setScheduleOrdersLoading(true);
      setScheduleOrdersError(false);
      const res = await axios.get<ScheduleOrderOption[]>(ORDERS_API, { headers });
      setScheduleOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setScheduleOrdersError(true);
      setScheduleOrders([]);
      ToasterService.error(
        "Failed to load sales order numbers",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setScheduleOrdersLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "salesOrderId") {
        const selected = scheduleOrders.find((order) => String(getScheduleOrderId(order)) === value);
        if (selected) {
          next.salesOrderId = String(getScheduleOrderId(selected));
          next.salesOrderNumber = getScheduleOrderNumber(selected);
          const items = selected.items || [];
          if (items.length === 1) {
            const onlyId = getScheduleItemId(items[0]);
            next.itemSalesOrderItemId = onlyId ? String(onlyId) : "";
          } else {
            next.itemSalesOrderItemId = "";
          }
        } else {
          next.salesOrderNumber = "";
          next.itemSalesOrderItemId = "";
        }
      }

      return next;
    });
  };

  const handleRefundChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRefundForm((current) => ({ ...current, [name]: value }));
  };

  /** The current status plus the moves the backend allows from it. */
  const statusChoices = (status?: string) => {
    const current = status || "PENDING";
    return [current, ...(nextReturnStatuses[current] || [])];
  };
  const editingStatus = returns.find((item) => item.id === editingId)?.status;

  // Only delivered goods can be returned, and a service order is fulfilled via Service Schedule rather than
  // returned. Orders entered directly have no quotation type, so only SERVICE orders are left out.
  const productScheduleOrders = useMemo(
    () =>
      scheduleOrders.filter(
        (order) =>
          order.quotationType !== "SERVICE" &&
          (!order.status || RETURNABLE_ORDER_STATUSES.includes(order.status))
      ),
    [scheduleOrders]
  );

  const selectedOrderItems = useMemo(() => {
    if (!form.salesOrderId) return [];
    const order = scheduleOrders.find(
      (o) => String(getScheduleOrderId(o)) === form.salesOrderId
    );
    // Lines with nothing delivered yet cannot be returned
    return (order?.items || []).filter(
      (item) => item.deliveredQuantity === undefined || Number(item.deliveredQuantity) > 0
    );
  }, [scheduleOrders, form.salesOrderId]);

  // Resolves what a return request's item(s) actually ARE (product name),
  // not just how many there are — looks the salesOrderItemId up against
  // that return's own sales order (the same data source already used to
  // populate the create-form dropdown).
  const resolveReturnItemLabels = (request: ReturnRequest): string[] => {
    const order = scheduleOrders.find((o) => getScheduleOrderId(o) === Number(request.salesOrderId));
    if (!order) {
      return (request.items || []).map((item) => `Item #${item.salesOrderItemId}`);
    }
    return (request.items || []).map((item) => {
      const matched = (order.items || []).find(
        (orderItem) => getScheduleItemId(orderItem) === Number(item.salesOrderItemId)
      );
      return matched
        ? scheduleItemLabel(matched, 0)
        : `Item #${item.salesOrderItemId}`;
    });
  };

  const buildPayload = () => ({
    id: editingId || 0,
    requestDate: form.requestDate,
    status: form.status,
    reason: form.reason,
    resolution: form.resolution,
    salesOrderId: toNumber(form.salesOrderId),
    remarks: form.remarks,
    items: [
      {
        id: 0,
        salesOrderItemId: toNumber(form.itemSalesOrderItemId),
        refundAmount: form.resolution === "EXCHANGE" || form.itemRefundAmount.trim() === "" ? null : toNumber(form.itemRefundAmount),
        returnQuantity: toNumber(form.itemReturnQuantity),
        remarks: form.itemRemarks,
      },
    ],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.salesOrderId) {
      ToasterService.error("Sales order required", "Select a sales order number.");
      return;
    }
    if (!form.itemSalesOrderItemId) {
      ToasterService.error(
        "Sales order item required",
        "Select which item from the sales order is being returned."
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const res = editingId
        ? await axios.put<ReturnRequest>(`${API_URL}/${editingId}`, payload, { headers })
        : await axios.post<ReturnRequest>(API_URL, payload, { headers });
      upsertReturn(res.data);
      ToasterService.success(editingId ? "Return request updated" : "Return request created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save return request", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const updateReturnStatus = async (request: ReturnRequest, nextStatus: string) => {
    if (!request.id || request.status === nextStatus) return;

    try {
      setStatusUpdatingId(request.id);
      const payload = {
        id: request.id,
        requestDate: request.requestDate,
        status: nextStatus,
        reason: request.reason,
        resolution: request.resolution || "REFUND",
        salesOrderId: request.salesOrderId,
        remarks: request.remarks || "",
        items: (request.items || []).map((item) => ({
          id: item.id || 0,
          salesOrderItemId: item.salesOrderItemId,
          refundAmount: Number(item.refundAmount || 0),
          returnQuantity: Number(item.returnQuantity || 0),
          remarks: item.remarks || "",
        })),
      };

      const res = await axios.put<ReturnRequest>(`${API_URL}/${request.id}`, payload, { headers });
      upsertReturn(res.data);
      ToasterService.success("Return request status updated");
    } catch (error) {
      ToasterService.error("Failed to update status", getErrorMessage(error, "Please try again."));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyReturnForm);
    setShowFormModal(true);
  };

  const openEdit = (request: ReturnRequest) => {
    const item = request.items?.[0];
    const matchedOrder = scheduleOrders.find(
      (order) => getScheduleOrderId(order) === Number(request.salesOrderId)
    );

    setEditingId(request.id);
    setForm({
      requestDate: request.requestDate || emptyReturnForm.requestDate,
      status: request.status || "REQUESTED",
      reason: reasonOptions.includes(request.reason as ReturnReason)
        ? (request.reason as ReturnReason)
        : "DAMAGED_PRODUCT",
      resolution: request.resolution === "EXCHANGE" ? "EXCHANGE" : "REFUND",
      salesOrderId: String(request.salesOrderId || ""),
      salesOrderNumber: matchedOrder ? getScheduleOrderNumber(matchedOrder) : `Order #${request.salesOrderId}`,
      remarks: request.remarks || "",
      itemSalesOrderItemId: String(item?.salesOrderItemId || ""),
      itemRefundAmount: item?.refundAmount != null ? String(item.refundAmount) : "",
      itemReturnQuantity: String(item?.returnQuantity || 1),
      itemRemarks: item?.remarks || "",
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyReturnForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deleteReturn) return;
    try {
      await axios.delete(`${API_URL}/${deleteReturn.id}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setReturns((current) => current.filter((item) => item.id !== deleteReturn.id));
      ToasterService.success("Return request deleted");
    } catch (error) {
      ToasterService.error("Failed to delete return request", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteReturn(null);
    }
  };

  const openRefundModal = (request: ReturnRequest) => {
    setRefundForm({
      ...emptyRefundForm,
      returnRequestId: String(request.id),
      // The most that can be refunded is the value of all returned lines
      amount: String(
        request.refund?.amount ??
          (request.items || []).reduce((sum, item) => sum + Number(item.refundAmount || 0), 0)
      ),
      refundDate: toLocalDateTimeInput(new Date()),
    });
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    if (refundSubmitting) return;
    setShowRefundModal(false);
  };

  const createRefund = async () => {
    if (!refundForm.returnRequestId || !refundForm.amount) {
      ToasterService.error("Return request ID and refund amount are required");
      return;
    }

    const returnRequestId = toNumber(refundForm.returnRequestId);
    const existingReturn = returns.find((item) => Number(item.id) === returnRequestId);

    if (!existingReturn) {
      ToasterService.error(
        "Return request not found",
        `Return request #${returnRequestId} is not available in the loaded return requests list.`
      );
      return;
    }

    if (existingReturn?.refund?.id || existingReturn?.refund) {
      ToasterService.error(
        "Refund already exists",
        `Return request #${returnRequestId} already has a refund. Update it from the refunds page instead of creating a new one.`
      );
      return;
    }

    try {
      setRefundSubmitting(true);
      const payload = {
        id: 0,
        amount: toNumber(refundForm.amount),
        refundDate: toIsoDateTime(refundForm.refundDate),
        status: refundForm.status || "PENDING",
        paymentMethod: refundForm.paymentMethod || "BANK_TRANSFER",
        returnRequestId,
      };

      const res = await axios.post<Refund>(`${API_URL}/${returnRequestId}/refund`, payload, { headers });
      const refund = {
        ...res.data,
        returnRequestId: res.data.returnRequestId ?? returnRequestId,
      };

      // A PROCESSED refund completes the return on the backend, so reload it rather than patching locally
      try {
        const fresh = await axios.get<ReturnRequest>(`${API_URL}/${returnRequestId}`, { headers });
        upsertReturn(fresh.data);
      } catch {
        setReturns((current) =>
          current.map((item) =>
            Number(item.id) === returnRequestId ? { ...item, refund } : item
          )
        );
      }

      ToasterService.success("Refund created");
      setRefundForm(emptyRefundForm);
      setShowRefundModal(false);
    } catch (error) {
      ToasterService.error("Failed to create refund", getErrorMessage(error, "Please try again."));
    } finally {
      setRefundSubmitting(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: returns.length,
      requested: returns.filter((item) => item.status === "REQUESTED").length,
      refundAmount: returns.reduce(
        (sum, item) =>
          sum +
          (item.refund?.amount ||
            item.items?.reduce((a, b) => a + Number(b.refundAmount || 0), 0) ||
            0),
        0
      ),
      refunded: returns.filter((item) => !!item.refund).length,
    }),
    [returns]
  );

  const columns: ColumnDef<ReturnRequest>[] = [
    {
      key: "id",
      label: "Request",
      sortable: true,
      render: (item) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{item.returnNumber || `Return #${item.id}`}</div>
          <div className="text-xs text-slate-500">
            {item.salesOrderNumber || `Order ID: ${item.salesOrderId}`}
            {item.customerName ? ` · ${item.customerName}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "itemsReturned",
      label: "Item Returned",
      sortable: false,
      render: (item) => {
        const labels = resolveReturnItemLabels(item);
        if (labels.length === 0) return <span className="text-sm text-slate-400">--</span>;
        return (
          <div className="text-sm text-slate-700">
            {labels[0]}
            {labels.length > 1 && (
              <span className="ml-1 text-xs text-slate-400">+{labels.length - 1} more</span>
            )}
          </div>
        );
      },
    },
    { key: "requestDate", label: "Request Date", sortable: true },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      render: (item) => (
        <div className="rounded-full bg-cyan-50 py-1 text-center text-xs font-semibold text-cyan-700">
          <span>{toFriendlyLabel(item.reason)}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (item) => !canUpdate || statusChoices(item.status).length <= 1 ? (
        <span className="inline-flex h-9 w-[112px] items-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-700">
          {toFriendlyLabel(item.status || "")}
        </span>
      ) : (
        <select
          value={item.status || ""}
          onChange={(e) => {
            e.stopPropagation();
            void updateReturnStatus(item, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={statusUpdatingId === item.id}
          className="h-9 w-[112px] rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statusChoices(item.status).map((status) => (
            <option key={status} value={status}>
              {toFriendlyLabel(status)}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "refund",
      label: "Refund / Exchange",
      sortable: false,
      render: (item) => item.resolution === "EXCHANGE" ? (
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
          {item.status === "COMPLETED" ? "Exchanged" : "Exchange"}
        </span>
      ) : (item.refund ? `${money(item.refund.amount)} (${item.refund.status})` : "--"),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (item) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canUpdate && !FINAL_RETURN_STATUSES.includes(item.status) && (<button
            type="button"
            onClick={() => openEdit(item)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title={t("Edit")}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>)}
          {canCreate && !item.refund && item.status === "APPROVED" && item.resolution !== "EXCHANGE" && (
            <button
              type="button"
              onClick={() => openRefundModal(item)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-green-50 hover:text-green-600"
              title={t("Refund")}
            >
              <ReceiptRefundIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && DELETABLE_RETURN_STATUSES.includes(item.status) && item.refund?.status !== "PROCESSED" && (<button
            type="button"
            onClick={() => setDeleteReturn(item)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title={t("Delete")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Return Requests")} description="Manage sales return requests" />
      <PageBreadcrumb
        pageTitle="Return Requests"
        actions={<AddButton onClick={openCreate} label={t("Add Return Request")} />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Return Requests")} value={stats.total} icon={<ArrowUturnLeftIcon />} />
          <StatsCard
            label={t("Requested")}
            value={stats.requested}
            icon={<CalendarDaysIcon />}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label={t("Refund Amount")}
            value={money(stats.refundAmount)}
            icon={<BanknotesIcon />}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label={t("Refunded")}
            value={stats.refunded}
            icon={<ReceiptRefundIcon />}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>

        <ReusableTable
          data={returns}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="requestDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ArrowUturnLeftIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">{t("No return requests found")}</p>
              <button
                type="button"
                onClick={() => fetchReturns()}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                {t("Reload all return requests")}
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={t(editingId ? "Edit Return Request" : "Create Return Request")}
        subtitle={t("Enter the return request details")}
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={t(editingId ? "Update Return Request" : "Create Return Request")}
        maxWidthClassName="max-w-3xl"
        tabs={[
          {
            label: "Request Info",
            fields: [
              <FloatingDateRangePicker
                key="requestDate"
                label={t("Request Date")}
                startDate={toDateValue(form.requestDate)}
                endDate={toDateValue(form.requestDate)}
                onChange={([start, end]) =>
                  setForm((current) => ({
                    ...current,
                    requestDate: toInputDateValue(end || start),
                  }))
                }
                placeholder=""
                required
                singleSelection
              />,
              // A new return always starts PENDING; the status only changes on existing returns
              ...(editingId
                ? [
                    <FloatingSelect
                      key="status"
                      label={t("Status")}
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      includeEmptyOption={false}
                      options={statusChoices(editingStatus).map((item) => ({ id: item, name: toFriendlyLabel(item) }))}
                    />,
                  ]
                : []),
              <FloatingSelect
                key="reason"
                label={t("Reason")}
                name="reason"
                value={form.reason}
                onChange={handleChange}
                includeEmptyOption={false}
                options={reasonOptions.map((item) => ({ id: item, name: toFriendlyLabel(item) }))}
              />,
              <FloatingSelect
                key="resolution"
                label={t("Resolution")}
                name="resolution"
                value={form.resolution}
                onChange={handleChange}
                includeEmptyOption={false}
                options={[
                  { id: "REFUND", name: "Refund the customer" },
                  { id: "EXCHANGE", name: "Exchange (send the same items again)" },
                ]}
              />,
              <div key="salesOrder" className="md:col-span-2">
                <FloatingSelect
                  label={t("Sales Order Number")}
                  name="salesOrderId"
                  value={form.salesOrderId}
                  onChange={handleChange}
                  emptyOptionLabel={scheduleOrdersLoading ? "Loading orders..." : ""}
                  options={productScheduleOrders
                    .map((order) => {
                      const id = getScheduleOrderId(order);
                      const number = getScheduleOrderNumber(order);
                      return { id: String(id), name: number || `Order #${id}` };
                    })
                    .filter((order) => Number(order.id) > 0)}
                  required
                />
                {scheduleOrdersError && (
                  <button
                    type="button"
                    onClick={fetchScheduleOrders}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
                  >
                    <ArrowPathIcon className="h-3 w-3" />
                    {t("Retry loading sales order numbers")}
                  </button>
                )}
                {form.salesOrderNumber && (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("Selected:")} <span className="font-medium text-slate-700">{form.salesOrderNumber}</span>
                  </p>
                )}
              </div>,
              ...(form.salesOrderId && selectedOrderItems.length > 0
                ? [
                    <div key="salesOrderItem" className="md:col-span-2">
                      <FloatingSelect
                        label={t("Sales Order Item")}
                        name="itemSalesOrderItemId"
                        value={form.itemSalesOrderItemId}
                        onChange={handleChange}
                        emptyOptionLabel=""
                        options={selectedOrderItems
                          .map((item, index) => {
                            const id = getScheduleItemId(item);
                            return {
                              id: String(id),
                              name: scheduleItemLabel(item, index),
                            };
                          })
                          .filter((option) => Number(option.id) > 0)}
                        required
                      />
                      {selectedOrderItems.length > 1 && !form.itemSalesOrderItemId && (
                        <p className="mt-1 text-xs text-amber-600">
                          {t("This order has")} {selectedOrderItems.length} items — choose which one is being returned.
                        </p>
                      )}
                    </div>,
                  ]
                : []),
            ],
          },
          {
            label: "Item Details",
            fields: [
              <FloatingInput
                key="itemReturnQuantity"
                label={t("Return Quantity")}
                name="itemReturnQuantity"
                type="number"
                min={1}
                value={form.itemReturnQuantity}
                onChange={handleChange}
                required
              />,
              form.resolution === "EXCHANGE" ? (
                <p key="itemRefundAmount" className="self-center text-[11px] text-slate-500">
                  {t("No refund for an exchange. Completing it sends the same items again from the order's warehouse and takes the returned ones back into stock (not when they are damaged).")}
                </p>
              ) : (
                <FloatingInput
                  key="itemRefundAmount"
                  label={t("Refund Amount (blank = value of the returned items)")}
                  name="itemRefundAmount"
                  type="number"
                  min={0}
                  value={form.itemRefundAmount}
                  onChange={handleChange}
                />
              ),
              <FloatingInput
                key="itemRemarks"
                label={t("Item Remarks")}
                name="itemRemarks"
                value={form.itemRemarks}
                onChange={handleChange}
              />,
              <div key="remarks" className="md:col-span-2">
                <FloatingTextarea
                  label={t("Remarks")}
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={3}
                />
              </div>,
            ],
          },
        ]}
      />

      <PaginatedPopup
        isOpen={showRefundModal}
        title={t("Create Refund")}
        subtitle={
          refundForm.returnRequestId
            ? `Refund for return request #${refundForm.returnRequestId}`
            : "Enter refund details"
        }
        onClose={closeRefundModal}
        onSubmit={(e) => {
          e.preventDefault();
          void createRefund();
        }}
        submitting={refundSubmitting}
        submitLabel={t("Create Refund")}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Refund Details",
            fields: [
              <FloatingInput
                key="refundAmount"
                label={t("Refund Amount")}
                name="amount"
                type="number"
                min={0}
                value={refundForm.amount}
                onChange={handleRefundChange}
                required
              />,
              <FloatingInput
                key="refundDate"
                label={t("Refund Date")}
                name="refundDate"
                type="datetime-local"
                value={refundForm.refundDate}
                onChange={handleRefundChange}
              />,
              <FloatingSelect
                key="refundStatus"
                label={t("Refund Status")}
                name="status"
                value={refundForm.status}
                onChange={handleRefundChange}
                includeEmptyOption={false}
                options={refundStatusOptions.map((status) => ({
                  id: status,
                  name: toFriendlyLabel(status),
                }))}
              />,
              <FloatingSelect
                key="refundPaymentMethod"
                label={t("Payment Method")}
                name="paymentMethod"
                value={refundForm.paymentMethod}
                onChange={handleRefundChange}
                includeEmptyOption={false}
                options={paymentMethods.map((method) => ({
                  id: method,
                  name: toFriendlyLabel(method),
                }))}
              />,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteReturn}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteReturn(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText={t("Delete Return Request")}
        subText={deleteReturn ? `Are you sure you want to delete return request #${deleteReturn.id}?` : t("Are you sure?")}
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteReturn(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default ReturnRequests;

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
  requestDate: string;
  status: string;
  reason: ReturnReason | string;
  salesOrderId: number;
  remarks: string;
  items: ReturnItem[];
  refund?: Refund;
};

type ScheduleOrderOption = {
  id?: number;
  salesOrderId?: number;
  orderId?: number;
  orderNumber?: string;
  salesOrderNumber?: string;
  customerId?: number;
  items?: Array<{
    id?: number;
    salesOrderItemId?: number;
    itemId?: number;
    productName?: string;
    productCode?: string;
    quantity?: number;
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
const SCHEDULE_ORDERS_API = "/v1/api/sales/sales-orders/schedule/orders";
const PAGE_SIZE = 10;
const reasonOptions: ReturnReason[] = [
  "DAMAGED_PRODUCT",
  "WRONG_ITEM",
  "CUSTOMER_CHANGED_MIND",
  "LATE_DELIVERY",
  "OTHER",
];
const paymentMethodOptions = ["BANK_TRANSFER"];
const refundStatusOptions = ["PENDING", "PROCESSED", "FAILED"];

const emptyReturnForm: ReturnForm = {
  requestDate: new Date().toISOString().split("T")[0],
  status: "REQUESTED",
  reason: "DAMAGED_PRODUCT",
  salesOrderId: "",
  salesOrderNumber: "",
  remarks: "",
  itemSalesOrderItemId: "",
  itemRefundAmount: "0",
  itemReturnQuantity: "1",
  itemRemarks: "",
};

const emptyRefundForm: RefundForm = {
  returnRequestId: "",
  amount: "0",
  refundDate: new Date().toISOString().slice(0, 16),
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

function toIsoDateTime(value: string) {
  if (!value) return new Date().toISOString();
  return value.includes("T") ? new Date(value).toISOString() : new Date(`${value}T00:00:00`).toISOString();
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
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  },
  index: number
) {
  const resolvedId = getScheduleItemId(item);
  const name = item.productName || item.productCode || `Item #${resolvedId || index + 1}`;
  const qty = item.quantity !== undefined ? ` · Qty ${item.quantity}` : "";
  return `${name}${qty}`;
}

const ReturnRequests: React.FC = () => {
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
      const res = await axios.get<ScheduleOrderOption[]>(SCHEDULE_ORDERS_API, { headers });
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

  const availableStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          ["REQUESTED", "PENDING", "APPROVED", "REJECTED", "REFUNDED", ...returns.map((item) => item.status).filter(Boolean)]
        )
      ),
    [returns]
  );

  const selectedOrderItems = useMemo(() => {
    if (!form.salesOrderId) return [];
    const order = scheduleOrders.find(
      (o) => String(getScheduleOrderId(o)) === form.salesOrderId
    );
    return order?.items || [];
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
    salesOrderId: toNumber(form.salesOrderId),
    remarks: form.remarks,
    items: [
      {
        id: 0,
        salesOrderItemId: toNumber(form.itemSalesOrderItemId),
        refundAmount: toNumber(form.itemRefundAmount),
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
      salesOrderId: String(request.salesOrderId || ""),
      salesOrderNumber: matchedOrder ? getScheduleOrderNumber(matchedOrder) : `Order #${request.salesOrderId}`,
      remarks: request.remarks || "",
      itemSalesOrderItemId: String(item?.salesOrderItemId || ""),
      itemRefundAmount: String(item?.refundAmount || 0),
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
      amount: String(request.refund?.amount ?? request.items?.[0]?.refundAmount ?? 0),
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

      setReturns((current) =>
        current.map((item) =>
          Number(item.id) === returnRequestId ? { ...item, refund } : item
        )
      );

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
          <div className="text-sm font-semibold text-slate-900">Return #{item.id}</div>
          <div className="text-xs text-slate-500">Order ID: {item.salesOrderId}</div>
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
      render: (item) => (
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
          {availableStatusOptions.map((status) => (
            <option key={status} value={status}>
              {toFriendlyLabel(status)}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "refund",
      label: "Refund",
      sortable: false,
      render: (item) => (item.refund ? `${money(item.refund.amount)} (${item.refund.status})` : "--"),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (item) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(item)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openRefundModal(item)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-green-50 hover:text-green-600"
            title="Refund"
          >
            <ReceiptRefundIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteReturn(item)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Return Requests" description="Manage sales return requests" />
      <PageBreadcrumb
        pageTitle="Return Requests"
        actions={<AddButton onClick={openCreate} label="Add Return Request" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Return Requests" value={stats.total} icon={<ArrowUturnLeftIcon />} />
          <StatsCard
            label="Requested"
            value={stats.requested}
            icon={<CalendarDaysIcon />}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Refund Amount"
            value={money(stats.refundAmount)}
            icon={<BanknotesIcon />}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Refunded"
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
              <p className="mb-2 text-sm text-gray-500">No return requests found</p>
              <button
                type="button"
                onClick={() => fetchReturns()}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reload all return requests
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Return Request" : "Create Return Request"}
        subtitle="Enter return request details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Return Request" : "Create Return Request"}
        maxWidthClassName="max-w-3xl"
        tabs={[
          {
            label: "Request Info",
            fields: [
              <FloatingDateRangePicker
                key="requestDate"
                label="Request Date"
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
              <FloatingSelect
                key="status"
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                includeEmptyOption={false}
                options={availableStatusOptions.map((item) => ({ id: item, name: toFriendlyLabel(item) }))}
              />,
              <FloatingSelect
                key="reason"
                label="Reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                includeEmptyOption={false}
                options={reasonOptions.map((item) => ({ id: item, name: toFriendlyLabel(item) }))}
              />,
              <div key="salesOrder" className="md:col-span-2">
                <FloatingSelect
                  label="Sales Order Number"
                  name="salesOrderId"
                  value={form.salesOrderId}
                  onChange={handleChange}
                  emptyOptionLabel={scheduleOrdersLoading ? "Loading orders..." : ""}
                  options={scheduleOrders
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
                    Retry loading sales order numbers
                  </button>
                )}
                {form.salesOrderNumber && (
                  <p className="mt-1 text-xs text-slate-500">
                    Selected: <span className="font-medium text-slate-700">{form.salesOrderNumber}</span>
                  </p>
                )}
              </div>,
              ...(form.salesOrderId && selectedOrderItems.length > 0
                ? [
                    <div key="salesOrderItem" className="md:col-span-2">
                      <FloatingSelect
                        label="Sales Order Item"
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
                          This order has {selectedOrderItems.length} items — choose which one is being returned.
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
                label="Return Quantity"
                name="itemReturnQuantity"
                type="number"
                min={1}
                value={form.itemReturnQuantity}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="itemRefundAmount"
                label="Refund Amount"
                name="itemRefundAmount"
                type="number"
                min={0}
                value={form.itemRefundAmount}
                onChange={handleChange}
              />,
              <FloatingInput
                key="itemRemarks"
                label="Item Remarks"
                name="itemRemarks"
                value={form.itemRemarks}
                onChange={handleChange}
              />,
              <div key="remarks" className="md:col-span-2">
                <FloatingTextarea
                  label="Remarks"
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
        title="Create Refund"
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
        submitLabel="Create Refund"
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Refund Details",
            fields: [
              <FloatingInput
                key="refundAmount"
                label="Refund Amount"
                name="amount"
                type="number"
                min={0}
                value={refundForm.amount}
                onChange={handleRefundChange}
                required
              />,
              <FloatingInput
                key="refundDate"
                label="Refund Date"
                name="refundDate"
                type="datetime-local"
                value={refundForm.refundDate}
                onChange={handleRefundChange}
              />,
              <FloatingSelect
                key="refundStatus"
                label="Refund Status"
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
                label="Payment Method"
                name="paymentMethod"
                value={refundForm.paymentMethod}
                onChange={handleRefundChange}
                includeEmptyOption={false}
                options={paymentMethodOptions.map((method) => ({
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
        innerText="Delete Return Request"
        subText={deleteReturn ? `Are you sure you want to delete return request #${deleteReturn.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteReturn(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default ReturnRequests;
import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ReceiptRefundIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
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

type SalesOrderOption = {
  id: number;
  orderNumber?: string;
  customerId?: number;
  items?: Array<{ id?: number }>;
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
const PAGE_SIZE = 10;
const reasonOptions: ReturnReason[] = [
  "DAMAGED_PRODUCT",
  "WRONG_ITEM",
  "CUSTOMER_CHANGED_MIND",
  "LATE_DELIVERY",
  "OTHER",
];
const refundStatusOptions = ["PENDING"];
const paymentMethodOptions = ["BANK_TRANSFER"];

const emptyReturnForm: ReturnForm = {
  requestDate: new Date().toISOString().split("T")[0],
  status: "REQUESTED",
  reason: "DAMAGED_PRODUCT",
  salesOrderId: "",
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

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function toFriendlyLabel(value: string) {
  return value.replace(/_/g, " ");
}

function salesOrderOptionLabel(order: SalesOrderOption) {
  return order.orderNumber || `Order #${order.id}`;
}

const ReturnRequests: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [form, setForm] = useState<ReturnForm>(emptyReturnForm);
  const [refundForm, setRefundForm] = useState<RefundForm>(emptyRefundForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [requestIdFilter, setRequestIdFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [refundDateFilter, setRefundDateFilter] = useState("");
  const [deleteReturn, setDeleteReturn] = useState<ReturnRequest | null>(null);
  const [salesOrders, setSalesOrders] = useState<SalesOrderOption[]>([]);

  useEffect(() => {
    fetchReturns();
    fetchSalesOrders();
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

  const fetchSalesOrders = async () => {
    try {
      const res = await axios.get<SalesOrderOption[]>("/v1/api/sales/sales-orders", { headers });
      setSalesOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load sales orders", getErrorMessage(error, "Please try again."));
      setSalesOrders([]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "salesOrderId") {
        const selectedOrder = salesOrders.find((order) => String(order.id) === value);
        if (selectedOrder?.items?.[0]?.id) {
          next.itemSalesOrderItemId = String(selectedOrder.items[0].id);
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
    if (!form.salesOrderId || !form.itemSalesOrderItemId) {
      ToasterService.error("Required fields missing", "Sales order ID and sales order item ID are required.");
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
    setEditingId(request.id);
    setForm({
      requestDate: request.requestDate || emptyReturnForm.requestDate,
      status: request.status || "REQUESTED",
      reason: reasonOptions.includes(request.reason as ReturnReason)
        ? (request.reason as ReturnReason)
        : "DAMAGED_PRODUCT",
      salesOrderId: String(request.salesOrderId || ""),
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

  const createRefund = async () => {
    if (!refundForm.returnRequestId || !refundForm.amount) {
      ToasterService.error("Return request ID and refund amount are required");
      return;
    }
    try {
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

      const payload = {
        id: 0,
        amount: toNumber(refundForm.amount),
        refundDate: toIsoDateTime(refundForm.refundDate),
        status: "PENDING",
        paymentMethod: "BANK_TRANSFER",
        returnRequestId,
      };

      const res = await axios.post<Refund>(`${API_URL}/${returnRequestId}/refund`, payload, { headers });
      const refund = {
        ...res.data,
        returnRequestId: res.data.returnRequestId ?? returnRequestId,
      };

      setReturns((current) =>
        current.map((item) =>
          Number(item.id) === returnRequestId
            ? {
                ...item,
                refund,
              }
            : item
        )
      );

      ToasterService.success("Refund created");
      setRefundForm(emptyRefundForm);
    } catch (error) {
      ToasterService.error("Failed to create refund", getErrorMessage(error, "Please try again."));
    }
  };

  const filtered = useMemo(() => {
    const term = searchableText(search);

    return returns.filter((item) => {
      const salesOrder = salesOrders.find((order) => Number(order.id) === Number(item.salesOrderId));
      const refundAmount = item.refund?.amount || item.items?.reduce((sum, row) => sum + Number(row.refundAmount || 0), 0) || 0;
      const refundDateOnly = item.refund?.refundDate ? String(item.refund.refundDate).slice(0, 10) : "";
      const filterDateOnly = refundDateFilter ? refundDateFilter.slice(0, 10) : "";

      const haystack = [
        item.id,
        item.status,
        item.reason,
        item.salesOrderId,
        item.requestDate,
        item.remarks,
        salesOrder?.orderNumber,
        salesOrder?.customerId,
        item.refund?.status,
        item.refund?.paymentMethod,
        item.refund?.refundDate,
        refundAmount,
        item.items?.length,
        ...((item.items || []).flatMap((row) => [
          row.id,
          row.salesOrderItemId,
          row.returnQuantity,
          row.refundAmount,
          row.remarks,
        ])),
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      const matchesSearch = !term || haystack.includes(term);
      const matchesRequestId = !requestIdFilter || String(item.id).includes(requestIdFilter);
      const matchesPaymentMethod =
        !paymentMethodFilter || String(item.refund?.paymentMethod || "").toLowerCase() === paymentMethodFilter.toLowerCase();
      const matchesRefundDate = !filterDateOnly || refundDateOnly === filterDateOnly;

      return matchesSearch && matchesRequestId && matchesPaymentMethod && matchesRefundDate;
    });
  }, [paymentMethodFilter, refundDateFilter, requestIdFilter, returns, salesOrders, search]);

  const stats = useMemo(
    () => ({
      total: returns.length,
      requested: returns.filter((item) => item.status === "REQUESTED").length,
      refundAmount: returns.reduce(
        (sum, item) => sum + (item.refund?.amount || item.items?.reduce((a, b) => a + Number(b.refundAmount || 0), 0) || 0),
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
    { key: "requestDate", label: "Request Date", sortable: true, },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      render: (item) =><div className="rounded-full text-center bg-cyan-50 py-1 text-xs font-semibold text-cyan-700"><span >{toFriendlyLabel(item.reason)}</span></div> ,
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
      key: "items",
      label: "Items",
      sortable: false,
      render: (item) => item.items?.length || 0,
    },
    {
      key: "refund",
      label: "Refund",
      sortable: false,
      className: "",
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
            onClick={() => setRefundForm((current) => ({ ...current, returnRequestId: String(item.id), amount: String(item.refund?.amount || item.items?.[0]?.refundAmount || 0) }))}
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
      <PageBreadcrumb pageTitle="Return Requests" />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Return Request" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Return Requests" value={stats.total} icon={<ArrowUturnLeftIcon />} />
          <StatsCard label="Requested" value={stats.requested} icon={<CalendarDaysIcon />} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label="Refund Amount" value={money(stats.refundAmount)} icon={<BanknotesIcon />} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Refunded" value={stats.refunded} icon={<ReceiptRefundIcon />} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:-mb-4">
          <div className="relative w-full sm:max-w-md mt-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search return requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ListingPdfExportButton
              title="Return Requests"
              subtitle="Filtered return request listing"
              reportLabel="Sales Report"
              data={filtered}
              fileName="Return_Requests"
              disabled={loading}
              metadata={(rows, rangeLabel) => [
                { label: "Total", value: rows.length },
                { label: "Range", value: rangeLabel },
                { label: "Payment", value: paymentMethodFilter || "All" },
                { label: "Search", value: search || "None" },
              ]}
            />
            <FilterPopover title="Refund Tools" buttonLabel="Filters" widthClassName="w-[20rem] sm:w-[22rem]" showFooter={false}>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Return Request ID</label>
                <input
                  type="number"
                  value={requestIdFilter}
                  onChange={(e) => setRequestIdFilter(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Payment Method</label>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">Any method</option>
                    {paymentMethodOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Refund Amount</label>
                  <input
                    type="number"
                    name="amount"
                    value={refundForm.amount}
                    onChange={handleRefundChange}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Refund Date</label>
                <input
                  type="date"
                  value={refundDateFilter}
                  onChange={(e) => setRefundDateFilter(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRequestIdFilter("");
                    setPaymentMethodFilter("");
                    setRefundDateFilter("");
                    setRefundForm(emptyRefundForm);
                  }}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Reset
                </button>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-dashed border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-medium text-cyan-700">
                    Filters apply live
                  </div>
                  <button
                    type="button"
                    onClick={createRefund}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Create Refund
                  </button>
                </div>
              </div>
            </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="requestDate"
          defaultSortOrder="desc"
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
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                includeEmptyOption={false}
                options={availableStatusOptions.map((item) => ({ id: item, name: toFriendlyLabel(item) }))}
              />,
              <FloatingSelect
                label="Reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                includeEmptyOption={false}
                options={reasonOptions.map((item) => ({ id: item, name: toFriendlyLabel(item) }))}
              />,
              <FloatingSelect
                label="Sales Order"
                name="salesOrderId"
                value={form.salesOrderId}
                onChange={handleChange}
                options={salesOrders.map((order) => ({
                  id: String(order.id),
                  name: salesOrderOptionLabel(order),
                }))}
              />,
            ],
          },
          {
            label: "Item Details",
            fields: [
              <FloatingInput label="Sales Order Item ID" name="itemSalesOrderItemId" type="number" value={form.itemSalesOrderItemId} onChange={handleChange} required />,
              <FloatingInput label="Return Quantity" name="itemReturnQuantity" type="number" value={form.itemReturnQuantity} onChange={handleChange} required />,
              <FloatingInput label="Refund Amount" name="itemRefundAmount" type="number" value={form.itemRefundAmount} onChange={handleChange} />,
              <FloatingInput label="Item Remarks" name="itemRemarks" value={form.itemRemarks} onChange={handleChange} />,
              <FloatingTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={3} />,
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

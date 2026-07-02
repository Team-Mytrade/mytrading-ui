import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
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
  returnRequestId: number;
};

type ReturnRequest = {
  id: number;
  requestDate: string;
  status: string;
  reason: string;
  salesOrderId: number;
  remarks: string;
  items: ReturnItem[];
  refund?: Refund;
};

type ReturnForm = {
  requestDate: string;
  status: string;
  reason: string;
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
const statusOptions = ["REQUESTED"];
const reasonOptions = ["DAMAGED_PRODUCT"];
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

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [deleteReturn, setDeleteReturn] = useState<ReturnRequest | null>(null);

  useEffect(() => {
    fetchReturns();
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

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Return request ID is required");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get<ReturnRequest>(`${API_URL}/${lookupId}`, { headers });
      setReturns([res.data]);
      ToasterService.success("Return request loaded");
    } catch (error) {
      ToasterService.error("Failed to load return request", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleRefundChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRefundForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => ({
    id: editingId || 0,
    requestDate: form.requestDate,
    status: "REQUESTED",
    reason: "DAMAGED_PRODUCT",
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
    refund: {
      id: 0,
      amount: toNumber(form.itemRefundAmount),
      refundDate: new Date().toISOString(),
      status: "PENDING",
      paymentMethod: "BANK_TRANSFER",
      returnRequestId: editingId || 0,
    },
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
      reason: request.reason || "DAMAGED_PRODUCT",
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
      const payload = {
        id: 0,
        amount: toNumber(refundForm.amount),
        refundDate: toIsoDateTime(refundForm.refundDate),
        status: "PENDING",
        paymentMethod: "BANK_TRANSFER",
        returnRequestId: toNumber(refundForm.returnRequestId),
      };
      await axios.post(`${API_URL}/${refundForm.returnRequestId}/refund`, payload, { headers });
      ToasterService.success("Refund created");
      setRefundForm(emptyRefundForm);
      await fetchReturns();
    } catch (error) {
      ToasterService.error("Failed to create refund", getErrorMessage(error, "Please try again."));
    }
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return returns.filter((item) =>
      [item.id, item.status, item.reason, item.salesOrderId, item.remarks]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [returns, search]);

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
    { key: "requestDate", label: "Request Date", sortable: true },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      render: (item) => <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">{item.reason}</span>,
    },
    { key: "status", label: "Status", sortable: true },
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

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Return Request" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Return Requests" value={stats.total} icon={<ArrowUturnLeftIcon />} />
          <StatsCard label="Requested" value={stats.requested} icon={<CalendarDaysIcon />} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label="Refund Amount" value={money(stats.refundAmount)} icon={<BanknotesIcon />} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Refunded" value={stats.refunded} icon={<ReceiptRefundIcon />} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <FloatingInput label="Return Request ID" type="number" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
            <button type="button" onClick={fetchById} className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700">Get By ID</button>
            <button type="button" onClick={fetchReturns} className="h-[52px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200">Load All</button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <FloatingInput label="Refund Return Request ID" name="returnRequestId" type="number" value={refundForm.returnRequestId} onChange={handleRefundChange} />
            <FloatingInput label="Refund Amount" name="amount" type="number" value={refundForm.amount} onChange={handleRefundChange} />
            <FloatingInput label="Refund Date" name="refundDate" type="datetime-local" value={refundForm.refundDate} onChange={handleRefundChange} />
            <FloatingSelect label="Payment Method" name="paymentMethod" value={refundForm.paymentMethod} onChange={handleRefundChange} includeEmptyOption={false} options={paymentMethodOptions.map((item) => ({ id: item, name: item }))} />
            <button type="button" onClick={createRefund} className="h-[52px] rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700">Create Refund</button>
          </div>
        </div>

        <div className="relative w-full sm:max-w-md">
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

        <ReusableTable
          data={filtered}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="requestDate"
          defaultSortOrder="desc"
        />
      </div>

      {showFormModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{editingId ? "Edit Return Request" : "Create Return Request"}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Enter return request details from the API schema</p>
                </div>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <FloatingDatePicker label="Request Date" name="requestDate" value={form.requestDate} onChange={handleChange} required />
                  <FloatingSelect label="Status" name="status" value={form.status} onChange={handleChange} includeEmptyOption={false} options={statusOptions.map((item) => ({ id: item, name: item }))} />
                  <FloatingSelect label="Reason" name="reason" value={form.reason} onChange={handleChange} includeEmptyOption={false} options={reasonOptions.map((item) => ({ id: item, name: item }))} />
                  <FloatingInput label="Sales Order ID" name="salesOrderId" type="number" value={form.salesOrderId} onChange={handleChange} required />
                  <FloatingInput label="Sales Order Item ID" name="itemSalesOrderItemId" type="number" value={form.itemSalesOrderItemId} onChange={handleChange} required />
                  <FloatingInput label="Return Quantity" name="itemReturnQuantity" type="number" value={form.itemReturnQuantity} onChange={handleChange} required />
                  <FloatingInput label="Refund Amount" name="itemRefundAmount" type="number" value={form.itemRefundAmount} onChange={handleChange} />
                  <FloatingInput label="Item Remarks" name="itemRemarks" value={form.itemRemarks} onChange={handleChange} />
                </div>
                <FloatingTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={3} />

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button type="button" onClick={closeForm} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
                    {submitting ? "Saving..." : editingId ? "Update Return Request" : "Create Return Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

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

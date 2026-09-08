import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BanknotesIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ReceiptRefundIcon,
  TrashIcon,
  XCircleIcon,
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
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type Refund = {
  id: number;
  amount: number;
  refundDate: string;
  status: string;
  paymentMethod: PaymentMethod | string;
  returnRequestId: number;
};

type ReturnRequestOption = {
  id: number;
  salesOrderId?: number;
  status?: string;
  reason?: string;
};

type RefundForm = {
  amount: string;
  refundDate: string;
  status: string;
  paymentMethod: PaymentMethod;
  returnRequestId: string;
};

type PaymentMethod =
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CASH"
  | "WALLET"
  | "CHEQUE"
  | "UPI";

const API_URL = "/v1/api/sales/refunds";
const PAGE_SIZE = 10;
const statusOptions = ["PENDING", "PROCESSED", "FAILED"];
const paymentMethodOptions: PaymentMethod[] = [
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "CASH",
  "WALLET",
  "CHEQUE",
  "UPI",
];

const emptyForm: RefundForm = {
  amount: "",
  refundDate: new Date().toISOString().slice(0, 16),
  status: "PENDING",
  paymentMethod: "BANK_TRANSFER",
  returnRequestId: "",
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

function toApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function toInputDateTime(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 16);
  return date.toISOString().slice(0, 16);
}

function toDateValue(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalDateTimeValue(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

const Refunds: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequestOption[]>([]);
  const [form, setForm] = useState<RefundForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [returnRequestLookupId, setReturnRequestLookupId] = useState("");
  const [deleteRefund, setDeleteRefund] = useState<Refund | null>(null);

  useEffect(() => {
    fetchRefunds();
    fetchReturnRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertRefund = (refund: Refund) => {
    setRefunds((current) => {
      const exists = current.some((item) => item.id === refund.id);
      if (exists) return current.map((item) => (item.id === refund.id ? refund : item));
      return [refund, ...current];
    });
  };

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Refund[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setRefunds(data);
      if (data.length === 0) ToasterService.noData("No refunds found");
    } catch (error) {
      ToasterService.error("Failed to load refunds", getErrorMessage(error, "Please try again."));
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturnRequests = async () => {
    try {
      const res = await axios.get<ReturnRequestOption[]>("/v1/api/sales/returns", { headers });
      setReturnRequests(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load return requests", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchByStatus = async () => {
    if (!statusFilter) {
      ToasterService.error("Status is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<Refund[]>(`${API_URL}/status/${statusFilter}`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setRefunds(data);
      data.length ? ToasterService.success("Refunds loaded") : ToasterService.noData("No refunds found");
    } catch (error) {
      ToasterService.error("Failed to load refunds by status", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchByReturnRequest = async () => {
    if (!returnRequestLookupId) {
      ToasterService.error("Return request ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<Refund>(`${API_URL}/return-request/${returnRequestLookupId}`, { headers });
      setRefunds(res.data ? [res.data] : []);
      ToasterService.success("Return request refund loaded");
    } catch (error) {
      ToasterService.error("Failed to load refund by return request", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => ({
    id: editingId || 0,
    amount: toNumber(form.amount),
    refundDate: toApiDateTime(form.refundDate),
    status: form.status,
    paymentMethod: form.paymentMethod,
    returnRequestId: toNumber(form.returnRequestId),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.amount || !form.returnRequestId) {
      ToasterService.error("Required fields missing", "Amount and return request are required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const res = editingId
        ? await axios.put<Refund>(`${API_URL}/${editingId}`, payload, { headers })
        : await axios.post<Refund>(API_URL, payload, { headers });

      upsertRefund(res.data);
      ToasterService.success(editingId ? "Refund updated" : "Refund created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save refund", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const updateRefundStatus = async (refund: Refund, nextStatus: string) => {
    if (!refund.id || refund.status === nextStatus) return;

    try {
      setStatusUpdatingId(refund.id);
      const payload = {
        id: refund.id,
        amount: Number(refund.amount || 0),
        refundDate: refund.refundDate,
        status: nextStatus,
        paymentMethod: refund.paymentMethod,
        returnRequestId: Number(refund.returnRequestId || 0),
      };

      const res = await axios.put<Refund>(`${API_URL}/${refund.id}`, payload, { headers });
      upsertRefund(res.data);
      ToasterService.success("Refund status updated");
    } catch (error) {
      ToasterService.error("Failed to update status", getErrorMessage(error, "Please try again."));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (refund: Refund) => {
    setEditingId(refund.id);
    setForm({
      amount: String(refund.amount || ""),
      refundDate: toInputDateTime(refund.refundDate),
      status: refund.status || "PENDING",
      paymentMethod: paymentMethodOptions.includes(refund.paymentMethod as PaymentMethod)
        ? (refund.paymentMethod as PaymentMethod)
        : "BANK_TRANSFER",
      returnRequestId: String(refund.returnRequestId || ""),
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deleteRefund) return;

    try {
      await axios.delete(`${API_URL}/${deleteRefund.id}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setRefunds((current) => current.filter((item) => item.id !== deleteRefund.id));
      ToasterService.success("Refund deleted");
    } catch (error) {
      ToasterService.error("Failed to delete refund", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteRefund(null);
    }
  };

  const filteredRefunds = useMemo(() => {
    const term = searchableText(search);
    if (!term) return refunds;

    return refunds.filter((refund) => {
      const returnRequest = returnRequests.find((item) => Number(item.id) === Number(refund.returnRequestId));
      const haystack = [
        refund.id,
        refund.returnRequestId,
        refund.amount,
        refund.status,
        refund.paymentMethod,
        refund.refundDate,
        returnRequest?.salesOrderId,
        returnRequest?.status,
        returnRequest?.reason,
        `refund ${refund.id}`,
        `return ${refund.returnRequestId}`,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [refunds, returnRequests, search]);

  const stats = useMemo(() => ({
    total: refunds.length,
    pending: refunds.filter((item) => item.status === "PENDING").length,
    processed: refunds.filter((item) => item.status === "PROCESSED").length,
    failed: refunds.filter((item) => item.status === "FAILED").length,
  }), [refunds]);

  const returnRequestOptions = returnRequests.map((item) => ({
    id: String(item.id),
    name: `Return #${item.id}${item.salesOrderId ? ` - Order #${item.salesOrderId}` : ""}${item.status ? ` (${item.status})` : ""}`,
  }));

  const columns: ColumnDef<Refund>[] = [
    {
      key: "id",
      label: "Refund",
      sortable: true,
      render: (refund) => (
        <div>
          <div className="font-medium text-cyan-700">Refund #{refund.id}</div>
          <div className="text-xs text-slate-500">Return #{refund.returnRequestId}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (refund) => <span className="font-semibold text-slate-900">{money(refund.amount)}</span>,
    },
    {
      key: "refundDate",
      label: "Refund Date",
      sortable: true,
      render: (refund) => refund.refundDate ? new Date(refund.refundDate).toLocaleString() : "--",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (refund) => (
        <select
          value={refund.status || ""}
          onChange={(e) => {
            e.stopPropagation();
            void updateRefundStatus(refund, e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          disabled={statusUpdatingId === refund.id}
          className="h-9 w-[112px] rounded-xl border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      ),
    },
    { key: "paymentMethod", label: "Payment Method", sortable: true, },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (refund) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(refund)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteRefund(refund)}
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
      <PageMeta title="Refunds" description="Manage sales refunds" />
      <PageBreadcrumb pageTitle="Refunds" />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Refund" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Refunds" value={stats.total} icon={<ReceiptRefundIcon />} />
          <StatsCard label="Pending" value={stats.pending} icon={<BanknotesIcon />} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label="Processed" value={stats.processed} icon={<CheckCircleIcon />} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Failed" value={stats.failed} icon={<XCircleIcon />} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:mt-1 md:-mb-4">
          <div className="relative w-full sm:max-w-md mt-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search refunds..."
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

          <div className="flex items-center gap-2 -mt-0.5">
            <ListingPdfExportButton
  title="Refunds"
  subtitle="Filtered refund listing"
  reportLabel="Sales Report"
  data={filteredRefunds}
  dateAccessor={(refund) => refund.refundDate}
  columns={[
    {
      key: "returnRequestId",
      header: "Return Request",
      accessor: (refund) => `Return #${refund.returnRequestId}`,
    },
    { key: "amount", header: "Amount", align: "right" },
    {
      key: "refundDate",
      header: "Refund Date",
      accessor: (refund) => (refund.refundDate ? new Date(refund.refundDate).toLocaleString() : "-"),
    },
    { key: "status", header: "Status" },
    { key: "paymentMethod", header: "Payment Method" },
  ]}
  fileName="Refunds"
  disabled={loading}
  metadata={(rows, rangeLabel) => [
    { label: "Total", value: rows.length },
    { label: "Range", value: rangeLabel },
    { label: "Status", value: statusFilter || "All" },
    { label: "Search", value: search || "None" },
  ]}
/>
            <FilterPopover title="Filter Refunds" buttonLabel="Filters" widthClassName="w-[20rem] sm:w-[22rem]" showFooter={false}>
            <div className="space-y-3">
              <FloatingSelect
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                emptyOptionLabel=""
                options={statusOptions.map((status) => ({ id: status, name: status }))}
              />
              <FloatingSelect
                label="Return Request"
                value={returnRequestLookupId}
                onChange={(e) => setReturnRequestLookupId(e.target.value)}
                emptyOptionLabel=""
                options={returnRequestOptions}
              />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("");
                    setReturnRequestLookupId("");
                    void fetchRefunds();
                  }}
                  className="h-10 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={fetchByStatus}
                  className="h-10 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Status
                </button>
                <button
                  type="button"
                  onClick={fetchByReturnRequest}
                  className="h-10 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Return
                </button>
              </div>
            </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredRefunds}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="refundDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ReceiptRefundIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No refunds found</p>
              <button type="button" onClick={openCreate} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                Create your first refund
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Refund" : "Create Refund"}
        subtitle="Enter refund details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Refund" : "Create Refund"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Refund Info",
            fields: [
              <FloatingInput label="Amount" name="amount" type="number" value={form.amount} onChange={handleChange} required />,
              <FloatingDateRangePicker
                label="Refund Date"
                startDate={toDateValue(form.refundDate)}
                endDate={toDateValue(form.refundDate)}
                onChange={([start, end]) =>
                  setForm((current) => ({
                    ...current,
                    refundDate: toLocalDateTimeValue(end || start),
                  }))
                }
                placeholder=""
                required
                singleSelection
                showTimeSelect
                closeOnSelect={false}
                dateFormat="dd-MM-yyyy hh:mm aa"
              />,
              <FloatingSelect
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                includeEmptyOption={false}
                options={statusOptions.map((status) => ({ id: status, name: status }))}
              />,
              <FloatingSelect
                label="Payment Method"
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                includeEmptyOption={false}
                options={paymentMethodOptions.map((method) => ({ id: method, name: method }))}
              />,
            ],
          },
          {
            label: "Return Request",
            fields: [
              <FloatingSelect
                label="Return Request"
                name="returnRequestId"
                value={form.returnRequestId}
                onChange={handleChange}
                options={returnRequestOptions}
                required
              />,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteRefund}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteRefund(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Refund"
        subText={deleteRefund ? `Are you sure you want to delete refund #${deleteRefund.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRefund(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default Refunds;

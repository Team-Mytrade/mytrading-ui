import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

import { MagnifyingGlassIcon, UserIcon, CalendarIcon, XMarkIcon } from "@heroicons/react/24/solid";
import {
  FunnelIcon,
  PackageIcon,
  NotebookTextIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  RefreshCwIcon,
  PackageMinusIcon,
  BadgeCheckIcon,
  PrinterIcon,
} from "lucide-react";
import { printDeliveryChallan } from "./deliveryChallan";
import { todayIso } from "../../utils/localDate";
import {
  DELIVERY_API,
  DeliveryOrder,
  DeliveryStatus,
  StatusBadge,
  apiError,
  formatDate,
  formatDateTime,
  statusConfig,
  useDeliveryLookups,
} from "./deliveryShared";
import { usePermissions } from "../../access/usePermissions";

import { t } from "../../i18n/i18n";
// A delivery note records what was handed over to the customer. Goods issues are raised against it.

const API = {
  notes: `${DELIVERY_API}/delivery-notes`,
  note: (id: number) => `${DELIVERY_API}/delivery-notes/${id}`,
  orders: `${DELIVERY_API}/delivery-orders`,
  goodsIssues: `${DELIVERY_API}/goods-issues`,
};

const NOTE_STATUSES: DeliveryStatus[] = ["PENDING", "CONFIRMED", "PARTIAL", "DELIVERED", "CANCELLED"];
// Delivered / partly delivered are set by Confirm delivery (it takes the goods out of stock), not by editing
const EDITABLE_NOTE_STATUSES: DeliveryStatus[] = ["PENDING", "CONFIRMED", "IN_TRANSIT", "CANCELLED"];
const PAGE_SIZE = 10;

interface NoteItem {
  id?: number;
  productId: number;
  productName?: string | null;
  salesOrderItemId?: number | null;
  orderedQty: number;
  deliveredQty: number;
}

interface DeliveryNoteRecord {
  id: number;
  deliveryNo: string;
  deliveryDate: string;
  salesOrderId?: number;
  customerId: number;
  deliveryOrderId?: number;
  deliveryOrderNumber?: string | null;
  // Set when confirmed: the sales dispatch was confirmed (stock out, invoiceable)
  confirmedAt?: string | null;
  salesDispatchNumber?: string | null;
  status: DeliveryStatus;
  createdDate?: string;
  items: NoteItem[];
}

interface FormItem {
  productId: string;
  productName?: string | null;
  salesOrderItemId?: number | null;
  orderedQty: string;
  deliveredQty: string;
}

interface NoteForm {
  deliveryOrderId: string;
  customerId: string;
  salesOrderId: string;
  deliveryDate: string;
  status: DeliveryStatus;
  items: FormItem[];
}

const emptyItem = (): FormItem => ({ productId: "", orderedQty: "1", deliveredQty: "0" });

const emptyForm = (): NoteForm => ({
  deliveryOrderId: "",
  customerId: "",
  salesOrderId: "",
  deliveryDate: todayIso(),
  status: "PENDING",
  items: [emptyItem()],
});

const optionalId = (value: string) => (value ? Number(value) : undefined);

const DeliveryNote: React.FC = () => {
  const { canCreate, canDelete, canUpdate } = usePermissions();
  const lookups = useDeliveryLookups(["customers", "products", "salesOrders"]);

  const [notes, setNotes] = useState<DeliveryNoteRecord[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState("");

  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selected, setSelected] = useState<DeliveryNoteRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const [notesRes, ordersRes] = await Promise.all([
        axios.get<DeliveryNoteRecord[]>(API.notes),
        axios.get<DeliveryOrder[]>(API.orders).catch(() => ({ data: [] as DeliveryOrder[] })),
      ]);
      setNotes(notesRes.data);
      setOrders(ordersRes.data);
    } catch (err) {
      toast.error(apiError(err, "Failed to load delivery notes"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const orderNumber = (id?: number) => orders.find((o) => o.id === id)?.deliveryOrderNumber ?? (id ? `DO #${id}` : "-");

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes.filter((n) => {
      const matchesSearch =
        !term ||
        [n.deliveryNo, lookups.customerName(n.customerId), n.deliveryOrderId ? orderNumber(n.deliveryOrderId) : "",
          n.salesOrderId ? lookups.salesOrderLabel(n.salesOrderId) : ""]
          .some((value) => value.toLowerCase().includes(term));
      const matchesStatus = statusFilter === "ALL" || n.status === statusFilter;
      const matchesDate = !dateFilter || (n.deliveryDate ?? "").startsWith(dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, orders, search, statusFilter, dateFilter, lookups.customers, lookups.salesOrders]);

  const stats = useMemo(() => {
    const count = (...statuses: DeliveryStatus[]) => notes.filter((n) => statuses.includes(n.status)).length;
    return {
      total: notes.length,
      pending: count("PENDING", "CONFIRMED"),
      partial: count("PARTIAL"),
      delivered: count("DELIVERED"),
      cancelled: count("CANCELLED"),
    };
  }, [notes]);

  // ================= FORM =================

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowFormModal(true);
  };

  const openEdit = (note: DeliveryNoteRecord) => {
    setEditingId(note.id);
    setForm({
      deliveryOrderId: note.deliveryOrderId ? String(note.deliveryOrderId) : "",
      customerId: String(note.customerId),
      salesOrderId: note.salesOrderId ? String(note.salesOrderId) : "",
      deliveryDate: note.deliveryDate ?? todayIso(),
      status: note.status ?? "PENDING",
      items: note.items.length
        ? note.items.map((i) => ({ productId: String(i.productId), productName: i.productName, salesOrderItemId: i.salesOrderItemId,
          orderedQty: String(i.orderedQty), deliveredQty: String(i.deliveredQty ?? 0) }))
        : [emptyItem()],
    });
    setShowDetailModal(false);
    setShowFormModal(true);
  };

  const closeForm = () => {
    setShowFormModal(false);
    setEditingId(null);
  };

  const setField = <K extends keyof NoteForm>(name: K, value: NoteForm[K]) => setForm((prev) => ({ ...prev, [name]: value }));

  // Taking over a delivery order fills in its customer, sales order and lines
  const chooseOrder = (orderId: string) => {
    const order = orders.find((o) => String(o.id) === orderId);
    setForm((prev) =>
      order
        ? {
            ...prev,
            deliveryOrderId: orderId,
            customerId: String(order.customerId),
            salesOrderId: order.salesOrderId ? String(order.salesOrderId) : "",
            items: order.items.map((i) => ({ productId: String(i.productId), productName: i.productName, salesOrderItemId: i.salesOrderItemId,
              orderedQty: String(Number(i.quantity)), deliveredQty: String(Number(i.quantity)) })),
          }
        : { ...prev, deliveryOrderId: orderId }
    );
  };

  const setItem = (index: number, patch: Partial<FormItem>) =>
    setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  const removeItem = (index: number) =>
    setForm((prev) => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = form.items.filter((i) => i.productId);
    if (!form.customerId) return void toast.warning("Choose a customer");
    if (!lines.length) return void toast.warning("Add at least one product");
    for (const line of lines) {
      const ordered = Number(line.orderedQty);
      const delivered = Number(line.deliveredQty || 0);
      if (!(ordered > 0)) return void toast.warning("Ordered quantities must be greater than 0");
      if (delivered < 0 || delivered > ordered) {
        return void toast.warning(`Delivered quantity for ${lookups.productName(Number(line.productId))} must be between 0 and ${ordered}`);
      }
    }

    const payload = {
      deliveryOrderId: optionalId(form.deliveryOrderId),
      customerId: Number(form.customerId),
      salesOrderId: optionalId(form.salesOrderId),
      deliveryDate: form.deliveryDate || undefined,
      status: form.status,
      items: lines.map((i) => ({ productId: Number(i.productId), productName: i.productName || lookups.productName(Number(i.productId)),
        salesOrderItemId: i.salesOrderItemId ?? undefined, orderedQty: Number(i.orderedQty), deliveredQty: Number(i.deliveredQty || 0) })),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await axios.put(API.note(editingId), payload);
        toast.success("Delivery note updated");
      } else {
        const { data } = await axios.post<DeliveryNoteRecord>(API.notes, payload);
        toast.success(`Delivery note ${data.deliveryNo} created`);
      }
      closeForm();
      await fetchNotes();
    } catch (err) {
      toast.error(apiError(err, "Failed to save the delivery note"));
    } finally {
      setSubmitting(false);
    }
  };

  // ================= ACTIONS =================

  const openView = (note: DeliveryNoteRecord) => {
    setSelected(note);
    setShowDetailModal(true);
  };

  const openDelete = (note: DeliveryNoteRecord) => {
    setSelected(note);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await axios.delete(API.note(selected.id));
      toast.success(`${selected.deliveryNo} deleted`);
      setShowDeleteModal(false);
      setSelected(null);
      await fetchNotes();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete the delivery note"));
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * The customer received the goods: Sales confirms the delivery order's dispatch at the delivered quantities
   * (stock leaves the warehouse and it can be invoiced). Anything not delivered goes back to "left to dispatch".
   */
  const confirmDelivery = async (note: DeliveryNoteRecord) => {
    const partial = note.items.some((i) => Number(i.deliveredQty ?? 0) < Number(i.orderedQty));
    const message = partial
      ? `Confirm ${note.deliveryNo} as partly delivered? The delivered quantities leave stock; the rest can go on another delivery order.`
      : `Confirm ${note.deliveryNo} as delivered? The goods leave stock and the dispatch can be invoiced.`;
    if (!window.confirm(message)) return;
    try {
      const { data } = await axios.post<DeliveryNoteRecord>(`${API.note(note.id)}/confirm`);
      toast.success(data.salesDispatchNumber
        ? `${note.deliveryNo} confirmed; dispatch ${data.salesDispatchNumber} is ready to invoice`
        : `${note.deliveryNo} confirmed`);
      setShowDetailModal(false);
      await fetchNotes();
    } catch (err) {
      toast.error(apiError(err, "Could not confirm the delivery"));
    }
  };

  // The challan the driver hands over and the customer signs (vehicle, transporter and address from the delivery order)
  const printChallan = async (note: DeliveryNoteRecord) => {
    const order = orders.find((o) => o.id === note.deliveryOrderId);
    try {
      await printDeliveryChallan({
        deliveryNo: note.deliveryNo,
        deliveryDate: note.deliveryDate,
        status: statusConfig(note.status).label,
        confirmedAt: note.confirmedAt,
        customerName: lookups.customerName(note.customerId, order?.customerName),
        customerCode: order?.customerNumber,
        deliveryAddress: order?.deliveryAddress,
        deliveryOrderNumber: note.deliveryOrderNumber ?? (note.deliveryOrderId ? orderNumber(note.deliveryOrderId) : null),
        salesOrderLabel: note.salesOrderId ? lookups.salesOrderLabel(note.salesOrderId) : null,
        salesDispatchNumber: note.salesDispatchNumber ?? order?.salesDispatchNumber,
        vehiclePlate: order?.vehiclePlate,
        transporterName: order?.transporterName,
        lines: note.items.map((i) => ({
          productName: i.productName || lookups.productName(i.productId),
          orderedQty: Number(i.orderedQty),
          deliveredQty: i.deliveredQty == null ? null : Number(i.deliveredQty),
        })),
      });
    } catch (err) {
      toast.error(apiError(err, "Could not make the delivery challan"));
    }
  };

  // Drafts a goods issue for everything still open on the note
  const issueGoods = async (note: DeliveryNoteRecord) => {
    try {
      const { data } = await axios.post<{ issueNo: string }>(API.goodsIssues, { deliveryNoteId: note.id });
      toast.success(`Draft goods issue ${data.issueNo} created. Post it on the Goods Issue page.`);
    } catch (err) {
      toast.error(apiError(err, "Could not create the goods issue"));
    }
  };

  // ================= TABLE =================

  const tableColumns: ColumnDef<DeliveryNoteRecord>[] = [
    {
      key: "deliveryNo",
      label: "Delivery Note",
      sortable: true,
      headerClassName: "w-[17%] text-left",
      className: "w-[17%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <NotebookTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate leading-snug">{row.deliveryNo}</span>
            <span className="text-xs text-slate-400 truncate">{row.deliveryOrderId ? orderNumber(row.deliveryOrderId) : "No delivery order"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      sortValueGetter: (row) => lookups.customerName(row.customerId),
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (row) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <UserIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 truncate">{lookups.customerName(row.customerId)}</span>
        </div>
      ),
    },
    {
      key: "salesOrderId",
      label: "Sales Order",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (row) => <span className="text-sm text-slate-600">{row.salesOrderId ? lookups.salesOrderLabel(row.salesOrderId) : "-"}</span>,
    },
    {
      key: "deliveryDate",
      label: "Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-600">{formatDate(row.deliveryDate)}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "items",
      label: "Items",
      sortable: false,
      headerClassName: "w-[8%] text-left",
      className: "w-[8%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <PackageIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-600">{row.items?.length || 0}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[18%] text-right pr-4",
      className: "w-[18%] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openView(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600" title={t("View")}>
            <EyeIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => printChallan(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700" title={t("Print delivery challan")}>
            <PrinterIcon className="h-4 w-4" />
          </button>
          {canUpdate && !row.confirmedAt && row.status !== "CANCELLED" && (
            <button type="button" onClick={() => confirmDelivery(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600" title={t("Confirm delivery (stock out)")}>
              <BadgeCheckIcon className="h-4 w-4" />
            </button>
          )}
          {canUpdate && !row.confirmedAt && (<button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit")}>
            <PencilIcon className="h-4 w-4" />
          </button>)}
          {row.status !== "CANCELLED" && canCreate && (
            <button type="button" onClick={() => issueGoods(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600" title={t("Issue goods")}>
              <PackageMinusIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && !row.confirmedAt && (<button type="button" onClick={() => openDelete(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title={t("Delete")}>
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      ),
    },
  ];

  // Orders the note can document: not cancelled
  const orderOptions = orders
    .filter((o) => o.status !== "CANCELLED" || String(o.id) === form.deliveryOrderId)
    .map((o) => ({ id: o.id, name: `${o.deliveryOrderNumber} · ${lookups.customerName(o.customerId, o.customerName)}` }));

  return (
    <>
      <PageMeta title={t("Delivery Notes")} description="Record what was handed over to customers" />
      <PageBreadcrumb pageTitle="Delivery Notes" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label={t("Add Delivery Note")} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard label={t("Total")} value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Open")} value={stats.pending} gradient="from-yellow-50 to-amber-50" borderColor="border-yellow-100" labelColor="text-yellow-600" />
          <StatsCard label={t("Partial")} value={stats.partial} gradient="from-orange-50 to-amber-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label={t("Delivered")} value={stats.delivered} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Cancelled")} value={stats.cancelled} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder={t("Search by note no, customer, delivery or sales order...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchNotes} className="p-2 border rounded-lg hover:bg-gray-50" title={t("Refresh")}>
              <RefreshCwIcon className={`h-5 w-5 text-gray-600 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className="p-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-600">{t("Filters")}</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="p-4 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("Status")}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | "ALL")}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">{t("All Statuses")}</option>
                {NOTE_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusConfig(status).label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("Date")}</label>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div className="flex items-end">
              {(statusFilter !== "ALL" || dateFilter) && (
                <button
                  onClick={() => {
                    setStatusFilter("ALL");
                    setDateFilter("");
                  }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  {t("✕ Clear All Filters")}
                </button>
              )}
            </div>
          </div>
        )}

        <ReusableTable<DeliveryNoteRecord>
          data={filteredNotes}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="createdDate"
          defaultSortOrder="desc"
          onRowClick={openView}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <NotebookTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">{t("No Delivery Notes Found")}</p>
              {search || statusFilter !== "ALL" || dateFilter ? (
                <p className="text-gray-400 text-xs">{t("Try adjusting your search or filters")}</p>
              ) : (
                canCreate && <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                  {t("Create your first delivery note")}
                </button>
              )}
            </div>
          }
        />

        {/* ================= CREATE / EDIT MODAL ================= */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <form onSubmit={handleSave} className="bg-white p-6 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <NotebookTextIcon className="h-6 w-6 text-cyan-600" />
                    {t(editingId ? "Edit Delivery Note" : "New Delivery Note")}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {editingId
                      ? "Once goods are issued against a note, only its header and status can change."
                      : "Start from a delivery order to copy its customer and products. The note number is assigned on save."}
                  </p>
                </div>
                <button type="button" onClick={closeForm} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <div className="sm:col-span-2">
                  <FloatingSelect
                    label={t("Delivery Order")}
                    name="deliveryOrderId"
                    value={form.deliveryOrderId}
                    onChange={(e) => chooseOrder(e.target.value)}
                    options={orderOptions}
                    emptyOptionLabel={t("None")}
                  />
                </div>

                {lookups.customers.length > 0 ? (
                  <FloatingSelect
                    label={t("Customer *")}
                    name="customerId"
                    value={form.customerId}
                    onChange={(e) => setField("customerId", e.target.value)}
                    options={lookups.customers.map((c) => ({ id: c.id, name: c.customerName }))}
                    required
                  />
                ) : (
                  <FloatingInput label={t("Customer ID *")} name="customerId" type="number" min={1} value={form.customerId} onChange={(e) => setField("customerId", e.target.value)} required />
                )}

                {lookups.salesOrders.length > 0 ? (
                  <FloatingSelect
                    label={t("Sales Order")}
                    name="salesOrderId"
                    value={form.salesOrderId}
                    onChange={(e) => setField("salesOrderId", e.target.value)}
                    options={lookups.salesOrders
                      .filter((s) => !form.customerId || !s.customerId || String(s.customerId) === form.customerId)
                      .map((s) => ({ id: s.id, name: s.orderNumber ?? `SO #${s.id}` }))}
                    emptyOptionLabel={t("None")}
                  />
                ) : (
                  <FloatingInput label={t("Sales Order ID")} name="salesOrderId" type="number" min={1} value={form.salesOrderId} onChange={(e) => setField("salesOrderId", e.target.value)} />
                )}

                <FloatingInput label={t("Delivery Date *")} name="deliveryDate" type="date" value={form.deliveryDate} onChange={(e) => setField("deliveryDate", e.target.value)} required />

                <FloatingSelect
                  label={t("Status *")}
                  name="status"
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value as DeliveryStatus)}
                  options={EDITABLE_NOTE_STATUSES.map((s) => ({ id: s, name: statusConfig(s).label }))}
                  includeEmptyOption={false}
                  required
                />
              </div>

              <div className="mt-2 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                    <PackageIcon className="h-5 w-5 text-cyan-600" />
                    {t("Products")} ({form.items.filter((i) => i.productId).length})
                  </h3>
                  <button type="button" onClick={addItem} className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-50 text-cyan-600 rounded-lg hover:bg-cyan-100 text-sm font-medium">
                    <PlusIcon className="h-4 w-4" />
                    {t("Add Product")}
                  </button>
                </div>
                <div className="hidden sm:grid grid-cols-[1fr_7rem_7rem_2rem] gap-2 px-2 mb-1 text-xs font-medium text-slate-500">
                  <span>{t("Product")}</span><span>{t("Ordered")}</span><span>{t("Delivered")}</span><span />
                </div>
                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_5rem_5rem_2rem] sm:grid-cols-[1fr_7rem_7rem_2rem] items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      {lookups.products.length > 0 ? (
                        <select
                          value={item.productId}
                          onChange={(e) => setItem(index, { productId: e.target.value })}
                          className="min-w-0 p-2 border border-gray-300 rounded-lg text-sm bg-white"
                          aria-label={t("Product")}
                        >
                          <option value="">{t("Choose a product")}</option>
                          {item.productId && !lookups.products.some((p) => String(p.id) === item.productId) && (
                            <option value={item.productId}>{lookups.productName(Number(item.productId))}</option>
                          )}
                          {lookups.products.map((p) => (
                            <option key={p.id} value={p.id}>{p.productCode ? `${p.productName} (${p.productCode})` : p.productName}</option>
                          ))}
                        </select>
                      ) : (
                        <input type="number" min={1} placeholder={t("Product ID")} value={item.productId} onChange={(e) => setItem(index, { productId: e.target.value })} className="min-w-0 p-2 border border-gray-300 rounded-lg text-sm" aria-label={t("Product ID")} />
                      )}
                      <input type="number" min={0} step="any" value={item.orderedQty} onChange={(e) => setItem(index, { orderedQty: e.target.value })} className="p-2 border border-gray-300 rounded-lg text-sm" aria-label={t("Ordered quantity")} />
                      <input type="number" min={0} step="any" value={item.deliveredQty} onChange={(e) => setItem(index, { deliveredQty: e.target.value })} className="p-2 border border-gray-300 rounded-lg text-sm" aria-label={t("Delivered quantity")} />
                      <button type="button" onClick={() => removeItem(index)} disabled={form.items.length === 1} className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-30" title={t("Remove")}>
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={closeForm} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium" disabled={submitting}>
                  {t("Cancel")}
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Note"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= DETAIL MODAL ================= */}
        {showDetailModal && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white p-6 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <NotebookTextIcon className="h-6 w-6 text-cyan-600" />
                    {selected.deliveryNo}
                  </h2>
                  <div className="mt-2"><StatusBadge status={selected.status} /></div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><label className="text-xs text-gray-500">{t("Customer")}</label><p className="font-medium text-slate-700">{lookups.customerName(selected.customerId)}</p></div>
                <div><label className="text-xs text-gray-500">{t("Date")}</label><p className="font-medium text-slate-700">{formatDate(selected.deliveryDate)}</p></div>
                <div><label className="text-xs text-gray-500">{t("Delivery Order")}</label><p className="font-medium text-slate-700">{selected.deliveryOrderId ? orderNumber(selected.deliveryOrderId) : "-"}</p></div>
                <div><label className="text-xs text-gray-500">{t("Sales Order")}</label><p className="font-medium text-slate-700">{selected.salesOrderId ? lookups.salesOrderLabel(selected.salesOrderId) : "-"}</p></div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500">{t("Delivery")}</label>
                  <p className="font-medium text-slate-700">
                    {selected.confirmedAt
                      ? `Confirmed ${formatDateTime(selected.confirmedAt)}${selected.salesDispatchNumber ? ` · dispatch ${selected.salesDispatchNumber} (stock out, ready to invoice)` : ""}`
                      : "Not confirmed yet: confirm it when the customer has received the goods"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <PackageIcon className="h-5 w-5 text-cyan-600" />
                  {t("Products")} ({selected.items?.length || 0})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selected.items?.map((item, index) => (
                    <div key={item.id ?? index} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm gap-3">
                      <span className="font-medium text-slate-700 truncate">{item.productName || lookups.productName(item.productId)}</span>
                      <span className="whitespace-nowrap space-x-3">
                        <span className="text-gray-500">{t("Ordered")} {item.orderedQty}</span>
                        <span className="text-green-600">{t("Delivered")} {item.deliveredQty ?? 0}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4 flex flex-wrap justify-end gap-2">
                <button onClick={() => printChallan(selected)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">
                  <PrinterIcon className="h-4 w-4 inline mr-1" />
                  {t("Print Challan")}
                </button>
                {canUpdate && !selected.confirmedAt && selected.status !== "CANCELLED" && (
                  <button onClick={() => confirmDelivery(selected)} className="px-4 py-2 bg-[#4DD0E1] text-white rounded-lg hover:bg-[#26C6DA] text-sm font-medium">
                    <BadgeCheckIcon className="h-4 w-4 inline mr-1" />
                    {t("Confirm Delivery")}
                  </button>
                )}
                {selected.status !== "CANCELLED" && canCreate && (
                  <button onClick={() => issueGoods(selected)} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-sm font-medium">
                    <PackageMinusIcon className="h-4 w-4 inline mr-1" />
                    {t("Issue Goods")}
                  </button>
                )}
                {canUpdate && !selected.confirmedAt && (<button onClick={() => openEdit(selected)} className="px-4 py-2 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 text-sm font-medium">
                  <PencilIcon className="h-4 w-4 inline mr-1" />
                  {t("Edit")}
                </button>)}
                {canDelete && !selected.confirmedAt && (<button
                  onClick={() => {
                    setShowDetailModal(false);
                    openDelete(selected);
                  }}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  <TrashIcon className="h-4 w-4 inline mr-1" />
                  {t("Delete")}
                </button>)}
              </div>
              {selected.createdDate && <p className="mt-4 border-t pt-3 text-xs text-gray-400">{t("Created")} {formatDateTime(selected.createdDate)}</p>}
            </div>
          </div>
        )}

        {/* ================= DELETE MODAL ================= */}
        {showDeleteModal && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t("Delete Delivery Note")}</h3>
                  <p className="text-sm text-gray-500">
                    {t("Delete")} <span className="font-semibold text-gray-700">{selected.deliveryNo}</span>{t("? Notes with goods issued against them cannot be deleted.")}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelected(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={submitting}
                >
                  {t("Cancel")}
                </button>
                <button type="button" onClick={handleDelete} disabled={submitting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50">
                  {t(submitting ? "Deleting..." : "Delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DeliveryNote;

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import {
  FloatingInput,
  FloatingTextarea,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";

import { MagnifyingGlassIcon, UserIcon, CalendarIcon, XMarkIcon } from "@heroicons/react/24/solid";
import {
  FunnelIcon,
  PackageIcon,
  ClipboardListIcon,
  TruckIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  RefreshCwIcon,
  MapPinIcon,
  ArrowRightLeftIcon,
} from "lucide-react";
import { todayIso } from "../../utils/localDate";
import {
  DELIVERY_API,
  DELIVERY_STATUSES,
  DELETABLE_ORDER_STATUSES,
  EDITABLE_ORDER_STATUSES,
  DeliveryOrder,
  DeliveryStatus,
  StatusBadge,
  apiError,
  formatDate,
  formatDateTime,
  nextStatuses,
  statusConfig,
  useDeliveryLookups,
} from "./deliveryShared";
import { usePermissions } from "../../access/usePermissions";

import { t } from "../../i18n/i18n";
// ================= API CONFIGURATION =================

const API = {
  orders: `${DELIVERY_API}/delivery-orders`,
  order: (id: number) => `${DELIVERY_API}/delivery-orders/${id}`,
  status: (id: number) => `${DELIVERY_API}/delivery-orders/${id}/status`,
  addresses: (customerId: string) => `${DELIVERY_API}/customer-addresses?customerId=${customerId}`,
  // What is still left to dispatch on a sales order
  dispatchable: (salesOrderId: string) => `/v1/api/sales/sales-orders/${salesOrderId}/dispatchable-items`,
};

// ================= TYPES =================

interface AddressOption {
  id: number;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  defaultDelivery?: boolean;
}

interface DispatchableItem {
  salesOrderItemId: number;
  productId: number;
  productName?: string;
  remainingQuantity: number;
}

// Ids are strings for the selects
interface FormItem {
  productId: string;
  productName?: string;
  quantity: string;
  // The sales order line it delivers (its sales dispatch line)
  salesOrderItemId?: number;
}

interface OrderForm {
  customerId: string;
  salesOrderId: string;
  warehouseId: string;
  deliveryDate: string; // datetime-local value, "2026-10-14T10:00"
  vehicleId: string;
  transporterId: string;
  deliveryAddressId: string;
  remarks: string;
  items: FormItem[];
}

const PAGE_SIZE = 10;

const emptyItem = (): FormItem => ({ productId: "", quantity: "1" });

const emptyForm = (): OrderForm => ({
  customerId: "",
  salesOrderId: "",
  warehouseId: "",
  deliveryDate: `${todayIso()}T10:00`,
  vehicleId: "",
  transporterId: "",
  deliveryAddressId: "",
  remarks: "",
  items: [emptyItem()],
});

const optionalId = (value: string) => (value ? Number(value) : undefined);
const addressLabel = (a: AddressOption) => [a.addressLine1, a.addressLine2, a.city, a.postalCode].filter(Boolean).join(", ");

// ================= COMPONENT =================

const DeliveryOrderPage: React.FC = () => {
  const { canCreate, canDelete, canUpdate } = usePermissions();
  const lookups = useDeliveryLookups(["customers", "products", "vehicles", "transporters", "warehouses", "salesOrders"]);

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState("");

  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  const [selected, setSelected] = useState<DeliveryOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<DeliveryStatus | "">("");
  const [statusRemarks, setStatusRemarks] = useState("");

  // ================= DATA =================

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<DeliveryOrder[]>(API.orders);
      setOrders(data);
    } catch (err) {
      toast.error(apiError(err, "Failed to load delivery orders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // The chosen customer's saved addresses; a new order starts at their default delivery address
  useEffect(() => {
    if (!showFormModal || !form.customerId) {
      setAddresses([]);
      return;
    }
    let cancelled = false;
    axios
      .get<AddressOption[]>(API.addresses(form.customerId))
      .then(({ data }) => {
        if (cancelled) return;
        setAddresses(data);
        setForm((prev) =>
          prev.deliveryAddressId && data.some((a) => String(a.id) === prev.deliveryAddressId)
            ? prev
            : { ...prev, deliveryAddressId: String(data.find((a) => a.defaultDelivery)?.id ?? "") }
        );
      })
      .catch(() => !cancelled && setAddresses([]));
    return () => {
      cancelled = true;
    };
  }, [form.customerId, showFormModal]);

  // ================= FILTER & STATS =================

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        !term ||
        [
          o.deliveryOrderNumber,
          lookups.customerName(o.customerId, o.customerName),
          o.vehiclePlate,
          o.transporterName,
          o.salesOrderId ? lookups.salesOrderLabel(o.salesOrderId) : "",
        ].some((value) => (value ?? "").toLowerCase().includes(term));
      const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
      const matchesDate = !dateFilter || (o.deliveryDate ?? "").startsWith(dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, search, statusFilter, dateFilter, lookups.customers, lookups.salesOrders]);

  const stats = useMemo(() => {
    const count = (...statuses: DeliveryStatus[]) => orders.filter((o) => statuses.includes(o.status)).length;
    return {
      total: orders.length,
      open: count("PENDING", "CONFIRMED"),
      inTransit: count("IN_TRANSIT", "PARTIAL"),
      delivered: count("DELIVERED"),
      returned: count("RETURNED"),
      cancelled: count("CANCELLED"),
    };
  }, [orders]);

  // ================= FORM =================

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowFormModal(true);
  };

  const openEdit = (order: DeliveryOrder) => {
    setEditingId(order.id);
    setForm({
      customerId: String(order.customerId),
      salesOrderId: order.salesOrderId ? String(order.salesOrderId) : "",
      warehouseId: order.warehouseId ? String(order.warehouseId) : "",
      deliveryDate: (order.deliveryDate ?? "").slice(0, 16),
      vehicleId: order.vehicleId ? String(order.vehicleId) : "",
      transporterId: order.transporterId ? String(order.transporterId) : "",
      deliveryAddressId: order.deliveryAddressId ? String(order.deliveryAddressId) : "",
      remarks: order.remarks ?? "",
      items: order.items.length
        ? order.items.map((i) => ({ productId: String(i.productId), productName: i.productName, quantity: String(Number(i.quantity)),
          salesOrderItemId: i.salesOrderItemId ?? undefined }))
        : [emptyItem()],
    });
    setShowDetailModal(false);
    setShowFormModal(true);
  };

  const closeForm = () => {
    setShowFormModal(false);
    setEditingId(null);
  };

  const setField = (name: keyof OrderForm, value: string) => setForm((prev) => ({ ...prev, [name]: value }));

  // A sales order of another customer no longer fits once the customer changes
  const changeCustomer = (customerId: string) =>
    setForm((prev) => {
      const salesOrder = lookups.salesOrders.find((s) => String(s.id) === prev.salesOrderId);
      const keepSalesOrder = salesOrder && salesOrder.customerId === Number(customerId);
      return { ...prev, customerId, deliveryAddressId: "", salesOrderId: keepSalesOrder ? prev.salesOrderId : "" };
    });

  const setItem = (index: number, patch: Partial<FormItem>) =>
    setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));

  const removeItem = (index: number) =>
    setForm((prev) => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items }));

  const loadSalesOrderLines = async () => {
    if (!form.salesOrderId) return;
    setLoadingLines(true);
    try {
      const { data } = await axios.get<DispatchableItem[]>(API.dispatchable(form.salesOrderId));
      if (!data.length) {
        toast.info("Nothing is left to dispatch on this sales order");
        return;
      }
      setForm((prev) => ({
        ...prev,
        items: data.map((d) => ({
          productId: String(d.productId),
          productName: d.productName,
          quantity: String(Number(d.remainingQuantity)),
          salesOrderItemId: d.salesOrderItemId,
        })),
      }));
      toast.success(`Loaded ${data.length} line(s) from the sales order`);
    } catch (err) {
      toast.error(apiError(err, "Could not load the sales order lines"));
    } finally {
      setLoadingLines(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = form.items.filter((i) => i.productId);
    if (!form.customerId) return void toast.warning("Choose a customer");
    if (!form.deliveryDate) return void toast.warning("Choose the delivery date");
    if (!lines.length) return void toast.warning("Add at least one product");
    // Up to 3 decimals for weight/length units (2.5 KG), as on the sales order
    if (lines.some((i) => !(Number(i.quantity) > 0) || !/^\d+(\.\d{1,3})?$/.test(String(i.quantity).trim()))) {
      return void toast.warning("Quantities must be greater than 0, with at most 3 decimals");
    }

    const customer = lookups.customers.find((c) => String(c.id) === form.customerId);
    const previous = orders.find((o) => o.id === editingId);
    const payload = {
      customerId: Number(form.customerId),
      customerName: customer?.customerName ?? previous?.customerName,
      customerNumber: customer?.customerCode ?? previous?.customerNumber,
      salesOrderId: optionalId(form.salesOrderId),
      warehouseId: optionalId(form.warehouseId),
      deliveryDate: form.deliveryDate.length === 16 ? `${form.deliveryDate}:00` : form.deliveryDate,
      vehicleId: optionalId(form.vehicleId),
      transporterId: optionalId(form.transporterId),
      deliveryAddressId: optionalId(form.deliveryAddressId),
      remarks: form.remarks.trim() || undefined,
      items: lines.map((i) => ({
        productId: Number(i.productId),
        productName: i.productName || lookups.products.find((p) => String(p.id) === i.productId)?.productName,
        quantity: Number(i.quantity),
        salesOrderItemId: form.salesOrderId ? i.salesOrderItemId : undefined,
      })),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await axios.put(API.order(editingId), payload);
        toast.success("Delivery order updated");
      } else {
        const { data } = await axios.post<DeliveryOrder>(API.orders, payload);
        toast.success(`Delivery order ${data.deliveryOrderNumber} created`);
      }
      closeForm();
      await fetchOrders();
    } catch (err) {
      toast.error(apiError(err, "Failed to save the delivery order"));
    } finally {
      setSubmitting(false);
    }
  };

  // ================= STATUS & DELETE =================

  const openView = (order: DeliveryOrder) => {
    setSelected(order);
    setShowDetailModal(true);
  };

  const openStatus = (order: DeliveryOrder) => {
    setSelected(order);
    setNewStatus(nextStatuses(order.status)[0] ?? "");
    setStatusRemarks("");
    setShowStatusModal(true);
  };

  const openDelete = (order: DeliveryOrder) => {
    setSelected(order);
    setShowDeleteModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selected || !newStatus) return;
    setSubmitting(true);
    try {
      await axios.put(API.status(selected.id), { status: newStatus, remarks: statusRemarks.trim() || undefined });
      toast.success(`${selected.deliveryOrderNumber} is now ${statusConfig(newStatus).label}`);
      setShowStatusModal(false);
      setShowDetailModal(false);
      await fetchOrders();
    } catch (err) {
      toast.error(apiError(err, "Failed to update the status"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await axios.delete(API.order(selected.id));
      toast.success(`${selected.deliveryOrderNumber} deleted`);
      setShowDeleteModal(false);
      setSelected(null);
      await fetchOrders();
    } catch (err) {
      toast.error(apiError(err, "Failed to delete the delivery order"));
    } finally {
      setSubmitting(false);
    }
  };

  // ================= TABLE =================

  const tableColumns: ColumnDef<DeliveryOrder>[] = [
    {
      key: "deliveryOrderNumber",
      label: "Delivery Order",
      sortable: true,
      headerClassName: "w-[17%] text-left",
      className: "w-[17%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <ClipboardListIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate leading-snug">{row.deliveryOrderNumber}</span>
            <span className="text-xs text-slate-400 truncate">
              {row.salesOrderId ? lookups.salesOrderLabel(row.salesOrderId) : "No sales order"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      sortValueGetter: (row) => lookups.customerName(row.customerId, row.customerName),
      headerClassName: "w-[17%] text-left",
      className: "w-[17%]",
      render: (row) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <UserIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 truncate">{lookups.customerName(row.customerId, row.customerName)}</span>
        </div>
      ),
    },
    {
      key: "deliveryDate",
      label: "Delivery Date",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-600">{formatDate(row.deliveryDate)}</span>
        </div>
      ),
    },
    {
      key: "vehiclePlate",
      label: "Vehicle / Transporter",
      sortable: false,
      headerClassName: "w-[17%] text-left",
      className: "w-[17%]",
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-slate-700 truncate">{row.vehiclePlate ?? "Not assigned"}</span>
          {row.transporterName && <span className="text-xs text-slate-400 truncate">{row.transporterName}</span>}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
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
      headerClassName: "w-[15%] text-right pr-4",
      className: "w-[15%] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openView(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600" title={t("View")}>
            <EyeIcon className="h-4 w-4" />
          </button>
          {EDITABLE_ORDER_STATUSES.includes(row.status) && (
            canUpdate && <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit")}>
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {nextStatuses(row.status).length > 0 && (
            <button type="button" onClick={() => openStatus(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-purple-50 hover:text-purple-600" title={t("Change status")}>
              <ArrowRightLeftIcon className="h-4 w-4" />
            </button>
          )}
          {DELETABLE_ORDER_STATUSES.includes(row.status) && (
            canDelete && <button type="button" onClick={() => openDelete(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title={t("Delete")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // Only the chosen customer's sales orders (all of them until a customer is chosen)
  const salesOrderOptions = lookups.salesOrders
    .filter((s) => !form.customerId || !s.customerId || String(s.customerId) === form.customerId)
    .map((s) => ({ id: s.id, name: s.orderNumber ?? `SO #${s.id}` }));

  // ================= UI =================

  return (
    <>
      <PageMeta title={t("Delivery Orders")} description="Plan and track deliveries to customers" />
      <PageBreadcrumb pageTitle="Delivery Orders" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label={t("Add Delivery Order")} />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          <StatsCard label={t("Total")} value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Open")} value={stats.open} gradient="from-yellow-50 to-amber-50" borderColor="border-yellow-100" labelColor="text-yellow-600" />
          <StatsCard label={t("In Transit")} value={stats.inTransit} gradient="from-purple-50 to-violet-50" borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label={t("Delivered")} value={stats.delivered} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Returned")} value={stats.returned} gradient="from-orange-50 to-amber-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label={t("Cancelled")} value={stats.cancelled} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder={t("Search by order no, customer, vehicle or sales order...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchOrders} className="p-2 border rounded-lg hover:bg-gray-50" title={t("Refresh")}>
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
                {DELIVERY_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusConfig(status).label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("Delivery Date")}</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
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

        {/* TABLE */}
        <ReusableTable<DeliveryOrder>
          data={filteredOrders}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="createdDate"
          defaultSortOrder="desc"
          onRowClick={openView}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <ClipboardListIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">{t("No Delivery Orders Found")}</p>
              {search || statusFilter !== "ALL" || dateFilter ? (
                <p className="text-gray-400 text-xs">{t("Try adjusting your search or filters")}</p>
              ) : (
                canCreate && <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                  {t("Create your first delivery order")}
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
                    <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                    {t(editingId ? "Edit Delivery Order" : "New Delivery Order")}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {t(editingId ? "Pending and confirmed orders can still change." : "The order number is assigned when you save.")}
                  </p>
                </div>
                <button type="button" onClick={closeForm} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {lookups.customers.length > 0 ? (
                  <FloatingSelect
                    label={t("Customer *")}
                    name="customerId"
                    value={form.customerId}
                    onChange={(e) => changeCustomer(e.target.value)}
                    options={lookups.customers.map((c) => ({ id: c.id, name: c.customerName }))}
                    required
                  />
                ) : (
                  <FloatingInput label={t("Customer ID *")} name="customerId" type="number" min={1} value={form.customerId} onChange={(e) => changeCustomer(e.target.value)} required />
                )}

                <FloatingInput
                  label={t("Delivery Date & Time *")}
                  name="deliveryDate"
                  type="datetime-local"
                  value={form.deliveryDate}
                  onChange={(e) => setField("deliveryDate", e.target.value)}
                  required
                />

                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    {lookups.salesOrders.length > 0 ? (
                      <FloatingSelect
                        label={t("Sales Order")}
                        name="salesOrderId"
                        value={form.salesOrderId}
                        onChange={(e) => setField("salesOrderId", e.target.value)}
                        options={salesOrderOptions}
                        emptyOptionLabel={t("None")}
                      />
                    ) : (
                      <FloatingInput label={t("Sales Order ID")} name="salesOrderId" type="number" min={1} value={form.salesOrderId} onChange={(e) => setField("salesOrderId", e.target.value)} />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={loadSalesOrderLines}
                    disabled={!form.salesOrderId || loadingLines}
                    className="mt-1 h-[50px] px-3 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 text-xs font-semibold hover:bg-cyan-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    title={t("Fill the lines with what is still left to dispatch on the sales order")}
                  >
                    {t(loadingLines ? "Loading..." : "Load lines")}
                  </button>
                </div>

                {lookups.warehouses.length > 0 ? (
                  <FloatingSelect
                    label={t("Ship From Warehouse")}
                    name="warehouseId"
                    value={form.warehouseId}
                    onChange={(e) => setField("warehouseId", e.target.value)}
                    options={lookups.warehouses.map((w) => ({ id: w.id, name: w.code ? `${w.name} (${w.code})` : w.name }))}
                    emptyOptionLabel={t("Not set")}
                  />
                ) : (
                  <FloatingInput label={t("Warehouse ID")} name="warehouseId" type="number" min={1} value={form.warehouseId} onChange={(e) => setField("warehouseId", e.target.value)} />
                )}

                <div className="sm:col-span-2">
                  <FloatingSelect
                    label={t("Delivery Address")}
                    name="deliveryAddressId"
                    value={form.deliveryAddressId}
                    onChange={(e) => setField("deliveryAddressId", e.target.value)}
                    options={addresses.map((a) => ({ id: a.id, name: `${addressLabel(a)}${a.defaultDelivery ? " (default)" : ""}` }))}
                    emptyOptionLabel={form.customerId ? (addresses.length ? "Not set" : "No saved addresses for this customer") : "Choose a customer first"}
                    disabled={!form.customerId}
                  />
                </div>

                <FloatingSelect
                  label={t("Vehicle")}
                  name="vehicleId"
                  value={form.vehicleId}
                  onChange={(e) => setField("vehicleId", e.target.value)}
                  options={lookups.vehicles.map((v) => ({ id: v.id, name: v.status ? `${v.licensePlate} · ${v.status}` : v.licensePlate }))}
                  emptyOptionLabel={t("Assign later")}
                />

                <FloatingSelect
                  label={t("Transporter")}
                  name="transporterId"
                  value={form.transporterId}
                  onChange={(e) => setField("transporterId", e.target.value)}
                  options={lookups.transporters.map((t) => ({ id: t.id, name: t.name }))}
                  emptyOptionLabel={t("Assign later")}
                />

                <div className="sm:col-span-2">
                  <FloatingTextarea label={t("Remarks")} name="remarks" value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} rows={2} />
                </div>
              </div>

              {/* ITEMS */}
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

                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      {lookups.products.length > 0 ? (
                        <select
                          value={item.productId}
                          onChange={(e) => setItem(index, { productId: e.target.value, productName: undefined })}
                          className="flex-1 min-w-0 p-2 border border-gray-300 rounded-lg text-sm bg-white"
                          aria-label={t("Product")}
                        >
                          <option value="">{t("Choose a product")}</option>
                          {/* Keep a product that is no longer in the catalogue list */}
                          {item.productId && !lookups.products.some((p) => String(p.id) === item.productId) && (
                            <option value={item.productId}>{lookups.productName(Number(item.productId), item.productName)}</option>
                          )}
                          {lookups.products.map((p) => (
                            <option key={p.id} value={p.id}>{p.productCode ? `${p.productName} (${p.productCode})` : p.productName}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          placeholder={t("Product ID")}
                          value={item.productId}
                          onChange={(e) => setItem(index, { productId: e.target.value })}
                          className="flex-1 min-w-0 p-2 border border-gray-300 rounded-lg text-sm"
                          aria-label={t("Product ID")}
                        />
                      )}
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity}
                        onChange={(e) => setItem(index, { quantity: e.target.value })}
                        className="w-24 p-2 border border-gray-300 rounded-lg text-sm"
                        aria-label={t("Quantity")}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                        className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-30"
                        title={t("Remove")}
                      >
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Order"}
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
                    <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                    {selected.deliveryOrderNumber}
                  </h2>
                  <div className="mt-2"><StatusBadge status={selected.status} /></div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Detail label={t("Customer")} value={lookups.customerName(selected.customerId, selected.customerName)} icon={<UserIcon className="h-4 w-4 text-slate-400" />} />
                <Detail label={t("Delivery Date")} value={formatDateTime(selected.deliveryDate)} icon={<CalendarIcon className="h-4 w-4 text-slate-400" />} />
                <Detail label={t("Sales Order")} value={selected.salesOrderId ? lookups.salesOrderLabel(selected.salesOrderId) : "-"} />
                {/* Holds the quantities in Sales; confirming the delivery note takes them out of stock */}
                {selected.salesOrderId ? (
                  <Detail label={t("Sales Dispatch")} value={selected.salesDispatchNumber
                    ? `${selected.salesDispatchNumber}${["DELIVERED", "PARTIAL"].includes(selected.status) ? " (confirmed)" : " (draft until the delivery note is confirmed)"}`
                    : "None: save the order to reserve its quantities"} />
                ) : null}
                <Detail label={t("Warehouse")} value={selected.warehouseId ? lookups.warehouseName(selected.warehouseId) : "-"} />
                <Detail label={t("Vehicle")} value={selected.vehiclePlate ?? "Not assigned"} icon={<TruckIcon className="h-4 w-4 text-slate-400" />} />
                <Detail label={t("Transporter")} value={selected.transporterName ?? "Not assigned"} />
                <div className="sm:col-span-2">
                  <Detail label={t("Delivery Address")} value={selected.deliveryAddress ?? "Not set"} icon={<MapPinIcon className="h-4 w-4 text-slate-400" />} />
                </div>
                {selected.remarks && (
                  <div className="sm:col-span-2">
                    <Detail label={t("Remarks")} value={selected.remarks} />
                  </div>
                )}
              </div>

              {selected.tracking && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{t("Latest update")}</p>
                  <p className="text-slate-700">
                    {statusConfig(selected.tracking.currentStatus).label}
                    {selected.tracking.remarks ? ` — ${selected.tracking.remarks}` : ""}
                  </p>
                  {selected.tracking.failureReason && <p className="text-red-600 text-xs mt-1">{t("Reason:")} {selected.tracking.failureReason}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDateTime(selected.tracking.statusUpdatedAt)}
                    {selected.tracking.updatedBy ? ` by ${selected.tracking.updatedBy}` : ""}
                  </p>
                </div>
              )}

              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <PackageIcon className="h-5 w-5 text-cyan-600" />
                  {t("Products")} ({selected.items?.length || 0})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selected.items?.map((item, index) => (
                    <div key={item.id ?? index} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                      <span className="font-medium text-slate-700">{lookups.productName(item.productId, item.productName)}</span>
                      <span className="text-slate-500">{t("Qty")} {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4 flex flex-wrap justify-end gap-2">
                {EDITABLE_ORDER_STATUSES.includes(selected.status) && (
                  canUpdate && <button onClick={() => openEdit(selected)} className="px-4 py-2 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 text-sm font-medium">
                    <PencilIcon className="h-4 w-4 inline mr-1" />
                    {t("Edit")}
                  </button>
                )}
                {nextStatuses(selected.status).length > 0 && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openStatus(selected);
                    }}
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium"
                  >
                    <ArrowRightLeftIcon className="h-4 w-4 inline mr-1" />
                    {t("Change Status")}
                  </button>
                )}
                {DELETABLE_ORDER_STATUSES.includes(selected.status) && (
                  canDelete && <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openDelete(selected);
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                  >
                    <TrashIcon className="h-4 w-4 inline mr-1" />
                    {t("Delete")}
                  </button>
                )}
              </div>

              {selected.createdDate && (
                <p className="mt-4 border-t pt-3 text-xs text-gray-400">{t("Created")} {formatDateTime(selected.createdDate)}</p>
              )}
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
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t("Delete Delivery Order")}</h3>
                  <p className="text-sm text-gray-500">
                    {t("Delete")} <span className="font-semibold text-gray-700">{selected.deliveryOrderNumber}</span> {t("for")}{" "}
                    {lookups.customerName(selected.customerId, selected.customerName)}?
                  </p>
                  <p className="text-xs text-red-500 mt-2">{t("This cannot be undone.")}</p>
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

        {/* ================= STATUS MODAL ================= */}
        {showStatusModal && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowRightLeftIcon className="h-6 w-6 text-purple-600" />
                {t("Change Status")}
              </h2>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{selected.deliveryOrderNumber}</span>
                <StatusBadge status={selected.status} />
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("New Status *")}</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as DeliveryStatus)}
                className="w-full p-2 mb-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {nextStatuses(selected.status).map((status) => (
                  <option key={status} value={status}>{statusConfig(status).label}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("Remarks")}</label>
              <textarea
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
                rows={2}
                placeholder={newStatus === "RETURNED" || newStatus === "CANCELLED" ? "Why? e.g. customer not available" : "Optional note for the tracking history"}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowStatusModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium" disabled={submitting}>
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  disabled={submitting || !newStatus}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t(submitting ? "Updating..." : "Update Status")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const Detail: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div>
    <label className="text-xs text-gray-500">{label}</label>
    <p className="font-medium text-slate-700 flex items-center gap-1.5">
      {icon}
      <span className="min-w-0 break-words">{value}</span>
    </p>
  </div>
);

export default DeliveryOrderPage;

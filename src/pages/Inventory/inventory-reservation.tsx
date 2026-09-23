import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  PencilIcon,
  ShoppingBagIcon,
  TrashIcon,
  UserIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type ReservationItem = {
  id?: number;
  productId: number;
  reservedQty: number;
  productName?: string;
  productCategory?: string;
};

type InventoryReservation = {
  id?: number;
  reservationNo: string;
  salesOrderId: number;
  warehouseId: number;
  status: "RESERVED" | "RELEASED" | "CONSUMED" | "CANCELLED" | "EXPIRED";
  reservationDate: string;
  items: ReservationItem[];
  customerId?: number;
  productId?: number;
  customerName?: string;
  productName?: string;
  productCategory?: string;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

type Product = {
  id: number;
  productId?: number;
  productName?: string;
  name?: string;
  productCode?: string;
  code?: string;
  categoryName?: string;
  productType?: string;
};

type Customer = {
  id: number;
  customerName?: string;
  tradeName?: string;
  email?: string;
};

type SalesOrder = {
  id: number;
  customerId: number;
  orderNumber?: string;
};

type InventoryForm = {
  salesOrderId: string;
  warehouseId: string;
  status: string;
  reservationDate: string;
  productId: string;
  reservedQty: string;
};

const API_URL = "/v1/api/inventory/inventory-reservations";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/purchase/products";
const CUSTOMER_API_URL = "/v1/api/crm/customers";
const SALES_ORDER_API_URL = "/v1/api/sales/sales-orders";
const ENUM_API_URL = "/v1/api/inventory/enums";
const PAGE_SIZE = 10;

// 🔧 Route paths — match your app's actual routes.
const PRODUCT_ROUTE = "/purchase-products";
const WAREHOUSE_ROUTE = "/warehouse";
const CUSTOMERS_PAGE_PATH = "/customer-management";
const SALES_ORDERS_ROUTE = "/sales-orders";

const USER_SELECTABLE_STATUSES = ["RESERVED", "RELEASED", "CONSUMED", "CANCELLED"];
const ALL_STATUSES = ["RESERVED", "RELEASED", "CONSUMED", "CANCELLED", "EXPIRED"];

const emptyForm: InventoryForm = {
  salesOrderId: "",
  warehouseId: "",
  status: "",
  reservationDate: new Date().toISOString().split("T")[0],
  productId: "",
  reservedQty: "",
};

function toNumber(value: string | number | undefined | null): number {
  return Number(value || 0);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function getCustomerName(customer: Customer | undefined): string {
  if (!customer) return "--";
  return customer.customerName || customer.tradeName || `Customer #${customer.id}`;
}

const InventoryReservationManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"release" | "consume" | null>(null);

  const [statusOptions, setStatusOptions] = useState<string[]>(USER_SELECTABLE_STATUSES);
  const [enumLoading, setEnumLoading] = useState(false);

  useEffect(() => {
    fetchEnums();
    fetchReservations();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEnums = async (): Promise<void> => {
    try {
      setEnumLoading(true);
      const response = await axios.get(`${ENUM_API_URL}?type=RESERVATION_STATUS`, { headers });
      const data = Array.isArray(response.data) ? response.data : [];

      const codes = data
        .map((item: any) => {
          if (typeof item === "string") return item;
          return item.code || item;
        })
        .filter(Boolean) as string[];

      const userSelectable = codes.filter((code) => code !== "EXPIRED");
      setStatusOptions(userSelectable.length > 0 ? userSelectable : USER_SELECTABLE_STATUSES);

      setForm((prev) => ({
        ...prev,
        status: userSelectable.length > 0 ? userSelectable[0] : USER_SELECTABLE_STATUSES[0],
      }));
    } catch (error) {
      console.warn("Failed to fetch reservation status, using fallback");
      setStatusOptions(USER_SELECTABLE_STATUSES);
    } finally {
      setEnumLoading(false);
    }
  };

  const fetchDropdowns = async (): Promise<void> => {
    try {
      const [warehouseRes, productRes, customerRes, salesOrderRes] = await Promise.all([
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
        axios.get<Product[]>(PRODUCT_API_URL, { headers }),
        axios.get<Customer[]>(CUSTOMER_API_URL, { headers }),
        axios.get<SalesOrder[]>(SALES_ORDER_API_URL, { headers }),
      ]);

      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
      setCustomers(Array.isArray(customerRes.data) ? customerRes.data : []);
      setSalesOrders(Array.isArray(salesOrderRes.data) ? salesOrderRes.data : []);
    } catch (error) {
      ToasterService.error("Failed to load dropdown data", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchReservations = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryReservation[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];

      // Only enrich self-contained fields (items-based). Customer / order
      // resolution is done at RENDER time — see getReservationCustomer() —
      // so the values update as soon as customers/salesOrders finish loading.
      const enrichedData = data.map((reservation) => {
        const firstItem = reservation.items?.[0];
        return {
          ...reservation,
          productId: firstItem?.productId || 0,
          productName: firstItem?.productName || `Product #${firstItem?.productId || "Unknown"}`,
          productCategory: firstItem?.productCategory || "",
          reservedQty: reservation.items?.[0]?.reservedQty || 0,
        };
      });

      setReservations(enrichedData);
    } catch (error) {
      setReservations([]);
      ToasterService.error("Failed to load reservations", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (): void => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      status: statusOptions[0] || "RESERVED",
    });
    setShowFormModal(true);
  };

  const closeForm = (): void => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openEdit = (reservation: InventoryReservation): void => {
    setEditingId(reservation.id || null);
    setForm({
      salesOrderId: String(reservation.salesOrderId || ""),
      warehouseId: String(reservation.warehouseId || ""),
      status: reservation.status || statusOptions[0] || "RESERVED",
      reservationDate: reservation.reservationDate || emptyForm.reservationDate,
      productId: String(reservation.items?.[0]?.productId || ""),
      reservedQty: String(reservation.items?.[0]?.reservedQty || ""),
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildCreatePayload = () => ({
    salesOrderId: toNumber(form.salesOrderId),
    warehouseId: toNumber(form.warehouseId),
    status: form.status,
    reservationDate: form.reservationDate,
    items: [
      {
        productId: toNumber(form.productId),
        reservedQty: toNumber(form.reservedQty),
      },
    ],
  });

  const buildUpdatePayload = () => ({
    id: editingId || 0,
    salesOrderId: toNumber(form.salesOrderId),
    warehouseId: toNumber(form.warehouseId),
    status: form.status,
    reservationDate: form.reservationDate,
    items: [
      {
        id: 0,
        productId: toNumber(form.productId),
        reservedQty: toNumber(form.reservedQty),
      },
    ],
  });

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!form.salesOrderId || toNumber(form.salesOrderId) <= 0) {
      ToasterService.error("Sales Order ID is required");
      return;
    }
    if (!form.warehouseId || toNumber(form.warehouseId) <= 0) {
      ToasterService.error("Please select a warehouse");
      return;
    }
    if (!form.productId || toNumber(form.productId) <= 0) {
      ToasterService.error("Please select a product");
      return;
    }
    if (!form.reservedQty || toNumber(form.reservedQty) <= 0) {
      ToasterService.error("Reserved quantity is required");
      return;
    }

    try {
      setSubmitting(true);
      const payload = editingId ? buildUpdatePayload() : buildCreatePayload();

      if (editingId) {
        await axios.put(`${API_URL}/update`, payload, { headers });
        ToasterService.success("Reservation updated successfully");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Reservation created successfully");
      }

      closeForm();
      await fetchReservations();
    } catch (error) {
      ToasterService.error("Failed to save reservation", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async (): Promise<void> => {
    if (!actionId) return;

    try {
      setSubmitting(true);
      await axios.put(`${API_URL}/${actionId}/release`, {}, { headers });
      ToasterService.success("Reservation released successfully");
      setActionId(null);
      setActionType(null);
      await fetchReservations();
    } catch (error) {
      ToasterService.error("Failed to release reservation", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsume = async (): Promise<void> => {
    if (!actionId) return;

    try {
      setSubmitting(true);
      await axios.put(`${API_URL}/${actionId}/consume`, {}, { headers });
      ToasterService.success("Reservation consumed successfully");
      setActionId(null);
      setActionType(null);
      await fetchReservations();
    } catch (error) {
      ToasterService.error("Failed to consume reservation", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteId) return;

    try {
      setSubmitting(true);
      await axios.delete(`${API_URL}/${deleteId}?cascade=true`, { headers });
      ToasterService.success("Reservation deleted successfully");
      setDeleteId(null);
      await fetchReservations();
    } catch (error) {
      ToasterService.error("Failed to delete reservation", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: reservations.length,
      reserved: reservations.filter((r) => r.status === "RESERVED").length,
      released: reservations.filter((r) => r.status === "RELEASED").length,
      consumed: reservations.filter((r) => r.status === "CONSUMED").length,
      cancelled: reservations.filter((r) => r.status === "CANCELLED").length,
    }),
    [reservations]
  );

  const canDelete = (status: string) =>
    status === "RESERVED" || status === "CANCELLED" || status === "EXPIRED";
  const canRelease = (status: string) => status === "RESERVED";
  const canConsume = (status: string) => status === "RESERVED";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESERVED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "RELEASED":
        return "bg-green-100 text-green-700 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "CONSUMED":
        return "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300";
      case "CANCELLED":
        return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
      case "EXPIRED":
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RESERVED":
        return <ClockIcon className="h-4 w-4" />;
      case "RELEASED":
        return <CheckCircleIcon className="h-4 w-4" />;
      case "CONSUMED":
        return <CheckCircleIcon className="h-4 w-4" />;
      case "CANCELLED":
        return <XCircleIcon className="h-4 w-4" />;
      case "EXPIRED":
        return <XCircleIcon className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // =====================================================================
  // FIX: resolve customer / order labels at RENDER time.
  // This runs on every render, so as soon as `customers` and `salesOrders`
  // finish loading, the labels update automatically — no race condition.
  // =====================================================================
  const getReservationOrder = (reservation: InventoryReservation) =>
    salesOrders.find((o) => Number(o.id) === Number(reservation.salesOrderId));

  const getReservationCustomer = (reservation: InventoryReservation) => {
    // 1. Direct customerId on the reservation
    if (reservation.customerId) {
      const direct = customers.find(
        (c) => Number(c.id) === Number(reservation.customerId)
      );
      if (direct) return direct;
    }

    // 2. salesOrderId → order.customerId → customer
    const order = getReservationOrder(reservation);
    if (order?.customerId) {
      const viaOrder = customers.find(
        (c) => Number(c.id) === Number(order.customerId)
      );
      if (viaOrder) return viaOrder;
    }

    return undefined;
  };

  const getReservationCustomerName = (reservation: InventoryReservation) => {
    const customer = getReservationCustomer(reservation);
    if (customer) return getCustomerName(customer);

    // Fallback — try the order number, then last-resort IDs
    const order = getReservationOrder(reservation);
    if (order?.orderNumber) return order.orderNumber;
    if (order?.id) return `Order #${order.id}`;
    if (reservation.salesOrderId) return `Order #${reservation.salesOrderId}`;
    return "Unknown customer";
  };

  const getReservationCustomerId = (reservation: InventoryReservation) => {
    const customer = getReservationCustomer(reservation);
    return customer?.id;
  };

  // ---------- Navigation helpers ----------
  const goToProduct = (productId?: number, productName?: string) => {
    if (!productId) return;
    navigate(
      `${PRODUCT_ROUTE}?productId=${productId}&productName=${encodeURIComponent(
        productName || `Product #${productId}`
      )}`
    );
  };

  const goToWarehouse = (warehouseId?: number, warehouseName?: string) => {
    if (!warehouseId) return;
    navigate(
      `${WAREHOUSE_ROUTE}?warehouseId=${warehouseId}&warehouseName=${encodeURIComponent(
        warehouseName || `Warehouse #${warehouseId}`
      )}`
    );
  };

  const goToCustomer = (reservation: InventoryReservation) => {
    const customerId = getReservationCustomerId(reservation);
    if (!customerId) return;
    const name = getReservationCustomerName(reservation);
    navigate(
      `${CUSTOMERS_PAGE_PATH}?customerIds=${customerId}&customerName=${encodeURIComponent(name)}`
    );
  };

  const goToSalesOrder = (orderId?: number) => {
    if (!orderId) return;
    navigate(`${SALES_ORDERS_ROUTE}?orderId=${orderId}`);
  };

  // ---------- Row details renderer ----------
  const renderReservationDetails = (reservation: InventoryReservation) => {
    const warehouse = warehouses.find((w) => Number(w.id) === Number(reservation.warehouseId));
    const customer = getReservationCustomer(reservation);
    const customerId = customer?.id;
    const customerName = getReservationCustomerName(reservation);

    const Field = ({
      label,
      children,
      full,
    }: {
      label: string;
      children: React.ReactNode;
      full?: boolean;
    }) => (
      <div
        className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 ${
          full ? "col-span-2" : ""
        }`}
      >
        <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
          {children}
        </div>
      </div>
    );

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reservation No">{reservation.reservationNo || "--"}</Field>
          <Field label="Reservation ID">#{reservation.id}</Field>

          <Field label="Customer" full>
            {customerId ? (
              <button
                type="button"
                onClick={() => goToCustomer(reservation)}
                className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                {customerName}
              </button>
            ) : (
              <span>{customerName}</span>
            )}
          </Field>

          <Field label="Sales Order">
            {reservation.salesOrderId ? (
              <button
                type="button"
                onClick={() => goToSalesOrder(reservation.salesOrderId)}
                className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                #{reservation.salesOrderId}
              </button>
            ) : (
              <span>--</span>
            )}
          </Field>

          <Field label="Warehouse">
            {reservation.warehouseId ? (
              <button
                type="button"
                onClick={() => goToWarehouse(reservation.warehouseId, warehouse?.name)}
                className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                {warehouse?.name || `Warehouse #${reservation.warehouseId}`}
              </button>
            ) : (
              <span>--</span>
            )}
          </Field>

          <Field label="Status" full>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(
                reservation.status
              )}`}
            >
              {getStatusIcon(reservation.status)}
              {reservation.status}
            </span>
          </Field>

          <Field label="Reservation Date">
            {reservation.reservationDate || "--"}
          </Field>
          <Field label="Total Items">{reservation.items?.length || 0}</Field>
        </div>

        {/* Items list */}
        {reservation.items && reservation.items.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
              Items
            </div>
            <div className="space-y-2">
              {reservation.items.map((item, idx) => (
                <div
                  key={item.id ?? idx}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => goToProduct(item.productId, item.productName)}
                    className="text-left text-sm font-medium text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                  >
                    {item.productName || `Product #${item.productId}`}
                  </button>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Qty: {item.reservedQty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const columns: ColumnDef<InventoryReservation>[] = [
    {
      key: "reservationNo",
      label: "Reservation No",
      sortable: true,
      render: (reservation) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40">
            <ClockIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {reservation.reservationNo}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              ID: #{reservation.id}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      // Sort by the resolved name, not the raw field
      sortValueGetter: (reservation) => getReservationCustomerName(reservation),
      render: (reservation) => {
        const customerId = getReservationCustomerId(reservation);
        const customerName = getReservationCustomerName(reservation);
        return (
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-400"
            onClick={(e) => {
              e.stopPropagation();
              if (customerId) goToCustomer(reservation);
            }}
            title={customerId ? `View ${customerName}` : customerName}
          >
            <UserIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>{customerName}</span>
          </button>
        );
      },
    },
    {
      key: "productName",
      label: "Product",
      sortable: true,
      render: (reservation) => (
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-400"
          onClick={(e) => {
            e.stopPropagation();
            goToProduct(reservation.productId, reservation.productName);
          }}
        >
          <CubeIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <div className="text-left">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {reservation.productName || "--"}
            </p>
            {reservation.productCategory && reservation.productCategory !== "--" && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {reservation.productCategory}
              </p>
            )}
          </div>
        </button>
      ),
    },
    {
      key: "salesOrderId",
      label: "Sales Order",
      sortable: true,
      render: (reservation) => {
        const orderId = reservation.salesOrderId;
        const order = getReservationOrder(reservation);
        const label = order?.orderNumber ? order.orderNumber : `#${orderId || "--"}`;
        return (
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-cyan-600 transition-colors hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            onClick={(e) => {
              e.stopPropagation();
              goToSalesOrder(orderId);
            }}
          >
            <ShoppingBagIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>{label}</span>
          </button>
        );
      },
    },
    {
      key: "warehouseId",
      label: "Warehouse",
      sortable: true,
      render: (reservation) => {
        const warehouse = warehouses.find(
          (w) => Number(w.id) === Number(reservation.warehouseId)
        );
        const warehouseId = reservation.warehouseId;
        return (
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-400"
            onClick={(e) => {
              e.stopPropagation();
              goToWarehouse(warehouseId, warehouse?.name);
            }}
          >
            <BuildingOffice2Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>
              {warehouse?.name ||
                (reservation.warehouseId ? `#${reservation.warehouseId}` : "N/A")}
            </span>
          </button>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (reservation) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
            reservation.status
          )}`}
        >
          {getStatusIcon(reservation.status)}
          {reservation.status}
        </span>
      ),
    },
    {
      key: "reservedQty",
      label: "Qty",
      sortable: true,
      render: (reservation) => (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {reservation.items?.[0]?.reservedQty || 0}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (reservation) => (
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEdit(reservation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </button>

          {canRelease(reservation.status) && (
            <button
              type="button"
              onClick={() => {
                setActionId(reservation.id || null);
                setActionType("release");
              }}
              className="rounded-lg p-1.5 text-green-600 transition hover:bg-green-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              title="Release"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          )}

          {canConsume(reservation.status) && (
            <button
              type="button"
              onClick={() => {
                setActionId(reservation.id || null);
                setActionType("consume");
              }}
              className="rounded-lg p-1.5 text-purple-600 transition hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40"
              title="Consume"
            >
              <CheckCircleIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (canDelete(reservation.status)) {
                setDeleteId(reservation.id || null);
              } else {
                ToasterService.warning(
                  `Cannot delete ${reservation.status} reservation. Only RESERVED, CANCELLED or EXPIRED can be deleted.`
                );
              }
            }}
            className={`rounded-lg p-1.5 transition ${
              canDelete(reservation.status)
                ? "text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                : "cursor-not-allowed text-gray-300 dark:text-slate-600"
            }`}
            title={canDelete(reservation.status) ? "Delete" : "Cannot delete"}
            disabled={!canDelete(reservation.status)}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Inventory Reservations" description="Manage inventory reservations" />
      <PageBreadcrumb
        pageTitle="Inventory Reservations"
        actions={<AddButton onClick={openCreate} label="Add Reservation" />}
      />

      <div className="w-full max-w-none space-y-6 px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Reservations"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<ClockIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="RESERVED"
            value={stats.reserved}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<ClockIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="RELEASED"
            value={stats.released}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="CONSUMED / CANCELLED"
            value={stats.consumed + stats.cancelled}
            gradient="from-gray-50 to-red-50"
            borderColor="border-gray-100"
            labelColor="text-gray-600"
            icon={<CheckCircleIcon className="h-5 w-5" />}
          />
        </div>

        <ReusableTable
          data={reservations}
          columns={columns}
          loading={loading || enumLoading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          enableRowDetails={true}
          rowDetailsTitle="Reservation Details"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClockIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                No reservations found
              </p>
              <button
                type="button"
                onClick={() => fetchReservations()}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reload all reservations
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Reservation" : "Create Reservation"}
        subtitle="Reserve stock for a customer order"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Reservation" : "Create Reservation"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Reservation Details",
            fields: [
              <FloatingSelect
                key="salesOrderId"
                label="Sales Order ID"
                name="salesOrderId"
                value={form.salesOrderId}
                onChange={handleChange}
                emptyOptionLabel="Select sales order"
                options={salesOrders.map((order) => ({
                  id: String(order.id),
                  name: `#${order.id} - ${order.orderNumber || "Order"}`,
                }))}
                required
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                emptyOptionLabel="Select warehouse"
                options={warehouses.map((w) => ({
                  id: String(w.id),
                  name: w.name || w.code || `Warehouse #${w.id}`,
                }))}
                required
              />,
              <FloatingSelect
                key="status"
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                includeEmptyOption={false}
                options={statusOptions.map((status) => ({
                  id: status,
                  name: status,
                }))}
              />,
              <FloatingInput
                key="reservationDate"
                label="Reservation Date"
                name="reservationDate"
                type="date"
                value={form.reservationDate}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="productId"
                label="Product"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                emptyOptionLabel="Select product"
                options={products.map((p) => ({
                  id: String(p.id),
                  name: p.productName || p.name || `Product #${p.id}`,
                }))}
                required
              />,
              <FloatingInput
                key="reservedQty"
                label="Reserved Quantity"
                name="reservedQty"
                type="number"
                min={1}
                value={form.reservedQty}
                onChange={handleChange}
                required
              />,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!actionId}
        setIsPopupOpen={(open) => {
          if (!open) {
            setActionId(null);
            setActionType(null);
          }
        }}
        icon={
          actionType === "consume" ? (
            <CheckCircleIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          ) : (
            <ArrowPathIcon className="h-6 w-6 text-green-600 dark:text-emerald-400" />
          )
        }
        iconBg={
          actionType === "consume"
            ? "bg-purple-100 dark:bg-purple-950/40"
            : "bg-green-100 dark:bg-emerald-950/40"
        }
        innerText={actionType === "consume" ? "Consume Reservation" : "Release Reservation"}
        subText={
          actionType === "consume"
            ? "Are you sure you want to consume this reservation? Items will be marked as shipped."
            : "Are you sure you want to release this reservation? Items will be available again."
        }
        confirmLabel={actionType === "consume" ? "Consume" : "Release"}
        cancelLabel="Cancel"
        onConfirm={actionType === "consume" ? handleConsume : handleRelease}
        confirmBtnClass={
          actionType === "consume"
            ? "bg-purple-600 hover:bg-purple-700 text-white"
            : "bg-green-600 hover:bg-green-700 text-white"
        }
      />

      <DynamicPopup
        isPopupOpen={!!deleteId}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteId(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-100 dark:bg-red-950/40"
        innerText="Delete Reservation"
        subText="Are you sure you want to delete this reservation?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default InventoryReservationManager;
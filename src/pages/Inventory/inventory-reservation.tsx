import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  PencilSquareIcon as PencilIcon,
  ShoppingBagIcon,
  TrashIcon,
  UserIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { formatDate } from "../../company/format";
import { ListingPdfExportButton } from "../../components/common/export";

/**
 * Inventory Reservations
 * Reservations are created automatically when a sales order is created, so this
 * page has no Add or Edit. The only actions are Release, Consume and Delete.
 */

type ReservationItem = {
  id?: number;
  productId: number;
  reservedQty: number;
  requestedQty?: number;
  consumedQty?: number;
  productName?: string;
  productCategory?: string;
};

type ReservationStatus =
  | "DRAFT"
  | "RESERVED"
  | "PARTIALLY_RESERVED"
  | "RELEASED"
  | "CONSUMED"
  | "CANCELLED"
  | "EXPIRED";

type InventoryReservation = {
  id?: number;
  reservationNo: string;
  referenceType?: string;
  referenceNumber?: string;
  salesOrderId: number;
  warehouseId: number;
  warehouse?: string;
  releasedAt?: string | null;
  reservedQty?: number;
  status: ReservationStatus;
  reservationDate: string;
  items: ReservationItem[];
  customerId?: number;
  productId?: number;
  customerName?: string;
  productName?: string;
  productCategory?: string;
};

type Warehouse = { id: number; code: string; name: string };

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
  salesOrderNumber?: string;
  orderNo?: string;
  soNumber?: string;
};

const API_URL = "/v1/api/inventory/inventory-reservations";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
// Products live in the product catalogue (the purchase service no longer serves them)
const PRODUCT_API_URL = "/v1/api/common/products";
const CUSTOMER_API_URL = "/v1/api/common/customers";
const SALES_ORDER_API_URL = "/v1/api/sales/sales-orders";
const PAGE_SIZE = 10;

const PRODUCT_ROUTE = "/purchase-products";
const WAREHOUSE_ROUTE = "/warehouse";
const CUSTOMERS_PAGE_PATH = "/customer-management";
const SALES_ORDERS_ROUTE = "/sales-orders";

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

// The API returns UTC timestamps without "Z", so mark them as UTC; otherwise
// "Released At" shows 5:30 hours behind in IST.
const SERVER_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
function toUtc(value?: string | null) {
  return value && SERVER_TS.test(value) ? value.replace(/(\.\d{3})\d+$/, "$1") + "Z" : value;
}

function getProductLabel(product?: Product) {
  return product?.productName || product?.name || "";
}

function getOrderNumber(order?: SalesOrder) {
  return (
    order?.orderNumber || order?.salesOrderNumber || order?.orderNo || order?.soNumber || ""
  ).trim();
}

function getCustomerName(customer: Customer | undefined): string {
  if (!customer) return "--";
  return customer.customerName || customer.tradeName || "Unknown customer";
}

const InventoryReservationManager: React.FC = () => {
  const { canUpdate, canDelete: canDeleteReservations } = usePermissions();
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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"release" | "consume" | null>(null);

  useEffect(() => {
    fetchReservations();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sales order number for display. Never shows the raw id or a made-up number.
  const getSalesOrderDisplayById = (orderId?: number | null) => {
    if (!orderId) return "--";
    const order = salesOrders.find((o) => Number(o.id) === Number(orderId));
    return getOrderNumber(order) || "Sales Order";
  };

  const fetchDropdowns = async (): Promise<void> => {
    try {
      const [warehouseRes, productRes, customerRes, salesOrderRes] = await Promise.all([
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
        axios.get<Product[]>(PRODUCT_API_URL, { headers }),
        axios.get<Customer[]>(CUSTOMER_API_URL, { headers }),
        axios.get<SalesOrder[]>(SALES_ORDER_API_URL, { headers }),
      ]);

      setWarehouses(
        Array.isArray(warehouseRes.data)
          ? warehouseRes.data
          : (warehouseRes.data as any)?.content || (warehouseRes.data as any)?.data || []
      );
      setProducts(
        Array.isArray(productRes.data)
          ? productRes.data
          : (productRes.data as any)?.content || (productRes.data as any)?.data || []
      );
      setCustomers(
        Array.isArray(customerRes.data)
          ? customerRes.data
          : (customerRes.data as any)?.content || (customerRes.data as any)?.data || []
      );
      setSalesOrders(
        Array.isArray(salesOrderRes.data)
          ? salesOrderRes.data
          : (salesOrderRes.data as any)?.content || (salesOrderRes.data as any)?.data || []
      );
    } catch (error) {
      ToasterService.error("Failed to load dropdown data", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchReservations = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryReservation[]>(API_URL, { headers });
      const data = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.content || (response.data as any)?.data || [];

      // Names are filled in by `rows` below, once products/warehouses/orders load.
      setReservations(data);
    } catch (error) {
      setReservations([]);
      ToasterService.error("Failed to load reservations", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
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
      // NOTE: DELETE is not in the confirmed endpoint list either — same
      // caveat as `/update` above. Left as-is; confirm with backend.
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

  // The items only carry productId, and the reservation only carries
  // warehouseId / salesOrderId, so resolve readable values here. This runs again
  // when the lookups finish loading, so names never get stuck as ids.
  const rows = useMemo(
    () =>
      reservations.map((reservation) => {
        const firstItem = reservation.items?.[0];
        const warehouse = warehouses.find((w) => Number(w.id) === Number(reservation.warehouseId));
        const order = salesOrders.find((o) => Number(o.id) === Number(reservation.salesOrderId));
        const items = (reservation.items || []).map((item) => {
          const itemProduct = products.find(
            (p) => Number(p.id) === Number(item.productId) || Number(p.productId) === Number(item.productId)
          );
          return {
            ...item,
            productName: getProductLabel(itemProduct) || item.productName || "Unknown product",
            productCategory: itemProduct?.categoryName || item.productCategory || "",
          };
        });
        return {
          ...reservation,
          items,
          productId: firstItem?.productId || 0,
          productName: items[0]?.productName || "Unknown product",
          productCategory: items[0]?.productCategory || "",
          reservedQty: Number(firstItem?.reservedQty ?? 0),
          warehouse: warehouse ? warehouse.name || warehouse.code : "--",
          // Newer reservations store the sales order id ("3") here; show the
          // order number instead when we can find the order.
          referenceNumber: getOrderNumber(order) || reservation.referenceNumber || "--",
          releasedAt: toUtc(reservation.releasedAt) ?? reservation.releasedAt,
        };
      }),
    [reservations, products, warehouses, salesOrders]
  );

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
    status === "DRAFT" || status === "RESERVED" || status === "CANCELLED" || status === "EXPIRED";
  const canRelease = (status: string) => status === "RESERVED" || status === "PARTIALLY_RESERVED";
  const canConsume = (status: string) => status === "RESERVED" || status === "PARTIALLY_RESERVED";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      case "RESERVED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "PARTIALLY_RESERVED":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
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
      case "DRAFT":
        return <PencilIcon className="h-4 w-4" />;
      case "RESERVED":
        return <ClockIcon className="h-4 w-4" />;
      case "PARTIALLY_RESERVED":
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
  // Render-time resolvers (no raw ids shown)
  // =====================================================================
  const getReservationOrder = (reservation: InventoryReservation) =>
    salesOrders.find((o) => Number(o.id) === Number(reservation.salesOrderId));

  const getReservationCustomer = (reservation: InventoryReservation) => {
    if (reservation.customerId) {
      const direct = customers.find((c) => Number(c.id) === Number(reservation.customerId));
      if (direct) return direct;
    }
    const order = getReservationOrder(reservation);
    if (order?.customerId) {
      const viaOrder = customers.find((c) => Number(c.id) === Number(order.customerId));
      if (viaOrder) return viaOrder;
    }
    return undefined;
  };

  const getReservationCustomerName = (reservation: InventoryReservation) => {
    const customer = getReservationCustomer(reservation);
    if (customer) return getCustomerName(customer);
    // No order-id fallback — that showed "#77". Just say unknown.
    return "Unknown customer";
  };

  const getReservationCustomerId = (reservation: InventoryReservation) =>
    getReservationCustomer(reservation)?.id;

  // ---------- Navigation ----------
  const goToProduct = (productId?: number, productName?: string) => {
    if (!productId) return;
    navigate(
      `${PRODUCT_ROUTE}?productId=${productId}&productName=${encodeURIComponent(
        productName || ""
      )}`
    );
  };

  const goToWarehouse = (warehouseId?: number, warehouseName?: string) => {
    if (!warehouseId) return;
    navigate(
      `${WAREHOUSE_ROUTE}?warehouseId=${warehouseId}&warehouseName=${encodeURIComponent(
        warehouseName || ""
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
    // URL still uses id (that's fine — it's the routing param, not display).
    navigate(`${SALES_ORDERS_ROUTE}?orderId=${orderId}`);
  };

  // ---------- Row details ----------
  const renderReservationDetails = (reservation: InventoryReservation) => {
    const warehouse = warehouses.find((w) => Number(w.id) === Number(reservation.warehouseId));
    const customerId = getReservationCustomerId(reservation);
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
          <Field label="Reservation No" full>
            {reservation.reservationNo || "--"}
          </Field>

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
                {getSalesOrderDisplayById(reservation.salesOrderId)}
              </button>
            ) : (
              <span>—</span>
            )}
          </Field>

          <Field label="Warehouse">
            {reservation.warehouseId ? (
              <button
                type="button"
                onClick={() => goToWarehouse(reservation.warehouseId, warehouse?.name)}
                className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                {warehouse?.name || warehouse?.code || "--"}
              </button>
            ) : (
              <span>—</span>
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
                    {item.productName || "Unknown product"}
                  </button>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Qty: {Number(item.reservedQty ?? 0)}
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
            <p className="whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-white">
              {reservation.reservationNo}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      sortValueGetter: (reservation) => getReservationCustomerName(reservation),
      render: (reservation) => {
        const customerId = getReservationCustomerId(reservation);
        const customerName = getReservationCustomerName(reservation);
        return (
          <button
            type="button"
            className="flex max-w-[180px] items-center gap-2 text-left text-sm text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-400"
            onClick={(e) => {
              e.stopPropagation();
              if (customerId) goToCustomer(reservation);
            }}
            title={customerId ? `View ${customerName}` : customerName}
          >
            <UserIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{customerName}</span>
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
          className="flex max-w-[200px] items-center gap-2 text-left text-sm text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-400"
          onClick={(e) => {
            e.stopPropagation();
            goToProduct(reservation.productId, reservation.productName);
          }}
          title={reservation.productName}
        >
          <CubeIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm text-slate-700 dark:text-slate-300">
              {reservation.productName || "--"}
            </p>
            {reservation.productCategory && reservation.productCategory !== "--" && (
              <p className="truncate text-xs text-slate-400 dark:text-slate-500">
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
      sortValueGetter: (reservation) => getSalesOrderDisplayById(reservation.salesOrderId),
      render: (reservation) => {
        const orderId = reservation.salesOrderId;
        const label = getSalesOrderDisplayById(orderId);
        if (!orderId) {
          return <span className="text-sm text-slate-400 dark:text-slate-500">--</span>;
        }
        return (
          <button
            type="button"
            className="flex max-w-[220px] items-center gap-2 text-left text-sm text-cyan-600 transition-colors hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            onClick={(e) => {
              e.stopPropagation();
              goToSalesOrder(orderId);
            }}
            title={label}
          >
            <ShoppingBagIcon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{label}</span>
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
            className="flex max-w-[200px] items-center gap-2 text-left text-sm text-slate-700 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-300 dark:hover:text-cyan-400"
            onClick={(e) => {
              e.stopPropagation();
              goToWarehouse(warehouseId, warehouse?.name);
            }}
            title={warehouse?.name}
          >
            <BuildingOffice2Icon className="h-4 w-4 flex-shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{warehouse?.name || warehouse?.code || "--"}</span>
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
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
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
          {Number(reservation.items?.[0]?.reservedQty ?? 0)}
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
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {/* No edit: changing a reservation would re-lock stock. Release it and reserve again. */}
          {canRelease(reservation.status) && (
            canUpdate && <button
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
            canUpdate && <button
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

          {canDeleteReservations && <button
            type="button"
            onClick={() => {
              if (canDelete(reservation.status)) {
                setDeleteId(reservation.id || null);
              } else {
                ToasterService.warning(
                  `Cannot delete ${reservation.status} reservation. Only DRAFT, RESERVED, CANCELLED or EXPIRED can be deleted.`
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
          </button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Inventory Reservations" description="Manage inventory reservations" />
      <PageBreadcrumb pageTitle="Inventory Reservations" />

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

        {/* CORRECTED: PDF export added — previously missing entirely. */}
        <div className="mb-4 flex items-center justify-end">
          <ListingPdfExportButton
            title="Inventory Reservations"
            subtitle="Current inventory reservations listing"
            reportLabel="Inventory Reservations Report"
            data={reservations}
            fileName="Inventory_Reservations"
            disabled={loading}
            columns={[
              { header: "Reservation No", accessor: (row) => row.reservationNo || "-" },
              { header: "Customer", accessor: (row) => getReservationCustomerName(row) },
              { header: "Product", accessor: (row) => row.productName || "-" },
              {
                header: "Sales Order",
                accessor: (row) => getSalesOrderDisplayById(row.salesOrderId),
              },
              {
                header: "Warehouse",
                accessor: (row) =>
                  warehouses.find((w) => Number(w.id) === Number(row.warehouseId))?.name ||
                  `Warehouse #${row.warehouseId}`,
              },
              { header: "Status", accessor: (row) => row.status },
              {
                header: "Quantity",
                accessor: (row) => String(row.items?.[0]?.reservedQty || 0),
              },
              {
                header: "Reservation Date",
                accessor: (row) =>
                  row.reservationDate ? formatDate(row.reservationDate) : "-",
              },
            ]}
            metadata={(rows) => [
              { label: "Total Reservations", value: rows.length },
              { label: "Reserved", value: rows.filter((r) => r.status === "RESERVED").length },
              { label: "Released", value: rows.filter((r) => r.status === "RELEASED").length },
              {
                label: "Consumed / Cancelled",
                value: rows.filter((r) => r.status === "CONSUMED" || r.status === "CANCELLED").length,
              },
            ]}
          />
        </div>

        <ReusableTable
          data={rows}
          columns={columns}
          loading={loading}
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
        onCancel={() => {
          setActionId(null);
          setActionType(null);
        }}
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

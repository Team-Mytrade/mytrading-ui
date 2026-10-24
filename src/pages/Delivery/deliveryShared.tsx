import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  CheckCircleIcon,
  ClockIcon,
  PackageIcon,
  RotateCcwIcon,
  ThumbsUpIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react";
import { listOf } from "../Dashboard/dashboardKit";

// Shared by the delivery order, delivery note and delivery status pages. Shapes follow the
// delivery-service DTOs.

export const DELIVERY_API = "/v1/api/delivery";

/* ================= Statuses ================= */

export type DeliveryStatus =
  | "PENDING" | "CONFIRMED" | "IN_TRANSIT" | "PARTIAL" | "DELIVERED" | "RETURNED" | "CANCELLED";

export const DELIVERY_STATUSES: DeliveryStatus[] =
  ["PENDING", "CONFIRMED", "IN_TRANSIT", "PARTIAL", "DELIVERED", "RETURNED", "CANCELLED"];

export const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; className: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending", className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: <ClockIcon className="h-3 w-3" /> },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200", icon: <ThumbsUpIcon className="h-3 w-3" /> },
  IN_TRANSIT: { label: "In Transit", className: "bg-purple-50 text-purple-700 border-purple-200", icon: <TruckIcon className="h-3 w-3" /> },
  PARTIAL: { label: "Partially Delivered", className: "bg-amber-50 text-amber-700 border-amber-200", icon: <PackageIcon className="h-3 w-3" /> },
  DELIVERED: { label: "Delivered", className: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircleIcon className="h-3 w-3" /> },
  RETURNED: { label: "Returned", className: "bg-orange-50 text-orange-700 border-orange-200", icon: <RotateCcwIcon className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200", icon: <XCircleIcon className="h-3 w-3" /> },
};

export const statusConfig = (status?: string) =>
  DELIVERY_STATUS_CONFIG[(status ?? "PENDING") as DeliveryStatus] ?? DELIVERY_STATUS_CONFIG.PENDING;

export const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const config = statusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-xs font-semibold rounded-full border ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
};

// Same rules as the service: cancelled and returned are final, delivered can only be returned
export const nextStatuses = (current?: string): DeliveryStatus[] => {
  if (current === "CANCELLED" || current === "RETURNED") return [];
  if (current === "DELIVERED") return ["RETURNED"];
  return DELIVERY_STATUSES.filter((s) => s !== current);
};

// Statuses that record why a delivery did not go through
export const FAILURE_STATUSES: DeliveryStatus[] = ["RETURNED", "CANCELLED"];

/* ================= Delivery orders ================= */

export interface DeliveryTracking {
  id: number;
  deliveryOrderId: number;
  currentStatus: string;
  remarks?: string;
  updatedBy?: string;
  deliveredSuccessfully: boolean;
  failureReason?: string;
  statusUpdatedAt?: string;
}

export interface DeliveryOrderItem {
  id?: number;
  productId: number;
  productName?: string;
  quantity: number;
}

export interface DeliveryOrder {
  id: number;
  deliveryOrderNumber: string;
  deliveryDate: string;
  status: DeliveryStatus;
  customerId: number;
  customerName?: string;
  customerNumber?: string;
  salesOrderId?: number;
  reservationId?: number;
  warehouseId?: number;
  vehicleId?: number;
  vehiclePlate?: string;
  transporterId?: number;
  transporterName?: string;
  deliveryAddressId?: number;
  deliveryAddress?: string;
  remarks?: string;
  createdDate?: string;
  items: DeliveryOrderItem[];
  tracking?: DeliveryTracking | null;
}

export const EDITABLE_ORDER_STATUSES: DeliveryStatus[] = ["PENDING", "CONFIRMED"];
export const DELETABLE_ORDER_STATUSES: DeliveryStatus[] = ["PENDING", "CANCELLED"];

/* ================= Lookups from other modules ================= */

export interface CustomerOption { id: number; customerName: string; customerCode?: string }
export interface ProductOption { id: number; productName: string; productCode?: string }
export interface VehicleOption { id: number; licensePlate: string; status?: string }
export interface TransporterOption { id: number; name: string }
export interface WarehouseOption { id: number; name: string; code?: string }
export interface SalesOrderOption { id: number; orderNumber?: string; customerId?: number; status?: string }

export interface DeliveryLookups {
  customers: CustomerOption[];
  products: ProductOption[];
  vehicles: VehicleOption[];
  transporters: TransporterOption[];
  warehouses: WarehouseOption[];
  salesOrders: SalesOrderOption[];
}

const EMPTY_LOOKUPS: DeliveryLookups = { customers: [], products: [], vehicles: [], transporters: [], warehouses: [], salesOrders: [] };

// A user without access to another module (e.g. no CRM permission) gets an empty list; forms then fall
// back to typing the id
const tryList = async <T,>(url: string): Promise<T[]> => {
  try {
    return listOf<T>((await axios.get(url)).data);
  } catch {
    return [];
  }
};

export const useDeliveryLookups = (needed: (keyof DeliveryLookups)[]) => {
  const [lookups, setLookups] = useState<DeliveryLookups>(EMPTY_LOOKUPS);
  const key = needed.join(",");

  useEffect(() => {
    let cancelled = false;
    const sources: Record<keyof DeliveryLookups, () => Promise<unknown[]>> = {
      customers: () => tryList<CustomerOption>("/v1/api/common/customers"),
      products: () => tryList<ProductOption>("/v1/api/common/products"),
      vehicles: () => tryList<VehicleOption>(`${DELIVERY_API}/vehicles`),
      transporters: () => tryList<TransporterOption>(`${DELIVERY_API}/transporters?active=true`),
      warehouses: () => tryList<WarehouseOption>("/v1/api/inventory/warehouses"),
      salesOrders: () => tryList<SalesOrderOption>("/v1/api/sales/sales-orders"),
    };
    Promise.all(needed.map(async (name) => [name, await sources[name]()] as const)).then((loaded) => {
      if (!cancelled) setLookups((prev) => ({ ...prev, ...Object.fromEntries(loaded) }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const customerName = (id?: number, fallback?: string) =>
    fallback || lookups.customers.find((c) => c.id === id)?.customerName || (id ? `Customer #${id}` : "-");
  const productName = (id?: number, fallback?: string) =>
    fallback || lookups.products.find((p) => p.id === id)?.productName || (id ? `Product #${id}` : "-");
  const warehouseName = (id?: number) =>
    lookups.warehouses.find((w) => w.id === id)?.name || (id ? `Warehouse #${id}` : "-");
  const salesOrderLabel = (id?: number) =>
    lookups.salesOrders.find((s) => s.id === id)?.orderNumber || (id ? `SO #${id}` : "-");

  return { ...lookups, customerName, productName, warehouseName, salesOrderLabel };
};

/* ================= Helpers ================= */

// The service's error format: {status, error, message, fieldErrors?}
export const apiError = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.response?.data?.error || fallback;

export const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : "-");
export const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "-");

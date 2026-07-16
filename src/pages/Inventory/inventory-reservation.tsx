// pages/InventoryReservationManager.tsx

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import FilterPopover from "../../components/common/filter";
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
};

type InventoryReservation = {
  id?: number;
  reservationNo: string;
  salesOrderId: number;
  warehouseId: number;
  status: "RESERVED" | "RELEASED" | "CONSUMED" | "CANCELLED";
  reservationDate: string;
  items: ReservationItem[];
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

type Product = {
  id: number;
  productName: string;
  code: string;
};

type InventoryForm = {
  reservationNo: string;
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
const PAGE_SIZE = 10;

const statusOptions = ["RESERVED", "RELEASED", "CONSUMED", "CANCELLED"];

const emptyForm: InventoryForm = {
  reservationNo: "",
  salesOrderId: "",
  warehouseId: "",
  status: "RESERVED",
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

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

const InventoryReservationManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"release" | "consume" | null>(null);

  useEffect(() => {
    fetchReservations();
    fetchDropdowns();
  }, []);

  const fetchReservations = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryReservation[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      setReservations(data);
    } catch (error) {
      setReservations([]);
      ToasterService.error("Failed to load reservations", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async (): Promise<void> => {
    try {
      const [warehouseRes, productRes] = await Promise.all([
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
        axios.get<Product[]>(PRODUCT_API_URL, { headers }),
      ]);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
    } catch (error) {
      ToasterService.error("Failed to load dropdowns", getErrorMessage(error, "Please try again."));
    }
  };

  const openCreate = (): void => {
    setEditingId(null);
    setForm(emptyForm);
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
      reservationNo: reservation.reservationNo || "",
      salesOrderId: String(reservation.salesOrderId || ""),
      warehouseId: String(reservation.warehouseId || ""),
      status: reservation.status || "RESERVED",
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
    reservationNo: form.reservationNo.trim(),
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
    reservationNo: form.reservationNo.trim(),
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

    if (!form.reservationNo.trim()) {
      ToasterService.error("Reservation number is required");
      return;
    }
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

  const filteredReservations = useMemo(() => {
    const term = searchableText(search);

    return reservations.filter((reservation) => {
      const matchesStatus = statusFilter === "" || reservation.status === statusFilter;

      const searchString = `${reservation.id} ${reservation.reservationNo} ${reservation.salesOrderId} ${reservation.warehouseId}`.toLowerCase();
      const matchesSearch = !term || searchString.includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [reservations, search, statusFilter]);

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

  const canDelete = (status: string) => status === "RESERVED" || status === "CANCELLED";
  const canRelease = (status: string) => status === "RESERVED";
  const canConsume = (status: string) => status === "RESERVED";

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RESERVED": return "bg-blue-100 text-blue-700";
      case "RELEASED": return "bg-green-100 text-green-700";
      case "CONSUMED": return "bg-gray-100 text-gray-700";
      case "CANCELLED": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RESERVED": return <ClockIcon className="h-4 w-4" />;
      case "RELEASED": return <CheckCircleIcon className="h-4 w-4" />;
      case "CONSUMED": return <CheckCircleIcon className="h-4 w-4" />;
      case "CANCELLED": return <XCircleIcon className="h-4 w-4" />;
      default: return null;
    }
  };

  const columns: ColumnDef<InventoryReservation>[] = [
    {
      key: "reservationNo",
      label: "Reservation No",
      sortable: true,
      render: (reservation) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50">
            <ClockIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{reservation.reservationNo}</p>
            {/* <p className="text-xs text-slate-400">ID: #{reservation.id}</p> */}
          </div>
        </div>
      ),
    },
    {
      key: "salesOrderId",
      label: "Sales Order",
      sortable: true,
      render: (reservation) => (
        <span className="text-sm text-slate-700">{reservation.salesOrderId}</span>
      ),
    },
    {
      key: "warehouseId",
      label: "Warehouse",
      sortable: true,
      render: (reservation) => {
        const warehouse = warehouses.find((w) => w.id === reservation.warehouseId);
        return (
          <span className="text-sm text-slate-700">
            {warehouse?.name || reservation.warehouseId}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (reservation) => (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(reservation.status)}`}>
          {getStatusIcon(reservation.status)}
          {reservation.status}
        </span>
      ),
    },
   {
  key: "productId",
  label: "Product",
  sortable: true,
  render: (reservation) => {
    const productId = reservation.items?.[0]?.productId;
    const product = products.find((p) => p.id === productId);
    
    // Always show product name if available
    return (
      <span className="text-sm text-slate-700">
        {product?.productName || "Unknown Product"}
      </span>
    );
  },
},
    {
      key: "reservedQty",
      label: "Qty",
      sortable: true,
      render: (reservation) => (
        <span className="text-sm font-medium text-slate-700">
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
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(reservation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
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
              className="rounded-lg p-1.5 text-green-600 transition hover:bg-green-50"
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
              className="rounded-lg p-1.5 text-purple-600 transition hover:bg-purple-50"
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
                  `Cannot delete ${reservation.status} reservation. Only RESERVED or CANCELLED can be deleted.`
                );
              }
            }}
            className={`rounded-lg p-1.5 transition ${
              canDelete(reservation.status)
                ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                : "text-gray-300 cursor-not-allowed"
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
      <PageBreadcrumb pageTitle="Inventory Reservations" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Reservation" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search reservations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <FilterPopover
            title="Filter Reservations"
            buttonLabel="Filters"
            label="Status"
            value={statusFilter}
            options={[
              { label: "All Status", value: "" },
              ...statusOptions.map((status) => ({
                label: status,
                value: status,
              })),
            ]}
            onChange={setStatusFilter}
            onReset={() => setStatusFilter("")}
            onApply={() => undefined}
          />
        </div>

        <ReusableTable
          data={filteredReservations}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClockIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No reservations found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first reservation
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
      label: "Reservation Info",
      fields: [
        <FloatingInput
          key="reservationNo"
          label="Reservation No"
          name="reservationNo"
          value={form.reservationNo}
          onChange={handleChange}
          required
        />,
        <FloatingInput
          key="salesOrderId"
          label="Sales Order ID"
          name="salesOrderId"
          type="number"
          value={form.salesOrderId}
          onChange={handleChange}
          required
        />,
        <FloatingSelect
          key="warehouseId"
          label="Select warehouse"
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
          options={statusOptions.map((status) => ({ id: status, name: status }))}
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
        <FloatingInput
          key="productId"
          label="Product ID"
          name="productId"
          type="number"
          value={form.productId}
          onChange={handleChange}
          required
        />,
      ],
    },
    {
      label: "Quantity",
      fields: [
        <FloatingInput
          key="reservedQty"
          label="Reserved Quantity"
          name="reservedQty"
          type="number"
          value={form.reservedQty}
          onChange={handleChange}
          required
        />,
      ],
    },
  ]}
/>

      <DynamicPopup
        isPopupOpen={!!deleteId}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteId(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
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
// pages/InventoryReservationManager.tsx

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import {
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  TrashIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type ReservationItem = {
  id?: number;
  productId: number;
  reservedQty: number;
};

// ✅ Only accepted statuses
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
  name: string;
  code: string;
};

const API_URL = "/v1/api/inventory/inventory-reservations";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/purchase/products";

const emptyForm: InventoryReservation = {
  reservationNo: "",
  salesOrderId: 0,
  warehouseId: 0,
  status: "RESERVED",
  reservationDate: new Date().toISOString().slice(0, 10),
  items: [{ productId: 0, reservedQty: 0 }],
};

// ✅ Only accepted statuses
const statusOptions = ["RESERVED", "RELEASED", "CONSUMED", "CANCELLED"];

const InventoryReservationManager: React.FC = () => {
  const [rows, setRows] = useState<InventoryReservation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<InventoryReservation>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [releaseId, setReleaseId] = useState<number | null>(null);

  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tenantId = user?.tenantId || "";
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    };
  }, []);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL, { headers });
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load inventory reservations", error);
      ToasterService.error("Failed to load inventory reservations");
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [warehouseRes, productRes] = await Promise.all([
        axios.get(WAREHOUSE_API_URL, { headers }),
        axios.get(PRODUCT_API_URL, { headers }),
      ]);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
    } catch (error) {
      console.error("Failed to load dropdown data", error);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchDropdowns();
  }, []);

  const updateField = (key: keyof InventoryReservation, value: string | number) => {
    setForm((prev) => {
      if (key === "status") {
        const statusValue = value as InventoryReservation["status"];
        if (statusOptions.includes(statusValue)) {
          return { ...prev, [key]: statusValue };
        }
        return prev;
      }
      return { ...prev, [key]: value };
    });
  };

  const updateItem = (key: keyof ReservationItem, value: number) => {
    setForm((prev) => ({
      ...prev,
      items: [{ ...prev.items[0], [key]: value }],
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  // ✅ CREATE payload
  const buildCreatePayload = () => ({
    reservationNo: form.reservationNo,
    salesOrderId: Number(form.salesOrderId),
    warehouseId: Number(form.warehouseId),
    status: form.status,
    reservationDate: form.reservationDate,
    items: form.items.map((item) => ({
      productId: Number(item.productId),
      reservedQty: Number(item.reservedQty),
    })),
  });

  // ✅ UPDATE payload with ID in body
  const buildUpdatePayload = () => ({
    id: editingId || 0,
    reservationNo: form.reservationNo,
    salesOrderId: Number(form.salesOrderId),
    warehouseId: Number(form.warehouseId),
    status: form.status,
    reservationDate: form.reservationDate,
    items: form.items.map((item) => ({
      id: item.id || 0,
      productId: Number(item.productId),
      reservedQty: Number(item.reservedQty),
    })),
  });

  const saveReservation = async () => {
    if (!form.reservationNo.trim()) {
      ToasterService.error("Reservation number is required");
      return;
    }
    if (!form.salesOrderId || form.salesOrderId <= 0) {
      ToasterService.error("Sales Order ID is required");
      return;
    }
    if (!form.warehouseId || form.warehouseId <= 0) {
      ToasterService.error("Please select a warehouse");
      return;
    }
    if (!form.items[0]?.productId || form.items[0].productId <= 0) {
      ToasterService.error("Please select a product");
      return;
    }
    if (!form.items[0]?.reservedQty || form.items[0].reservedQty <= 0) {
      ToasterService.error("Reserved quantity is required");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildCreatePayload();

      await axios.post(API_URL, payload, { headers });
      ToasterService.success("Inventory reservation created");

      resetForm();
      fetchReservations();
    } catch (error) {
      console.error("Failed to save inventory reservation", error);
      ToasterService.error("Failed to save inventory reservation");
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ UPDATE - PUT /update
  const updateReservation = async () => {
    if (!editingId) {
      ToasterService.error("No reservation selected for update");
      return;
    }

    if (!form.reservationNo.trim()) {
      ToasterService.error("Reservation number is required");
      return;
    }
    if (!form.salesOrderId || form.salesOrderId <= 0) {
      ToasterService.error("Sales Order ID is required");
      return;
    }
    if (!form.warehouseId || form.warehouseId <= 0) {
      ToasterService.error("Please select a warehouse");
      return;
    }
    if (!form.items[0]?.productId || form.items[0].productId <= 0) {
      ToasterService.error("Please select a product");
      return;
    }
    if (!form.items[0]?.reservedQty || form.items[0].reservedQty <= 0) {
      ToasterService.error("Reserved quantity is required");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildUpdatePayload();

      await axios.put(`${API_URL}/update`, payload, { headers });
      ToasterService.success("Inventory reservation updated");

      resetForm();
      fetchReservations();
    } catch (error) {
      console.error("Failed to update inventory reservation", error);
      ToasterService.error("Failed to update inventory reservation");
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ RELEASE - PUT /{id}/release
  const handleRelease = async () => {
    if (!releaseId) return;

    try {
      setSubmitting(true);
      await axios.put(`${API_URL}/${releaseId}/release`, {}, { headers });
      ToasterService.success("Reservation released successfully");
      setReleaseId(null);
      fetchReservations();
    } catch (error) {
      console.error("Failed to release reservation", error);
      ToasterService.error("Failed to release reservation");
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ DELETE - DELETE /{id}
  const deleteReservation = async () => {
    if (!deleteId) return;

    try {
      setSubmitting(true);
      await axios.delete(`${API_URL}/${deleteId}?cascade=true`, { headers });
      ToasterService.success("Inventory reservation deleted");
      setDeleteId(null);
      fetchReservations();
    } catch (error) {
      console.error("Failed to delete inventory reservation", error);
      ToasterService.error("Failed to delete inventory reservation");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (row: InventoryReservation) => {
    setEditingId(row.id || null);
    setForm({
      reservationNo: row.reservationNo || "",
      salesOrderId: Number(row.salesOrderId || 0),
      warehouseId: Number(row.warehouseId || 0),
      status: row.status || "RESERVED",
      reservationDate: row.reservationDate || emptyForm.reservationDate,
      items: row.items?.length ? row.items : [{ productId: 0, reservedQty: 0 }],
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
  };

  // ✅ Action buttons visibility based on status
  const canDelete = (status: string) => status === "RESERVED" || status === "CANCELLED";
  const canRelease = (status: string) => status === "RESERVED";

  // ✅ Status color mapping
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

  return (
    <div className="p-6">
      <PageMeta title="Inventory Reservations" description="Manage inventory reservations" />
      <PageBreadcrumb pageTitle="Inventory Reservations" />

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory Reservations</h2>
            <p className="text-sm text-gray-500">
              Reserve product quantities for sales orders.
              <span className="ml-2 text-xs text-green-600">✅ All statuses working</span>
            </p>
          </div>
          <AddButton onClick={openCreate} label="Add Reservation" />
        </div>

        {/* FORM */}
        {showForm && (
          <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input
                className="rounded-md border px-3 py-2"
                placeholder="Reservation No"
                value={form.reservationNo}
                onChange={(e) => updateField("reservationNo", e.target.value)}
              />
              <input
                className="rounded-md border px-3 py-2"
                type="number"
                placeholder="Sales Order ID"
                value={form.salesOrderId || ""}
                onChange={(e) => updateField("salesOrderId", Number(e.target.value))}
              />
              <select
                className="rounded-md border px-3 py-2"
                value={form.warehouseId}
                onChange={(e) => updateField("warehouseId", Number(e.target.value))}
              >
                <option value={0}>Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border px-3 py-2"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value as InventoryReservation["status"])}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border px-3 py-2"
                type="date"
                value={form.reservationDate}
                onChange={(e) => updateField("reservationDate", e.target.value)}
              />
              <select
                className="rounded-md border px-3 py-2"
                value={form.items[0]?.productId || 0}
                onChange={(e) => updateItem("productId", Number(e.target.value))}
              >
                <option value={0}>Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border px-3 py-2"
                type="number"
                placeholder="Reserved Quantity"
                value={form.items[0]?.reservedQty || ""}
                onChange={(e) => updateItem("reservedQty", Number(e.target.value))}
              />
              <div className="flex items-center rounded-md border bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <ClockIcon className="mr-1 h-4 w-4" />
                Status: {form.status}
              </div>
              <div className="flex gap-2 md:col-span-4">
                <button
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={editingId ? updateReservation : saveReservation}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
                <button
                  className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                  onClick={closeForm}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Reservation No</th>
                <th className="px-3 py-2">Sales Order</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-center" colSpan={8}>Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center" colSpan={8}>No reservations found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{row.id}</td>
                    <td className="px-3 py-2 font-medium">{row.reservationNo}</td>
                    <td className="px-3 py-2">{row.salesOrderId}</td>
                    <td className="px-3 py-2">
                      {warehouses.find((w) => w.id === row.warehouseId)?.name || row.warehouseId}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(row.status)}`}>
                        {getStatusIcon(row.status)}
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {products.find((p) => p.id === row.items?.[0]?.productId)?.name ||
                        row.items?.[0]?.productId}
                    </td>
                    <td className="px-3 py-2">{row.items?.[0]?.reservedQty}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded p-1 text-blue-600 hover:bg-blue-50"
                          onClick={() => openEdit(row)}
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>

                        {canRelease(row.status) && (
                          <button
                            className="rounded p-1 text-green-600 hover:bg-green-50"
                            onClick={() => setReleaseId(row.id || null)}
                            title="Release"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          className={`rounded p-1 ${
                            canDelete(row.status)
                              ? "text-red-600 hover:bg-red-50"
                              : "text-gray-300 cursor-not-allowed"
                          }`}
                          onClick={() => {
                            if (canDelete(row.status)) {
                              setDeleteId(row.id || null);
                            } else {
                              ToasterService.warning(
                                `Cannot delete ${row.status} reservation. Only RESERVED or CANCELLED can be deleted.`
                              );
                            }
                          }}
                          title={canDelete(row.status) ? "Delete" : "Cannot delete"}
                          disabled={!canDelete(row.status)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Release Popup */}
      <DynamicPopup
        isPopupOpen={!!releaseId}
        setIsPopupOpen={(open) => {
          if (!open) setReleaseId(null);
        }}
        icon={<ArrowPathIcon className="h-6 w-6 text-green-600" />}
        iconBg="bg-green-100"
        innerText="Release Reservation"
        subText="Are you sure you want to release this reservation? Items will be available again."
        confirmLabel="Release"
        cancelLabel="Cancel"
        onConfirm={handleRelease}
        confirmBtnClass="bg-green-600 hover:bg-green-700 text-white"
      />

      {/* Delete Popup */}
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
        onConfirm={deleteReservation}
        confirmBtnClass="bg-red-600 hover:bg-red-700 text-white"
      />
    </div>
  );
};

export default InventoryReservationManager;
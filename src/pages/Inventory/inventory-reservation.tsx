import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
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
  status: string;
  reservationDate: string;
  items: ReservationItem[];
};

const API_URL = "/v1/api/inventory/inventory-reservations";

const emptyForm: InventoryReservation = {
  reservationNo: "",
  salesOrderId: 0,
  warehouseId: 0,
  status: "RESERVED",
  reservationDate: new Date().toISOString().slice(0, 10),
  items: [{ productId: 0, reservedQty: 0 }],
};

const InventoryReservationManager: React.FC = () => {
  const [rows, setRows] = useState<InventoryReservation[]>([]);
  const [form, setForm] = useState<InventoryReservation>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
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

  useEffect(() => {
    fetchReservations();
  }, []);

  const updateField = (key: keyof InventoryReservation, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  const buildPayload = () => ({
    ...(editingId ? { id: editingId } : {}),
    reservationNo: form.reservationNo,
    salesOrderId: Number(form.salesOrderId),
    warehouseId: Number(form.warehouseId),
    status: form.status,
    reservationDate: form.reservationDate,
    items: form.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      productId: Number(item.productId),
      reservedQty: Number(item.reservedQty),
    })),
  });

  const saveReservation = async () => {
    try {
      const payload = buildPayload();
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Inventory reservation updated");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Inventory reservation created");
      }
      resetForm();
      fetchReservations();
    } catch (error) {
      console.error("Failed to save inventory reservation", error);
      ToasterService.error("Failed to save inventory reservation");
    }
  };

  const editReservation = (row: InventoryReservation) => {
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

  const deleteReservation = async (id?: number) => {
    if (!id) return;
    try {
      await axios.delete(`${API_URL}/${id}`, { headers });
      ToasterService.success("Inventory reservation deleted");
      fetchReservations();
    } catch (error) {
      console.error("Failed to delete inventory reservation", error);
      ToasterService.error("Failed to delete inventory reservation");
    }
  };

  return (
    <div className="p-6">
      <PageMeta title="InventoryReservationManager" description="Inventory reservation controller" />
      <PageBreadcrumb pageTitle="InventoryReservationManager" />

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory Reservations</h2>
            <p className="text-sm text-gray-500">Reserve product quantities for sales orders.</p>
          </div>
          <AddButton onClick={() => setShowForm(true)} label="Add Reservation" />
        </div>

        {showForm && (
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-4">
            <input className="rounded-md border px-3 py-2" placeholder="Reservation No" value={form.reservationNo} onChange={(e) => updateField("reservationNo", e.target.value)} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Sales Order ID" value={form.salesOrderId} onChange={(e) => updateField("salesOrderId", Number(e.target.value))} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Warehouse ID" value={form.warehouseId} onChange={(e) => updateField("warehouseId", Number(e.target.value))} />
            <select className="rounded-md border px-3 py-2" value={form.status} onChange={(e) => updateField("status", e.target.value)}>
              <option value="RESERVED">RESERVED</option>
              <option value="RELEASED">RELEASED</option>
              <option value="FULFILLED">FULFILLED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <input className="rounded-md border px-3 py-2" type="date" value={form.reservationDate} onChange={(e) => updateField("reservationDate", e.target.value)} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Item Product ID" value={form.items[0]?.productId || 0} onChange={(e) => updateItem("productId", Number(e.target.value))} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Reserved Qty" value={form.items[0]?.reservedQty || 0} onChange={(e) => updateItem("reservedQty", Number(e.target.value))} />
            <div className="flex gap-2 md:col-span-4">
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={saveReservation}>{editingId ? "Update" : "Create"}</button>
              <button className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Reservation No</th>
                <th className="px-3 py-2">Sales Order ID</th>
                <th className="px-3 py-2">Warehouse ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Product ID</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-4" colSpan={8}>Loading...</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2">{row.reservationNo}</td>
                  <td className="px-3 py-2">{row.salesOrderId}</td>
                  <td className="px-3 py-2">{row.warehouseId}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.items?.[0]?.productId}</td>
                  <td className="px-3 py-2">{row.items?.[0]?.reservedQty}</td>
                  <td className="px-3 py-2">
                    <button className="mr-2 text-blue-600" onClick={() => editReservation(row)}>Edit</button>
                    <button className="text-red-600" onClick={() => deleteReservation(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td className="px-3 py-4" colSpan={8}>No reservations found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryReservationManager;

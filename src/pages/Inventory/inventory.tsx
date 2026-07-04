import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";

type InventoryStock = {
  id?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  type: string;
  quantity: number;
  movementDate: string;
  referenceNo: string;
  productId: number;
  reservedQty: number;
  minStockLevel: number;
  warehouse: string;
};

type WarehouseOption = {
  id: number;
  code: string;
  name: string;
  locationType?: string;
};

type ProductOption = {
  id: number;
  productCode?: string;
  productName?: string;
  categoryName?: string;
};

const API_URL = "/v1/api/inventory/stock";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/purchase/products";

const toBackendDateTime = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const pad = (num: number) => String(num).padStart(2, "0");
  const millis = String(date.getMilliseconds()).padStart(3, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${millis}`;
};

const emptyForm: InventoryStock = {
  type: "GRN",
  quantity: 0,
  movementDate: new Date().toISOString().slice(0, 10),
  referenceNo: "",
  productId: 0,
  reservedQty: 0,
  minStockLevel: 0,
  warehouse: "",
};

const InventoryStockManager: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [rows, setRows] = useState<InventoryStock[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<InventoryStock>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL, { headers });
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load inventory stock", error);
      ToasterService.error("Failed to load inventory stock");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(WAREHOUSE_API_URL, { headers });
      setWarehouses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load warehouses", error);
      ToasterService.error("Failed to load warehouses");
      setWarehouses([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(PRODUCT_API_URL, { headers });
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load products", error);
      ToasterService.error("Failed to load products");
      setProducts([]);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchWarehouses();
    fetchProducts();
  }, []);

  const updateField = (key: keyof InventoryStock, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  const buildPayload = () => ({
    id: editingId || 0,
    createdDate: toBackendDateTime(form.createdDate),
    updatedDate: toBackendDateTime(),
    createdBy: form.createdBy || user?.userId || user?.id || getStoredUser()?.userId || "",
    tenantId: form.tenantId || user?.tenantId || getStoredUser()?.tenantId || "",
    type: form.type,
    quantity: Number(form.quantity),
    movementDate: form.movementDate,
    referenceNo: form.referenceNo,
    productId: Number(form.productId),
    reservedQty: Number(form.reservedQty),
    minStockLevel: Number(form.minStockLevel),
    warehouse: form.warehouse,
  });

  const saveStock = async () => {
    try {
      const payload = buildPayload();
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Inventory stock updated");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Inventory stock created");
      }
      resetForm();
      fetchStock();
    } catch (error) {
      console.error("Failed to save inventory stock", error);
      ToasterService.error("Failed to save inventory stock");
    }
  };

  const editStock = (row: InventoryStock) => {
    setEditingId(row.id || null);
    setForm({
      id: row.id,
      createdDate: row.createdDate,
      updatedDate: row.updatedDate,
      createdBy: row.createdBy,
      tenantId: row.tenantId,
      type: row.type || "GRN",
      quantity: Number(row.quantity || 0),
      movementDate: row.movementDate || emptyForm.movementDate,
      referenceNo: row.referenceNo || "",
      productId: Number(row.productId || 0),
      reservedQty: Number(row.reservedQty || 0),
      minStockLevel: Number(row.minStockLevel || 0),
      warehouse: typeof row.warehouse === "string" ? row.warehouse : "",
    });
    setShowForm(true);
  };

  const deleteStock = async (id?: number) => {
    if (!id) return;
    try {
      await axios.delete(`${API_URL}/${id}`, { headers });
      ToasterService.success("Inventory stock deleted");
      fetchStock();
    } catch (error) {
      console.error("Failed to delete inventory stock", error);
      ToasterService.error("Failed to delete inventory stock");
    }
  };

  return (
    <div className="p-6">
      <PageMeta title="inventory" description="Inventory stock entries" />
      <PageBreadcrumb pageTitle="inventory" />

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory Stock</h2>
            <p className="text-sm text-gray-500">Create and manage stock entries.</p>
          </div>
          <AddButton onClick={() => setShowForm(true)} label="Add Stock" />
        </div>

        {showForm && (
          <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-4">
            <input className="rounded-md border px-3 py-2" placeholder="Type" value={form.type} onChange={(e) => updateField("type", e.target.value)} />
            <select className="rounded-md border px-3 py-2" value={form.productId || ""} onChange={(e) => updateField("productId", Number(e.target.value))}>
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.productName || `Product ${product.id}`}{product.productCode ? ` (${product.productCode})` : ""}
                </option>
              ))}
            </select>
            <select className="rounded-md border px-3 py-2" value={form.warehouse} onChange={(e) => updateField("warehouse", e.target.value)}>
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.code || warehouse.name}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            <input className="rounded-md border px-3 py-2" type="date" value={form.movementDate} onChange={(e) => updateField("movementDate", e.target.value)} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => updateField("quantity", Number(e.target.value))} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Reserved Qty" value={form.reservedQty} onChange={(e) => updateField("reservedQty", Number(e.target.value))} />
            <input className="rounded-md border px-3 py-2" type="number" placeholder="Min Stock Level" value={form.minStockLevel} onChange={(e) => updateField("minStockLevel", Number(e.target.value))} />
            <input className="rounded-md border px-3 py-2" placeholder="Reference No" value={form.referenceNo} onChange={(e) => updateField("referenceNo", e.target.value)} />
            <div className="flex gap-2 md:col-span-4">
              <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={saveStock}>{editingId ? "Update" : "Create"}</button>
              <button className="rounded-md border px-4 py-2 text-sm font-semibold" onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Product ID</th>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Reserved</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-4" colSpan={8}>Loading...</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-3 py-2">{row.id}</td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">{row.productId}</td>
                  <td className="px-3 py-2">{row.warehouse}</td>
                  <td className="px-3 py-2">{row.quantity}</td>
                  <td className="px-3 py-2">{row.reservedQty}</td>
                  <td className="px-3 py-2">{row.referenceNo}</td>
                  <td className="px-3 py-2">
                    <button className="mr-2 text-blue-600" onClick={() => editStock(row)}>Edit</button>
                    <button className="text-red-600" onClick={() => deleteStock(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td className="px-3 py-4" colSpan={8}>No stock entries found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryStockManager;

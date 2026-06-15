import React, { useEffect, useState } from "react";
import axios from "axios";

interface Product {
  id: number;
  name: string;
}

interface Warehouse {
  id: number;
  name: string;
}

interface Batch {
  id: number;
  batchNumber: string;
}

interface SerialNumber {
  id: number;
  serial?: string;
}

interface StockMovement {
  id: number;
  movementDate: string;
  movementType: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  reference: string;
  product?: Product;
  warehouse?: Warehouse;
  batch?: Batch;
  serialNumber?: SerialNumber;
}

const API_URL = "/v1/api/inventory";
const ITEMS_PER_PAGE = 5;

const MOVEMENT_TYPES = ["GRN", "Transfer", "Adjustment", "Return", "Sale"];

const StockMovementsManager: React.FC = () => {
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof StockMovement>("movementDate");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    movementDate: "",
    movementType: "",
    quantity: "",
    fromLocation: "",
    toLocation: "",
    reference: "",
    productId: "",
    warehouseId: "",
    batchId: "",
    serialNumberId: "",
  });

  useEffect(() => {
    fetchStockMovements();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
    fetchSerialNumbers();
  }, []);

  const fetchStockMovements = async () => {
    try {
      const res = await axios.get(`${API_URL}/stock-movements`);
      setStockMovements(res.data);
    } catch (err) {
      console.error("Failed to load stock movements", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products", err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_URL}/warehouses`);
      setWarehouses(res.data);
    } catch (err) {
      console.error("Failed to load warehouses", err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`);
      setBatches(res.data);
    } catch (err) {
      console.error("Failed to load batches", err);
    }
  };

  const fetchSerialNumbers = async () => {
    try {
      const res = await axios.get(`${API_URL}/serial-numbers`);
      setSerialNumbers(res.data);
    } catch (err) {
      console.error("Failed to load serial numbers", err);
    }
  };

  const clearForm = () => {
    setForm({
      movementDate: "",
      movementType: "",
      quantity: "",
      fromLocation: "",
      toLocation: "",
      reference: "",
      productId: "",
      warehouseId: "",
      batchId: "",
      serialNumberId: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => ({
    movementDate: form.movementDate,
    movementType: form.movementType,
    quantity: Number(form.quantity),
    fromLocation: form.fromLocation,
    toLocation: form.toLocation,
    reference: form.reference,
    product: {
      id: Number(form.productId),
    },
    warehouse: {
      id: Number(form.warehouseId),
    },
    batch: {
      id: Number(form.batchId),
    },
    serialNumber: {
      id: Number(form.serialNumberId),
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await axios.put(`${API_URL}/stock-movements/${editingId}`, buildPayload());
      } else {
        await axios.post(`${API_URL}/stock-movements`, buildPayload());
      }

      fetchStockMovements();
      clearForm();
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  const handleEdit = (sm: StockMovement) => {
    setEditingId(sm.id);
    setForm({
      movementDate: sm.movementDate || "",
      movementType: sm.movementType || "",
      quantity: sm.quantity?.toString() || "",
      fromLocation: sm.fromLocation || "",
      toLocation: sm.toLocation || "",
      reference: sm.reference || "",
      productId: sm.product?.id?.toString() || "",
      warehouseId: sm.warehouse?.id?.toString() || "",
      batchId: sm.batch?.id?.toString() || "",
      serialNumberId: sm.serialNumber?.id?.toString() || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this stock movement?")) return;

    try {
      await axios.delete(`${API_URL}/stock-movements/${id}`);
      fetchStockMovements();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleSort = (field: keyof StockMovement) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = stockMovements.filter((sm) =>
    `${sm.movementType || ""} ${sm.fromLocation || ""} ${sm.toLocation || ""} ${sm.reference || ""} ${sm.product?.name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  return (
    <div className="purchase-order-container">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "600", marginBottom: "0.5rem" }}>
          Stock Movements Manager
        </h1>
        <p style={{ color: "#666" }}>Track and manage inventory stock movements</p>
      </div>

      {!showForm && (
        <button
          onClick={() => {
            clearForm();
            setShowForm(true);
          }}
          className="btn btn-primary add-btn"
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontWeight: "500",
            marginBottom: "1.5rem",
          }}
        >
          <i className="fas fa-plus" style={{ marginRight: "0.5rem" }}></i>
          Add Stock Movement
        </button>
      )}

      {!showForm && (
        <input
          className="search-input"
          placeholder="Search by type, location, reference, or product..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            marginBottom: "1.5rem",
            fontSize: "1rem",
          }}
        />
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="form-container"
          style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Movement Date */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Movement Date
              </label>
              <input
                type="date"
                value={form.movementDate}
                onChange={(e) => handleChange("movementDate", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Movement Type */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Movement Type
              </label>
              <select
                value={form.movementType}
                onChange={(e) => handleChange("movementType", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Type</option>
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Quantity
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
                required
                min="1"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Product */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Product
              </label>
              <select
                value={form.productId}
                onChange={(e) => handleChange("productId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* From Location */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                From Location
              </label>
              <input
                type="text"
                value={form.fromLocation}
                onChange={(e) => handleChange("fromLocation", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* To Location */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                To Location
              </label>
              <input
                type="text"
                value={form.toLocation}
                onChange={(e) => handleChange("toLocation", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Warehouse */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Warehouse
              </label>
              <select
                value={form.warehouseId}
                onChange={(e) => handleChange("warehouseId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Batch
              </label>
              <select
                value={form.batchId}
                onChange={(e) => handleChange("batchId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Serial Number */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Serial Number
              </label>
              <select
                value={form.serialNumberId}
                onChange={(e) => handleChange("serialNumberId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Serial Number</option>
                {serialNumbers.map((sn) => (
                  <option key={sn.id} value={sn.id}>
                    {sn.serial || `ID: ${sn.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Reference
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => handleChange("reference", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>

          <div className="form-actions" style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
            <button
              type="submit"
              className="btn btn-success"
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              {editingId ? "Update" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearForm}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {!showForm && (
        <div style={{ overflowX: "auto" }}>
          <table
            className="purchase-order-table my-4"
            style={{
              width: "100%",
              backgroundColor: "white",
              borderRadius: "0.5rem",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <thead className="table-header" style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th
                  onClick={() => handleSort("movementDate")}
                  className="table-head cursor-pointer"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  Date
                  {sortField === "movementDate" && (
                    <span className="sort-arrow">{sortAsc ? " ↑" : " ↓"}</span>
                  )}
                </th>
                <th
                  onClick={() => handleSort("movementType")}
                  className="table-head cursor-pointer"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  Type
                  {sortField === "movementType" && (
                    <span className="sort-arrow">{sortAsc ? " ↑" : " ↓"}</span>
                  )}
                </th>
                <th
                  className="table-head"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                  }}
                >
                  Product
                </th>
                <th
                  onClick={() => handleSort("quantity")}
                  className="table-head cursor-pointer"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  Qty
                  {sortField === "quantity" && (
                    <span className="sort-arrow">{sortAsc ? " ↑" : " ↓"}</span>
                  )}
                </th>
                <th
                  className="table-head"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                  }}
                >
                  From
                </th>
                <th
                  className="table-head"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                  }}
                >
                  To
                </th>
                <th
                  className="table-head"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                  }}
                >
                  Reference
                </th>
                <th
                  className="table-head actions-head"
                  style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="empty-state"
                    style={{
                      padding: "3rem",
                      textAlign: "center",
                      color: "#9ca3af",
                    }}
                  >
                    <i
                      className="fas fa-exchange-alt empty-icon"
                      style={{ fontSize: "3rem", marginBottom: "1rem", display: "block" }}
                    ></i>
                    No stock movements found.
                  </td>
                </tr>
              ) : (
                paginated.map((sm) => (
                  <tr
                    key={sm.id}
                    className="table-row"
                    style={{ borderTop: "1px solid #f3f4f6" }}
                  >
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      {new Date(sm.movementDate).toLocaleDateString()}
                    </td>
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      <span
                        style={{
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#dbeafe",
                          color: "#1e40af",
                          borderRadius: "0.375rem",
                          fontSize: "0.875rem",
                          fontWeight: "500",
                        }}
                      >
                        {sm.movementType}
                      </span>
                    </td>
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      {sm.product?.name || "N/A"}
                    </td>
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      {sm.quantity}
                    </td>
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      {sm.fromLocation}
                    </td>
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      {sm.toLocation}
                    </td>
                    <td className="table-cell" style={{ padding: "1rem" }}>
                      {sm.reference}
                    </td>
                    <td className="table-cell actions-cell" style={{ padding: "1rem" }}>
                      <button
                        onClick={() => handleEdit(sm)}
                        className="btn edit-btn"
                        title="Edit"
                        style={{
                          padding: "0.5rem 0.75rem",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                          marginRight: "0.5rem",
                        }}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(sm.id)}
                        className="btn delete-btn"
                        title="Delete"
                        style={{
                          padding: "0.5rem 0.75rem",
                          backgroundColor: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "0.375rem",
                          cursor: "pointer",
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!showForm && totalPages > 1 && (
        <div
          className="pagination-container"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn btn-secondary pagination-btn"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: page === 1 ? "#e5e7eb" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: page === 1 ? "not-allowed" : "pointer",
            }}
          >
            Previous
          </button>
          <span className="pagination-info" style={{ color: "#4b5563" }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary pagination-btn"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: page === totalPages ? "#e5e7eb" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: page === totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default StockMovementsManager;
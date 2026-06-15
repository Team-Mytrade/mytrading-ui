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
  warrantyStart: string;
  warrantyEnd: string;
  product?: Product;
  warehouse?: Warehouse;
  batch?: Batch;
}

const API_URL = "/v1/api/inventory";
const ITEMS_PER_PAGE = 5;

const SerialNumberManager: React.FC = () => {
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof SerialNumber>("warrantyStart");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    warrantyStart: "",
    warrantyEnd: "",
    productId: "",
    warehouseId: "",
    batchId: "",
  });

  useEffect(() => {
    fetchSerialNumbers();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
  }, []);

  const fetchSerialNumbers = async () => {
    try {
      const res = await axios.get(`${API_URL}/serial-numbers`);
      setSerialNumbers(res.data);
    } catch (err) {
      console.error("Failed to load serial numbers", err);
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

  const clearForm = () => {
    setForm({
      warrantyStart: "",
      warrantyEnd: "",
      productId: "",
      warehouseId: "",
      batchId: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => ({
    warrantyStart: form.warrantyStart,
    warrantyEnd: form.warrantyEnd,
    product: {
      id: Number(form.productId),
    },
    warehouse: {
      id: Number(form.warehouseId),
    },
    batch: {
      id: Number(form.batchId),
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await axios.put(`${API_URL}/serial-numbers/${editingId}`, buildPayload());
      } else {
        await axios.post(`${API_URL}/serial-numbers`, buildPayload());
      }

      fetchSerialNumbers();
      clearForm();
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  const handleEdit = (sn: SerialNumber) => {
    setEditingId(sn.id);
    setForm({
      warrantyStart: sn.warrantyStart || "",
      warrantyEnd: sn.warrantyEnd || "",
      productId: sn.product?.id?.toString() || "",
      warehouseId: sn.warehouse?.id?.toString() || "",
      batchId: sn.batch?.id?.toString() || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this serial number?")) return;

    try {
      await axios.delete(`${API_URL}/serial-numbers/${id}`);
      fetchSerialNumbers();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleSort = (field: keyof SerialNumber) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = serialNumbers.filter((sn) =>
    `${sn.serial || ""} ${sn.product?.name || ""} ${sn.warehouse?.name || ""} ${sn.batch?.batchNumber || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
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
          Serial Number Manager
        </h1>
        <p style={{ color: "#666" }}>Manage inventory serial numbers</p>
      </div>

      {!showForm && (
        <button
          onClick={() => {
            clearForm();
            setShowForm(true);
          }}
          className="btn btn-primary add-btn"
        >
          <i className="fas fa-plus btn-icon"></i>
          Add Serial Number
        </button>
      )}

      {!showForm && (
        <input
          className="search-input"
          placeholder="Search by serial number, product, warehouse, or batch..."
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
          {/* Product */}
          <div className="floating-input-container" style={{ marginBottom: "1.5rem", position: "relative" }}>
            <select
              value={form.productId}
              onChange={(e) => handleChange("productId", e.target.value)}
              required
              className="floating-input"
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
            <label
              className="floating-label"
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "0.75rem",
                color: "#9ca3af",
                fontSize: "0.875rem",
                pointerEvents: "none",
              }}
            >
              Product
            </label>
          </div>

          {/* Warehouse */}
          <div className="floating-input-container" style={{ marginBottom: "1.5rem", position: "relative" }}>
            <select
              value={form.warehouseId}
              onChange={(e) => handleChange("warehouseId", e.target.value)}
              required
              className="floating-input"
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
            <label
              className="floating-label"
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "0.75rem",
                color: "#9ca3af",
                fontSize: "0.875rem",
                pointerEvents: "none",
              }}
            >
              Warehouse
            </label>
          </div>

          {/* Batch */}
          <div className="floating-input-container" style={{ marginBottom: "1.5rem", position: "relative" }}>
            <select
              value={form.batchId}
              onChange={(e) => handleChange("batchId", e.target.value)}
              required
              className="floating-input"
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
            <label
              className="floating-label"
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "0.75rem",
                color: "#9ca3af",
                fontSize: "0.875rem",
                pointerEvents: "none",
              }}
            >
              Batch
            </label>
          </div>

          {/* Warranty Start */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
              Warranty Start
            </label>
            <input
              type="date"
              value={form.warrantyStart}
              onChange={(e) => handleChange("warrantyStart", e.target.value)}
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

          {/* Warranty End */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
              Warranty End
            </label>
            <input
              type="date"
              value={form.warrantyEnd}
              onChange={(e) => handleChange("warrantyEnd", e.target.value)}
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

          <div className="form-actions" style={{ display: "flex", gap: "1rem" }}>
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
                onClick={() => handleSort("serial")}
                className="table-head cursor-pointer"
                style={{
                  padding: "1rem",
                  textAlign: "left",
                  fontWeight: "600",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Serial Number
                {sortField === "serial" && (
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
                className="table-head"
                style={{
                  padding: "1rem",
                  textAlign: "left",
                  fontWeight: "600",
                }}
              >
                Warehouse
              </th>
              <th
                className="table-head"
                style={{
                  padding: "1rem",
                  textAlign: "left",
                  fontWeight: "600",
                }}
              >
                Batch
              </th>
              <th
                onClick={() => handleSort("warrantyStart")}
                className="table-head cursor-pointer"
                style={{
                  padding: "1rem",
                  textAlign: "left",
                  fontWeight: "600",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Warranty Start
                {sortField === "warrantyStart" && (
                  <span className="sort-arrow">{sortAsc ? " ↑" : " ↓"}</span>
                )}
              </th>
              <th
                onClick={() => handleSort("warrantyEnd")}
                className="table-head cursor-pointer"
                style={{
                  padding: "1rem",
                  textAlign: "left",
                  fontWeight: "600",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Warranty End
                {sortField === "warrantyEnd" && (
                  <span className="sort-arrow">{sortAsc ? " ↑" : " ↓"}</span>
                )}
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
                  colSpan={7}
                  className="empty-state"
                  style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  <i
                    className="fas fa-barcode empty-icon"
                    style={{ fontSize: "3rem", marginBottom: "1rem", display: "block" }}
                  ></i>
                  No serial numbers found.
                </td>
              </tr>
            ) : (
              paginated.map((sn) => (
                <tr
                  key={sn.id}
                  className="table-row"
                  style={{ borderTop: "1px solid #f3f4f6" }}
                >
                  <td className="table-cell" style={{ padding: "1rem" }}>
                    {sn.serial || "N/A"}
                  </td>
                  <td className="table-cell" style={{ padding: "1rem" }}>
                    {sn.product?.name || "N/A"}
                  </td>
                  <td className="table-cell" style={{ padding: "1rem" }}>
                    {sn.warehouse?.name || "N/A"}
                  </td>
                  <td className="table-cell" style={{ padding: "1rem" }}>
                    {sn.batch?.batchNumber || "N/A"}
                  </td>
                  <td className="table-cell" style={{ padding: "1rem" }}>
                    {new Date(sn.warrantyStart).toLocaleDateString()}
                  </td>
                  <td className="table-cell" style={{ padding: "1rem" }}>
                    {new Date(sn.warrantyEnd).toLocaleDateString()}
                  </td>
                  <td className="table-cell actions-cell" style={{ padding: "1rem" }}>
                    <button
                      onClick={() => handleEdit(sn)}
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
                      onClick={() => handleDelete(sn.id)}
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

export default SerialNumberManager;
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import {
  CubeIcon,
  BuildingOffice2Icon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// ============================================================
// 📋 TYPE DEFINITIONS
// ============================================================

type ReportData = {
  stockPerProduct: Record<string, number>;
  stockPerWarehouse: Array<{
    warehouse: string;
    product: string;
    quantity: number;
  }>;
  agedStock: Array<{
    product: string;
    receivedDate: string;
    quantity: number;
  }>;
};

type Product = {
  id: number;
  name: string;
  code: string;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

// ============================================================
// 📡 API CONSTANTS
// ============================================================

const API_URL = "/v1/api/inventory/reports";
const PRODUCT_API_URL = "/v1/api/purchase/products";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";

// ============================================================
// 🎯 MAIN COMPONENT
// ============================================================

const InventoryReports: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tenantId = user?.tenantId || "";
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    };
  }, []);

  // ============================================================
  // 📡 FETCH DATA
  // ============================================================

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      const [reportRes, productRes, warehouseRes] = await Promise.all([
        axios.get<ReportData>(API_URL, { headers }),
        axios.get<Product[]>(PRODUCT_API_URL, { headers }),
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
      ]);

      setReportData(reportRes.data);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
      
      console.log("📊 Reports loaded:", reportRes.data);
      
    } catch (error) {
      console.error("Failed to load reports:", error);
      ToasterService.error("Failed to load inventory reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // ============================================================
  // 📊 COMPUTED VALUES
  // ============================================================

  const totalStock = reportData?.stockPerWarehouse?.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) || 0;

  const totalProducts = Object.keys(reportData?.stockPerProduct || {}).length;

  const lowStockItems = reportData?.stockPerWarehouse?.filter(
    (item) => item.quantity < 10
  ).length || 0;

  const agingStock = reportData?.agedStock?.length || 0;

  // ============================================================
  // 📥 EXPORT FUNCTIONS
  // ============================================================

  const exportPDF = async () => {
    if (!reportData) return;

    try {
      setExporting(true);
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.text("Inventory Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

      // Stock Per Warehouse
      doc.setFontSize(14);
      doc.text("Stock Per Warehouse", 14, 35);
      
      autoTable(doc, {
        head: [["Warehouse", "Product", "Quantity"]],
        body: reportData.stockPerWarehouse.map((item) => [
          item.warehouse,
          item.product,
          item.quantity,
        ]),
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [6, 182, 212] },
      });

      // Aged Stock
      const finalY = (doc as any).lastAutoTable?.finalY || 50;
      doc.setFontSize(14);
      doc.text("Aged Stock", 14, finalY + 15);

      autoTable(doc, {
        head: [["Product", "Received Date", "Quantity"]],
        body: reportData.agedStock.map((item) => [
          item.product,
          new Date(item.receivedDate).toLocaleDateString(),
          item.quantity,
        ]),
        startY: finalY + 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [6, 182, 212] },
      });

      doc.save(`Inventory_Report_${new Date().toISOString().split("T")[0]}.pdf`);
      ToasterService.success("PDF exported successfully");
      
    } catch (error) {
      console.error("Failed to export PDF:", error);
      ToasterService.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = () => {
    if (!reportData) return;

    try {
      setExporting(true);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Stock Per Warehouse
      const ws1 = XLSX.utils.json_to_sheet(
        reportData.stockPerWarehouse.map((item) => ({
          Warehouse: item.warehouse,
          Product: item.product,
          Quantity: item.quantity,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws1, "Stock Per Warehouse");

      // Sheet 2: Aged Stock
      const ws2 = XLSX.utils.json_to_sheet(
        reportData.agedStock.map((item) => ({
          Product: item.product,
          "Received Date": new Date(item.receivedDate).toLocaleDateString(),
          Quantity: item.quantity,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws2, "Aged Stock");

      // Sheet 3: Stock Per Product Summary
      const ws3 = XLSX.utils.json_to_sheet(
        Object.entries(reportData.stockPerProduct).map(([productId, quantity]) => ({
          "Product ID": productId,
          "Product Name": products.find((p) => String(p.id) === productId)?.name || "Unknown",
          Quantity: quantity,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws3, "Stock Per Product");

      XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
      ToasterService.success("Excel exported successfully");
      
    } catch (error) {
      console.error("Failed to export Excel:", error);
      ToasterService.error("Failed to export Excel");
    } finally {
      setExporting(false);
    }
  };

  // ============================================================
  // 🔍 HELPER FUNCTIONS
  // ============================================================

  const getWarehouseName = (code: string) => {
    const warehouse = warehouses.find((w) => w.code === code || String(w.id) === code);
    return warehouse?.name || warehouse?.code || code;
  };

  const getProductName = (id: string) => {
    const product = products.find((p) => String(p.id) === id);
    return product?.name || `Product #${id}`;
  };

  // ============================================================
  // 🖥️ UI RENDER
  // ============================================================

  return (
    <div className="p-6">
      <PageMeta title="Inventory Reports" description="View inventory reports" />
      <PageBreadcrumb pageTitle="Inventory Reports" />

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory Reports</h2>
            <p className="text-sm text-gray-500">
              Overview of your inventory across all warehouses.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportPDF}
              disabled={loading || exporting || !reportData}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <DocumentArrowDownIcon className="mr-1 inline h-4 w-4" />
              PDF
            </button>
            <button
              onClick={exportExcel}
              disabled={loading || exporting || !reportData}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <DocumentArrowDownIcon className="mr-1 inline h-4 w-4" />
              Excel
            </button>
            <button
              onClick={fetchReports}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowPathIcon className="mr-1 inline h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <ArrowPathIcon className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-2 text-sm text-gray-500">Loading reports...</p>
            </div>
          </div>
        ) : !reportData ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No report data available</p>
              <button
                onClick={fetchReports}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 p-2">
                    <CubeIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Products</p>
                    <p className="text-xl font-bold text-gray-900">{totalProducts}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 p-2">
                    <BuildingOffice2Icon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Stock</p>
                    <p className="text-xl font-bold text-gray-900">{totalStock.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-yellow-100 p-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Low Stock Items</p>
                    <p className="text-xl font-bold text-yellow-600">{lowStockItems}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 p-2">
                    <ClockIcon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Aging Stock</p>
                    <p className="text-xl font-bold text-red-600">{agingStock}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Per Warehouse Table */}
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Stock Per Warehouse
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Warehouse</th>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.stockPerWarehouse.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{item.warehouse}</td>
                        <td className="px-4 py-2">{item.product}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                    {reportData.stockPerWarehouse.length === 0 && (
                      <tr>
                        <td className="px-4 py-4 text-center text-gray-500" colSpan={3}>
                          No stock data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Aged Stock Table */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                Aged Stock (Items sitting in warehouse)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2">Received Date</th>
                      <th className="px-4 py-2 text-right">Quantity</th>
                      <th className="px-4 py-2 text-center">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.agedStock.map((item, index) => {
                      const daysOld = Math.floor(
                        (Date.now() - new Date(item.receivedDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      );
                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.product}</td>
                          <td className="px-4 py-2">
                            {new Date(item.receivedDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right font-medium">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                daysOld > 90
                                  ? "bg-red-100 text-red-700"
                                  : daysOld > 60
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {daysOld} days
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {reportData.agedStock.length === 0 && (
                      <tr>
                        <td className="px-4 py-4 text-center text-gray-500" colSpan={4}>
                          No aging stock data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InventoryReports;
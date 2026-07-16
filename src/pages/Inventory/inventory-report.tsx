// pages/InventoryReports.tsx

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CubeIcon,
  BuildingOffice2Icon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { ListingPdfExportButton } from "../../components/common/export";

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
  productName: string;
  code: string;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

const API_URL = "/v1/api/inventory/reports";
const PRODUCT_API_URL = "/v1/api/purchase/products";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";

const MOCK_REPORT_DATA: ReportData = {
  stockPerProduct: {
    "1": 100,
    "2": 50,
    "3": 25,
    "4": 10,
  },
  stockPerWarehouse: [
    { warehouse: "WH-01", product: "Product 1", quantity: 100 },
    { warehouse: "WH-01", product: "Product 2", quantity: 50 },
    { warehouse: "WH-02", product: "Product 1", quantity: 25 },
    { warehouse: "WH-02", product: "Product 3", quantity: 10 },
  ],
  agedStock: [
    { product: "Product 1", receivedDate: "2026-01-15", quantity: 30 },
    { product: "Product 2", receivedDate: "2026-02-20", quantity: 20 },
    { product: "Product 3", receivedDate: "2026-03-10", quantity: 5 },
  ],
};

const InventoryReports: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async (): Promise<void> => {
    try {
      setLoading(true);
      setPermissionDenied(false);

      const [reportRes, productRes, warehouseRes] = await Promise.all([
        axios.get<ReportData>(API_URL, { headers }),
        axios.get<Product[]>(PRODUCT_API_URL, { headers }),
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
      ]);

      setReportData(reportRes.data);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
    } catch (error: any) {
      console.error("Failed to load reports:", error);

      if (error.response?.status === 403) {
        setPermissionDenied(true);
        ToasterService.warning(
          "You don't have permission to view reports. Showing mock data for preview.",
          "Permission Denied"
        );
        setReportData(MOCK_REPORT_DATA);
        setProducts([
          { id: 1, productName: "Product 1", code: "P001" },
          { id: 2, productName: "Product 2", code: "P002" },
          { id: 3, productName: "Product 3", code: "P003" },
        ]);
        setWarehouses([
          { id: 1, code: "WH-01", name: "Main Warehouse" },
          { id: 2, code: "WH-02", name: "Secondary Warehouse" },
        ]);
      } else {
        ToasterService.error("Failed to load reports", getErrorMessage(error, "Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (typeof data === "string") return data;
      return data?.message || data?.detail || data?.error || fallback;
    }
    return fallback;
  };

  const totalStock = reportData?.stockPerWarehouse?.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) || 0;

  const totalProducts = Object.keys(reportData?.stockPerProduct || {}).length;

  const lowStockItems = reportData?.stockPerWarehouse?.filter(
    (item) => item.quantity < 10
  ).length || 0;

  const agingStock = reportData?.agedStock?.length || 0;

  const getAgingStatus = (days: number) => {
    if (days > 90) return { label: "Critical", className: "bg-red-100 text-red-700" };
    if (days > 60) return { label: "Aging", className: "bg-yellow-100 text-yellow-700" };
    return { label: "Healthy", className: "bg-green-100 text-green-700" };
  };

  return (
    <>
      <PageMeta title="Inventory Reports" description="View inventory reports" />
      <PageBreadcrumb pageTitle="Inventory Reports" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory Reports</h2>
            <p className="text-sm text-gray-500">Overview of your inventory across all warehouses.</p>
          </div>

          {!permissionDenied && reportData && (
            <ListingPdfExportButton<ReportData>
              title="Inventory Report"
              subtitle="Complete inventory report"
              reportLabel="Inventory Report"
              data={[reportData]}
              fileName="Inventory_Report"
              disabled={loading || exporting}
              metadata={(rows, rangeLabel) => [
                { label: "Total Products", value: totalProducts },
                { label: "Total Stock", value: totalStock },
                { label: "Low Stock Items", value: lowStockItems },
                { label: "Aging Stock", value: agingStock },
              ]}
              columns={[
                { header: "Product", accessor: (item) => item.stockPerWarehouse?.[0]?.product || "" },
                { header: "Warehouse", accessor: (item) => item.stockPerWarehouse?.[0]?.warehouse || "" },
                { header: "Quantity", accessor: (item) => item.stockPerWarehouse?.[0]?.quantity || 0 },
              ]}
            />
          )}
        </div>

        {permissionDenied && (
          <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-700">
            <LockClosedIcon className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Demo Mode</p>
              <p className="text-xs">
                You don't have permission to view reports. Showing mock data for UI preview.
                Contact administrator for access.
              </p>
            </div>
          </div>
        )}

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard
                label="Total Products"
                value={totalProducts}
                gradient="from-blue-50 to-indigo-50"
                borderColor="border-blue-100"
                labelColor="text-blue-600"
                icon={<CubeIcon className="h-5 w-5" />}
              />
              <StatsCard
                label="Total Stock"
                value={totalStock.toLocaleString()}
                gradient="from-green-50 to-emerald-50"
                borderColor="border-green-100"
                labelColor="text-green-600"
                icon={<BuildingOffice2Icon className="h-5 w-5" />}
              />
              <StatsCard
                label="Low Stock Items"
                value={lowStockItems}
                gradient="from-yellow-50 to-orange-50"
                borderColor="border-yellow-100"
                labelColor="text-yellow-600"
                icon={<ExclamationTriangleIcon className="h-5 w-5" />}
              />
              <StatsCard
                label="Aging Stock"
                value={agingStock}
                gradient="from-red-50 to-rose-50"
                borderColor="border-red-100"
                labelColor="text-red-600"
                icon={<ClockIcon className="h-5 w-5" />}
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Stock Per Warehouse</h3>
              <div className="overflow-x-auto">
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
                        <td className="px-4 py-2 text-right font-medium">{item.quantity}</td>
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

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Aged Stock</h3>
              <div className="overflow-x-auto">
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
                        (Date.now() - new Date(item.receivedDate).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const status = getAgingStatus(daysOld);
                      return (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.product}</td>
                          <td className="px-4 py-2">{new Date(item.receivedDate).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-right font-medium">{item.quantity}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>
                              {status.label} ({daysOld}d)
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
    </>
  );
};

export default InventoryReports;
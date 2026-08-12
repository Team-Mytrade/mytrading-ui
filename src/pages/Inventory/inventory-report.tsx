import React, { useEffect, useMemo, useState } from "react";
import FilterPopover from "../../components/common/filter";
import {
  CubeIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { ListingPdfExportButton } from "../../components/common/export";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

// STATIC DATA
const STATIC_STOCK_DATA = [
  {
    id: 1,
    productId: 1,
    productName: "Mouse",
    productCode: "2-bu-0003",
    warehouseId: 1,
    warehouseName: "warehouse 1",
    warehouseCode: "FSA",
    quantity: 100,
    reservedQty: 20,
    minStockLevel: 10,
    available: 80,
    type: "GRN",
    referenceNo: "TENANT_1-GRN-202607-000001",
    movementDate: "2026-07-01",
    createdDate: "2026-07-01T10:00:00Z",
    movementCount: 45,
    lastMovementDate: "2026-08-01",
    price: 50,
    expiryDate: "2028-12-31",
  },
  {
    id: 2,
    productId: 2,
    productName: "Table",
    productCode: "2-bu-0002",
    warehouseId: 2,
    warehouseName: "Mumbai",
    warehouseCode: "WH-2026-001",
    quantity: 54,
    reservedQty: 52,
    minStockLevel: 50,
    available: 2,
    type: "GRN",
    referenceNo: "TENANT_1-GRN-202607-000002",
    movementDate: "2026-07-02",
    createdDate: "2026-07-02T10:00:00Z",
    movementCount: 10,
    lastMovementDate: "2026-07-15",
    price: 150,
    expiryDate: "2028-12-31",
  },
  {
    id: 3,
    productId: 3,
    productName: "Refridgerator",
    productCode: "2-bu-0001",
    warehouseId: 3,
    warehouseName: "etwet",
    warehouseCode: "123",
    quantity: 50,
    reservedQty: 20,
    minStockLevel: 20,
    available: 30,
    type: "RETURN",
    referenceNo: "TENANT_1-RET-202607-000001",
    movementDate: "2026-07-03",
    createdDate: "2026-07-03T10:00:00Z",
    movementCount: 5,
    lastMovementDate: "2026-06-01",
    price: 500,
    expiryDate: "2028-12-31",
  },
  {
    id: 4,
    productId: 4,
    productName: "Keyboard",
    productCode: "2-bu-0004",
    warehouseId: 1,
    warehouseName: "warehouse 1",
    warehouseCode: "FSA",
    quantity: 45,
    reservedQty: 10,
    minStockLevel: 50,
    available: 35,
    type: "GRN",
    referenceNo: "TENANT_1-GRN-202607-000004",
    movementDate: "2026-07-04",
    createdDate: "2026-07-04T10:00:00Z",
    movementCount: 60,
    lastMovementDate: "2026-08-05",
    price: 80,
    expiryDate: "2028-12-31",
  },
  {
    id: 5,
    productId: 5,
    productName: "Monitor",
    productCode: "2-bu-0005",
    warehouseId: 2,
    warehouseName: "Mumbai",
    warehouseCode: "WH-2026-001",
    quantity: 30,
    reservedQty: 0,
    minStockLevel: 10,
    available: 30,
    type: "TRANSFER",
    referenceNo: "TENANT_1-TRF-202607-000001",
    movementDate: "2026-07-05",
    createdDate: "2026-07-05T10:00:00Z",
    movementCount: 20,
    lastMovementDate: "2026-07-20",
    price: 300,
    expiryDate: "2028-12-31",
  },
];

const STATIC_WAREHOUSE_DATA = [
  { id: 1, code: "FSA", name: "warehouse 1" },
  { id: 2, code: "WH-2026-001", name: "Mumbai" },
  { id: 3, code: "123", name: "etwet" },
];

const STATIC_PRODUCT_DATA = [
  { id: 1, productName: "Mouse", code: "2-bu-0003", category: "Electronics" },
  { id: 2, productName: "Table", code: "2-bu-0002", category: "Furniture" },
  { id: 3, productName: "Refridgerator", code: "2-bu-0001", category: "Appliances" },
  { id: 4, productName: "Keyboard", code: "2-bu-0004", category: "Electronics" },
  { id: 5, productName: "Monitor", code: "2-bu-0005", category: "Electronics" },
];

const STATIC_BATCH_DATA = [
  { id: 1, batchNumber: "BATCH-2026-001", productName: "Mouse", productId: 1, quantity: 50, manufacturingDate: "2026-01-15", expiryDate: "2028-01-15", warehouseName: "warehouse 1", status: "Good" },
  { id: 2, batchNumber: "BATCH-2026-002", productName: "Table", productId: 2, quantity: 30, manufacturingDate: "2026-02-20", expiryDate: "2028-02-20", warehouseName: "Mumbai", status: "Expiring Soon" },
  { id: 3, batchNumber: "BATCH-2026-003", productName: "Refridgerator", productId: 3, quantity: 20, manufacturingDate: "2026-03-10", expiryDate: "2028-03-10", warehouseName: "etwet", status: "Good" },
];

const STATIC_SERIAL_DATA = [
  { id: 1, serial: "SN-001-2026", productName: "Mouse", productId: 1, warehouseName: "warehouse 1", status: "Active", warrantyEnd: "2028-01-15" },
  { id: 2, serial: "SN-002-2026", productName: "Table", productId: 2, warehouseName: "Mumbai", status: "Active", warrantyEnd: "2028-02-20" },
  { id: 3, serial: "SN-003-2026", productName: "Refridgerator", productId: 3, warehouseName: "etwet", status: "Sold", warrantyEnd: "2028-03-10" },
];

const STATIC_MOVEMENT_DATA = [
  { id: 1, productName: "Mouse", warehouseName: "warehouse 1", movementType: "GRN", quantity: 10, movementDate: "2026-08-01", referenceNo: "GRN-001" },
  { id: 2, productName: "Table", warehouseName: "Mumbai", movementType: "TRANSFER", quantity: 5, movementDate: "2026-07-28", referenceNo: "TRF-002" },
  { id: 3, productName: "Refridgerator", warehouseName: "etwet", movementType: "RETURN", quantity: 2, movementDate: "2026-07-25", referenceNo: "RET-003" },
  { id: 4, productName: "Keyboard", warehouseName: "warehouse 1", movementType: "GRN", quantity: 20, movementDate: "2026-08-05", referenceNo: "GRN-004" },
  { id: 5, productName: "Monitor", warehouseName: "Mumbai", movementType: "TRANSFER", quantity: 3, movementDate: "2026-07-20", referenceNo: "TRF-005" },
];

const STATIC_ADJUSTMENT_DATA = [
  { id: 1, productName: "Mouse", warehouseName: "warehouse 1", adjustmentType: "POSITIVE", quantity: 5, reason: "Inventory Count", adjustmentDate: "2026-07-30" },
  { id: 2, productName: "Table", warehouseName: "Mumbai", adjustmentType: "NEGATIVE", quantity: 2, reason: "Damaged", adjustmentDate: "2026-07-25" },
];

// Types
type StockItem = {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  reservedQty: number;
  minStockLevel: number;
  available: number;
  type: string;
  referenceNo: string;
  movementDate: string;
  createdDate: string;
  movementCount: number;
  lastMovementDate: string;
  price: number;
  expiryDate: string;
};

type Product = {
  id: number;
  productName: string;
  code: string;
  category: string;
};

type Warehouse = {
  id: number;
  code: string;
  name: string;
};

type Batch = {
  id: number;
  batchNumber: string;
  productName: string;
  productId: number;
  quantity: number;
  manufacturingDate: string;
  expiryDate: string;
  warehouseName: string;
  status: string;
};

type Serial = {
  id: number;
  serial: string;
  productName: string;
  productId: number;
  warehouseName: string;
  status: string;
  warrantyEnd: string;
};

type Movement = {
  id: number;
  productName: string;
  warehouseName: string;
  movementType: string;
  quantity: number;
  movementDate: string;
  referenceNo: string;
};

type Adjustment = {
  id: number;
  productName: string;
  warehouseName: string;
  adjustmentType: string;
  quantity: number;
  reason: string;
  adjustmentDate: string;
};

// Enums for Report Types
type ReportType = 
  | "current" 
  | "warehouse" 
  | "product" 
  | "low" 
  | "reorder" 
  | "movement" 
  | "adjustment" 
  | "batch" 
  | "serial" 
  | "valuation" 
  | "reserved" 
  | "expired" 
  | "near-expiry" 
  | "quality" 
  | "dead" 
  | "fast" 
  | "slow";

const InventoryReports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>("current");
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [stocks] = useState<StockItem[]>(STATIC_STOCK_DATA);
  const [products] = useState<Product[]>(STATIC_PRODUCT_DATA);
  const [warehouses] = useState<Warehouse[]>(STATIC_WAREHOUSE_DATA);
  const [batches] = useState<Batch[]>(STATIC_BATCH_DATA);
  const [serials] = useState<Serial[]>(STATIC_SERIAL_DATA);
  const [movements] = useState<Movement[]>(STATIC_MOVEMENT_DATA);
  const [adjustments] = useState<Adjustment[]>(STATIC_ADJUSTMENT_DATA);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("")
  // Simulate loading
  useEffect(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  }, [reportType, selectedWarehouse, selectedProduct]);

  // Helper Functions
  const getProductName = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    return product?.productName || `Product #${productId}`;
  };

  const getProductCode = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    return product?.code || "";
  };

  const getProductCategory = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    return product?.category || "";
  };

  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    return warehouse?.name || `Warehouse #${warehouseId}`;
  };

  const getWarehouseCode = (warehouseId: number) => {
    const warehouse = warehouses.find((w) => w.id === warehouseId);
    return warehouse?.code || "";
  };

  // Status Helper
  const getStatus = (item: StockItem) => {
    const available = item.quantity - item.reservedQty;
    if (available <= 0) {
      return { label: "Out of Stock", className: "bg-red-100 text-red-700" };
    }
    if (available <= item.minStockLevel) {
      return { label: "Low Stock", className: "bg-yellow-100 text-yellow-700" };
    }
    return { label: "Healthy", className: "bg-green-100 text-green-700" };
  };

  // Filtered Data
  const getFilteredData = () => {
    switch (reportType) {
      case "current":
        return stocks;
      case "warehouse":
        return selectedWarehouse ? stocks.filter(s => s.warehouseId === selectedWarehouse) : stocks;
      case "product":
        return selectedProduct ? stocks.filter(s => s.productId === selectedProduct) : stocks;
      case "low":
        return stocks.filter(s => {
          const available = s.quantity - s.reservedQty;
          return available > 0 && available <= s.minStockLevel;
        });
      case "reorder":
        return stocks.filter(s => s.quantity <= s.minStockLevel * 0.5);
      case "movement":
        return movements;
      case "adjustment":
        return adjustments;
      case "batch":
        return batches;
      case "serial":
        return serials;
      case "valuation":
        return stocks.map(s => ({
          ...s,
          value: s.quantity * s.price,
        }));
      case "reserved":
        return stocks.filter(s => s.reservedQty > 0);
      case "expired":
        return stocks.filter(s => new Date(s.expiryDate) < new Date());
      case "near-expiry":
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        return stocks.filter(s => {
          const expiry = new Date(s.expiryDate);
          return expiry > today && expiry <= thirtyDaysFromNow;
        });
      case "quality":
        return stocks.filter(s => s.available > 0).slice(0, 3);
      case "dead":
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return stocks.filter(s => new Date(s.lastMovementDate) < sixMonthsAgo);
      case "fast":
        return [...stocks].sort((a, b) => b.movementCount - a.movementCount).slice(0, 3);
      case "slow":
        return [...stocks].sort((a, b) => a.movementCount - b.movementCount).slice(0, 3);
      default:
        return stocks;
    }
  };

  const data = getFilteredData();

  //  Stats
  const stats = useMemo(() => {
    const totalQty = stocks.reduce((sum, s) => sum + s.quantity, 0);
    const lowStock = stocks.filter(s => {
      const available = s.quantity - s.reservedQty;
      return available > 0 && available <= s.minStockLevel;
    });
    const totalProducts = new Set(stocks.map(s => s.productId)).size;
    const totalValue = stocks.reduce((sum, s) => sum + (s.quantity * s.price), 0);

    return {
      totalProducts,
      totalQty,
      lowStock: lowStock.length,
      totalItems: stocks.length,
      totalValue,
      totalBatches: batches.length,
      totalSerials: serials.length,
      totalMovements: movements.length,
      totalAdjustments: adjustments.length,
    };
  }, [stocks]);

  //  Columns for different reports
  const currentStockColumns: ColumnDef<any>[] = [
    { key: "productName", label: "Product", sortable: true, render: (item) => item.productName },
    { key: "productCode", label: "Code", sortable: true, render: (item) => item.productCode },
    { key: "warehouseName", label: "Warehouse", sortable: true, render: (item) => item.warehouseName },
    { key: "quantity", label: "Qty", sortable: true, render: (item) => item.quantity },
    { key: "available", label: "Available", sortable: true, render: (item) => item.available },
    { key: "status", label: "Status", sortable: false, render: (item) => {
      const status = getStatus(item);
      return <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>;
    }},
  ];

  const movementColumns: ColumnDef<any>[] = [
    { key: "productName", label: "Product", sortable: true, render: (item) => item.productName },
    { key: "warehouseName", label: "Warehouse", sortable: true, render: (item) => item.warehouseName },
    { key: "movementType", label: "Type", sortable: true, render: (item) => (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.movementType === "GRN" ? "bg-green-100 text-green-700" : item.movementType === "TRANSFER" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
        {item.movementType}
      </span>
    )},
    { key: "quantity", label: "Qty", sortable: true, render: (item) => item.quantity },
    { key: "movementDate", label: "Date", sortable: true, render: (item) => new Date(item.movementDate).toLocaleDateString() },
    { key: "referenceNo", label: "Reference", sortable: true, render: (item) => item.referenceNo },
  ];

  const batchColumns: ColumnDef<any>[] = [
    { key: "batchNumber", label: "Batch No", sortable: true, render: (item) => item.batchNumber },
    { key: "productName", label: "Product", sortable: true, render: (item) => item.productName },
    { key: "quantity", label: "Qty", sortable: true, render: (item) => item.quantity },
    { key: "manufacturingDate", label: "Manufacturing", sortable: true, render: (item) => new Date(item.manufacturingDate).toLocaleDateString() },
    { key: "expiryDate", label: "Expiry", sortable: true, render: (item) => new Date(item.expiryDate).toLocaleDateString() },
    { key: "warehouseName", label: "Warehouse", sortable: true, render: (item) => item.warehouseName },
    { key: "status", label: "Status", sortable: false, render: (item) => (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "Good" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
        {item.status}
      </span>
    )},
  ];

  const serialColumns: ColumnDef<any>[] = [
    { key: "serial", label: "Serial No", sortable: true, render: (item) => item.serial },
    { key: "productName", label: "Product", sortable: true, render: (item) => item.productName },
    { key: "warehouseName", label: "Warehouse", sortable: true, render: (item) => item.warehouseName },
    { key: "status", label: "Status", sortable: true, render: (item) => (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
        {item.status}
      </span>
    )},
    { key: "warrantyEnd", label: "Warranty End", sortable: true, render: (item) => new Date(item.warrantyEnd).toLocaleDateString() },
  ];

  const valuationColumns: ColumnDef<any>[] = [
    { key: "productName", label: "Product", sortable: true, render: (item) => item.productName },
    { key: "quantity", label: "Qty", sortable: true, render: (item) => item.quantity },
    { key: "price", label: "Unit Price", sortable: true, render: (item) => `₹${item.price}` },
    { key: "value", label: "Total Value", sortable: true, render: (item) => `₹${item.value}` },
    { key: "warehouseName", label: "Warehouse", sortable: true, render: (item) => item.warehouseName },
  ];

  const adjustmentColumns: ColumnDef<any>[] = [
    { key: "productName", label: "Product", sortable: true, render: (item) => item.productName },
    { key: "warehouseName", label: "Warehouse", sortable: true, render: (item) => item.warehouseName },
    { key: "adjustmentType", label: "Type", sortable: true, render: (item) => (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.adjustmentType === "POSITIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {item.adjustmentType}
      </span>
    )},
    { key: "quantity", label: "Qty", sortable: true, render: (item) => item.quantity },
    { key: "reason", label: "Reason", sortable: true, render: (item) => item.reason },
    { key: "adjustmentDate", label: "Date", sortable: true, render: (item) => new Date(item.adjustmentDate).toLocaleDateString() },
  ];

  //  Get columns based on report type
  const getColumns = () => {
    switch (reportType) {
      case "movement": return movementColumns;
      case "batch": return batchColumns;
      case "serial": return serialColumns;
      case "valuation": return valuationColumns;
      case "adjustment": return adjustmentColumns;
      default: return currentStockColumns;
    }
  };

  //  Get report title
  const getReportTitle = () => {
    switch (reportType) {
      case "current": return "Current Stock Report";
      case "warehouse": return "Warehouse Stock Report";
      case "product": return "Product Stock Report";
      case "low": return "Low Stock Report";
      case "reorder": return "Reorder Report";
      case "movement": return "Stock Movement Report";
      case "adjustment": return "Inventory Adjustment Report";
      case "batch": return "Batch Report";
      case "serial": return "Serial Number Report";
      case "valuation": return "Inventory Valuation Report";
      case "reserved": return "Reserved Stock Report";
      case "expired": return "Expired Product Report";
      case "near-expiry": return "Near Expiry Report";
      case "quality": return "Quality Inspection Report";
      case "dead": return "Dead Stock Report";
      case "fast": return "Fast Moving Products Report";
      case "slow": return "Slow Moving Products Report";
      default: return "Inventory Report";
    }
  };

  // Flatten data for PDF
  const flattenedData = data.map((item: any) => ({
    ...item,
    productName: item.productName || getProductName(item.productId),
    productCode: item.productCode || getProductCode(item.productId),
    warehouseName: item.warehouseName || getWarehouseName(item.warehouseId),
  }));

  return (
    <>
      <PageMeta title="Inventory Reports" description="View inventory reports" />
      <PageBreadcrumb pageTitle="Inventory Reports" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
         {/* Stats Cards - Dynamic based on report */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard
                label="Total Records"
                value={data.length}
                gradient="from-blue-50 to-indigo-50"
                borderColor="border-blue-100"
                labelColor="text-blue-600"
                icon={<CubeIcon className="h-5 w-5" />}
              />
              <StatsCard
                label="Total Products"
                value={stats.totalProducts}
                gradient="from-cyan-50 to-blue-50"
                borderColor="border-cyan-100"
                labelColor="text-cyan-600"
                icon={<BuildingOffice2Icon className="h-5 w-5" />}
              />
              <StatsCard
                label="Total Stock Quantity"
                value={stats.totalQty.toLocaleString()}
                gradient="from-green-50 to-emerald-50"
                borderColor="border-green-100"
                labelColor="text-green-600"
                icon={<BuildingOffice2Icon className="h-5 w-5" />}
              />
              <StatsCard
                label="Low Stock Items"
                value={stats.lowStock}
                gradient="from-yellow-50 to-orange-50"
                borderColor="border-yellow-100"
                labelColor="text-yellow-600"
                icon={<ExclamationTriangleIcon className="h-5 w-5" />}
              />
            </div>

            
    {/*  Filters + PDF (Below Stats Cards) */}
<div className="mb-6  flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
  <div className="flex items-center gap-2">
    {/* Report Type Dropdown */}
    <select
      value={reportType}
      onChange={(e) => setReportType(e.target.value as ReportType)}
      className="rounded-lg border border-gray-200 bg-white -mt-4 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[160px]"
    >
      <option value="current"> Current Stock</option>
      <option value="warehouse"> Warehouse Stock</option>
      <option value="product"> Product Stock</option>
      <option value="low"> Low Stock</option>
      <option value="reorder"> Reorder</option>
      <option value="movement"> Movement</option>
      <option value="adjustment"> Adjustment</option>
      <option value="batch"> Batch</option>
      <option value="serial"> Serial</option>
      <option value="valuation"> Valuation</option>
      <option value="reserved"> Reserved</option>
      <option value="expired"> Expired</option>
      <option value="near-expiry"> Near Expiry</option>
      <option value="quality"> Quality</option>
      <option value="dead"> Dead Stock</option>
      <option value="fast"> Fast Moving</option>
      <option value="slow"> Slow Moving</option>
    </select>

    {/* Warehouse/Product Filters (shown when needed) */}
    {reportType === "warehouse" && (
      <select
        value={selectedWarehouse || ""}
        onChange={(e) => setSelectedWarehouse(Number(e.target.value) || null)}
        className="rounded-lg border -mt-4 border-gray-200 bg-white px-3 pr-8 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <option value="">All Warehouses</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
    )}

    {reportType === "product" && (
      <select
        value={selectedProduct || ""}
        onChange={(e) => setSelectedProduct(Number(e.target.value) || null)}
        className="rounded-lg border border-gray-200 bg-white -mt-4 pr-8 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        <option value="">All Products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>{p.productName}</option>
        ))}
      </select>
    )}

    {/* PDF Export Button */}
    <ListingPdfExportButton
      title={getReportTitle()}
      subtitle="Complete inventory report"
      reportLabel="Inventory Report"
      data={flattenedData}
      fileName={`${getReportTitle().replace(/\s/g, '_')}`}
      disabled={loading}
      metadata={(rows, rangeLabel) => [
        { label: "Total Records", value: rows.length },
        { label: "Total Products", value: stats.totalProducts },
        { label: "Total Stock Quantity", value: stats.totalQty },
        { label: "Low Stock Items", value: stats.lowStock },
      ]}
      columns={[
        { header: "Product", accessor: (item) => item.productName },
        { header: "Code", accessor: (item) => item.productCode },
        { header: "Warehouse", accessor: (item) => item.warehouseName },
        { header: "Quantity", accessor: (item) => item.quantity },
        { header: "Available", accessor: (item) => item.available },
      ]}
    />
  </div>
</div>

      {/* ✅ Table */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <ReusableTable
          data={data}
          columns={getColumns()}
          loading={loading}
          pageSize={10}
          defaultSortKey="id"
          defaultSortOrder="desc"
          enableRowDetails={false}
          className=""
        />
      </div>
    </div>
  </>
);
}    
export default InventoryReports;

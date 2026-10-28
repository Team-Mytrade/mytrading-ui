import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCardFilter, { StatsCardOption, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { ToasterService } from "../../Services/ToasterService";
import { toLocalIsoDate, todayIso } from "../../utils/localDate";
import { formatMoney, formatNumber, formatDate } from "../../company/format";

/**
 * Inventory reports built from the live inventory records (stock levels, movements, adjustments, batches,
 * serial numbers, quality inspections) and the Product Catalogue (names, codes, standard cost).
 * Nothing here is sample data: an empty report means there is nothing of that kind yet.
 */

const INVENTORY = "/v1/api/inventory";
const PRODUCTS = "/v1/api/common/products";

type Row = Record<string, any> & { id: string | number };

type Warehouse = { id: number; code?: string; name?: string };
type Product = {
  id: number;
  productName?: string;
  productCode?: string;
  categoryName?: string;
  productCategory?: { categoryName?: string };
  standardCost?: number | null;
};
type StockLevel = {
  id: number;
  productId: number;
  quantity: number;
  reserved?: number;
  available?: number;
  reorderLevel?: number | null;
  warehouse?: Warehouse | null;
};

type ReportType =
  | "current"
  | "low"
  | "valuation"
  | "reserved"
  | "movement"
  | "adjustment"
  | "batch"
  | "serial"
  | "quality"
  | "analysis";

/** Extra data a report needs on top of stock levels, products and warehouses. */
type Dataset = "movements" | "adjustments" | "batches" | "serials" | "inspections";

const REPORTS: { key: ReportType; label: string; group: string; needs: Dataset[]; help: string }[] = [
  { key: "current", label: "Current Stock", group: "Stock", needs: [], help: "Stock on hand, reserved for orders and still available, per product and warehouse." },
  { key: "low", label: "Low Stock & Reorder", group: "Stock", needs: [], help: "Records at or below their reorder level, or out of stock. Order at least the shortfall to get back to the reorder level." },
  { key: "valuation", label: "Stock Valuation", group: "Stock", needs: [], help: "Stock on hand × the product's standard cost from the Product Catalogue." },
  { key: "reserved", label: "Reserved Stock", group: "Stock", needs: [], help: "Stock held for confirmed sales orders and not yet dispatched." },
  { key: "movement", label: "Stock Movements", group: "Activity", needs: ["movements"], help: "Every receipt, issue, transfer and correction in the chosen period." },
  { key: "adjustment", label: "Stock Adjustments", group: "Activity", needs: ["adjustments"], help: "Stock counted up or written off in the chosen period, with the reason." },
  { key: "analysis", label: "Fast / Slow / Dead Stock", group: "Activity", needs: ["movements"], help: "Quantity issued (sold or issued, not written off) per product in the chosen period. Fast = top third, Slow = the rest, Not issued = received or moved but nothing issued, Dead = in stock with no movement at all." },
  { key: "batch", label: "Batches & Expiry", group: "Tracking", needs: ["batches"], help: "Batches with stock, by expiry date. Expiring soon = within 30 days." },
  { key: "serial", label: "Serial Numbers", group: "Tracking", needs: ["serials"], help: "Serial-tracked units and where they are." },
  { key: "quality", label: "Quality Inspections", group: "Tracking", needs: ["inspections"], help: "Inspection results in the chosen period." },
];

const PERIODS = [
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 180, label: "Last 6 months" },
  { days: 365, label: "Last 12 months" },
];

/** Reports that use the period selector. */
const PERIOD_REPORTS: ReportType[] = ["movement", "adjustment", "analysis", "quality"];

const IN_TYPES = ["GRN", "PURCHASE_RECEIPT", "RETURN", "CUSTOMER_RETURN"];
const OUT_TYPES = ["ISSUE", "SALES_ISSUE", "SUPPLIER_RETURN", "DAMAGE"];
/** What counts as demand in the movement analysis (write-offs and returns to the supplier don't). */
const ISSUE_TYPES = ["ISSUE", "SALES_ISSUE"];
const TRANSFER_TYPES = ["TRANSFER", "WAREHOUSE_TRANSFER"];

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const qty = (value: unknown) => formatNumber(num(value));
const rupees = (value: unknown) =>
  formatMoney(num(value));
const humanize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase()) || "--";

/** "2026-10-21" (or [2026,10,21]) → "21 Oct 2026". */
const toIso = (value: unknown): string => {
  if (Array.isArray(value) && value.length >= 3) {
    return `${value[0]}-${String(value[1]).padStart(2, "0")}-${String(value[2]).padStart(2, "0")}`;
  }
  const text = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
};
const showDate = (value: unknown) => {
  const iso = toIso(value);
  if (!iso) return "--";
  const [y, m, d] = iso.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d));
};

const daysFromToday = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - start.getTime()) / 86400000);
};

/** In / Out / Transfer for a movement; adjustments and corrections by which side they have a location on. */
const directionOf = (movement: Row) => {
  const type = String(movement.movementType || "").toUpperCase();
  if (IN_TYPES.includes(type)) return "In";
  if (OUT_TYPES.includes(type)) return "Out";
  if (TRANSFER_TYPES.includes(type)) return "Transfer";
  if (movement.toLocation && !movement.fromLocation) return "In";
  if (movement.fromLocation && !movement.toLocation) return "Out";
  return "Other";
};

const Pill = ({ text, tone }: { text: string; tone: "green" | "amber" | "red" | "blue" | "slate" }) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{text}</span>;
};

const STOCK_TONE: Record<string, "green" | "amber" | "red"> = { Healthy: "green", "Low Stock": "amber", "Out of Stock": "red" };
const CLASS_TONE: Record<string, "green" | "amber" | "red"> = { Fast: "green", Slow: "amber", Dead: "red" };

const listOf = (data: unknown): Row[] => (Array.isArray(data) ? data : []);

const InventoryReports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>("current");
  const [warehouseId, setWarehouseId] = useState("");
  const [periodDays, setPeriodDays] = useState(90);

  const [stocks, setStocks] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [extra, setExtra] = useState<Partial<Record<Dataset, Row[]>>>({});
  const [batchStock, setBatchStock] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const report = REPORTS.find((item) => item.key === reportType) ?? REPORTS[0];

  const loadBase = async () => {
    setLoading(true);
    const [stockRes, productRes, warehouseRes] = await Promise.allSettled([
      axios.get(`${INVENTORY}/stock-levels`),
      axios.get(PRODUCTS),
      axios.get(`${INVENTORY}/warehouses`),
    ]);
    if (stockRes.status === "fulfilled") setStocks(listOf(stockRes.value.data) as StockLevel[]);
    else ToasterService.error("Failed to load stock levels");
    if (productRes.status === "fulfilled") setProducts(listOf(productRes.value.data) as Product[]);
    else ToasterService.error("Failed to load products", "Product names and costs may be missing.");
    if (warehouseRes.status === "fulfilled") setWarehouses(listOf(warehouseRes.value.data) as Warehouse[]);
    setLoading(false);
  };

  const loadDataset = async (dataset: Dataset, force = false) => {
    if (!force && extra[dataset]) return;
    setLoading(true);
    try {
      if (dataset === "batches") {
        const [batches, details] = await Promise.all([
          axios.get(`${INVENTORY}/batches`),
          axios.get(`${INVENTORY}/batches/stock-details`),
        ]);
        setBatchStock(listOf(details.data));
        setExtra((current) => ({ ...current, batches: listOf(batches.data) }));
      } else {
        const path = {
          movements: "stock-movements",
          adjustments: "stock-adjustments",
          serials: "serial-numbers",
          inspections: "quality-inspections",
        }[dataset];
        const res = await axios.get(`${INVENTORY}/${path}`);
        setExtra((current) => ({ ...current, [dataset]: listOf(res.data) }));
      }
    } catch {
      ToasterService.error(`Failed to load ${dataset} for this report`);
      setExtra((current) => ({ ...current, [dataset]: [] }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    report.needs.forEach((dataset) => void loadDataset(dataset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType]);

  const refresh = () => {
    void loadBase();
    report.needs.forEach((dataset) => void loadDataset(dataset, true));
  };

  const productById = useMemo(() => new Map(products.map((p) => [Number(p.id), p])), [products]);
  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [Number(w.id), w])), [warehouses]);
  const productName = (id: unknown) => productById.get(Number(id))?.productName || `Product #${id}`;
  const productCode = (id: unknown) => productById.get(Number(id))?.productCode || "";
  const warehouseName = (warehouse?: Warehouse | null, id?: unknown) => {
    const found = warehouse ?? warehouseById.get(Number(id));
    return found ? found.name || found.code || `Warehouse #${found.id}` : "--";
  };

  const inWarehouse = (id: unknown) => !warehouseId || String(id) === warehouseId;
  const since = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - periodDays);
    return toLocalIsoDate(date);
  }, [periodDays]);
  const inPeriod = (value: unknown) => {
    const iso = toIso(value);
    return Boolean(iso) && iso >= since;
  };

  /* ---------------- rows per report ---------------- */

  const stockRows = useMemo<Row[]>(
    () =>
      stocks
        .filter((s) => inWarehouse(s.warehouse?.id))
        .map((s) => {
          const available = num(s.available ?? num(s.quantity) - num(s.reserved));
          const reorder = s.reorderLevel == null ? null : num(s.reorderLevel);
          const status = available <= 0 ? "Out of Stock" : reorder != null && available <= reorder ? "Low Stock" : "Healthy";
          const unitCost = productById.get(Number(s.productId))?.standardCost;
          return {
            id: s.id,
            productId: s.productId,
            product: productName(s.productId),
            code: productCode(s.productId),
            warehouse: warehouseName(s.warehouse),
            onHand: num(s.quantity),
            reserved: num(s.reserved),
            available,
            reorderLevel: reorder,
            shortfall: reorder == null ? null : Math.max(0, reorder - available),
            status,
            unitCost: unitCost == null ? null : num(unitCost),
            value: unitCost == null ? null : num(s.quantity) * num(unitCost),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stocks, productById, warehouseById, warehouseId]
  );

  const movementRows = useMemo<Row[]>(
    () =>
      (extra.movements ?? [])
        .filter((m) => inWarehouse(m.warehouse?.id) && inPeriod(m.movementDate))
        .map((m) => ({
          id: m.id,
          date: toIso(m.movementDate),
          type: m.movementType,
          direction: directionOf(m),
          product: productName(m.productId),
          code: productCode(m.productId),
          warehouse: warehouseName(m.warehouse),
          quantity: num(m.quantity),
          route: [m.fromLocation, m.toLocation].some(Boolean) ? `${m.fromLocation || "—"} → ${m.toLocation || "—"}` : "--",
          reference: m.reference || "--",
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extra.movements, productById, warehouseById, warehouseId, since]
  );

  const adjustmentRows = useMemo<Row[]>(
    () =>
      (extra.adjustments ?? [])
        .filter((a) => inWarehouse(a.warehouse?.id) && inPeriod(a.adjustmentDate))
        .map((a) => ({
          id: a.id,
          date: toIso(a.adjustmentDate),
          product: productName(a.productId),
          code: productCode(a.productId),
          warehouse: warehouseName(a.warehouse),
          direction: String(a.adjustmentType).toUpperCase() === "NEGATIVE" ? "Decrease" : "Increase",
          quantity: num(a.quantity),
          reason: humanize(a.reason),
          batch: a.batch?.batchNumber || "--",
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extra.adjustments, productById, warehouseById, warehouseId, since]
  );

  const analysisRows = useMemo<Row[]>(() => {
    const byProduct = new Map<number, { onHand: number; issued: number; received: number; movedInPeriod: boolean; last: string }>();
    const entry = (productId: number) => {
      if (!byProduct.has(productId)) byProduct.set(productId, { onHand: 0, issued: 0, received: 0, movedInPeriod: false, last: "" });
      return byProduct.get(productId)!;
    };
    stocks.filter((s) => inWarehouse(s.warehouse?.id)).forEach((s) => (entry(Number(s.productId)).onHand += num(s.quantity)));
    (extra.movements ?? [])
      .filter((m) => inWarehouse(m.warehouse?.id))
      .forEach((m) => {
        const item = entry(Number(m.productId));
        const date = toIso(m.movementDate);
        if (date > item.last) item.last = date;
        if (!inPeriod(m.movementDate)) return;
        item.movedInPeriod = true;
        const type = String(m.movementType || "").toUpperCase();
        if (ISSUE_TYPES.includes(type)) item.issued += num(m.quantity);
        if (IN_TYPES.includes(type)) item.received += num(m.quantity);
      });

    const issuing = [...byProduct.entries()].filter(([, v]) => v.issued > 0).sort((a, b) => b[1].issued - a[1].issued);
    const fast = new Set(issuing.slice(0, Math.ceil(issuing.length / 3)).map(([id]) => id));
    const classOf = (productId: number, v: { onHand: number; issued: number; movedInPeriod: boolean }) => {
      if (v.issued > 0) return fast.has(productId) ? "Fast" : "Slow";
      return v.movedInPeriod ? "Not issued" : "Dead";
    };

    return [...byProduct.entries()]
      .filter(([, v]) => v.onHand > 0 || v.issued > 0)
      .map(([productId, v]) => ({
        id: productId,
        product: productName(productId),
        code: productCode(productId),
        onHand: v.onHand,
        issued: v.issued,
        received: v.received,
        lastMovement: v.last,
        movementClass: classOf(productId, v),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, extra.movements, productById, warehouseId, since]);

  const batchRows = useMemo<Row[]>(() => {
    const batchById = new Map((extra.batches ?? []).map((b) => [Number(b.id), b]));
    return batchStock
      .filter((b) => num(b.quantity) > 0 && inWarehouse(b.warehouseId))
      .map((b) => {
        const batch = batchById.get(Number(b.batchId));
        const expiry = toIso(batch?.expiryDate);
        const days = expiry ? daysFromToday(expiry) : null;
        const expiryStatus = days == null ? "No expiry" : days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "OK";
        return {
          id: `${b.batchId}-${b.warehouseId}`,
          batch: b.batchNumber || batch?.batchNumber || `Batch #${b.batchId}`,
          product: productName(b.productId ?? batch?.productId),
          code: productCode(b.productId ?? batch?.productId),
          warehouse: warehouseName(null, b.warehouseId),
          manufactured: toIso(batch?.manufacturingDate),
          expiry,
          daysLeft: days,
          quantity: num(b.quantity),
          available: num(b.available),
          expiryStatus,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchStock, extra.batches, productById, warehouseById, warehouseId]);

  const serialRows = useMemo<Row[]>(
    () =>
      (extra.serials ?? [])
        .filter((s) => inWarehouse(s.warehouse?.id))
        .map((s) => ({
          id: s.id,
          serial: s.serial,
          product: productName(s.productId),
          code: productCode(s.productId),
          warehouse: warehouseName(s.warehouse),
          batch: s.batch?.batchNumber || "--",
          status: s.currentStatus || "--",
          warrantyEnd: toIso(s.warrantyEnd),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extra.serials, productById, warehouseById, warehouseId]
  );

  const inspectionRows = useMemo<Row[]>(
    () =>
      (extra.inspections ?? [])
        .filter((q) => inPeriod(q.inspectionDate))
        .map((q) => ({
          id: q.id,
          date: toIso(q.inspectionDate),
          product: productName(q.productId),
          code: productCode(q.productId),
          item: q.serialNumber?.serial || q.batchNumber || q.batch?.batchNumber || "--",
          inspectionType: humanize(q.inspectionType),
          result: String(q.result || "").toUpperCase(),
          inspector: q.inspector || "--",
          remarks: q.remarks || "",
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extra.inspections, productById, since]
  );

  const rows: Row[] = {
    current: stockRows,
    low: stockRows.filter((r) => r.status !== "Healthy"),
    valuation: stockRows.filter((r) => r.onHand !== 0),
    reserved: stockRows.filter((r) => r.reserved > 0),
    movement: movementRows,
    adjustment: adjustmentRows,
    analysis: analysisRows,
    batch: batchRows,
    serial: serialRows,
    quality: inspectionRows,
  }[reportType];

  /* ---------------- cards per report ---------------- */

  const cards = useMemo<StatsCardOption<Row>[]>(() => {
    const all = (label: string): StatsCardOption<Row> => ({ key: "ALL", label, match: () => true, tone: "cyan" });
    const by = (key: string, label: string, match: (row: Row) => boolean, tone: StatsCardOption<Row>["tone"]) => ({ key, label, match, tone });
    switch (reportType) {
      case "current":
        return [
          all("All Records"),
          by("OK", "Healthy", (r) => r.status === "Healthy", "green"),
          by("LOW", "Low Stock", (r) => r.status === "Low Stock", "amber"),
          by("OUT", "Out of Stock", (r) => r.status === "Out of Stock", "red"),
        ];
      case "low":
        return [all("Needs Attention"), by("LOW", "Low Stock", (r) => r.status === "Low Stock", "amber"), by("OUT", "Out of Stock", (r) => r.status === "Out of Stock", "red")];
      case "valuation":
        return [all("Records In Stock"), by("NOCOST", "No Standard Cost", (r) => r.unitCost == null || r.unitCost === 0, "amber")];
      case "reserved":
        return [all("Records With Reservations"), by("NONE", "Fully Reserved", (r) => r.available <= 0, "red")];
      case "movement":
        return [
          all("All Movements"),
          by("IN", "In", (r) => r.direction === "In", "green"),
          by("OUT", "Out", (r) => r.direction === "Out", "red"),
          by("TRANSFER", "Transfer", (r) => r.direction === "Transfer", "blue"),
        ];
      case "adjustment":
        return [all("All Adjustments"), by("UP", "Increase", (r) => r.direction === "Increase", "green"), by("DOWN", "Decrease", (r) => r.direction === "Decrease", "red")];
      case "analysis":
        return [
          all("Products"),
          by("FAST", "Fast Moving", (r) => r.movementClass === "Fast", "green"),
          by("SLOW", "Slow Moving", (r) => r.movementClass === "Slow", "amber"),
          by("IDLE", "Not Issued", (r) => r.movementClass === "Not issued", "slate"),
          by("DEAD", "Dead Stock", (r) => r.movementClass === "Dead", "red"),
        ];
      case "batch":
        return [
          all("Batches In Stock"),
          by("EXPIRED", "Expired", (r) => r.expiryStatus === "Expired", "red"),
          by("SOON", "Expiring Soon", (r) => r.expiryStatus === "Expiring soon", "amber"),
          by("OK", "OK / No Expiry", (r) => r.expiryStatus === "OK" || r.expiryStatus === "No expiry", "green"),
        ];
      case "serial":
        return [
          all("All Serials"),
          by("AVAILABLE", "Available", (r) => r.status === "AVAILABLE", "green"),
          by("OUT", "Issued / Sold", (r) => r.status === "ISSUED" || r.status === "SOLD", "blue"),
          by("OTHER", "In Repair / Returned", (r) => r.status === "IN_REPAIR" || r.status === "RETURNED", "amber"),
        ];
      case "quality":
        return [
          all("Inspections"),
          by("PASS", "Pass", (r) => r.result === "PASS", "green"),
          by("FAIL", "Fail", (r) => r.result === "FAIL", "red"),
          by("CONDITIONAL", "Conditional", (r) => r.result === "CONDITIONAL", "amber"),
        ];
      default:
        return [all("All Records")];
    }
  }, [reportType]);

  const { filteredRows, cardFilterProps, setSelected } = useStatsCardFilter(rows, cards);

  // A new report starts with all its rows shown
  useEffect(() => setSelected("ALL"), [reportType, setSelected]);

  /* ---------------- columns per report ---------------- */

  const productColumns: ColumnDef<Row>[] = [
    { key: "product", label: "Product", sortable: true },
    { key: "code", label: "Code", sortable: true, className: "whitespace-nowrap" },
  ];
  const dateColumn = (key: string, label: string): ColumnDef<Row> => ({
    key,
    label,
    sortable: true,
    render: (row) => showDate(row[key]),
    exportValueGetter: (row) => showDate(row[key]),
  });
  const qtyColumn = (key: string, label: string): ColumnDef<Row> => ({
    key,
    label,
    sortable: true,
    className: "text-right tabular-nums",
    headerClassName: "text-right",
    render: (row) => (row[key] == null ? "--" : qty(row[key])),
  });

  const columns: ColumnDef<Row>[] = (() => {
    switch (reportType) {
      case "current":
      case "low":
      case "reserved":
        return [
          ...productColumns,
          { key: "warehouse", label: "Warehouse", sortable: true },
          qtyColumn("onHand", "On Hand"),
          qtyColumn("reserved", "Reserved"),
          qtyColumn("available", "Available"),
          ...(reportType === "reserved" ? [] : [qtyColumn("reorderLevel", "Reorder Level")]),
          ...(reportType === "low" ? [qtyColumn("shortfall", "Shortfall")] : []),
          ...(reportType === "reserved"
            ? []
            : [{
                key: "status",
                label: "Status",
                sortable: true,
                render: (row: Row) => <Pill text={row.status} tone={STOCK_TONE[row.status] || "slate"} />,
                exportValueGetter: (row: Row) => row.status,
              }]),
        ];
      case "valuation":
        return [
          ...productColumns,
          { key: "warehouse", label: "Warehouse", sortable: true },
          qtyColumn("onHand", "On Hand"),
          {
            key: "unitCost",
            label: "Standard Cost",
            sortable: true,
            className: "text-right tabular-nums",
            headerClassName: "text-right",
            render: (row) => (row.unitCost == null ? "--" : rupees(row.unitCost)),
            exportValueGetter: (row) => (row.unitCost == null ? "" : rupees(row.unitCost)),
          },
          {
            key: "value",
            label: "Stock Value",
            sortable: true,
            className: "text-right tabular-nums font-semibold",
            headerClassName: "text-right",
            render: (row) => (row.value == null ? "--" : rupees(row.value)),
            exportValueGetter: (row) => (row.value == null ? "" : rupees(row.value)),
          },
        ];
      case "movement":
        return [
          dateColumn("date", "Date"),
          {
            key: "direction",
            label: "Direction",
            sortable: true,
            render: (row) => (
              <Pill text={row.direction} tone={row.direction === "In" ? "green" : row.direction === "Out" ? "red" : row.direction === "Transfer" ? "blue" : "slate"} />
            ),
            exportValueGetter: (row) => row.direction,
          },
          { key: "type", label: "Type", sortable: true, render: (row) => humanize(row.type), exportValueGetter: (row) => humanize(row.type) },
          ...productColumns,
          { key: "warehouse", label: "Warehouse", sortable: true },
          qtyColumn("quantity", "Qty"),
          { key: "route", label: "From → To", sortable: false },
          { key: "reference", label: "Reference", sortable: true },
        ];
      case "adjustment":
        return [
          dateColumn("date", "Date"),
          ...productColumns,
          { key: "warehouse", label: "Warehouse", sortable: true },
          {
            key: "direction",
            label: "Type",
            sortable: true,
            render: (row) => <Pill text={row.direction} tone={row.direction === "Increase" ? "green" : "red"} />,
            exportValueGetter: (row) => row.direction,
          },
          qtyColumn("quantity", "Qty"),
          { key: "reason", label: "Reason", sortable: true },
          { key: "batch", label: "Batch", sortable: true },
        ];
      case "analysis":
        return [
          ...productColumns,
          qtyColumn("onHand", "On Hand"),
          qtyColumn("issued", "Issued"),
          qtyColumn("received", "Received"),
          dateColumn("lastMovement", "Last Movement"),
          {
            key: "movementClass",
            label: "Class",
            sortable: true,
            render: (row) => <Pill text={row.movementClass} tone={CLASS_TONE[row.movementClass] || "slate"} />,
            exportValueGetter: (row) => row.movementClass,
          },
        ];
      case "batch":
        return [
          { key: "batch", label: "Batch", sortable: true },
          ...productColumns,
          { key: "warehouse", label: "Warehouse", sortable: true },
          dateColumn("manufactured", "Manufactured"),
          dateColumn("expiry", "Expiry"),
          qtyColumn("quantity", "Qty"),
          qtyColumn("available", "Available"),
          {
            key: "expiryStatus",
            label: "Status",
            sortable: true,
            sortValueGetter: (row) => row.daysLeft ?? Number.MAX_SAFE_INTEGER,
            render: (row) => (
              <Pill
                text={row.expiryStatus === "Expiring soon" ? `Expires in ${row.daysLeft} day${row.daysLeft === 1 ? "" : "s"}` : row.expiryStatus}
                tone={row.expiryStatus === "Expired" ? "red" : row.expiryStatus === "Expiring soon" ? "amber" : row.expiryStatus === "OK" ? "green" : "slate"}
              />
            ),
            exportValueGetter: (row) => row.expiryStatus,
          },
        ];
      case "serial":
        return [
          { key: "serial", label: "Serial No", sortable: true },
          ...productColumns,
          { key: "warehouse", label: "Warehouse", sortable: true },
          { key: "batch", label: "Batch", sortable: true },
          {
            key: "status",
            label: "Status",
            sortable: true,
            render: (row) => <Pill text={humanize(row.status)} tone={row.status === "AVAILABLE" ? "green" : row.status === "IN_REPAIR" ? "amber" : "blue"} />,
            exportValueGetter: (row) => humanize(row.status),
          },
          dateColumn("warrantyEnd", "Warranty End"),
        ];
      case "quality":
        return [
          dateColumn("date", "Date"),
          ...productColumns,
          { key: "item", label: "Batch / Serial", sortable: true },
          { key: "inspectionType", label: "Inspection", sortable: true },
          {
            key: "result",
            label: "Result",
            sortable: true,
            render: (row) => <Pill text={humanize(row.result)} tone={row.result === "PASS" ? "green" : row.result === "FAIL" ? "red" : "amber"} />,
            exportValueGetter: (row) => humanize(row.result),
          },
          { key: "inspector", label: "Inspector", sortable: true },
          { key: "remarks", label: "Remarks", sortable: false },
        ];
      default:
        return productColumns;
    }
  })();

  /** One line of totals under the cards, for the reports where a sum means something. */
  const summary = (() => {
    const sum = (key: string) => filteredRows.reduce((total, row) => total + num(row[key]), 0);
    switch (reportType) {
      case "current":
        return `On hand ${qty(sum("onHand"))} · Reserved ${qty(sum("reserved"))} · Available ${qty(sum("available"))}`;
      case "valuation":
        return `Total stock value ${rupees(sum("value"))}`;
      case "reserved":
        return `Reserved ${qty(sum("reserved"))} of ${qty(sum("onHand"))} on hand`;
      case "movement": {
        const moved = (direction: string) =>
          filteredRows.filter((row) => row.direction === direction).reduce((total, row) => total + num(row.quantity), 0);
        return `In ${qty(moved("In"))} · Out ${qty(moved("Out"))} · Transferred ${qty(moved("Transfer"))}`;
      }
      case "batch":
        return `Quantity in these batches ${qty(sum("quantity"))}`;
      default:
        return "";
    }
  })();

  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

  return (
    <>
      <PageMeta title="Inventory Reports" description="Inventory reports from the live stock records" />
      <PageBreadcrumb pageTitle="Inventory Reports" />

      <div className="w-full max-w-none px-0 py-8">
        <div className="px-3 py-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ReportType)}
                className={`${selectClass} min-w-[220px]`}
                aria-label="Report"
              >
                {["Stock", "Activity", "Tracking"].map((group) => (
                  <optgroup key={group} label={group}>
                    {REPORTS.filter((item) => item.group === group).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {reportType !== "quality" && (
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className={selectClass} aria-label="Warehouse">
                  <option value="">All warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name || warehouse.code || `Warehouse #${warehouse.id}`}
                    </option>
                  ))}
                </select>
              )}
              {PERIOD_REPORTS.includes(reportType) && (
                <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} className={selectClass} aria-label="Period">
                  {PERIODS.map((period) => (
                    <option key={period.days} value={period.days}>
                      {period.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            <p className="max-w-xl text-sm text-gray-500 dark:text-gray-400">
              {report.help}
              {PERIOD_REPORTS.includes(reportType) && ` Since ${showDate(since)} (today ${showDate(todayIso())}).`}
            </p>
          </div>

          <StatsCardFilter {...cardFilterProps} />

          {summary && <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">{summary}</p>}

          <ReusableTable
            key={reportType}
            data={filteredRows}
            columns={columns}
            loading={loading}
            pageSize={10}
            defaultSortKey={["movement", "adjustment", "quality"].includes(reportType) ? "date" : reportType === "batch" ? "expiryStatus" : "product"}
            defaultSortOrder={["movement", "adjustment", "quality"].includes(reportType) ? "desc" : "asc"}
            rowDetailsTitle={report.label}
            emptyState={
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Nothing to show for {report.label.toLowerCase()}
                {warehouseId ? " in this warehouse" : ""}
                {PERIOD_REPORTS.includes(reportType) ? " in this period" : ""}.
              </div>
            }
          />
        </div>
      </div>
    </>
  );
};

export default InventoryReports;

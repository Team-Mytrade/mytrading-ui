import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { exportListingPdf } from "./export";
import "./TableExportModal.css";

const PERIODS = [{ label: "All time", value: "all" }, { label: "Last 30 days", value: "30" }, { label: "Last 90 days", value: "90" }, { label: "Custom range", value: "custom" }];

/**
 * Generic table export dialog.
 * @param {{isOpen:boolean, onClose:()=>void, data:object[], columns:Array<{key:string,label:string,sortValueGetter?:(row:object)=>unknown}>, title?:string}} props
 * Date ranges use common record timestamps (createdAt, updatedAt, date, etc.) when supplied by a page's API.
 */
export default function TableExportModal({ isOpen, onClose, data, columns, title = "Table data" }) {
  const [period, setPeriod] = useState("all");
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const range = useMemo(() => {
    if (period === "all") return { from: null, to: null, label: "All time" };
    const to = period === "custom" ? new Date(`${toValue}T23:59:59`) : new Date();
    const from = period === "custom" ? new Date(`${fromValue}T00:00:00`) : new Date(to);
    if (period === "30") from.setDate(from.getDate() - 30);
    if (period === "90") from.setDate(from.getDate() - 90);
    return { from, to, label: `${from.toLocaleDateString()} – ${to.toLocaleDateString()}` };
  }, [fromValue, period, toValue]);
  const exportRows = useMemo(() => data.filter((row) => {
    if (!range.from || !range.to) return true;
    const record = row;
    const timestamp = record.createdAt || record.updatedAt || record.date || record.createdDate || record.modifiedAt;
    const date = timestamp ? new Date(timestamp) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date >= range.from && date <= range.to);
  }), [data, range]);
  const flattenedRows = useMemo(() => exportRows.map((row) => Object.fromEntries(columns.filter((column) => column.key !== "actions").map((column) => {
    const raw = column.sortValueGetter ? column.sortValueGetter(row) : row[column.key];
    const value = Array.isArray(raw) ? raw.length : raw && typeof raw === "object" ? JSON.stringify(raw) : raw ?? "—";
    return [column.label, value];
  }))), [columns, exportRows]);
  const download = (format) => {
    if (period === "custom" && (!fromValue || !toValue || fromValue > toValue)) return;
    if (!flattenedRows.length) return;
    const fileBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "table_export";
    if (format === "pdf") exportListingPdf({ title, data: flattenedRows, fileName: `${fileBase}.pdf`, subtitle: "Table export", metadata: [{ label: "Range", value: range.label }, { label: "Total", value: flattenedRows.length }] });
    else { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(flattenedRows), "Export"); XLSX.writeFile(workbook, `${fileBase}.xlsx`); }
    onClose();
  };
  if (!isOpen) return null;
  return <div className="table-export-modal" role="dialog" aria-modal="true" aria-labelledby="table-export-title"><div className="table-export-modal__backdrop" onClick={onClose} /><div className="table-export-modal__panel"><header><div><h3 id="table-export-title">Export {title}</h3><p>Choose a time period, then select a file format.</p></div><button type="button" onClick={onClose} aria-label="Close export options">×</button></header><main><p className="table-export-modal__step">1. Time period</p><div className="table-export-modal__periods">{PERIODS.map((option) => <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={period === option.value ? "is-selected" : ""}>{option.label}</button>)}</div>{period === "custom" && <div className="table-export-modal__dates"><label>From<input type="date" value={fromValue} onChange={(event) => setFromValue(event.target.value)} /></label><label>To<input type="date" value={toValue} onChange={(event) => setToValue(event.target.value)} /></label></div>}<p className="table-export-modal__summary">{flattenedRows.length} record{flattenedRows.length === 1 ? "" : "s"} will be included for {range.label}.</p></main><footer><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={() => download("pdf")} disabled={!flattenedRows.length}>Export PDF</button><button type="button" onClick={() => download("excel")} disabled={!flattenedRows.length}>Export Excel</button></footer></div></div>;
}

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { exportListingPdf } from "./export";
import "../../styles/TableExportModal.css";

/** 13 Oct 2026 */
const displayDate = (date) => date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const PERIODS = [{ label: "All time", value: "all" }, { label: "Last 30 days", value: "30" }, { label: "Last 90 days", value: "90" }, { label: "Custom range", value: "custom" }];

/**
 * Generic table export dialog.
 * @param {{isOpen:boolean, onClose:()=>void, data:object[], columns:Array<{key:string,label:string,sortValueGetter?:(row:object)=>unknown}>, title?:string}} props
 * Date ranges use common record timestamps (createdAt, updatedAt, date, etc.) when supplied by a page's API.
 */
export default function TableExportModal({ isOpen, onClose, data, columns, title: givenTitle, mode = "export" }) {
  const sharing = mode === "share";
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // A fresh dialog each time: no message left from the last share
  useEffect(() => {
    if (isOpen) setNote("");
  }, [isOpen, mode]);
  // Without a title from the page, the page's own name: the last crumb of its breadcrumb ("Customers", "Delivery
  // Orders"…), else the browser tab's title
  const pageName = () => {
    if (typeof document === "undefined") return "";
    const crumbs = document.querySelectorAll(".page-breadcrumb__trail .page-breadcrumb__label");
    const crumb = crumbs.length ? crumbs[crumbs.length - 1].textContent.trim() : "";
    const tab = document.title.split("|")[0].trim();
    return crumb || (tab && tab !== "myTrading" ? tab : "");
  };
  const title = givenTitle || (isOpen && pageName()) || "Table data";
  const [period, setPeriod] = useState("all");
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const range = useMemo(() => {
    if (period === "all") return { from: null, to: null, label: "All time" };
    const to = period === "custom" ? new Date(`${toValue}T23:59:59`) : new Date();
    const from = period === "custom" ? new Date(`${fromValue}T00:00:00`) : new Date(to);
    if (period === "30") from.setDate(from.getDate() - 30);
    if (period === "90") from.setDate(from.getDate() - 90);
    return { from, to, label: `${displayDate(from)} to ${displayDate(to)}` };
  }, [fromValue, period, toValue]);
  const exportRows = useMemo(() => data.filter((row) => {
    if (!range.from || !range.to) return true;
    const record = row;
    const timestamp = record.createdAt || record.updatedAt || record.date || record.createdDate || record.modifiedAt;
    const date = timestamp ? new Date(timestamp) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date >= range.from && date <= range.to);
  }), [data, range]);
  const flattenedRows = useMemo(() => exportRows.map((row) => Object.fromEntries(columns.filter((column) => column.key !== "actions").map((column) => {
    // exportValueGetter gives readable text (₹ amounts, 13 Oct 2026, Active/Inactive, names).
    const raw = column.exportValueGetter
      ? column.exportValueGetter(row)
      : column.sortValueGetter
        ? column.sortValueGetter(row)
        : row[column.key];
    const value = Array.isArray(raw)
      ? raw.length
      : raw && typeof raw === "object"
        ? raw.name || raw.title || raw.label || "--"
        : typeof raw === "boolean"
          ? (raw ? "Active" : "Inactive")
          : raw ?? "--";
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
  // Print: the same rows as a plain table in a hidden frame, printed with the browser's dialog (no page chrome)
  const print = () => {
    if (period === "custom" && (!fromValue || !toValue || fromValue > toValue)) return;
    if (!flattenedRows.length) return;
    const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const headers = Object.keys(flattenedRows[0]);
    const dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
    const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic",sans-serif;color:#0f172a;margin:24px}
      h1{font-size:18px;margin:0 0 4px} p{margin:0 0 14px;color:#64748b;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:11px} th,td{border:1px solid #e2e8f0;padding:5px 7px;text-align:start;vertical-align:top}
      th{background:#f1f5f9;font-weight:600} tr:nth-child(even) td{background:#fafafa} thead{display:table-header-group} tr{break-inside:avoid}
      @page{margin:12mm}
    </style></head><body><h1>${esc(title)}</h1><p>${esc(range.label)} · ${flattenedRows.length} record${flattenedRows.length === 1 ? "" : "s"} · Printed ${esc(displayDate(new Date()))}</p>
      <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${flattenedRows
        .map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // The print dialog blocks until closed; remove the frame afterwards
    setTimeout(() => frame.remove(), 1000);
    onClose();
  };
  /* ---------------- Share (WhatsApp, email, copy, the device's share sheet) ---------------- */
  const validRange = () => !(period === "custom" && (!fromValue || !toValue || fromValue > toValue)) && flattenedRows.length > 0;
  const fileBaseName = () => title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "table_export";
  // A short text: the title, the period and the first rows (their first three filled columns), and a link to the page
  const summary = (maxRows = 15) => {
    const lines = [`*${title}*`, `${range.label} · ${flattenedRows.length} record${flattenedRows.length === 1 ? "" : "s"}`, ""];
    flattenedRows.slice(0, maxRows).forEach((row) => {
      const parts = Object.values(row).map((v) => String(v ?? "").trim()).filter((v) => v && v !== "--").slice(0, 3);
      lines.push(`• ${parts.join(" — ")}`);
    });
    if (flattenedRows.length > maxRows) lines.push(`…and ${flattenedRows.length - maxRows} more`);
    lines.push("", `Open in MyTrading: ${window.location.href}`);
    return lines.join("\n");
  };
  const shareWhatsApp = () => {
    if (!validRange()) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(summary())}`, "_blank", "noopener,noreferrer");
    onClose();
  };
  const shareEmail = () => {
    if (!validRange()) return;
    // Mail links have a length limit: fewer rows, and the full list is one click away
    let body = summary(15).replace(/\*/g, "");
    if (body.length > 1800) body = summary(6).replace(/\*/g, "");
    window.location.href = `mailto:?subject=${encodeURIComponent(`${title} — ${range.label}`)}&body=${encodeURIComponent(body)}`;
    onClose();
  };
  const copySummary = async () => {
    if (!validRange()) return;
    try {
      await navigator.clipboard.writeText(summary().replace(/\*/g, ""));
      setNote("Copied: paste it into any chat or email.");
    } catch {
      setNote("Copying isn't allowed here; use WhatsApp or Email.");
    }
  };
  // The branded PDF through the device's share sheet (WhatsApp, Mail, Teams…); where the browser can't share files,
  // it is downloaded to attach by hand
  const sharePdf = async () => {
    if (!validRange() || busy) return;
    setBusy(true);
    try {
      const blob = await exportListingPdf({ title, data: flattenedRows, subtitle: "Shared list", asBlob: true,
        metadata: [{ label: "Range", value: range.label }, { label: "Total", value: flattenedRows.length }] });
      const file = new File([blob], `${fileBaseName()}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title} — ${range.label}` });
        onClose();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNote("This browser can't share files directly: the PDF was downloaded so you can attach it.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") setNote("The PDF couldn't be shared. Try again or use WhatsApp or Email.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;
  return <div className="table-export-modal" role="dialog" aria-modal="true" aria-labelledby="table-export-title"><div className="table-export-modal__backdrop" onClick={onClose} /><div className="table-export-modal__panel"><header><div><h3 id="table-export-title">{sharing ? "Share" : "Export"} {title}</h3><p>{sharing ? "Choose a time period, then how to share it." : "Choose a time period, then print or select a file format."}</p></div><button type="button" onClick={onClose} aria-label={sharing ? "Close share options" : "Close export options"}>×</button></header><main><p className="table-export-modal__step">1. Time period</p><div className="table-export-modal__periods">{PERIODS.map((option) => <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={period === option.value ? "is-selected" : ""}>{option.label}</button>)}</div>{period === "custom" && <div className="table-export-modal__dates"><label>From<input type="date" value={fromValue} onChange={(event) => setFromValue(event.target.value)} /></label><label>To<input type="date" value={toValue} onChange={(event) => setToValue(event.target.value)} /></label></div>}<p className="table-export-modal__summary">{flattenedRows.length} record{flattenedRows.length === 1 ? "" : "s"} will be included for {range.label}.</p>{note && <p className="table-export-modal__summary" role="status">{note}</p>}</main>{sharing ? <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={copySummary} disabled={!flattenedRows.length}>Copy</button><button type="button" onClick={shareEmail} disabled={!flattenedRows.length}>Email</button><button type="button" onClick={shareWhatsApp} disabled={!flattenedRows.length}>WhatsApp</button><button type="button" onClick={sharePdf} disabled={!flattenedRows.length || busy}>{busy ? "Preparing…" : "Share PDF"}</button></footer> : <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={print} disabled={!flattenedRows.length}>Print</button><button type="button" onClick={() => download("pdf")} disabled={!flattenedRows.length}>Export PDF</button><button type="button" onClick={() => download("excel")} disabled={!flattenedRows.length}>Export Excel</button></footer>}</div></div>;
}

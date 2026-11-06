import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { FileCheck2, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { t } from "../../i18n/i18n";

const API = `${INVOICE_API}/export-evidence`;
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

const DOCUMENT_TYPES: Record<string, string> = {
  EXIT_DECLARATION: "Customs exit declaration",
  BILL_OF_LADING: "Bill of lading",
  AIRWAY_BILL: "Airway bill",
  ROAD_MANIFEST: "Road manifest / truck waybill",
  COURIER_RECEIPT: "Courier or postal receipt",
  OTHER: "Other official document",
};
const STATUS: Record<string, { label: string; tone: string }> = {
  HELD: { label: "Proof held", tone: "bg-emerald-50 text-emerald-700" },
  DUE: { label: "Proof due", tone: "bg-amber-50 text-amber-700" },
  OVERDUE: { label: "Overdue", tone: "bg-red-50 text-red-700" },
};

interface ExportRow {
  invoiceId: number; invoiceNumber: string; invoiceDate: string; customerName: string | null; currencyCode: string | null; grandTotal: number;
  supplyType: string; importEntryNumber: string | null; country: string | null; dueDate: string; daysLeft: number; status: string;
  documentType: string | null; documentNumber: string | null; exitDate: string | null;
}

/**
 * Proof of exit for zero-rated exports and re-exports (backlog 7.2.1 step 4): an export stays zero-rated only with
 * evidence the goods left within 90 days. Lists the exports by how long is left and records the evidence.
 */
export default function ExportEvidence() {
  const { canUpdate } = usePermissions("INVOICE");
  const [missingOnly, setMissingOnly] = useState(true);
  const [rows, setRows] = useState<ExportRow[] | null>(null);
  const [editing, setEditing] = useState<ExportRow | null>(null);
  const [form, setForm] = useState({ documentType: "EXIT_DECLARATION", documentNumber: "", exitDate: todayInput() });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<ExportRow[]>(API, { params: { missingOnly } }).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setRows([]);
      ToasterService.error("Exports could not be loaded", apiError(err, "Is the finance service running?"));
    });
  }, [missingOnly]);
  useEffect(load, [load]);

  const open = (row: ExportRow) => {
    setEditing(row);
    setForm({ documentType: row.documentType ?? "EXIT_DECLARATION", documentNumber: row.documentNumber ?? "", exitDate: row.exitDate ?? todayInput() });
  };

  const save = async () => {
    if (!editing) return;
    if (!form.documentNumber.trim()) return ToasterService.error("Enter the document's number.");
    setBusy(true);
    try {
      await axios.put(`${API}/${editing.invoiceId}`, { documentType: form.documentType, documentNumber: form.documentNumber.trim(), exitDate: form.exitDate });
      ToasterService.success("Proof of exit recorded.");
      setEditing(null);
      load();
    } catch (err) {
      ToasterService.error("The proof of exit could not be saved", apiError(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: ExportRow) => {
    if (!window.confirm(t("Remove the proof of exit from {number}?", { number: row.invoiceNumber }))) return;
    try {
      await axios.delete(`${API}/${row.invoiceId}`);
      load();
    } catch (err) {
      ToasterService.error("The proof of exit could not be removed", apiError(err, "Please try again."));
    }
  };

  const overdue = (rows ?? []).filter((r) => r.status === "OVERDUE").length;
  return (
    <>
      <PageMeta title={t("Export Evidence")} description="Proof of exit for zero-rated exports" />
      <PageBreadcrumb pageTitle="Export Evidence" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <div>
              <h2 className={CARD_TITLE}>{t("Proof of exit for exports")}</h2>
              <p className="text-xs text-slate-500">{t("An export or re-export is zero-rated only when you hold proof the goods left the country within 90 days of the invoice.")}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
              <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> {t("Only those still needing proof")}
            </label>
          </div>
          {overdue > 0 && (
            <p className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {t("{count} export(s) are past 90 days without proof; without it they are taxed at the standard rate.", { count: overdue })}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={TH}>{t("Invoice")}</th>
                  <th className={TH}>{t("Customer")}</th>
                  <th className={TH}>{t("To")}</th>
                  <th className={`${TH} text-end`}>{t("Amount")}</th>
                  <th className={TH}>{t("Proof due by")}</th>
                  <th className={TH}>{t("Proof")}</th>
                  <th className={TH}>{t("Status")}</th>
                  <th className={TH} aria-label={t("Actions")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {rows === null ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">{t(missingOnly ? "Every export has its proof of exit." : "No exports yet.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.invoiceId}>
                    <td className={TD}>
                      <span className="font-medium">{r.invoiceNumber}</span>
                      <span className="block text-xs text-slate-400">{dateLabel(r.invoiceDate)} · {t(r.supplyType === "RE_EXPORT" ? "Re-export" : "Export")}
                        {r.importEntryNumber ? ` · ${t("imported on")} ${r.importEntryNumber}` : ""}</span>
                    </td>
                    <td className={TD}>{r.customerName}</td>
                    <td className={TD}>{r.country ?? "—"}</td>
                    <td className={`${TD} whitespace-nowrap text-end`}>{money(r.grandTotal, r.currencyCode)}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {dateLabel(r.dueDate)}
                      {r.status !== "HELD" && <span className="block text-xs text-slate-400">
                        {r.daysLeft >= 0 ? t("{days} days left", { days: r.daysLeft }) : t("{days} days late", { days: -r.daysLeft })}</span>}
                    </td>
                    <td className={TD}>
                      {r.documentNumber ? <>{t(DOCUMENT_TYPES[r.documentType ?? ""] ?? r.documentType ?? "")} {r.documentNumber}
                        <span className="block text-xs text-slate-400">{t("Left on")} {dateLabel(r.exitDate)}</span></> : "—"}
                    </td>
                    <td className={TD}><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[r.status]?.tone}`}>{t(STATUS[r.status]?.label ?? r.status)}</span></td>
                    <td className={`${TD} whitespace-nowrap text-end`}>
                      {canUpdate && <button type="button" className={ROW_ICON_BUTTON} title={t("Record proof of exit")} aria-label={t("Record proof of exit")} onClick={() => open(r)}><FileCheck2 className="h-4 w-4" /></button>}
                      {canUpdate && r.documentNumber && <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")} onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t("Proof of exit for {number}", { number: editing.invoiceNumber })}>
          <div className={`${CARD} w-full max-w-md space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t("Proof of exit for {number}", { number: editing.invoiceNumber })}</h2>
            <div>
              <label className={LABEL} htmlFor="ee-type">{t("Document")}</label>
              <select id="ee-type" className={INPUT} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
                {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="ee-number">{t("Document number")} *</label>
              <input id="ee-number" className={INPUT} maxLength={60} value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ee-date">{t("Date the goods left")}</label>
              <input id="ee-date" type="date" className={INPUT} max={todayInput()} value={form.exitDate} onChange={(e) => setForm({ ...form, exitDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setEditing(null)}>{t("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>{t("Save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

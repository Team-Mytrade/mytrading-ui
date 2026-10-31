import { useState } from "react";
import { Download, RefreshCw, Undo2, X } from "lucide-react";
import axios from "axios";
import { ToasterService } from "../../Services/ToasterService";
import { errorText, TenantAccess } from "../../access/accessApi";
import { formatDate, formatDateTime } from "../../company/format";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

export interface TenantClosure {
  tenantId: string;
  tenantName: string;
  status: "SCHEDULED" | "CANCELLED" | "DELETING" | "FAILED" | "DELETED";
  reason: string | null;
  requestedBy: string | null;
  /** UTC, without an offset (like the other times here). */
  requestedAt: string;
  deleteAfter: string;
  finishedAt: string | null;
  finalExport: { id: number; status: "RUNNING" | "DONE" | "PARTIAL" | "FAILED"; sizeBytes: number | null; error: string | null } | null;
  services: { service: string; ok: boolean; rows: number; error: string | null }[];
  error: string | null;
}

const BASE = "/v1/api/user/platform";
const path = (tenantId: string) => `${BASE}/tenants/${encodeURIComponent(tenantId)}/closure`;

export const closureApi = {
  all: () => axios.get<TenantClosure[]>(`${BASE}/closures`).then((r) => r.data),
  close: (tenantId: string, reason: string, confirmName: string) =>
    axios.post<TenantClosure>(path(tenantId), { reason, confirmName }).then((r) => r.data),
  cancel: (tenantId: string) => axios.delete<TenantClosure>(path(tenantId)).then((r) => r.data),
  exportAgain: (tenantId: string) => axios.post<TenantClosure>(`${path(tenantId)}/export`).then((r) => r.data),
};

/** A closure that is under way (not cancelled). */
export const closing = (c?: TenantClosure) => !!c && c.status !== "CANCELLED";

const utc = (value: string | null) => (value ? `${value}Z` : null);

const EXPORT_LABEL: Record<string, string> = {
  RUNNING: "Being made...", DONE: "Ready", PARTIAL: "Ready, some parts missing", FAILED: "Failed",
};

const CLOSURE_LABEL: Record<TenantClosure["status"], string> = {
  SCHEDULED: "Closing", CANCELLED: "Cancelled", DELETING: "Deleting data...", FAILED: "Deletion incomplete", DELETED: "Data deleted",
};

/**
 * Close a company for good (Super Admin): its users can't sign in from now, a final export is made, and after
 * 30 days its data is deleted in every module. Until then the closure can be cancelled.
 */
export default function TenantClosureDialog({ tenant, closure, onClose, onChanged }: {
  tenant: TenantAccess;
  closure?: TenantClosure;
  onClose: () => void;
  onChanged: (c: TenantClosure) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const active = closing(closure);

  const run = async (action: () => Promise<TenantClosure>, done: string) => {
    setBusy(true);
    try {
      onChanged(await action());
      ToasterService.success(done);
    } catch (err) {
      ToasterService.error(errorText(err, t("Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!reason.trim()) {
      ToasterService.error(t("Give the reason for closing the company."));
      return;
    }
    if (confirmName.trim().toLowerCase() !== tenant.tenantName.trim().toLowerCase()) {
      ToasterService.error(t("Type the company's name exactly to confirm."));
      return;
    }
    run(() => closureApi.close(tenant.tenantId, reason.trim(), confirmName.trim()), `${tenant.tenantName} ${t("is being closed.")}`);
  };

  const download = async () => {
    try {
      const res = await axios.get<Blob>(`${path(tenant.tenantId)}/export/file`, { responseType: "blob" });
      const name = /filename="?([^";]+)"?/.exec(String(res.headers["content-disposition"] ?? ""))?.[1] ?? `final-export-${tenant.tenantId}.zip`;
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not download the export.")));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`${CARD} w-full max-w-lg space-y-4 p-5`} role="dialog" aria-labelledby="tenant-closure-title">
        <div className="flex items-center justify-between">
          <h3 id="tenant-closure-title" className="text-sm font-semibold text-slate-900 dark:text-white">
            {t("Close")} {tenant.tenantName}
          </h3>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        {!active ? (
          <>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {t("Its users can't sign in from now on, and a final export of all its data is made for you to download. After 30 days the company's data is deleted in every module and can't be recovered. Until then you can cancel.")}
            </div>
            <div>
              <label className={LABEL} htmlFor="closure-reason">{t("Reason *")}</label>
              <textarea id="closure-reason" className={INPUT} rows={2} maxLength={400} value={reason}
                placeholder={t("e.g. Customer cancelled the contract")} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="closure-confirm">{t("Type the company's name to confirm")}</label>
              <input id="closure-confirm" className={INPUT} value={confirmName} placeholder={tenant.tenantName}
                autoComplete="off" onChange={(e) => setConfirmName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>{t("Cancel")}</button>
              <button type="button" className={`${PRIMARY_BUTTON} bg-red-600 hover:bg-red-700 focus-visible:ring-red-500`}
                disabled={busy || confirmName.trim().toLowerCase() !== tenant.tenantName.trim().toLowerCase()} onClick={close}>
                {t(busy ? "Closing..." : "Close company")}
              </button>
            </div>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-slate-500">{t("Status")}</dt>
              <dd className="font-semibold text-slate-800 dark:text-gray-100">{t(CLOSURE_LABEL[closure!.status])}</dd>
              <dt className="text-slate-500">{t("Reason")}</dt>
              <dd className="text-slate-800 dark:text-gray-100">{closure!.reason}</dd>
              <dt className="text-slate-500">{t("Closed")}</dt>
              <dd className="text-slate-800 dark:text-gray-100">{formatDateTime(utc(closure!.requestedAt))}{closure!.requestedBy ? ` · ${closure!.requestedBy}` : ""}</dd>
              <dt className="text-slate-500">{closure!.status === "DELETED" ? t("Data deleted") : t("Data deleted after")}</dt>
              <dd className="text-slate-800 dark:text-gray-100">{closure!.status === "DELETED" ? formatDateTime(utc(closure!.finishedAt)) : formatDate(utc(closure!.deleteAfter))}</dd>
              <dt className="text-slate-500">{t("Final export")}</dt>
              <dd className="text-slate-800 dark:text-gray-100">
                {closure!.finalExport ? t(EXPORT_LABEL[closure!.finalExport.status] ?? closure!.finalExport.status) : t("None")}
              </dd>
            </dl>
            {closure!.error && <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">{closure!.error}</p>}
            {closure!.services.some((s) => !s.ok) && (
              <p className="text-[11px] text-orange-700">
                {t("Not deleted yet:")} {closure!.services.filter((s) => !s.ok).map((s) => s.service).join(", ")}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {(closure!.finalExport?.status === "DONE" || closure!.finalExport?.status === "PARTIAL") && (
                <button type="button" className={SECONDARY_BUTTON} onClick={download}>
                  <Download className="h-4 w-4" /> {t("Download final export")}
                </button>
              )}
              {closure!.status === "SCHEDULED" && closure!.finalExport?.status !== "RUNNING" && (
                <button type="button" className={SECONDARY_BUTTON} disabled={busy}
                  onClick={() => run(() => closureApi.exportAgain(tenant.tenantId), t("A new final export is being made."))}>
                  <RefreshCw className="h-4 w-4" /> {t("Make the export again")}
                </button>
              )}
              {closure!.status === "SCHEDULED" && (
                <button type="button" className={SECONDARY_BUTTON} disabled={busy}
                  onClick={() => window.confirm(t("Cancel the closure? The company gets back its previous status.")) &&
                    run(() => closureApi.cancel(tenant.tenantId), t("The closure was cancelled."))}>
                  <Undo2 className="h-4 w-4" /> {t("Cancel closure")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

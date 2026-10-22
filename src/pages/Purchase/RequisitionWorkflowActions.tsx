import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import CloseButton from "../../components/common/CloseButton";
import { ToasterService } from "../../Services/ToasterService";
import {usePermissions} from "../../access/usePermissions"

const BASE = "/v1/api/purchase/purchase-requisitions";

type ActionKey = "submit" | "approve" | "reject" | "cancel";

type Action = {
  key: ActionKey;
  label: string;
  done: string;
  /** "primary" = coloured pill in the row, "menu" = inside the ⋯ menu. */
  place: "primary" | "menu";
  className: string;
};

/** Pill styles (light + dark). */
const PILL = {
  cyan: "bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500",
  green: "bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500",
  redOutline:
    "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40",
};

/**
 * Requisition status flow: DRAFT -> Submit -> SUBMITTED -> Approve / Reject (approvers),
 * Cancel before approval. The server enforces the same rules, including that nobody
 * approves their own requisition.
 *
 * Layout per row:
 *   DRAFT      [Submit]               ⋯ (Cancel requisition)
 *   SUBMITTED  [Approve] [Reject]     ⋯ (Cancel requisition)
 *   others     nothing here (Create PO for APPROVED comes from the page config)
 */
export default function RequisitionWorkflowActions({
  row,
  refreshRows,
}: {
  row: { id?: unknown; status?: unknown; requisitionNumber?: unknown };
  refreshRows: () => Promise<void>;
}) {
  // Submit and cancel are POSTs (PURCHASE:CREATE); approve and reject need PURCHASE:APPROVE
  const { canCreate, canApprove } = usePermissions("PURCHASE");
  const [busy, setBusy] = useState(false);
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null);
  const [confirm, setConfirm] = useState<ActionKey | null>(null);
  const [reason, setReason] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const status = String(row.status ?? "").toUpperCase();
  const prName = String(row.requisitionNumber || "this requisition");

  const actions: Action[] = [];
  if (status === "DRAFT") {
    actions.push({ key: "submit", label: "Submit", done: "submitted for approval", place: "primary", className: PILL.cyan });
  }
  if ((status === "SUBMITTED" || status === "IN_REVIEW") && canApprove) {
    actions.push({ key: "approve", label: "Approve", done: "approved", place: "primary", className: PILL.green });
    actions.push({ key: "reject", label: "Reject", done: "rejected", place: "primary", className: PILL.redOutline });
  }
  if (status === "DRAFT" || status === "SUBMITTED") {
    actions.push({ key: "cancel", label: "Cancel requisition", done: "cancelled", place: "menu", className: "" });
  }

  const primary = actions.filter((action) => action.place === "primary");
  const menu = actions.filter((action) => action.place === "menu");

  // Close the ⋯ menu on outside click, scroll or Escape.
  useEffect(() => {
    if (!menuAt) return undefined;
    const close = () => setMenuAt(null);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuAt]);

  const run = async (key: ActionKey, reasonText?: string) => {
    const action = actions.find((item) => item.key === key);
    if (!action) return;
    setBusy(true);
    try {
      await axios.post(`${BASE}/${row.id}/${key}`, null, {
        params: reasonText ? { reason: reasonText } : undefined,
      });
      ToasterService.success(`${prName} ${action.done}`);
      setConfirm(null);
      setReason("");
      await refreshRows();
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      ToasterService.error(data?.error || data?.message || `Could not ${action.label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  // Submit and Approve run straight away; Reject and Cancel ask first.
  const onAction = (key: ActionKey) => {
    setMenuAt(null);
    if (key === "reject" || key === "cancel") {
      setReason("");
      setConfirm(key);
      return;
    }
    run(key);
  };

  const openMenu = () => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuAt({ top: rect.bottom + 4, left: Math.max(8, rect.right - 170) });
  };

  if (!actions.length) return null;

  const isReject = confirm === "reject";
  const reasonMissing = isReject && !reason.trim();

  return (
    <>
      {primary.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onAction(action.key);
          }}
          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 transition disabled:opacity-50 ${action.className}`}
        >
          {action.label}
        </button>
      ))}

      {menu.length > 0 && (
        <button
          ref={menuButtonRef}
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            if (menuAt) setMenuAt(null);
            else openMenu();
          }}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title="More actions"
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={Boolean(menuAt)}
        >
          <EllipsisVerticalIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {/* ⋯ menu, drawn on top of the page so the table never cuts it off */}
      {menuAt &&
        createPortal(
          <div
            role="menu"
            style={{ position: "fixed", top: menuAt.top, left: menuAt.left, width: 170, zIndex: 10000 }}
            className="rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg dark:border-gray-700 dark:bg-gray-900"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {menu.map((action) => (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                onClick={() => onAction(action.key)}
                className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body
        )}

      {/* Confirm Cancel / Reject (Reject needs a reason) */}
      {confirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onMouseDown={() => !busy && setConfirm(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl bg-white p-5 text-left shadow-2xl dark:bg-gray-900"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {isReject ? `Reject ${prName}?` : `Cancel ${prName}?`}
                </h3>
                <CloseButton onClick={() => setConfirm(null)} disabled={busy} />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {isReject
                  ? "The requester will see this reason."
                  : "A cancelled requisition can't be submitted or turned into a purchase order."}
              </p>

              <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {isReject ? "Reason" : "Reason (optional)"}
                {isReject && <span className="text-red-500"> *</span>}
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  autoFocus
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  placeholder={isReject ? "e.g. Budget not available this month" : ""}
                />
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  disabled={busy}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => run(confirm, reason.trim() || undefined)}
                  disabled={busy || reasonMissing}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Please wait..." : isReject ? "Reject" : "Cancel requisition"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

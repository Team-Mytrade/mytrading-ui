import { useContext, useState } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { ToasterService } from "../../Services/ToasterService";

const BASE = "/v1/api/purchase/purchase-requisitions";

type Action = { key: string; label: string; done: string; className: string; needsReason?: boolean };

/**
 * Requisition status flow: DRAFT -> Submit -> SUBMITTED -> Approve / Reject (approvers), Cancel before
 * approval. The server enforces the same rules, including that nobody approves their own requisition.
 */
export default function RequisitionWorkflowActions({
  row,
  refreshRows,
}: {
  row: { id?: unknown; status?: unknown };
  refreshRows: () => Promise<void>;
}) {
  const { access } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const status = String(row.status ?? "");
  const canApprove = hasPermission(access, "PURCHASE:APPROVE");

  const actions: Action[] = [];
  if (status === "DRAFT") {
    actions.push({ key: "submit", label: "Submit", done: "submitted", className: "text-cyan-700 hover:bg-cyan-50" });
  }
  if ((status === "SUBMITTED" || status === "IN_REVIEW") && canApprove) {
    actions.push({ key: "approve", label: "Approve", done: "approved", className: "text-green-700 hover:bg-green-50" });
    actions.push({ key: "reject", label: "Reject", done: "rejected", className: "text-red-700 hover:bg-red-50", needsReason: true });
  }
  if (status === "DRAFT" || status === "SUBMITTED") {
    actions.push({ key: "cancel", label: "Cancel", done: "cancelled", className: "text-gray-600 hover:bg-gray-100" });
  }

  const run = async (action: Action) => {
    let params: Record<string, string> | undefined;
    if (action.needsReason) {
      const reason = window.prompt("Reason for rejecting this requisition?");
      if (!reason?.trim()) return;
      params = { reason: reason.trim() };
    }
    setBusy(true);
    try {
      await axios.post(`${BASE}/${row.id}/${action.key}`, null, { params });
      ToasterService.success(`Requisition ${action.done}`);
      await refreshRows();
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      ToasterService.error(data?.error || data?.message || `Could not ${action.label.toLowerCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            run(action);
          }}
          className={`rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50 ${action.className}`}
        >
          {action.label}
        </button>
      ))}
    </>
  );
}

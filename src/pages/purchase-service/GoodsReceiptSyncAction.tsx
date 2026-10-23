import { useState } from "react";
import axios from "axios";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";

const GRN_API = "/v1/api/purchase/grns";

/**
 * Retry for an accepted GRN whose goods did not reach Inventory (sync FAILED or never sent).
 * The server re-posts it and returns the receipt with its new sync status.
 */
export default function GoodsReceiptSyncAction({
  row,
  refreshRows,
}: {
  row: { id?: unknown; receiptNumber?: unknown; status?: unknown; inventorySyncStatus?: unknown };
  refreshRows: () => Promise<void>;
}) {
  // The retry is a POST, so it needs PURCHASE:CREATE like creating the receipt
  const { canCreate } = usePermissions("PURCHASE");
  const [busy, setBusy] = useState(false);

  const status = String(row.status ?? "").toUpperCase();
  const sync = String(row.inventorySyncStatus ?? "").toUpperCase();
  if (!canCreate || status !== "ACCEPTED" || sync === "SYNCED") return null;

  const retry = async () => {
    setBusy(true);
    try {
      const response = await axios.post(`${GRN_API}/${row.id}/retry-inventory-sync`);
      const name = String(row.receiptNumber || "Receipt");
      if (String(response.data?.inventorySyncStatus).toUpperCase() === "SYNCED") {
        ToasterService.success(`${name}: goods added to stock`);
      } else {
        ToasterService.error(`${name}: still not in stock. ${response.data?.inventorySyncError || "Inventory is not reachable."}`);
      }
      await refreshRows();
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      ToasterService.error(data?.message || data?.error || "Could not post the receipt to Inventory");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        retry();
      }}
      title="Retry posting to Inventory"
      aria-label="Retry posting to Inventory"
      className="rounded-lg p-2 text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
    >
      <ArrowPathIcon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
    </button>
  );
}

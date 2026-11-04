import { useState } from "react";
import axios from "axios";
import { ArchiveBoxXMarkIcon, EnvelopeIcon, InformationCircleIcon, PrinterIcon, XCircleIcon } from "@heroicons/react/24/outline";
import DocumentEmailDialog from "../../components/common/DocumentEmailDialog";
import CloseOrderDialog from "../../components/common/CloseOrderDialog";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { companyDisplayName } from "../../company/companyApi";
import { formatDate } from "../../company/format";
import { PurchaseOrderDoc, isPoApproved, loadPurchaseOrderDoc, printPurchaseOrder, purchaseOrderPdf } from "./purchaseOrderPdf";

import { t } from "../../i18n/i18n";
const PURCHASE = "/v1/api/purchase";
// Approved and not finished; the server checks the same
const SENDABLE = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"];
const ICON =
  "rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-40 dark:text-gray-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400";

type ApiError = { response?: { data?: { message?: string; error?: string } }; message?: string };

const errorText = (err: unknown, fallback: string) => {
  const e = err as ApiError;
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
};

// Nothing received yet: cancel; part received: close short (PURCHASE:APPROVE; the server checks the same)
const CANCELLABLE = ["DRAFT", "APPROVED", "SENT"];

/**
 * Print the purchase order, and email it to the vendor once it is approved (marks it Sent). Approvers can cancel an
 * order nothing was received against, or close a part-received one short; the reason is kept.
 */
export default function PurchaseOrderDocumentActions({
  row,
  refreshRows,
}: {
  row: { id?: unknown; poNumber?: unknown; status?: unknown; approvalStatus?: unknown; closedAt?: unknown; closeReason?: unknown };
  refreshRows: () => Promise<void>;
}) {
  // Emailing is a POST (PURCHASE:CREATE); marking as sent without an email is a PUT (PURCHASE:UPDATE)
  const { canCreate, canUpdate, canApprove } = usePermissions("PURCHASE");
  const [busy, setBusy] = useState(false);
  const [emailing, setEmailing] = useState<PurchaseOrderDoc | null>(null);
  const [closing, setClosing] = useState<"cancel" | "close" | null>(null);
  const id = Number(row.id);
  const status = String(row.status ?? "").toUpperCase();
  const sendable = isPoApproved({ approvalStatus: String(row.approvalStatus ?? ""), status: String(row.status ?? "") })
    && SENDABLE.includes(status);
  const closedReason = row.closedAt ? String(row.closeReason ?? "") : "";

  const closeOrder = async (reason: string) => {
    try {
      await axios.post(`${PURCHASE}/purchase-orders/${id}/${closing}`, { reason });
      ToasterService.success(closing === "cancel"
        ? `${String(row.poNumber || "The order")}: ${t("cancelled")}`
        : `${String(row.poNumber || "The order")}: ${t("closed short")}`);
      setClosing(null);
      await refreshRows();
    } catch (err) {
      ToasterService.error(closing === "cancel" ? "The order could not be cancelled" : "The order could not be closed",
        errorText(err, "Please try again."));
    }
  };

  const withDoc = async (action: (doc: PurchaseOrderDoc) => Promise<void> | void) => {
    setBusy(true);
    try {
      await action(await loadPurchaseOrderDoc(id));
    } catch (err) {
      ToasterService.error("The purchase order could not be loaded", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const markSent = async () => {
    try {
      await axios.put(`${PURCHASE}/purchase-orders/${id}/sent`);
      ToasterService.success(`${String(row.poNumber || "The order")} is marked as sent to the vendor.`);
      setEmailing(null);
      await refreshRows();
    } catch (err) {
      ToasterService.error("Could not mark the order as sent", errorText(err, "Please try again."));
    }
  };

  if (!Number.isFinite(id)) return null;
  const number = emailing?.po.poNumber || String(row.poNumber || `#${id}`);
  const company = companyDisplayName();

  return (
    <>
      <button type="button" title={t("Print purchase order")} aria-label={t("Print purchase order")} className={ICON} disabled={busy}
        onClick={(e) => { e.stopPropagation(); void withDoc(printPurchaseOrder); }}>
        <PrinterIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      {sendable && canCreate && (
        <button type="button" title={t("Email to vendor")} aria-label={t("Email to vendor")} className={ICON} disabled={busy}
          onClick={(e) => { e.stopPropagation(); void withDoc((doc) => setEmailing(doc)); }}>
          <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {canApprove && !row.closedAt && CANCELLABLE.includes(status) && (
        <button type="button" title={t("Cancel order")} aria-label={t("Cancel order")} className={ICON} disabled={busy}
          onClick={(e) => { e.stopPropagation(); setClosing("cancel"); }}>
          <XCircleIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {canApprove && !row.closedAt && status === "PARTIALLY_RECEIVED" && (
        <button type="button" title={t("Close short")} aria-label={t("Close short")} className={ICON} disabled={busy}
          onClick={(e) => { e.stopPropagation(); setClosing("close"); }}>
          <ArchiveBoxXMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {closedReason && (
        <span className="inline-flex p-2 text-amber-500" title={`${t(status === "CANCELLED" ? "Cancelled" : "Closed short")}: ${closedReason}`}>
          <InformationCircleIcon className="h-4 w-4" aria-label={t(status === "CANCELLED" ? "Cancelled" : "Closed short")} />
        </span>
      )}
      {closing && (
        <CloseOrderDialog
          title={closing === "cancel" ? t("Cancel purchase order") : t("Close purchase order short")}
          subtitle={closing === "cancel"
            ? `${String(row.poNumber || "")}: ${t("nothing more will be received, and its requisition can be ordered again.")}`
            : `${String(row.poNumber || "")}: ${t("what wasn't received won't be; what was received stays billable.")}`}
          submitLabel={closing === "cancel" ? t("Cancel order") : t("Close short")}
          onSubmit={closeOrder}
          onClose={() => setClosing(null)}
        />
      )}
      {emailing && (
        <DocumentEmailDialog
          documentLabel="Purchase order"
          number={number}
          endpoint={`${PURCHASE}/purchase-orders/${id}`}
          recipient="vendor"
          defaultTo={emailing.vendor?.contactEmail || ""}
          defaultSubject={`Purchase order ${number} from ${company}`}
          defaultMessage={
            `Dear ${emailing.vendor?.contactName || emailing.vendor?.name || "Sir/Madam"},\n\n` +
            `Please find attached our purchase order ${number}` +
            (emailing.po.expectedDeliveryDate ? `, for delivery by ${formatDate(emailing.po.expectedDeliveryDate)}` : "") +
            ". Kindly confirm the order and the delivery date.\n\nRegards,\n" + company
          }
          markSent
          hint={emailing.po.sentToVendorAt
            ? `Last sent ${formatDate(emailing.po.sentToVendorAt)}. The PDF is attached, as in the print.`
            : "The PDF is attached, as in the print. Sending it marks the order as Sent."}
          sendLabel="Send to vendor"
          getPdf={() => purchaseOrderPdf(emailing)}
          onClose={() => setEmailing(null)}
          onSent={() => { setEmailing(null); void refreshRows(); }}
          onSendWithoutEmail={canUpdate ? markSent : undefined}
        />
      )}
    </>
  );
}

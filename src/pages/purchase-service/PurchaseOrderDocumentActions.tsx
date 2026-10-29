import { useState } from "react";
import axios from "axios";
import { EnvelopeIcon, PrinterIcon } from "@heroicons/react/24/outline";
import DocumentEmailDialog from "../../components/common/DocumentEmailDialog";
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

/** Print the purchase order, and email it to the vendor once it is approved (marks it Sent). */
export default function PurchaseOrderDocumentActions({
  row,
  refreshRows,
}: {
  row: { id?: unknown; poNumber?: unknown; status?: unknown; approvalStatus?: unknown };
  refreshRows: () => Promise<void>;
}) {
  // Emailing is a POST (PURCHASE:CREATE); marking as sent without an email is a PUT (PURCHASE:UPDATE)
  const { canCreate, canUpdate } = usePermissions("PURCHASE");
  const [busy, setBusy] = useState(false);
  const [emailing, setEmailing] = useState<PurchaseOrderDoc | null>(null);
  const id = Number(row.id);
  const sendable = isPoApproved({ approvalStatus: String(row.approvalStatus ?? ""), status: String(row.status ?? "") })
    && SENDABLE.includes(String(row.status ?? "").toUpperCase());

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

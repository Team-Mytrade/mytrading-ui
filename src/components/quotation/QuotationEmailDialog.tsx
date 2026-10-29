import DocumentEmailDialog from "../common/DocumentEmailDialog";

const API_URL = "/v1/api/sales/quotations";

export interface EmailableQuotation {
  id: number;
  quoteNumber?: string;
  customerName?: string;
  email?: string;
  validUntil?: string;
}

interface Props {
  quotation: EmailableQuotation;
  // Customer address to start with (the quotation's own email first)
  defaultTo: string;
  companyName: string;
  // Opened by moving a draft to Sent: the email marks it sent
  markSent: boolean;
  // The same PDF as the download
  getPdf: () => Promise<Blob>;
  onClose: () => void;
  onSent: (quotation: Record<string, unknown>) => void;
  // Mark as sent without an email (no address, or sent another way)
  onSendWithoutEmail?: () => void;
}

/** Emails a quotation's PDF to the customer and shows earlier sends. */
export default function QuotationEmailDialog({
  quotation, defaultTo, companyName, markSent, getPdf, onClose, onSent, onSendWithoutEmail,
}: Props) {
  const number = quotation.quoteNumber || `#${quotation.id}`;
  return (
    <DocumentEmailDialog
      documentLabel="Quotation"
      number={number}
      endpoint={`${API_URL}/${quotation.id}`}
      recipient="customer"
      defaultTo={defaultTo}
      defaultSubject={`Quotation ${number} from ${companyName}`}
      defaultMessage={
        `Dear ${quotation.customerName || "Sir/Madam"},\n\nPlease find attached our quotation ${number}. ` +
        "Let us know if you have any questions.\n\nRegards,\n" + companyName
      }
      markSent={markSent}
      getPdf={getPdf}
      onClose={onClose}
      onSent={(response) => onSent((response.quotation as Record<string, unknown>) ?? {})}
      onSendWithoutEmail={onSendWithoutEmail}
    />
  );
}

import { useState } from "react";
import axios from "axios";
import { ChatBubbleLeftRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { companyDisplayName, currentCompanyCountry } from "../../company/companyApi";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";

// Sends a document's PDF (invoice, quotation, statement) to the customer's WhatsApp through the company's WhatsApp
// channel and its document template (backlog 7.1.4). The page makes the PDF, as for the download.

export interface WhatsAppDocumentDialogProps {
  // "Invoice", "Quotation", "Statement": the title and messages
  documentLabel: string;
  number?: string;
  customerName?: string;
  // POST multipart: file, phone, country, companyName (+ extra)
  endpoint: string;
  defaultPhone?: string | null;
  // The server knows a number for it (the invoice keeps the customer's phone): the field may stay empty
  phoneOptional?: boolean;
  extra?: Record<string, string>;
  getPdf: () => Promise<Blob>;
  onClose: () => void;
  onSent?: (response: Record<string, unknown>) => void;
}

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

export default function WhatsAppDocumentDialog({
  documentLabel, number, customerName, endpoint, defaultPhone, phoneOptional, extra, getPdf, onClose, onSent,
}: WhatsAppDocumentDialogProps) {
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const what = `${t(documentLabel)}${number ? ` ${number}` : ""}`;

  const send = async () => {
    if (!phone.trim() && !phoneOptional) {
      setProblem(t("Enter the customer's mobile number"));
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      const pdf = await getPdf();
      const form = new FormData();
      form.append("file", new File([pdf], `${(number || documentLabel).replace(/[^a-z0-9_-]+/gi, "-")}.pdf`, { type: "application/pdf" }));
      if (phone.trim()) form.append("phone", phone.trim());
      const country = currentCompanyCountry();
      if (country) form.append("country", country);
      form.append("companyName", companyDisplayName());
      Object.entries(extra ?? {}).forEach(([key, value]) => value && form.append(key, value));
      const res = await axios.post(endpoint, form, { quiet: true } as object);
      const to = (res.data as { to?: string })?.to;
      ToasterService.success(t("{what} sent by WhatsApp").replace("{what}", what), to ? `${t("To")} ${to}` : undefined);
      onSent?.(res.data ?? {});
      onClose();
    } catch (err) {
      const message = apiError(err, "The document could not be sent by WhatsApp");
      setProblem(message.replace(/^(phone|file): /, ""));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-labelledby="wa-doc-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-transparent dark:bg-[#191919]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><ChatBubbleLeftRightIcon className="h-4 w-4" /></span>
            <div>
              <h3 id="wa-doc-title" className="text-sm font-semibold text-slate-900 dark:text-white">{t("Send by WhatsApp")}</h3>
              <p className="text-[11px] text-slate-500">{what}{customerName ? ` · ${customerName}` : ""}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label={t("Close")}><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300" htmlFor="wa-doc-phone">{t("Customer's mobile number")}</label>
            <input id="wa-doc-phone" dir="ltr" className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" />
            <p className="mt-1 text-[11px] text-slate-500">
              {t("A local number gets your company's country code.")}
              {phoneOptional ? ` ${t("Leave it empty to use the phone kept on the invoice.")}` : ""}
            </p>
          </div>
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            {t("The PDF goes with your company's WhatsApp document template, from your WhatsApp Business number. It is listed under Recent deliveries on Notification Settings.")}
          </p>
          {problem && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{problem}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-gray-800">
          <button type="button" onClick={onClose} disabled={sending}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
            {t("Cancel")}
          </button>
          <button type="button" onClick={send} disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            {sending ? t("Sending…") : t("Send")}
          </button>
        </div>
      </div>
    </div>
  );
}

import { ReactNode, useEffect, useState } from "react";
import axios from "axios";
import { EnvelopeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { formatDateTime } from "../../company/format";

interface EmailHistory {
  id: number;
  sentTo: string;
  cc?: string | null;
  subject?: string;
  sentAt?: string;
  sentBy?: string;
  delivered: boolean;
  failure?: string | null;
}

export interface DocumentEmailDialogProps {
  // "Quotation", "Purchase order": used in the title, toasts and errors
  documentLabel: string;
  number: string;
  // Record URL: POST {endpoint}/email sends, GET {endpoint}/emails lists earlier sends
  endpoint: string;
  // Who receives it, for the hints ("customer", "vendor")
  recipient: string;
  defaultTo: string;
  defaultSubject: string;
  defaultMessage: string;
  // The send also moves the document to Sent
  markSent: boolean;
  // Shown under the title
  hint?: ReactNode;
  sendLabel?: string;
  // The same PDF as the download / print
  getPdf: () => Promise<Blob>;
  onClose: () => void;
  // The server's answer to the send
  onSent: (response: Record<string, unknown>) => void;
  // Mark as sent without an email (no address, or sent another way)
  onSendWithoutEmail?: () => void;
}

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const EMAIL = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

type ApiError = { response?: { data?: { message?: string; error?: string } }; message?: string };

const errorText = (err: unknown, fallback: string) => {
  const e = err as ApiError;
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
};

const invalidAddresses = (value: string) =>
  value.split(/[,;]/).map((s) => s.trim()).filter(Boolean).filter((s) => !EMAIL.test(s));

/** Emails a document's PDF (quotation, purchase order) and shows earlier sends. */
export default function DocumentEmailDialog({
  documentLabel, number, endpoint, recipient, defaultTo, defaultSubject, defaultMessage, markSent, hint, sendLabel,
  getPdf, onClose, onSent, onSendWithoutEmail,
}: DocumentEmailDialogProps) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<EmailHistory[]>([]);

  useEffect(() => {
    axios.get<EmailHistory[]>(`${endpoint}/emails`)
      .then((r) => setHistory(Array.isArray(r.data) ? r.data : []))
      .catch(() => setHistory([]));
  }, [endpoint]);

  const send = async () => {
    const bad = [...invalidAddresses(to), ...invalidAddresses(cc)];
    if (!to.trim()) {
      ToasterService.error(`Enter the ${recipient}'s email address.`);
      return;
    }
    if (bad.length) {
      ToasterService.error(`Not a valid email address: ${bad.join(", ")}`);
      return;
    }
    setSending(true);
    try {
      const pdf = await getPdf();
      const form = new FormData();
      form.append("file", new File([pdf], `${number.replace(/[^a-z0-9_-]+/gi, "-")}.pdf`, { type: "application/pdf" }));
      form.append("to", to);
      if (cc.trim()) form.append("cc", cc);
      form.append("subject", subject);
      form.append("message", message);
      form.append("markSent", String(markSent));
      const res = await axios.post(`${endpoint}/email`, form);
      ToasterService.success(`${documentLabel} ${number} emailed to ${to}`, markSent ? "It is now marked as Sent." : undefined);
      onSent(res.data ?? {});
    } catch (err) {
      ToasterService.error(`The ${documentLabel.toLowerCase()} could not be emailed`, errorText(err, "Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-labelledby="doc-email-title"
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-transparent dark:bg-[#191919]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600"><EnvelopeIcon className="h-4 w-4" /></span>
            <div>
              <h3 id="doc-email-title" className="text-sm font-semibold text-slate-900 dark:text-white">Email {documentLabel.toLowerCase()} {number}</h3>
              <p className="text-[11px] text-slate-500">
                {hint ?? (markSent ? `Sending it marks the ${documentLabel.toLowerCase()} as Sent.` : "The PDF is attached, as in the download.")}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className={LABEL} htmlFor="de-to">To *</label>
            <input id="de-to" className={INPUT} value={to} onChange={(e) => setTo(e.target.value)} placeholder={`${recipient}@example.com`} />
            <p className="mt-0.5 text-[11px] text-slate-500">Separate several addresses with commas.</p>
          </div>
          <div>
            <label className={LABEL} htmlFor="de-cc">Cc</label>
            <input id="de-cc" className={INPUT} value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="de-subject">Subject</label>
            <input id="de-subject" className={INPUT} value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="de-message">Message</label>
            <textarea id="de-message" className={`${INPUT} min-h-[140px]`} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          {history.length > 0 && (
            <div>
              <p className={LABEL}>Sent before</p>
              <ul className="space-y-1">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] dark:bg-[#222222]">
                    <span className="min-w-0 truncate text-slate-700 dark:text-gray-300">{h.sentTo}{h.cc ? ` (cc ${h.cc})` : ""}</span>
                    <span className={`shrink-0 ${h.delivered ? "text-slate-500" : "text-red-600"}`} title={h.failure ?? undefined}>
                      {h.delivered ? "" : "Failed · "}
                      {h.sentAt ? formatDateTime(h.sentAt) : ""}
                      {h.sentBy ? ` · ${h.sentBy}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-gray-800">
          {markSent && onSendWithoutEmail && (
            <button type="button" onClick={onSendWithoutEmail} disabled={sending}
              className="mr-auto text-xs font-medium text-slate-500 hover:text-cyan-700 hover:underline disabled:opacity-50">
              Mark as Sent without emailing
            </button>
          )}
          <button type="button" onClick={onClose} disabled={sending}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
            Cancel
          </button>
          <button type="button" onClick={send} disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            <EnvelopeIcon className="h-4 w-4" />
            {sending ? "Sending..." : sendLabel ?? (markSent ? "Send and mark as Sent" : "Send email")}
          </button>
        </div>
      </div>
    </div>
  );
}

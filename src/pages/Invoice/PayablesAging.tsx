import React from "react";
import { dateLabel, labelOf, money } from "./invoiceShared";

import { t } from "../../i18n/i18n";
export interface AgingBucket {
  bucket: string;
  invoiceCount: number;
  outstandingAmount: number;
}

export interface ApAging {
  asOfDate: string;
  totalOutstanding: number;
  overdueAmount: number;
  dueThisWeekAmount: number;
  buckets: AgingBucket[];
  vendors: {
    vendorId: number | null;
    vendorName: string;
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
    total: number;
  }[];
  dueThisWeek: {
    payableId: number;
    purchaseInvoiceId: number | null;
    invoiceNumber: string | null;
    vendorName: string;
    dueDate: string;
    balance: number;
  }[];
}

export interface DebitNote {
  id: number;
  debitNoteNumber: string;
  noteDate?: string;
  amount: number;
  appliedAmount?: number | null;
  status: string;
  reason?: string;
  vendorName?: string;
  returnNumber?: string | null;
  grnNumber?: string | null;
  purchaseInvoice?: { id: number; invoiceNumber?: string } | null;
}

const BUCKET_TONES = ["bg-emerald-500", "bg-amber-400", "bg-orange-500", "bg-red-500", "bg-red-700"];

const DEBIT_NOTE_STATUS: Record<string, { label: string; tone: string; hint: string }> = {
  APPLIED: { label: "Applied", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", hint: "Taken off the bill's balance" },
  NETTED: { label: "Left off bill", tone: "bg-slate-50 text-slate-600 border-slate-200", hint: "The bill was made without these goods" },
  PENDING: { label: "Waiting for bill", tone: "bg-amber-50 text-amber-700 border-amber-200", hint: "Applied when the goods receipt is billed" },
};

/** Open payables by days past due, per vendor, and the bills due in the next 7 days. */
export const PayablesAging: React.FC<{ aging: ApAging | null }> = ({ aging }) => {
  if (!aging) return null;
  const total = Number(aging.totalOutstanding) || 0;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{t("Aging by days past due")}</h3>
          <span className="text-xs text-slate-400">{t("as of")} {dateLabel(aging.asOfDate)}</span>
        </div>
        {total > 0 && (
          <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
            {aging.buckets.map((bucket, index) => (
              <div key={bucket.bucket} className={BUCKET_TONES[index]} style={{ width: `${(Number(bucket.outstandingAmount) / total) * 100}%` }} title={`${bucket.bucket}: ${money(bucket.outstandingAmount)}`} />
            ))}
          </div>
        )}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {aging.buckets.map((bucket, index) => (
            <div key={bucket.bucket} className="rounded-lg border border-slate-100 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`h-2 w-2 rounded-full ${BUCKET_TONES[index]}`} />
                {bucket.bucket === "Current" ? "Not yet due" : `${bucket.bucket} days`}
              </div>
              <div className="text-sm font-semibold text-slate-900">{money(bucket.outstandingAmount)}</div>
              <div className="text-xs text-slate-400">{bucket.invoiceCount} bill{bucket.invoiceCount === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
        {aging.vendors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-3 text-left">{t("Vendor")}</th>
                  <th className="px-2 py-2 text-right">{t("Not due")}</th>
                  <th className="px-2 py-2 text-right">1-30</th>
                  <th className="px-2 py-2 text-right">31-60</th>
                  <th className="px-2 py-2 text-right">61-90</th>
                  <th className="px-2 py-2 text-right">90+</th>
                  <th className="py-2 pl-2 text-right">{t("Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {aging.vendors.map((row) => (
                  <tr key={row.vendorId ?? row.vendorName}>
                    <td className="py-2 pr-3 font-medium text-slate-800">{row.vendorName}</td>
                    {[row.current, row.days1to30, row.days31to60, row.days61to90, row.over90].map((value, index) => (
                      <td key={index} className={`px-2 py-2 text-right ${index > 0 && Number(value) > 0 ? "text-red-600" : "text-slate-600"}`}>
                        {Number(value) > 0 ? money(value) : "—"}
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right font-semibold text-slate-900">{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("Nothing is owed to vendors.")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{t("Due in the next 7 days")}</h3>
          <span className="text-sm font-semibold text-amber-700">{money(aging.dueThisWeekAmount)}</span>
        </div>
        {aging.dueThisWeek.length === 0 ? (
          <p className="text-sm text-slate-500">{t("No bills fall due this week.")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aging.dueThisWeek.map((bill) => (
              <li key={bill.payableId} className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">{bill.vendorName}</div>
                  <div className="text-xs text-slate-400">{t("Bill")} {bill.invoiceNumber ?? "—"} · due {dateLabel(bill.dueDate)}</div>
                </div>
                <span className="text-sm font-semibold text-slate-900">{money(bill.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export const DebitNotesList: React.FC<{ notes: DebitNote[] }> = ({ notes }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="mb-1 text-sm font-semibold text-slate-800">{t("Debit notes")}</h3>
    <p className="mb-3 text-xs text-slate-400">
      Goods returned to vendors (from Purchase Returns) and corrections raised on a bill. They reduce what is owed, like payments.
    </p>
    {notes.length === 0 ? (
      <p className="text-sm text-slate-500">{t("No debit notes yet.")}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="py-2 pr-3 text-left">{t("Debit note")}</th>
              <th className="px-2 py-2 text-left">{t("Vendor")}</th>
              <th className="px-2 py-2 text-left">{t("Against")}</th>
              <th className="px-2 py-2 text-left">{t("Reason")}</th>
              <th className="px-2 py-2 text-right">{t("Amount")}</th>
              <th className="px-2 py-2 text-right">{t("Applied")}</th>
              <th className="py-2 pl-2 text-left">{t("Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {notes.map((note) => {
              const status = DEBIT_NOTE_STATUS[note.status] ?? { label: labelOf(note.status), tone: "bg-slate-50 text-slate-600 border-slate-200", hint: "" };
              return (
                <tr key={note.id}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-slate-800">{note.debitNoteNumber}</span>
                    <span className="block text-xs text-slate-400">{dateLabel(note.noteDate)}</span>
                  </td>
                  <td className="px-2 py-2 text-slate-700">{note.vendorName ?? "—"}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {note.purchaseInvoice?.invoiceNumber ? `Bill ${note.purchaseInvoice.invoiceNumber}` : "No bill yet"}
                    {note.returnNumber && <span className="block text-xs text-slate-400">{note.returnNumber} · {note.grnNumber}</span>}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{note.reason ?? "—"}</td>
                  <td className="px-2 py-2 text-right font-medium">{money(note.amount)}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{note.appliedAmount != null ? money(note.appliedAmount) : "—"}</td>
                  <td className="py-2 pl-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.tone}`} title={status.hint}>{status.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

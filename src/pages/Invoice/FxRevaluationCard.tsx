import { useEffect, useState } from "react";
import axios from "axios";
import { ScaleIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { CARD, CARD_TITLE } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
interface RevaluationLine {
  // AR: a customer invoice, AP: a vendor bill
  kind: "AR" | "AP";
  documentId: number;
  number: string;
  party?: string | null;
  currency: string;
  balance: number;
  bookRate: number;
  rate: number;
  bookValue: number;
  newValue: number;
  difference: number;
}

interface Preview {
  date: string;
  baseCurrency: string;
  lines: RevaluationLine[];
  // Currencies with open documents but no rate on or before the date: left out
  missingRates: string[];
  receivablesDifference: number;
  payablesDifference: number;
  // Positive: a gain
  net: number;
  posted: boolean;
  reversalDate: string;
}

interface Run {
  date: string;
  entryNumber: string;
  net: number;
  reversalNumber?: string | null;
  reversalDate?: string | null;
}

const API = `${INVOICE_API}/accounting/fx-revaluation`;
const INPUT =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

// The last day of the previous month, the usual revaluation date
const lastMonthEnd = () => {
  const d = new Date(`${todayInput()}T00:00:00`);
  d.setDate(0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const signed = (value: number, currency?: string) => `${value > 0 ? "+" : ""}${money(value, currency)}`;

/**
 * Month-end revaluation: open foreign-currency invoices and bills restated at the rate on the date, the difference
 * posted as unrealised exchange gain or loss and reversed the next day. Running it again for a date replaces it.
 */
export default function FxRevaluationCard({ editable }: { editable: boolean }) {
  const [date, setDate] = useState(lastMonthEnd);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState<Run | null>(null);

  const loadRuns = () =>
    axios.get<Run[]>(API).then(
      (res) => setRuns(Array.isArray(res.data) ? res.data : []),
      (err) => ToasterService.error(apiError(err, "Could not load the revaluations")),
    );

  const loadPreview = (on: string) => {
    if (!on) return setPreview(null);
    axios.get<Preview>(`${API}/preview`, { params: { date: on } }).then(
      (res) => setPreview(res.data),
      (err) => {
        setPreview(null);
        ToasterService.error(apiError(err, "Could not work out the revaluation"));
      },
    );
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    loadPreview(date);
  }, [date]);

  const post = async () => {
    setConfirming(false);
    setBusy(true);
    try {
      const { data } = await axios.post<Preview>(API, { date });
      setPreview(data);
      ToasterService.success(`Revaluation at ${dateLabel(date)} posted`, `Reversed on ${dateLabel(data.reversalDate)}.`);
      void loadRuns();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not post the revaluation"));
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    const run = undoing;
    setUndoing(null);
    if (!run) return;
    setBusy(true);
    try {
      await axios.delete(`${API}/${run.date}`);
      ToasterService.success(`Revaluation at ${dateLabel(run.date)} undone`);
      void loadRuns();
      loadPreview(date);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not undo the revaluation"));
    } finally {
      setBusy(false);
    }
  };

  const base = preview?.baseCurrency;
  const nothing = !!preview && preview.lines.length === 0;

  return (
    <section className={`${CARD} p-5`}>
      <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
        <ScaleIcon className="h-4 w-4 text-cyan-600" /> {t("Month-end exchange revaluation")}
      </h3>
      <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
        {t("Open foreign-currency invoices and bills are restated at the rate on the date. The difference posts as unrealised exchange gain or loss and is reversed the next day, so settlements still post their full exchange difference. Bank balances, customer credits and vendor advances in foreign currency are not revalued.")}
        {!editable && ` ${t("Only a finance administrator can post it.")}`}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          {t("Revalue at")}
          <input type="date" className={`${INPUT} mt-1 block`} value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {editable && (
          <button type="button" disabled={busy || !preview || (nothing && !preview.posted)}
            onClick={() => setConfirming(true)}
            className="h-[38px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            {t(busy ? "Posting..." : preview?.posted ? "Post again" : "Post revaluation")}
          </button>
        )}
        {preview?.posted && <span className="text-xs text-emerald-700">{t("Posted for this date")}</span>}
      </div>

      {preview && preview.missingRates.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {t("No exchange rate on or before this date for")} <b>{preview.missingRates.join(", ")}</b>
          {t(": those documents are left out. Add the rate under Exchange Rates.")}
        </p>
      )}

      {preview && (nothing ? (
        <p className="mt-3 text-sm text-slate-400">{t("No open foreign-currency invoices or bills on this date.")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">{t("Document")}</th>
                <th className="py-1.5 pr-3 font-medium">{t("Party")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t("Open balance")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t("Booked rate")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t("Rate on date")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t("Booked value")}</th>
                <th className="py-1.5 pr-3 text-right font-medium">{t("New value")}</th>
                <th className="py-1.5 text-right font-medium">{t("Gain / loss")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {preview.lines.map((line) => {
                // A receivable worth more is a gain; a payable worth more is a loss
                const effect = line.kind === "AR" ? line.difference : -line.difference;
                return (
                  <tr key={`${line.kind}-${line.documentId}`} className="text-slate-700 dark:text-gray-200">
                    <td className="py-1.5 pr-3">
                      <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {t(line.kind === "AR" ? "Invoice" : "Bill")}
                      </span>
                      {line.number}
                    </td>
                    <td className="py-1.5 pr-3">{line.party ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{money(line.balance, line.currency)}</td>
                    <td className="py-1.5 pr-3 text-right">{line.bookRate}</td>
                    <td className="py-1.5 pr-3 text-right">{line.rate}</td>
                    <td className="py-1.5 pr-3 text-right">{money(line.bookValue, base)}</td>
                    <td className="py-1.5 pr-3 text-right">{money(line.newValue, base)}</td>
                    <td className={`py-1.5 text-right font-medium ${effect < 0 ? "text-rose-600" : effect > 0 ? "text-emerald-700" : ""}`}>
                      {signed(effect, base)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-right text-xs text-slate-600 dark:text-gray-300">
            {t("Receivables")} {signed(preview.receivablesDifference, base)} · {t("Payables")} {signed(-preview.payablesDifference, base)} ·{" "}
            <b className={preview.net < 0 ? "text-rose-600" : "text-emerald-700"}>
              {t(preview.net < 0 ? "Net loss" : "Net gain")} {money(Math.abs(preview.net), base)}
            </b>
          </p>
        </div>
      ))}

      {runs.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {runs.map((run) => (
            <li key={run.date} className="flex flex-wrap items-center gap-2">
              <span>
                {dateLabel(run.date)} · {run.entryNumber} · {t(run.net < 0 ? "loss" : "gain")} {money(Math.abs(run.net))}
                {run.reversalNumber ? ` · ${t("reversed")} ${dateLabel(run.reversalDate)} (${run.reversalNumber})` : ""}
              </span>
              {editable && (
                <button type="button" disabled={busy} onClick={() => setUndoing(run)}
                  className="text-rose-600 hover:underline disabled:opacity-50">{t("Undo")}</button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirming}
        title={t("Post revaluation")}
        message={preview ? `${dateLabel(date)}: ${t(preview.net < 0 ? "Net loss" : "Net gain")} ${money(Math.abs(preview.net), base)}. ${t("Reversed on")} ${dateLabel(preview.reversalDate)}.${preview.posted ? ` ${t("It replaces the revaluation already posted for this date.")}` : ""}` : ""}
        confirmLabel={t("Post")}
        onConfirm={() => void post()}
        onCancel={() => setConfirming(false)}
      />
      <ConfirmDialog
        isOpen={Boolean(undoing)}
        title={t("Undo revaluation")}
        message={`${t("Reverse the revaluation at")} ${dateLabel(undoing?.date)} ${t("and its next-day reversal?")}`}
        confirmLabel={t("Undo")}
        variant="danger"
        onConfirm={() => void undo()}
        onCancel={() => setUndoing(null)}
      />
    </section>
  );
}

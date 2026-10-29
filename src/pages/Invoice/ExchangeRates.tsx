import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CurrencyDollarIcon, TrashIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { INVOICE_API, apiError, dateLabel, todayInput } from "./invoiceShared";

interface Rate {
  id: number;
  currency: string;
  rateDate: string;
  rate: number;
  source?: string | null;
}

interface RatesView {
  baseCurrency?: string | null;
  rates: Rate[];
}

const API = `${INVOICE_API}/exchange-rates`;

// Rates keep up to 10 decimals; show what was entered
const rateText = (rate: number) => Number(rate).toLocaleString(undefined, { maximumFractionDigits: 10 });

/**
 * Exchange rates into the company's currency. Invoices, bills, receipts and payments in another currency take the
 * latest rate on or before their date, keep it, and post in the company's currency.
 */
const ExchangeRates: React.FC = () => {
  const { canCreate, canDelete } = usePermissions();
  const [data, setData] = useState<RatesView>({ rates: [] });
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ currency: "USD", rateDate: todayInput(), rate: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<RatesView>(API);
      setData({ baseCurrency: res.data.baseCurrency, rates: Array.isArray(res.data.rates) ? res.data.rates : [] });
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the exchange rates"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const base = data.baseCurrency ?? "";
  // The rate in force today for each currency (rates come newest first)
  const latest = useMemo(() => {
    const seen = new Map<string, Rate>();
    const today = todayInput();
    data.rates.forEach((r) => {
      if (r.rateDate <= today && !seen.has(r.currency)) seen.set(r.currency, r);
    });
    return [...seen.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }, [data.rates]);
  const shown = data.rates.filter((r) => !filter || r.currency === filter);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const currency = form.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return ToasterService.error("Use a 3-letter currency code such as USD");
    if (!(Number(form.rate) > 0)) return ToasterService.error(`Enter how much one ${currency} is worth${base ? ` in ${base}` : ""}`);
    setSaving(true);
    try {
      await axios.post(API, { currency, rateDate: form.rateDate || null, rate: Number(form.rate), source: form.source.trim() || null });
      ToasterService.success(`1 ${currency} = ${form.rate} ${base} from ${dateLabel(form.rateDate)}`);
      setForm((f) => ({ ...f, rate: "" }));
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the rate"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rate: Rate) => {
    if (!window.confirm(`Remove the ${rate.currency} rate of ${dateLabel(rate.rateDate)}? Documents that used it keep their rate.`)) return;
    try {
      await axios.delete(`${API}/${rate.id}`);
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not remove the rate"));
    }
  };

  return (
    <>
      <PageMeta title="Exchange Rates" description="Rates into the company's currency" />
      <PageBreadcrumb pageTitle="Exchange Rates" />

      <div className="w-full max-w-none space-y-4 py-4">
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#191919] dark:text-gray-300">
          The company's currency is <b>{base || "not known yet"}</b>. Invoices, bills, receipts and payments in another currency take
          the latest rate on or before their own date and keep it; the ledger and the statements are in {base || "the company's currency"}.
          Paying at a different rate than the invoice or bill was booked at puts the difference in <i>Exchange gains and losses</i>.
        </p>

        {latest.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {latest.map((r) => (
              <button key={r.currency} type="button" onClick={() => setFilter(filter === r.currency ? "" : r.currency)}
                className={`rounded-lg border px-3 py-2 text-left text-xs ${filter === r.currency ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <span className="block font-semibold text-slate-800">1 {r.currency} = {rateText(r.rate)} {base}</span>
                <span className="text-slate-500">since {dateLabel(r.rateDate)}</span>
              </button>
            ))}
          </div>
        )}

        {canCreate && (
          <form onSubmit={save} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5 dark:border-gray-800 dark:bg-[#191919]">
            <FloatingInput label="Currency (e.g. USD)" name="currency" value={form.currency} required
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) }))} />
            <FloatingInput label="From" name="rateDate" type="date" value={form.rateDate} onChange={(e) => setForm((f) => ({ ...f, rateDate: e.target.value }))} />
            <FloatingInput label={`1 ${form.currency || "…"} = ? ${base}`} name="rate" type="number" required value={form.rate}
              onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
            <FloatingInput label="Source (optional)" name="source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="h-10 w-full rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save rate"}
              </button>
            </div>
          </form>
        )}

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-[#191919]">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#222] dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Currency</th>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    <CurrencyDollarIcon className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                    {loading ? "Loading…" : "No rates yet. Documents in the company's own currency need none."}
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-gray-100">{r.currency}</td>
                  <td className="px-4 py-2 text-slate-600">{dateLabel(r.rateDate)}</td>
                  <td className="px-4 py-2 text-right text-slate-800 dark:text-gray-100">1 {r.currency} = {rateText(r.rate)} {base}</td>
                  <td className="px-4 py-2 text-slate-500">{r.source || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    {canDelete && (
                      <button type="button" onClick={() => remove(r)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
};

export default ExchangeRates;

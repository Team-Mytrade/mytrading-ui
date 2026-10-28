import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError } from "../Invoice/invoiceShared";
import { useCompany } from "../../company/companyApi";
import { formatDate, formatMoney, todayIso } from "../../company/format";

interface Box {
  taxableAmount: number;
  vatAmount: number;
  documents: number;
}

interface VatReturnData {
  from: string;
  to: string;
  currencies: string[];
  standardRatedSales: Box;
  zeroRatedSales: Box;
  exemptSales: Box;
  reverseChargeSales: Box;
  creditNotes: Box;
  standardRatedPurchases: Box;
  reverseChargePurchases: Box;
  outputVat: number;
  inputVat: number;
  netVatDue: number;
  invoiceCount: number;
  billCount: number;
}

type Period = "thisMonth" | "lastMonth" | "thisQuarter" | "lastQuarter" | "custom";

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** First and last day of a period, from today in the company's time zone. */
const rangeOf = (period: Period): [string, string] => {
  const [y, m] = todayIso().split("-").map(Number);
  const month = m - 1;
  if (period === "thisMonth") return [iso(y, month, 1), iso(y, month, lastDay(y, month))];
  if (period === "lastMonth") {
    const d = new Date(y, month - 1, 1);
    return [iso(d.getFullYear(), d.getMonth(), 1), iso(d.getFullYear(), d.getMonth(), lastDay(d.getFullYear(), d.getMonth()))];
  }
  const qStart = Math.floor(month / 3) * 3 - (period === "lastQuarter" ? 3 : 0);
  const start = new Date(y, qStart, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 2, 1);
  return [iso(start.getFullYear(), start.getMonth(), 1), iso(end.getFullYear(), end.getMonth(), lastDay(end.getFullYear(), end.getMonth()))];
};

const PERIODS: { id: Period; label: string }[] = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisQuarter", label: "This quarter" },
  { id: "lastQuarter", label: "Last quarter" },
  { id: "custom", label: "Custom" },
];

const INPUT = "h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-cyan-400 focus:outline-none dark:border-gray-700 dark:bg-[#1f1f1f] dark:text-gray-100";

/**
 * VAT return for a period, laid out like the GCC returns (UAE VAT 201 / KSA VAT return): sales by VAT category,
 * credit notes, purchases, and the VAT due (output less input; negative is refundable).
 */
const VatReturn: React.FC = () => {
  const { company } = useCompany();
  const [period, setPeriod] = useState<Period>("lastMonth");
  const [[from, to], setRange] = useState<[string, string]>(() => rangeOf("lastMonth"));
  const [data, setData] = useState<VatReturnData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!from || !to || to < from) return;
    try {
      setLoading(true);
      const res = await axios.get<VatReturnData>(`${INVOICE_API}/vat-return`, { params: { from, to } });
      setData(res.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not work out the VAT return"));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = (next: Period) => {
    setPeriod(next);
    if (next !== "custom") setRange(rangeOf(next));
  };

  const money = (value?: number) => formatMoney(value ?? 0);
  const vatRegistered = company?.taxRegime === "VAT";

  const rows = useMemo(() => {
    if (!data) return [];
    return [
      { group: "Sales (output)", label: "Standard-rated supplies", note: "Sold at the VAT rate", box: data.standardRatedSales, vat: true },
      { group: "", label: "Zero-rated supplies", note: "Exports and other 0% supplies", box: data.zeroRatedSales, vat: false },
      { group: "", label: "Exempt supplies", note: "Outside VAT (e.g. residential rent)", box: data.exemptSales, vat: false },
      { group: "", label: "Supplies under reverse charge", note: "The customer accounts for the VAT", box: data.reverseChargeSales, vat: false },
      { group: "", label: "Credit notes issued", note: "Reduce output VAT in the month issued", box: data.creditNotes, vat: true, negative: true },
      { group: "Purchases (input)", label: "Standard-rated expenses", note: "VAT on vendor bills, recoverable", box: data.standardRatedPurchases, vat: true },
      { group: "", label: "Imports and services under reverse charge", note: "You account for this VAT as output and input", box: data.reverseChargePurchases, vat: true },
    ];
  }, [data]);

  return (
    <>
      <PageMeta title="VAT Return" description="VAT due for a period" />
      <PageBreadcrumb pageTitle="VAT Return" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => choose(p.id)}
                className={`h-8 rounded-md border px-3 text-xs font-medium ${period === p.id
                  ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:bg-[#1f1f1f] dark:text-gray-300"}`}>
                {p.label}
              </button>
            ))}
            {period === "custom" && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="date" className={INPUT} value={from} onChange={(e) => setRange([e.target.value, to])} aria-label="From" />
                to
                <input type="date" className={INPUT} value={to} onChange={(e) => setRange([from, e.target.value])} aria-label="To" />
              </span>
            )}
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-gray-400">
            <div className="font-semibold text-slate-700 dark:text-gray-200">{company?.legalName || company?.companyName}</div>
            {vatRegistered ? <div>TRN {company?.taxNumber || "not set"}</div> : null}
            <div>{formatDate(from)} – {formatDate(to)}</div>
          </div>
        </div>

        {!vatRegistered && company && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Your company is not set as VAT registered. Set the tax registration and TRN in{" "}
            <Link to="/company-settings" className="font-semibold underline">Company Settings</Link>.
          </p>
        )}
        {data && data.currencies.length > 1 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This period has documents in {data.currencies.join(", ")}. They are added at face value; file foreign-currency
            documents at the exchange rate of their date.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label="Output VAT" value={money(data?.outputVat)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Input VAT (recoverable)" value={money(data?.inputVat)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard
            label={data && data.netVatDue < 0 ? "VAT refundable" : "Net VAT payable"}
            value={money(data ? Math.abs(data.netVatDue) : 0)}
            gradient={data && data.netVatDue < 0 ? "from-purple-50 to-pink-50" : "from-orange-50 to-yellow-50"}
            borderColor={data && data.netVatDue < 0 ? "border-purple-100" : "border-orange-100"}
            labelColor={data && data.netVatDue < 0 ? "text-purple-600" : "text-orange-600"}
          />
        </div>

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-[#191919]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#222] dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Box</th>
                <th className="px-4 py-2 text-right">Documents</th>
                <th className="px-4 py-2 text-right">Taxable value</th>
                <th className="px-4 py-2 text-right">VAT</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">{loading ? "Working it out…" : "No figures for this period"}</td></tr>
              )}
              {rows.map((row) => (
                <React.Fragment key={row.label}>
                  {row.group && (
                    <tr><td colSpan={4} className="bg-slate-50/60 px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-[#1c1c1c] dark:text-gray-400">{row.group}</td></tr>
                  )}
                  <tr className="border-t border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800 dark:text-gray-100">{row.label}</div>
                      <div className="text-[11px] text-slate-400">{row.note}</div>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">{row.box.documents}</td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-gray-200">
                      {row.negative && row.box.taxableAmount ? "−" : ""}{money(row.box.taxableAmount)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800 dark:text-gray-100">
                      {row.vat ? `${row.negative && row.box.vatAmount ? "−" : ""}${money(row.box.vatAmount)}` : "—"}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            {data && (
              <tfoot className="border-t-2 border-slate-200 text-sm dark:border-gray-700">
                <tr><td className="px-4 py-2 text-slate-600" colSpan={3}>Output VAT (standard-rated less credit notes, plus reverse charge)</td><td className="px-4 py-2 text-right font-medium">{money(data.outputVat)}</td></tr>
                <tr><td className="px-4 py-2 text-slate-600" colSpan={3}>Input VAT recoverable</td><td className="px-4 py-2 text-right font-medium">−{money(data.inputVat)}</td></tr>
                <tr className="text-base font-semibold">
                  <td className="px-4 py-2" colSpan={3}>{data.netVatDue < 0 ? "VAT refundable" : "Net VAT payable"}</td>
                  <td className="px-4 py-2 text-right text-cyan-700 dark:text-cyan-400">{money(Math.abs(data.netVatDue))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        <p className="text-xs text-slate-500">
          From {data?.invoiceCount ?? 0} issued sales invoice(s) and {data?.billCount ?? 0} vendor bill(s) dated in the period.
          A sales line's category comes from its product's tax code in <Link to="/taxTypes" className="text-cyan-700 hover:underline">Tax Types</Link>;
          bills' VAT is recorded on <Link to="/purchaseInvoices" className="text-cyan-700 hover:underline">Purchase Invoices</Link>.
        </p>
      </div>
    </>
  );
};

export default VatReturn;

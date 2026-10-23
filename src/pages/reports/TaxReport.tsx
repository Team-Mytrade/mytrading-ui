import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError, money, monthLabel } from "../Invoice/invoiceShared";

interface TaxReportData {
  totalTaxableAmount?: number;
  totalTaxAmount?: number;
  totalInvoiceAmount?: number;
  taxCollectedByMonth?: Record<string, number>;
}

/** Tax charged on issued sales invoices, by month. */
const TaxReport: React.FC = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState<TaxReportData>({});
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<TaxReportData>(`${INVOICE_API}/reports/tax`);
      setReport(res.data && typeof res.data === "object" ? res.data : {});
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load the tax report"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const months = useMemo(() => Object.entries(report.taxCollectedByMonth ?? {}).sort(([a], [b]) => b.localeCompare(a)), [report.taxCollectedByMonth]);
  const maxMonth = Math.max(1, ...months.map(([, value]) => Number(value || 0)));
  const taxable = Number(report.totalTaxableAmount || 0);
  const effectiveRate = taxable ? (Number(report.totalTaxAmount || 0) / taxable) * 100 : 0;

  return (
    <>
      <PageMeta title="Tax Report" description="Tax charged on sales invoices" />
      <PageBreadcrumb pageTitle="Tax Report" />

      <div className="w-full max-w-none space-y-4 py-4">
        <p className="text-xs text-slate-500">
          Tax on issued sales invoices. Tax paid on purchases is in{" "}
          <button type="button" className="text-cyan-700 hover:underline" onClick={() => navigate("/taxRecords")}>Tax Records</button>.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Taxable value" value={money(report.totalTaxableAmount)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Tax charged" value={money(report.totalTaxAmount)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Invoice total" value={money(report.totalInvoiceAmount)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label="Effective rate" value={`${effectiveRate.toFixed(2)}%`} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Tax charged by month</h2>
          {months.length === 0 ? (
            <p className="text-sm text-slate-400">{loading ? "Loading…" : "No issued invoices yet"}</p>
          ) : (
            <ul className="space-y-2">
              {months.map(([key, value]) => (
                <li key={key} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-sm">
                  <span className="text-slate-600">{monthLabel(key)}</span>
                  <span className="h-2 rounded-full bg-slate-100">
                    <span className="block h-2 rounded-full bg-emerald-500" style={{ width: `${(Number(value || 0) / maxMonth) * 100}%` }} />
                  </span>
                  <span className="font-medium text-slate-800">{money(value)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default TaxReport;

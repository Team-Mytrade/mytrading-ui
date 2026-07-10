import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  CalendarIcon,
  ShareIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";
import { BackButton } from "../../../components/common/BackButton";
import { AddButton } from "../../../components/common/AddButton";
import StatsCard from "../../../components/common/Statscard";

const API_TAX_RECORDS = "/v1/api/invoice/tax-record";

interface TaxSummary {
  taxCollected: number;
  taxPaid: number;
}

const TaxRecordList: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [fromDate, setFromDate] = useState<Date | null>(
    new Date(new Date().setMonth(new Date().getMonth() - 1))
  );
  const [toDate, setToDate] = useState<Date | null>(new Date());
  const [dateError, setDateError] = useState<string | null>(null);

  // ── Date validation (untouched) ──────────────────────────────────────────
  useEffect(() => {
    if (fromDate && toDate) {
      if (fromDate > toDate) {
        setDateError("From date cannot be later than to date");
      } else {
        setDateError(null);
      }
    } else {
      setDateError(null);
    }
  }, [fromDate, toDate]);

  // ── API calls (untouched) ────────────────────────────────────────────────
  const loadData = async () => {
    if (!fromDate || !toDate) {
      ToasterService.error("Please select both from and to dates");
      return;
    }
    if (fromDate > toDate) {
      ToasterService.error("From date cannot be later than to date");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API_TAX_RECORDS}/report`, {
        params: {
          from: fromDate.toISOString().split("T")[0],
          to: toDate.toISOString().split("T")[0],
        },
      });
      setSummary(response.data);
    } catch (err) {
      console.error("Error loading tax summary:", err);
      ToasterService.error("Failed to load tax summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate && fromDate <= toDate) {
      loadData();
    }
  }, []);

  const handleDateRangeSearch = () => {
    if (!fromDate || !toDate) {
      ToasterService.error("Please select both from and to dates");
      return;
    }
    if (fromDate > toDate) {
      ToasterService.error("From date cannot be later than to date");
      return;
    }
    loadData();
  };

  const exportPDF = async () => {
    if (exporting || !summary) return;
    setExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Tax Summary Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
      doc.text(
        `Period: ${fromDate?.toLocaleDateString()} - ${toDate?.toLocaleDateString()}`,
        14,
        30
      );
      autoTable(doc, {
        head: [["Metric", "Amount"]],
        body: [
          ["Tax Collected", `$${summary.taxCollected.toFixed(2)}`],
          ["Tax Paid", `$${summary.taxPaid.toFixed(2)}`],
          [
            "Net Tax",
            `$${(summary.taxCollected - summary.taxPaid).toFixed(2)}`,
          ],
        ],
        startY: 38,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      doc.save(
        `TaxSummary_${fromDate?.toISOString().split("T")[0]}_to_${toDate?.toISOString().split("T")[0]}.pdf`
      );
      ToasterService.success("PDF exported successfully");
    } catch (err) {
      console.error("Error exporting PDF:", err);
      ToasterService.error("Failed to export PDF");
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const exportExcel = async () => {
    if (exporting || !summary) return;
    setExporting(true);
    try {
      const data = [
        { Metric: "Tax Collected", Amount: summary.taxCollected },
        { Metric: "Tax Paid", Amount: summary.taxPaid },
        {
          Metric: "Net Tax",
          Amount: summary.taxCollected - summary.taxPaid,
        },
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TaxSummary");
      XLSX.writeFile(
        wb,
        `TaxSummary_${fromDate?.toISOString().split("T")[0]}_to_${toDate?.toISOString().split("T")[0]}.xlsx`
      );
      ToasterService.success("Excel exported successfully");
    } catch (err) {
      console.error("Error exporting Excel:", err);
      ToasterService.error("Failed to export Excel");
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  const netTax = summary ? summary.taxCollected - summary.taxPaid : 0;

  return (
    <>
      <PageMeta
        title="Tax Summary"
        description="Tax collection and payment summary"
      />
      <PageBreadcrumb pageTitle="Tax Summary" />

      <div className="w-full max-w-none px-0 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            {/* <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Summary</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Tax collection and payment overview
              </p>
            </div> */}
          </div>

          <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={loading || exporting || !summary}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!summary ? "Load data first to export" : "Export options"}
              >
                <ShareIcon className="h-5 w-5 text-gray-600" />
              </button>

              {showExportMenu && summary && (
                <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                  <button
                    onClick={exportPDF}
                    disabled={loading || exporting}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exporting ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>📄 PDF</span>
                    )}
                  </button>
                  <button
                    onClick={exportExcel}
                    disabled={loading || exporting}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exporting ? (
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>📊 Excel</span>
                    )}
                  </button>
                </div>
              )}
            </div>

            <AddButton
              label="Add Tax Record"
              onClick={() => navigate("/taxRecords/add")}
            />
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-cyan-600" />
            Select Date Range (Required)
          </h3>

          {dateError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{dateError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={fromDate}
                onChange={(date) => setFromDate(date)}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select from date"
                disabled={loading || exporting}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                selected={toDate}
                onChange={(date) => setToDate(date)}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select to date"
                disabled={loading || exporting}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <button
                onClick={handleDateRangeSearch}
                disabled={
                  loading || exporting || !fromDate || !toDate || !!dateError
                }
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {loading ? "Loading..." : "Load Records"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Showing records from {fromDate?.toLocaleDateString() || "..."} to{" "}
            {toDate?.toLocaleDateString() || "..."}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Summary Cards */}
        {summary && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                label="Tax Collected"
                value={`$${summary.taxCollected.toFixed(2)}`}
                gradient="from-green-50 to-white"
                borderColor="border-green-100"
                labelColor="text-green-700"
                icon={<ReceiptPercentIcon className="h-6 w-6 text-green-600" />}
              />
              <StatsCard
                label="Tax Paid"
                value={`$${summary.taxPaid.toFixed(2)}`}
                gradient="from-red-50 to-white"
                borderColor="border-red-100"
                labelColor="text-red-700"
                icon={<BanknotesIcon className="h-6 w-6 text-red-600" />}
              />
              <StatsCard
                label={netTax >= 0 ? "Net Tax (To Collect)" : "Net Tax (To Pay)"}
                value={`$${Math.abs(netTax).toFixed(2)}`}
                gradient={netTax >= 0 ? "from-cyan-50 to-white" : "from-orange-50 to-white"}
                borderColor={netTax >= 0 ? "border-cyan-100" : "border-orange-100"}
                labelColor={netTax >= 0 ? "text-cyan-700" : "text-orange-700"}
                icon={
                  <DocumentDuplicateIcon
                    className={`h-6 w-6 ${netTax >= 0 ? "text-cyan-600" : "text-orange-600"}`}
                  />
                }
              />
            </div>

            {/* Period Summary */}
            <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-600 flex items-center justify-center gap-2">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              Summary for period: {fromDate?.toLocaleDateString()} –{" "}
              {toDate?.toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!summary && !loading && fromDate && toDate && !dateError && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <ReceiptPercentIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-2">
              No tax data found for the selected period
            </p>
            <p className="text-gray-400 text-xs">
              Try adjusting your date range
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default TaxRecordList;
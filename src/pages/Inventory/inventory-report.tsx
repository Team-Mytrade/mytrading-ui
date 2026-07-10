import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";

const API_URL = "/v1/api/inventory/reports";

const InventoryReportManager: React.FC = () => {
  const [report, setReport] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL, { headers });
      setReport(response.data || {});
    } catch (error) {
      console.error("Failed to load inventory report", error);
      ToasterService.error("Failed to load inventory report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const entries = report && typeof report === "object" && !Array.isArray(report)
    ? Object.entries(report as Record<string, unknown>)
    : [];

  return (
    <div className="p-6">
      <PageMeta title="InventoryReportManager" description="Inventory report controller" />
      <PageBreadcrumb pageTitle="InventoryReportManager" />

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Inventory Reports</h2>
            <p className="text-sm text-gray-500">Report data from inventory report.</p>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={loadReport}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">Loading report...</div>
        ) : Array.isArray(report) ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  {Object.keys((report[0] || {}) as Record<string, unknown>).map((key) => (
                    <th key={key} className="px-3 py-2">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(report as Record<string, unknown>[]).map((row, index) => (
                  <tr key={index} className="border-b">
                    {Object.values(row).map((value, valueIndex) => (
                      <td key={valueIndex} className="px-3 py-2">{String(value ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : entries.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">{key}</p>
                <p className="mt-2 break-words text-sm text-gray-900">
                  {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-500">No report data found.</div>
        )}
      </div>
    </div>
  );
};

export default InventoryReportManager;

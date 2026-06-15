import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  TagIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  CalendarIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../../hooks/useConfirmDialog";
import StatsCard from "../../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";

const API_PAYMENT_TERMS = "/v1/api/invoice/payment-terms";

interface PaymentTerm {
  id?: number;
  termCode: string;
  description: string;
  dueDays: number;
}

const PAGE_SIZE = 10;

const PaymentTermList: React.FC = () => {
  const navigate = useNavigate();
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { confirmState, confirm, handleConfirm, handleCancel } =
    useConfirmDialog();

  // ── API calls (untouched) ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_PAYMENT_TERMS);
      setTerms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load payment terms:", err);
      ToasterService.error("Failed to load payment terms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message:
        "Are you sure you want to delete this payment term? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    setLoading(true);
    try {
      await axios.delete(`${API_PAYMENT_TERMS}/${id}`);
      ToasterService.success("Payment term deleted successfully");
      await loadData();
    } catch (err: any) {
      ToasterService.error(
        err.response?.data?.message || "Failed to delete payment term"
      );
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Payment Terms Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
      autoTable(doc, {
        head: [["Term Code", "Description", "Due Days"]],
        body: terms.map((t) => [t.termCode, t.description, t.dueDays.toString()]),
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      doc.save(`PaymentTerms_${new Date().toISOString().split("T")[0]}.pdf`);
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
    if (exporting) return;
    setExporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(
        terms.map((t) => ({
          Code: t.termCode,
          Description: t.description,
          Days: t.dueDays,
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PaymentTerms");
      XLSX.writeFile(
        wb,
        `PaymentTerms_${new Date().toISOString().split("T")[0]}.xlsx`
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

  // Stats
  const avgDueDays = terms.length
    ? Math.round(terms.reduce((s, t) => s + t.dueDays, 0) / terms.length)
    : 0;
  const maxDueDays = terms.length ? Math.max(...terms.map((t) => t.dueDays)) : 0;
  const minDueDays = terms.length ? Math.min(...terms.map((t) => t.dueDays)) : 0;

  // ── Table columns ────────────────────────────────────────────────────────
  const tableColumns: ColumnDef<PaymentTerm & { id: number }>[] = [
    {
      key: "termCode",
      label: "Term Code",
      sortable: true,
      render: (term) => (
        <div className="flex items-center">
          <TagIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-sm font-medium text-gray-900">
            {term.termCode}
          </span>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (term) => (
        <div className="text-sm text-gray-900">{term.description}</div>
      ),
    },
    {
      key: "dueDays",
      label: "Due Days",
      sortable: true,
      render: (term) => (
        <div className="flex items-center text-sm text-gray-900">
          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
          <span className="font-medium text-cyan-600">{term.dueDays}</span>
          <span className="ml-1 text-gray-500">days</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right",
      headerClassName: "!text-right pr-8",
      render: (term) => (
        <div
          className="flex justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button
              disabled={loading || exporting}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() =>
                      navigate(`/payment-terms/view/${term.id}`)
                    }
                    disabled={loading || exporting}
                    className={`${
                      active ? "bg-gray-50" : ""
                    } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <EyeIcon className="h-4 w-4 text-blue-600" />
                    View Details
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() =>
                      navigate(`/payment-terms/edit/${term.id}`)
                    }
                    disabled={loading || exporting}
                    className={`${
                      active ? "bg-gray-50" : ""
                    } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <PencilSquareIcon className="h-4 w-4 text-cyan-600" />
                    Edit
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={() => handleDelete(term.id!)}
                    disabled={loading || exporting}
                    className={`${
                      active ? "bg-gray-50" : ""
                    } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <TrashIcon className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
      ),
    },
  ];

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const tableToolbar = (
    <div className="flex items-center gap-2">
      {/* Export */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={loading || exporting}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShareIcon className="h-5 w-5 text-gray-600" />
        </button>
        {showExportMenu && (
          <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md border border-gray-200 z-50">
            <button
              onClick={exportPDF}
              disabled={loading || exporting}
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
              )}
              PDF
            </button>
            <button
              onClick={exportExcel}
              disabled={loading || exporting}
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <TableCellsIcon className="h-4 w-4 text-green-600" />
              )}
              Excel
            </button>
          </div>
        )}
      </div>

      {/* Filter */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        disabled={loading || exporting}
        className={`p-2 rounded-lg border ${
          showFilters
            ? "bg-cyan-50 border-cyan-300"
            : "border-gray-300 hover:bg-gray-50"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <FunnelIcon
          className={`h-5 w-5 ${
            showFilters ? "text-cyan-600" : "text-gray-600"
          }`}
        />
      </button>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Payment Terms" description="Manage payment terms" />
      <PageBreadcrumb
        pageTitle="Payment Terms"
        showAddButton
        addButtonLabel="Add Term"
        onAddClick={() => navigate("/payment-terms/add")}
      />

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Terms"
            value={terms.length}
            gradient="from-blue-50 to-white"
            borderColor="border-blue-100"
            labelColor="text-blue-700"
            icon={<DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />}
          />
          <StatsCard
            label="Average Days"
            value={avgDueDays}
            gradient="from-cyan-50 to-white"
            borderColor="border-cyan-100"
            labelColor="text-cyan-700"
            icon={<ClockIcon className="h-6 w-6 text-cyan-600" />}
          />
          <StatsCard
            label="Max Days"
            value={maxDueDays}
            gradient="from-purple-50 to-white"
            borderColor="border-purple-100"
            labelColor="text-purple-700"
            icon={<ArrowUpIcon className="h-6 w-6 text-purple-600" />}
          />
          <StatsCard
            label="Min Days"
            value={minDueDays}
            gradient="from-green-50 to-white"
            borderColor="border-green-100"
            labelColor="text-green-700"
            icon={<ArrowDownIcon className="h-6 w-6 text-green-600" />}
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Days Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {(loading || exporting) && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-700 font-medium">
                {loading ? "Loading..." : "Exporting..."}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<PaymentTerm & { id: number }>
          data={terms as (PaymentTerm & { id: number })[]}
          columns={tableColumns}
          loading={loading}
          searchable
          searchPlaceholder="Search by term code or description..."
          searchFields={["termCode", "description"]}
          pageSize={PAGE_SIZE}
          defaultSortKey="termCode"
          defaultSortOrder="asc"
          toolbar={tableToolbar}
          onRowClick={(term) =>
            !loading && !exporting && navigate(`/payment-terms/view/${term.id}`)
          }
          emptyState={
            <div className="flex flex-col items-center">
              <DocumentDuplicateIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">
                No payment terms found
              </p>
              <p className="text-gray-400 text-xs">
                Try adjusting your search or add a new payment term
              </p>
            </div>
          }
        />

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    </>
  );
};

export default PaymentTermList;

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
  EyeIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  CalendarIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";
import { useConfirmDialog } from "../../../hooks/useConfirmDialog";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import StatsCard from "../../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";

const API_RECEIPTS = "/v1/api/invoice/receipts";
const API_CUSTOMERS = "/v1/api/invoice/customers";
const PAGE_SIZE = 10;

interface Customer {
  id: number;
  name: string;
}

interface Allocation {
  id?: number;
  invoice: { id: number } | null;
  allocatedAmount: number;
}

interface PaymentReceipt {
  id?: number;
  receiptNumber: string;
  paymentDate: string;
  customer: { id: number } | null;
  totalAmountReceived: number;
  paymentMethod: string;
  referenceNumber: string;
  receivedBy: string;
  notes: string;
  allocations: Allocation[];
  invoice: { id: number } | null;
}

const PaymentReceiptList: React.FC = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // ── API calls (untouched) ──────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const [receiptRes, custRes] = await Promise.all([
        axios.get(API_RECEIPTS),
        axios.get(API_CUSTOMERS),
      ]);

      let receiptsData = receiptRes.data;
      console.log(receiptsData);
      if (receiptsData && !Array.isArray(receiptsData) && receiptsData.content) {
        receiptsData = receiptsData.content;
        console.log(receiptsData);
      }
      const receiptsArray = Array.isArray(receiptsData) ? receiptsData : [];
      receiptsArray.forEach((receipt) => {
        if (!receipt.id) console.warn("Receipt missing ID:", receipt);
      });

      setReceipts(receiptsArray);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
    } catch (err) {
      console.error("Error loading data:", err);
      ToasterService.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!id) {
      ToasterService.error("Invalid receipt ID");
      return;
    }
    const ok = await confirm({
      message:
        "Are you sure you want to delete this receipt? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    setLoading(true);
    try {
      await axios.delete(`${API_RECEIPTS}/${id}`);
      ToasterService.success("Receipt deleted successfully");
      await loadData();
    } catch (err: any) {
      ToasterService.error(
        err.response?.data?.message || "Failed to delete receipt"
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
      doc.text("Payment Receipts Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
      autoTable(doc, {
        head: [["Receipt #", "Customer", "Date", "Method", "Amount", "Reference"]],
        body: receipts.map((r) => [
          r.receiptNumber,
          customers.find((c) => c.id === r.customer?.id)?.name || "",
          r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : "",
          r.paymentMethod || "",
          (r.totalAmountReceived || 0).toFixed(2),
          r.referenceNumber || "",
        ]),
        startY: 30,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      doc.save(`Receipts_${new Date().toISOString().split("T")[0]}.pdf`);
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
      const data = receipts.map((r) => ({
        "Receipt #": r.receiptNumber,
        Customer: customers.find((c) => c.id === r.customer?.id)?.name || "",
        Date: r.paymentDate,
        Method: r.paymentMethod,
        Amount: r.totalAmountReceived,
        Reference: r.referenceNumber,
        "Received By": r.receivedBy,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Receipts");
      XLSX.writeFile(wb, `Receipts_${new Date().toISOString().split("T")[0]}.xlsx`);
      ToasterService.success("Excel exported successfully");
    } catch (err) {
      console.error("Error exporting Excel:", err);
      ToasterService.error("Failed to export Excel");
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleView = (receipt: PaymentReceipt) => {
    console.log("View receipt:", receipt);
    console.log("Receipt ID:", receipt.id);
    if (receipt.id) {
      navigate(`/payment-receipt/view/${receipt.id}`);
    } else {
      console.error("No ID found for receipt:", receipt);
      ToasterService.error("Cannot view receipt: Missing ID");
    }
  };

  const handleEdit = (receipt: PaymentReceipt) => {
    console.log("Edit receipt:", receipt);
    console.log("Receipt ID:", receipt.id);
    if (receipt.id) {
      navigate(`/payment-receipt/edit/${receipt.id}`);
    } else {
      console.error("No ID found for receipt:", receipt);
      ToasterService.error("Cannot edit receipt: Missing ID");
    }
  };

  const handleDeleteClick = (receipt: PaymentReceipt) => {
    console.log("Delete receipt:", receipt);
    console.log("Receipt ID:", receipt.id);
    if (receipt.id) {
      handleDelete(receipt.id);
    } else {
      console.error("No ID found for receipt:", receipt);
      ToasterService.error("Cannot delete receipt: Missing ID");
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  // Helpers
  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case "cash":
        return <BanknotesIcon className="h-4 w-4 text-green-600" />;
      case "credit card":
        return <CreditCardIcon className="h-4 w-4 text-blue-600" />;
      case "bank transfer":
        return <DocumentTextIcon className="h-4 w-4 text-purple-600" />;
      default:
        return <CurrencyDollarIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method?.toLowerCase()) {
      case "cash":
        return "bg-green-100 text-green-800";
      case "credit card":
        return "bg-blue-100 text-blue-800";
      case "bank transfer":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Stats
  const totalAmount = receipts.reduce(
    (sum, r) => sum + (r.totalAmountReceived || 0),
    0
  );
  const cashCount = receipts.filter(
    (r) => r.paymentMethod?.toLowerCase() === "cash"
  ).length;
  const cardCount = receipts.filter(
    (r) => r.paymentMethod?.toLowerCase() === "credit card"
  ).length;

  // Filter by payment method (applied before passing to ReusableTable)
  const methodFiltered = selectedPaymentMethod
    ? receipts.filter((r) => r.paymentMethod === selectedPaymentMethod)
    : receipts;

  // ── Table columns ────────────────────────────────────────────────────────
  const tableColumns: ColumnDef<PaymentReceipt & { id: number }>[] = [
    {
      key: "receiptNumber",
      label: "Receipt #",
      sortable: true,
      render: (receipt) => (
        <div className="flex items-center">
          <ReceiptPercentIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-sm font-medium text-gray-900">
            {receipt.receiptNumber}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (receipt) => (
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">
            {customers.find((c) => c.id === receipt.customer?.id)?.name || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "paymentDate",
      label: "Date",
      sortable: true,
      render: (receipt) => (
        <div className="flex items-center text-sm text-gray-900">
          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
          {receipt.paymentDate
            ? new Date(receipt.paymentDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "N/A"}
        </div>
      ),
    },
    {
      key: "paymentMethod",
      label: "Method",
      sortable: true,
      render: (receipt) => (
        <div className="flex items-center">
          {getPaymentMethodIcon(receipt.paymentMethod)}
          <span
            className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getPaymentMethodColor(
              receipt.paymentMethod
            )}`}
          >
            {receipt.paymentMethod || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "totalAmountReceived",
      label: "Amount",
      sortable: true,
      render: (receipt) => (
        <div className="flex items-center text-sm font-medium text-gray-900">
          <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-1" />
          {Number(receipt.totalAmountReceived ?? 0).toFixed(2)}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right",
      headerClassName: "!text-right pr-8",
      render: (receipt) => (
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
                    onClick={() => handleView(receipt)}
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
                    onClick={() => handleEdit(receipt)}
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
                    onClick={() => handleDeleteClick(receipt)}
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
          className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`}
        />
      </button>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Payment Receipts" description="Manage payment receipts" />
      <PageBreadcrumb
        pageTitle="Payment Receipts"
        showAddButton
        addButtonLabel="Add Receipt"
        onAddClick={() => navigate("/payment-receipt/add")}
      />

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Receipts"
            value={receipts.length}
            gradient="from-blue-50 to-white"
            borderColor="border-blue-100"
            labelColor="text-blue-700"
            icon={<DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />}
          />
          <StatsCard
            label="Total Amount"
            value={totalAmount.toFixed(2)}
            gradient="from-cyan-50 to-white"
            borderColor="border-cyan-100"
            labelColor="text-cyan-700"
            icon={<BanknotesIcon className="h-6 w-6 text-cyan-600" />}
          />
          <StatsCard
            label="Cash Receipts"
            value={cashCount}
            gradient="from-green-50 to-white"
            borderColor="border-green-100"
            labelColor="text-green-700"
            icon={<BanknotesIcon className="h-6 w-6 text-green-600" />}
          />
          <StatsCard
            label="Card Receipts"
            value={cardCount}
            gradient="from-blue-50 to-white"
            borderColor="border-blue-100"
            labelColor="text-blue-700"
            icon={<CreditCardIcon className="h-6 w-6 text-blue-600" />}
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["", "Cash", "Credit Card", "Bank Transfer"].map((method) => (
                    <button
                      key={method || "all"}
                      onClick={() => setSelectedPaymentMethod(method)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        selectedPaymentMethod === method
                          ? method === ""
                            ? "bg-cyan-600 text-white"
                            : method === "Cash"
                            ? "bg-green-600 text-white"
                            : method === "Credit Card"
                            ? "bg-blue-600 text-white"
                            : "bg-purple-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {method || "All"}
                    </button>
                  ))}
                </div>
              </div>
              {selectedPaymentMethod && (
                <button
                  onClick={() => setSelectedPaymentMethod("")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
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
        <ReusableTable<PaymentReceipt & { id: number }>
          data={methodFiltered as (PaymentReceipt & { id: number })[]}
          columns={tableColumns}
          loading={loading}
          searchable
          searchPlaceholder="Search receipts..."
          searchFields={["receiptNumber", "paymentMethod", "referenceNumber"]}
          pageSize={PAGE_SIZE}
          defaultSortKey="paymentDate"
          defaultSortOrder="desc"
          toolbar={tableToolbar}
          onRowClick={(receipt) =>
            !loading && !exporting && handleView(receipt)
          }
          emptyState={
            <div className="flex flex-col items-center">
              <ReceiptPercentIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No receipts found</p>
              <p className="text-gray-400 text-xs">
                Try adjusting your search or filters
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

export default PaymentReceiptList;

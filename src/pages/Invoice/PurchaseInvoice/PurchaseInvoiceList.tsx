import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    BuildingOfficeIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentArrowDownIcon,
    DocumentDuplicateIcon,
    EyeIcon,
    FunnelIcon,
    GlobeAltIcon,
    PencilSquareIcon,
    ReceiptPercentIcon,
    ShareIcon,
    TableCellsIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../../components/common/AddButton";
import { BackButton } from "../../../components/common/BackButton";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import StatsCard from "../../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import DynamicPopup from "../../../components/common/Popup";
import { ToasterService } from "../../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/purchase-invoices";
const ITEMS_PER_PAGE = 10;

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID";

interface Vendor {
    id: number;
    name: string;
}

interface PurchaseInvoice {
    id?: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    purchaseInvoiceStatus: Status;
    vendor: Vendor;
    currency: string;
    referenceNumber: string;
}

const PurchaseInvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const invRes = await axios.get(BASE_URL);
            setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
        } catch (err) {
            console.error("Error loading purchase invoices:", err);
            ToasterService.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const promptDelete = (invoice: PurchaseInvoice) => {
        setInvoiceToDelete(invoice);
        setShowDeletePopup(true);
    };

    const handleDelete = async () => {
        if (!invoiceToDelete?.id) return;

        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/${invoiceToDelete.id}`);
            ToasterService.success("Purchase invoice deleted successfully");
            setInvoiceToDelete(null);
            await loadData();
        } catch (err) {
            console.error("Error deleting purchase invoice:", err);
            ToasterService.error("Failed to delete purchase invoice");
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
            doc.text("Purchase Invoices Report", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

            autoTable(doc, {
                head: [["Invoice #", "Vendor", "Date", "Status", "Amount"]],
                body: invoices.map((invoice) => [
                    invoice.invoiceNumber,
                    invoice.vendor?.name || "",
                    new Date(invoice.invoiceDate).toLocaleDateString(),
                    invoice.purchaseInvoiceStatus,
                    `${invoice.currency} ${invoice.totalAmount.toFixed(2)}`,
                ]),
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
            });
            doc.save(`Purchase_Invoices_${new Date().toISOString().split("T")[0]}.pdf`);
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
            const data = invoices.map((invoice) => ({
                "Invoice #": invoice.invoiceNumber,
                Vendor: invoice.vendor?.name,
                Date: invoice.invoiceDate,
                Status: invoice.purchaseInvoiceStatus,
                Amount: invoice.totalAmount,
                Currency: invoice.currency,
                Reference: invoice.referenceNumber,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Purchase Invoices");
            XLSX.writeFile(wb, `Purchase_Invoices_${new Date().toISOString().split("T")[0]}.xlsx`);
            ToasterService.success("Excel exported successfully");
        } catch (err) {
            console.error("Error exporting Excel:", err);
            ToasterService.error("Failed to export Excel");
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const filteredInvoices = useMemo(
        () => invoices.filter((invoice) => (selectedStatus ? invoice.purchaseInvoiceStatus === selectedStatus : true)),
        [invoices, selectedStatus]
    );

    const tableColumns = useMemo<ColumnDef<PurchaseInvoice>[]>(
        () => [
            {
                key: "invoiceNumber",
                label: "Invoice #",
                sortable: true,
                render: (invoice) => (
                    <span className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</span>
                ),
            },
            {
                key: "vendor",
                label: "Vendor",
                render: (invoice) => (
                    <div className="flex items-center">
                        <BuildingOfficeIcon className="mr-2 h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{invoice.vendor?.name}</span>
                    </div>
                ),
            },
            {
                key: "invoiceDate",
                label: "Date",
                sortable: true,
                render: (invoice) => (
                    <span className="text-sm text-gray-500">
                        {new Date(invoice.invoiceDate).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        })}
                    </span>
                ),
            },
            {
                key: "totalAmount",
                label: "Amount",
                sortable: true,
                render: (invoice) => (
                    <span className="text-sm font-medium text-gray-900">
                        {invoice.currency} {invoice.totalAmount.toFixed(2)}
                    </span>
                ),
            },
            {
                key: "purchaseInvoiceStatus",
                label: "Status",
                sortable: true,
                render: (invoice) => {
                    const styles =
                        invoice.purchaseInvoiceStatus === "PAID"
                            ? "bg-green-100 text-green-800"
                            : invoice.purchaseInvoiceStatus === "PARTIALLY_PAID"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800";
                    const icon =
                        invoice.purchaseInvoiceStatus === "PAID"
                            ? <CheckCircleIcon className="mr-1 h-3 w-3" />
                            : invoice.purchaseInvoiceStatus === "PARTIALLY_PAID"
                              ? <ClockIcon className="mr-1 h-3 w-3" />
                              : <ReceiptPercentIcon className="mr-1 h-3 w-3" />;

                    return (
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${styles}`}>
                            {icon}
                            {invoice.purchaseInvoiceStatus.replace("_", " ")}
                        </span>
                    );
                },
            },
            {
                key: "actions",
                label: "Actions",
                className: "w-40",
                render: (invoice) => (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => navigate(`/payment-invoice/view/${invoice.id}`)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-cyan-600"
                            title="View details"
                        >
                            <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => navigate(`/payment-invoice/edit/${invoice.id}`)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600"
                            title="Edit invoice"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => promptDelete(invoice)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Delete invoice"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                ),
            },
        ],
        [navigate]
    );

    const tableToolbar = (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    className="rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-50"
                    title="Export"
                >
                    <ShareIcon className="h-5 w-5 text-gray-600" />
                </button>

                {showExportMenu && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button onClick={exportPDF} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                            PDF
                        </button>
                        <button onClick={exportExcel} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                            Excel
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`rounded-lg border p-2 transition-colors ${showFilters ? "border-cyan-300 bg-cyan-50 text-cyan-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                title="Toggle filters"
            >
                <FunnelIcon className="h-5 w-5" />
            </button>
        </>
    );

    const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const paidCount = invoices.filter((invoice) => invoice.purchaseInvoiceStatus === "PAID").length;
    const openCount = invoices.filter((invoice) => invoice.purchaseInvoiceStatus === "OPEN").length;

    return (
        <>
            <PageMeta title="Purchase Invoices" description="List of purchase invoices" />
            <PageBreadcrumb pageTitle="Purchase Invoices" />

            <div className="mx-auto max-w-7xl p-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <BackButton />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
                            <p className="mt-0.5 text-sm text-gray-500">
                                Manage purchase invoices using the shared list pattern.
                            </p>
                        </div>
                    </div>

                    <AddButton label="Add Invoice" onClick={() => navigate("/payment-invoice/add")} />
                </div>

                {showFilters && (
                    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-wrap gap-4">
                            <div className="min-w-[200px] flex-1">
                                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setSelectedStatus("")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "" ? "bg-cyan-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>All</button>
                                    <button onClick={() => setSelectedStatus("OPEN")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "OPEN" ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>Open</button>
                                    <button onClick={() => setSelectedStatus("PARTIALLY_PAID")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "PARTIALLY_PAID" ? "bg-yellow-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>Partially Paid</button>
                                    <button onClick={() => setSelectedStatus("PAID")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "PAID" ? "bg-green-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>Paid</button>
                                </div>
                            </div>

                            {selectedStatus && (
                                <button onClick={() => setSelectedStatus("")} className="self-end text-sm font-medium text-red-600 hover:text-red-800">
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatsCard label="Total Invoices" value={invoices.length} gradient="from-blue-50 to-white" borderColor="border-blue-100" labelColor="text-blue-700" icon={<DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />} />
                    <StatsCard label="Total Amount" value={totalAmount.toFixed(2)} gradient="from-cyan-50 to-white" borderColor="border-cyan-100" labelColor="text-cyan-700" icon={<BuildingOfficeIcon className="h-6 w-6 text-cyan-600" />} />
                    <StatsCard label="Paid" value={paidCount} gradient="from-green-50 to-white" borderColor="border-green-100" labelColor="text-green-700" icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />} />
                    <StatsCard label="Open" value={openCount} gradient="from-blue-50 to-white" borderColor="border-blue-100" labelColor="text-blue-700" icon={<ReceiptPercentIcon className="h-6 w-6 text-blue-600" />} />
                </div>

                <ReusableTable<PurchaseInvoice>
                    data={filteredInvoices}
                    columns={tableColumns}
                    loading={loading || exporting}
                    searchable
                    searchPlaceholder="Search by invoice number, vendor, or reference..."
                    searchFields={["invoiceNumber", "referenceNumber"]}
                    pageSize={ITEMS_PER_PAGE}
                    defaultSortKey="invoiceDate"
                    defaultSortOrder="desc"
                    toolbar={tableToolbar}
                    onRowClick={(invoice) => navigate(`/payment-invoice/view/${invoice.id}`)}
                    emptyState={
                        <div className="flex flex-col items-center py-4 text-gray-400">
                            <DocumentDuplicateIcon className="mb-3 h-12 w-12 text-gray-400" />
                            <p className="text-sm font-medium text-gray-500">No purchase invoices found</p>
                            <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                        </div>
                    }
                />

                <DynamicPopup
                    isPopupOpen={showDeletePopup}
                    setIsPopupOpen={setShowDeletePopup}
                    icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                    iconBg="bg-red-100"
                    innerText="Delete this purchase invoice?"
                    subText={
                        invoiceToDelete
                            ? `This will permanently remove ${invoiceToDelete.invoiceNumber}. This action cannot be undone.`
                            : "This action cannot be undone."
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                    onConfirm={handleDelete}
                    onCancel={() => setInvoiceToDelete(null)}
                />
            </div>
        </>
    );
};

export default PurchaseInvoiceList;

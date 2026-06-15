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
    PencilSquareIcon,
    ShareIcon,
    TableCellsIcon,
    TrashIcon,
    BanknotesIcon,
    ExclamationCircleIcon,
    TagIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import StatsCard from "../../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import DynamicPopup from "../../../components/common/Popup";
import { ToasterService } from "../../../Services/ToasterService";

const API_INVOICES = "/v1/api/invoice/invoices";
const API_CUSTOMERS = "/v1/api/invoice/customers";
const PAGE_SIZE = 10;

interface Customer {
    id: number;
    name: string;
}

interface Invoice {
    id?: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    customer?: { id: number } | null;
    paymentTerm?: { id: number };
    subTotal: number;
    totalDiscount: number;
    totalTax: number;
    grandTotal: number;
    amountPaid: number;
    balance: number;
    status: string;
}

const InvoiceList: React.FC = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

    const getCustomerName = (invoice: Invoice) => {
        const customerId = invoice.customer?.id;
        if (!customerId) return "Unknown";
        return customers.find((customer) => customer.id === customerId)?.name || "Unknown";
    };

    const formatDate = (value?: string) => {
        if (!value) return "-";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "-";
        return parsed.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatAmount = (value?: number) => {
        const numericValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return numericValue.toFixed(2);
    };

    const getNumericValue = (value?: number) => (
        typeof value === "number" && Number.isFinite(value) ? value : 0
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const [invRes, custRes] = await Promise.all([
                axios.get(API_INVOICES),
                axios.get(API_CUSTOMERS),
            ]);
            setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
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

    const promptDelete = (invoice: Invoice) => {
        setInvoiceToDelete(invoice);
        setShowDeletePopup(true);
    };

    const handleDelete = async () => {
        if (!invoiceToDelete?.id) return;

        setLoading(true);
        try {
            await axios.delete(`${API_INVOICES}/${invoiceToDelete.id}`);
            ToasterService.success("Invoice deleted successfully");
            setInvoiceToDelete(null);
            await loadData();
        } catch (err: any) {
            console.error("Error deleting invoice:", err);
            ToasterService.error(err.response?.data?.message || "Failed to delete invoice");
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
            doc.text("Invoice List", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

            const safeBody = invoices.map((inv) => [
                inv.invoiceNumber || "",
                getCustomerName(inv),
                formatDate(inv.invoiceDate),
                inv.status || "",
                `${inv.currency || ""} ${formatAmount(inv.grandTotal)}`.trim(),
            ]);

            autoTable(doc, {
                head: [["Invoice #", "Customer", "Date", "Status", "Total"]],
                body: safeBody,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
            });
            doc.save(`Invoices_${new Date().toISOString().split("T")[0]}.pdf`);
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
            const exportData = invoices.map((inv) => ({
                "Invoice #": inv.invoiceNumber,
                Customer: getCustomerName(inv),
                Date: inv.invoiceDate,
                "Due Date": inv.dueDate,
                Status: inv.status,
                Subtotal: inv.subTotal,
                Tax: inv.totalTax,
                Total: inv.grandTotal,
                "Amount Paid": inv.amountPaid,
                Balance: inv.balance,
                Currency: inv.currency,
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Invoices");
            XLSX.writeFile(wb, `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`);
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
        () => invoices.filter((invoice) => (selectedStatus ? invoice.status === selectedStatus : true)),
        [invoices, selectedStatus]
    );

    const tableColumns = useMemo<ColumnDef<Invoice>[]>(
        () => [
            {
                key: "invoiceNumber",
                label: "Invoice #",
                sortable: true,
                render: (invoice) => (
                    <span className="text-sm font-medium text-cyan-600">{invoice.invoiceNumber}</span>
                ),
            },
            {
                key: "customer",
                label: "Customer",
                render: (invoice) => (
                    <div className="flex items-center">
                        <BuildingOfficeIcon className="mr-2 h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{getCustomerName(invoice)}</span>
                    </div>
                ),
            },
            {
                key: "invoiceDate",
                label: "Date",
                sortable: true,
                render: (invoice) => (
                    <span className="text-sm text-gray-500">{formatDate(invoice.invoiceDate)}</span>
                ),
            },
            {
                key: "grandTotal",
                label: "Total",
                sortable: true,
                render: (invoice) => (
                    <span className="text-sm font-medium text-gray-900">
                        {invoice.currency} {formatAmount(invoice.grandTotal)}
                    </span>
                ),
            },
            {
                key: "status",
                label: "Status",
                sortable: true,
                render: (invoice) => {
                    const styles =
                        invoice.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : invoice.status === "OVERDUE"
                                ? "bg-red-100 text-red-800"
                                : invoice.status === "DRAFT"
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-blue-100 text-blue-800";

                    const icon =
                        invoice.status === "PAID" ? <CheckCircleIcon className="mr-1 h-3 w-3" /> :
                        invoice.status === "PENDING" ? <ClockIcon className="mr-1 h-3 w-3" /> :
                        invoice.status === "OVERDUE" ? <ExclamationCircleIcon className="mr-1 h-3 w-3" /> :
                        invoice.status === "DRAFT" ? <DocumentDuplicateIcon className="mr-1 h-3 w-3" /> :
                        <TagIcon className="mr-1 h-3 w-3" />;

                    return (
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${styles}`}>
                            {icon}
                            {invoice.status}
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
                            onClick={() => navigate(`/invoice-billing/view/${invoice.id}`)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-cyan-600"
                            title="View details"
                        >
                            <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => navigate(`/invoice-billing/edit/${invoice.id}`)}
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
        [navigate, customers]
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
                        <button
                            onClick={exportPDF}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                            PDF
                        </button>
                        <button
                            onClick={exportExcel}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                            Excel
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`rounded-lg border p-2 transition-colors ${
                    showFilters
                        ? "border-cyan-300 bg-cyan-50 text-cyan-600"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
                title="Toggle filters"
            >
                <FunnelIcon className="h-5 w-5" />
            </button>
        </>
    );

    const totalAmount = invoices.reduce((sum, invoice) => sum + getNumericValue(invoice.grandTotal), 0);
    const paidCount = invoices.filter((invoice) => invoice.status === "PAID").length;
    const pendingCount = invoices.filter((invoice) => invoice.status === "PENDING").length;
    const overdueCount = invoices.filter((invoice) => invoice.status === "OVERDUE").length;

    return (
        <>
            <PageMeta title="Invoices" description="Manage your invoices" />
            <PageBreadcrumb
                pageTitle="Invoices"
                showAddButton
                addButtonLabel="Add Invoice"
                onAddClick={() => navigate("/invoice-billing/add")}
            />

            <div className="mx-auto max-w-7xl p-6">
                {showFilters && (
                    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-wrap gap-4">
                            <div className="min-w-[200px] flex-1">
                                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setSelectedStatus("")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "" ? "bg-cyan-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>All</button>
                                    <button onClick={() => setSelectedStatus("PAID")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "PAID" ? "bg-green-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>Paid</button>
                                    <button onClick={() => setSelectedStatus("PENDING")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "PENDING" ? "bg-yellow-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>Pending</button>
                                    <button onClick={() => setSelectedStatus("OVERDUE")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${selectedStatus === "OVERDUE" ? "bg-red-600 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>Overdue</button>
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
                    <StatsCard label="Total Amount" value={totalAmount.toFixed(2)} gradient="from-cyan-50 to-white" borderColor="border-cyan-100" labelColor="text-cyan-700" icon={<BanknotesIcon className="h-6 w-6 text-cyan-600" />} />
                    <StatsCard label="Paid" value={paidCount} gradient="from-green-50 to-white" borderColor="border-green-100" labelColor="text-green-700" icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />} />
                    <StatsCard label="Pending" value={pendingCount} gradient="from-yellow-50 to-white" borderColor="border-yellow-100" labelColor="text-yellow-700" icon={<ClockIcon className="h-6 w-6 text-yellow-600" />} />
                </div>

                <ReusableTable<Invoice>
                    data={filteredInvoices}
                    columns={tableColumns}
                    loading={loading || exporting}
                    searchable
                    searchPlaceholder="Search by invoice number, customer, or status..."
                    searchFields={["invoiceNumber", "status"]}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="invoiceDate"
                    defaultSortOrder="desc"
                    toolbar={tableToolbar}
                    onRowClick={(invoice) => navigate(`/invoice-billing/view/${invoice.id}`)}
                    emptyState={
                        <div className="flex flex-col items-center py-4 text-gray-400">
                            <DocumentDuplicateIcon className="mb-3 h-12 w-12 text-gray-400" />
                            <p className="text-sm font-medium text-gray-500">No invoices found</p>
                            <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                        </div>
                    }
                />

                <DynamicPopup
                    isPopupOpen={showDeletePopup}
                    setIsPopupOpen={setShowDeletePopup}
                    icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                    iconBg="bg-red-100"
                    innerText="Delete this invoice?"
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

export default InvoiceList;


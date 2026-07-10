import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    PencilSquareIcon,
    TrashIcon,
    FunnelIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    BanknotesIcon,
    ReceiptRefundIcon,
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    DocumentDuplicateIcon,
    TagIcon,
    CalendarIcon,
    BuildingOfficeIcon,
    DocumentTextIcon,
    XCircleIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";
import StatsCard from "../../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import DynamicPopup from "../../../components/common/Popup";
import { AddButton } from "../../../components/common/AddButton";
import { BackButton } from "../../../components/common/BackButton";

const API_URL = "/v1/api/invoice/expenses-revenue";
const ACCOUNT_API = "/v1/api/invoice/general-accounts";
const ITEMS_PER_PAGE = 10;

export enum RevenueExpenseType {
    REVENUE = "REVENUE",
    EXPENSE = "EXPENSE",
    TRANSFER = "TRANSFER",
    ADJUSTMENT = "ADJUSTMENT",
    CREDIT_NOTE = "CREDIT_NOTE",
    DEBIT_NOTE = "DEBIT_NOTE",
    REFUND = "REFUND",
    CHARGEBACK = "CHARGEBACK",
    WRITE_OFF = "WRITE_OFF",
    OTHER = "OTHER"
}

export enum RevenueExpenseCategory {
    RENT = "RENT",
    FREIGHT = "FREIGHT",
    MISC = "MISC",
    SALARY = "SALARY",
    UTILITIES = "UTILITIES",
    OFFICE_SUPPLIES = "OFFICE_SUPPLIES",
    MAINTENANCE = "MAINTENANCE",
    TRAVEL = "TRAVEL",
    ENTERTAINMENT = "ENTERTAINMENT",
    ADVERTISING = "ADVERTISING",
    INSURANCE = "INSURANCE",
    TAXES = "TAXES",
    DEPRECIATION = "DEPRECIATION",
    INTEREST = "INTEREST",
    OTHER = "OTHER"
}

interface GeneralAccount {
    id: number;
    accountName: string;
}

interface ExpenseRevenueItem {
    id?: number;
    revenueExpenseType: RevenueExpenseType;
    revenueExpenseCategory: RevenueExpenseCategory;
    description: string;
    amount: number;
    transactionDate: string;
    generalAccountId?: number;
    generalAccount?: GeneralAccount;
    paymentMethod?: string;
    referenceNumber?: string;
}

interface SummaryData {
    total: number;
}

interface ReportSummaryItem {
    type: RevenueExpenseType;
    category: RevenueExpenseCategory;
    totalAmount: number;
}

interface MonthlyReportData {
    month: string;
    summary: ReportSummaryItem[];
}

interface ExportRow {
    Type?: string;
    Category?: string;
    Description?: string;
    Amount?: number;
    Date?: string;
    Account?: string;
}

const ExpenseRevenueList: React.FC = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState<ExpenseRevenueItem[]>([]);
    const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [monthlyReport, setMonthlyReport] = useState<MonthlyReportData | null>(null);
    const [selectedType, setSelectedType] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<ExpenseRevenueItem | null>(null);

    // Separate state for each filter type
    const [dateRangeFilter, setDateRangeFilter] = useState({
        type: "",
        fromDate: null as Date | null,
        toDate: null as Date | null
    });

    const [summaryFilter, setSummaryFilter] = useState({
        type: "",
        fromDate: null as Date | null,
        toDate: null as Date | null
    });

    const [reportFilter, setReportFilter] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
    });

    const resetAdvancedFilters = () => {
        setDateRangeFilter({ type: "", fromDate: null, toDate: null });
        setSummaryFilter({ type: "", fromDate: null, toDate: null });
        setReportFilter({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
        setSummary(null);
        setMonthlyReport(null);
    };

    const loadData = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const [itemRes, accRes] = await Promise.all([
                axios.get(API_URL),
                axios.get(ACCOUNT_API)
            ]);
            setItems(Array.isArray(itemRes.data) ? itemRes.data : []);
            setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
            setMonthlyReport(null);
            setSummary(null);
            resetAdvancedFilters();
        } catch (err) {
            console.error("Error loading data:", err);
            ToasterService.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadSummary = async () => {
        if (loading) return;

        if (!summaryFilter.type) {
            ToasterService.error("Please select a type for summary");
            return;
        }
        if (!summaryFilter.fromDate || !summaryFilter.toDate) {
            ToasterService.error("Please select both from and to dates");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/summary`, {
                params: {
                    type: summaryFilter.type,
                    from: summaryFilter.fromDate?.toISOString().split('T')[0],
                    to: summaryFilter.toDate?.toISOString().split('T')[0]
                }
            });
            setSummary(response.data);
            ToasterService.success("Summary loaded successfully");
        } catch (err) {
            console.error("Error loading summary:", err);
            ToasterService.error("Failed to load summary");
        } finally {
            setLoading(false);
        }
    };

    const loadDateRangeData = async () => {
        if (loading) return;

        if (!dateRangeFilter.type) {
            ToasterService.error("Please select a type");
            return;
        }
        if (!dateRangeFilter.fromDate || !dateRangeFilter.toDate) {
            ToasterService.error("Please select both from and to dates");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.get(
                `${API_URL}/type/from/to`,
                {
                    params: {
                        type: dateRangeFilter.type,
                        from: dateRangeFilter.fromDate?.toISOString().split('T')[0],
                        to: dateRangeFilter.toDate?.toISOString().split('T')[0]
                    }
                }
            );
            setItems(Array.isArray(response.data) ? response.data : []);
            setMonthlyReport(null);
            setSummary(null);
            ToasterService.success("Date range filter applied");
        } catch (err) {
            console.error("Error loading date range data:", err);
            ToasterService.error("Failed to load date range data");
        } finally {
            setLoading(false);
        }
    };

    const loadReport = async () => {
        if (loading) return;

        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/report`, {
                params: {
                    year: reportFilter.year,
                    month: reportFilter.month
                }
            });
            setMonthlyReport(response.data);
            ToasterService.success(`Report for ${reportFilter.year}-${reportFilter.month} loaded`);
        } catch (err) {
            console.error("Error loading report:", err);
            ToasterService.error("Failed to load report");
        } finally {
            setLoading(false);
        }
    };

    const resetToAllData = async () => {
        setShowAdvancedFilters(false);
        await loadData();
        ToasterService.success("Showing all data");
    };

    const handleDelete = async () => {
        if (!itemToDelete?.id) return;
        setLoading(true);
        try {
            await axios.delete(`${API_URL}/${itemToDelete.id}`);
            ToasterService.success("Transaction deleted");
            await loadData();
        } catch {
            ToasterService.error("Failed to delete transaction");
        } finally {
            setLoading(false);
            setItemToDelete(null);
        }
    };

    const exportPDF = async () => {
        if (exporting) return;
        setExporting(true);

        try {
            const doc = new jsPDF();
            const pdfDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
            doc.setFontSize(18);
            doc.text("Expense & Revenue Report", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

            // Main transactions table
            if (items.length > 0) {
                autoTable(doc, {
                    head: [["Type", "Category", "Description", "Amount", "Date", "Account"]],
                    body: items.map(i => [
                        i.revenueExpenseType,
                        i.revenueExpenseCategory,
                        i.description,
                        i.amount.toFixed(2),
                        new Date(i.transactionDate).toLocaleDateString(),
                        accounts.find(a => a.id === i.generalAccountId)?.accountName || ""
                    ]),
                    startY: 30,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
            }

            // Summary section
            if (summary) {
                autoTable(doc, {
                    head: [["Summary", "Value"]],
                    body: [
                        ["Total Amount", summary.total.toFixed(2)],
                    ],
                    startY: items.length > 0 ? (pdfDoc.lastAutoTable?.finalY ?? 30) + 10 : 30,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
            }

            // Monthly Report section
            if (monthlyReport) {
                const revenueTotal = monthlyReport.summary
                    .filter(item => item.type === RevenueExpenseType.REVENUE)
                    .reduce((sum, item) => sum + item.totalAmount, 0);

                const expenseTotal = monthlyReport.summary
                    .filter(item => item.type === RevenueExpenseType.EXPENSE)
                    .reduce((sum, item) => sum + item.totalAmount, 0);

                autoTable(doc, {
                    head: [[`Monthly Report - ${monthlyReport.month}`]],
                    body: [
                        ["Revenue Total", revenueTotal.toFixed(2)],
                        ["Expense Total", expenseTotal.toFixed(2)],
                        ["Net Balance", (revenueTotal - expenseTotal).toFixed(2)],
                    ],
                    startY: (summary || items.length > 0) ? (pdfDoc.lastAutoTable?.finalY ?? 30) + 10 : 30,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });

                // Category breakdown
                autoTable(doc, {
                    head: [["Type", "Category", "Amount"]],
                    body: monthlyReport.summary.map(item => [
                        item.type,
                        item.category,
                        item.totalAmount.toFixed(2)
                    ]),
                    startY: (pdfDoc.lastAutoTable?.finalY ?? 30) + 10,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [41, 128, 185] }
                });
            }

            doc.save(`Expense_Revenue_${new Date().toISOString().split('T')[0]}.pdf`);
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
            const data: ExportRow[] = items.map(i => ({
                Type: i.revenueExpenseType,
                Category: i.revenueExpenseCategory,
                Description: i.description,
                Amount: i.amount,
                Date: i.transactionDate,
                Account: accounts.find(a => a.id === i.generalAccountId)?.accountName || ""
            }));

            if (summary) {
                data.push({});
                data.push({ Type: "SUMMARY", Description: "Total Amount", Amount: summary.total });
            }

            if (monthlyReport) {
                data.push({});
                data.push({ Type: "MONTHLY REPORT", Description: `Month: ${monthlyReport.month}` });
                monthlyReport.summary.forEach(item => {
                    data.push({
                        Type: item.type,
                        Category: item.category,
                        Amount: item.totalAmount
                    });
                });
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Transactions");
            XLSX.writeFile(wb, `Expense_Revenue_${new Date().toISOString().split('T')[0]}.xlsx`);
            ToasterService.success("Excel exported successfully");
        } catch (err) {
            console.error("Error exporting Excel:", err);
            ToasterService.error("Failed to export Excel");
        } finally {
            setExporting(false);
            setShowExportMenu(false);
        }
    };

    const filteredItems = useMemo(() => items.filter((i) => {
        const matchesType = selectedType ? i.revenueExpenseType === selectedType : true;
        const matchesCategory = selectedCategory ? i.revenueExpenseCategory === selectedCategory : true;
        return matchesType && matchesCategory;
    }), [items, selectedType, selectedCategory]);

    const totalRevenue = items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + i.amount, 0);

    const getTypeColor = (type: RevenueExpenseType) => {
        switch (type) {
            case RevenueExpenseType.REVENUE:
                return "bg-green-100 text-green-800";
            case RevenueExpenseType.EXPENSE:
                return "bg-red-100 text-red-800";
            case RevenueExpenseType.TRANSFER:
                return "bg-blue-100 text-blue-800";
            case RevenueExpenseType.ADJUSTMENT:
                return "bg-purple-100 text-purple-800";
            case RevenueExpenseType.CREDIT_NOTE:
                return "bg-indigo-100 text-indigo-800";
            case RevenueExpenseType.DEBIT_NOTE:
                return "bg-pink-100 text-pink-800";
            case RevenueExpenseType.REFUND:
                return "bg-orange-100 text-orange-800";
            case RevenueExpenseType.CHARGEBACK:
                return "bg-yellow-100 text-yellow-800";
            case RevenueExpenseType.WRITE_OFF:
                return "bg-gray-100 text-gray-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const getTypeIcon = (type: RevenueExpenseType) => {
        switch (type) {
            case RevenueExpenseType.REVENUE:
                return <ArrowTrendingUpIcon className="h-3 w-3 text-green-600" />;
            case RevenueExpenseType.EXPENSE:
                return <ArrowTrendingDownIcon className="h-3 w-3 text-red-600" />;
            case RevenueExpenseType.TRANSFER:
                return <BanknotesIcon className="h-3 w-3 text-blue-600" />;
            case RevenueExpenseType.ADJUSTMENT:
                return <ChartBarIcon className="h-3 w-3 text-purple-600" />;
            case RevenueExpenseType.CREDIT_NOTE:
                return <DocumentTextIcon className="h-3 w-3 text-indigo-600" />;
            case RevenueExpenseType.DEBIT_NOTE:
                return <DocumentTextIcon className="h-3 w-3 text-pink-600" />;
            case RevenueExpenseType.REFUND:
                return <ReceiptRefundIcon className="h-3 w-3 text-orange-600" />;
            case RevenueExpenseType.CHARGEBACK:
                return <CurrencyDollarIcon className="h-3 w-3 text-yellow-600" />;
            case RevenueExpenseType.WRITE_OFF:
                return <XCircleIcon className="h-3 w-3 text-gray-600" />;
            default:
                return <TagIcon className="h-3 w-3 text-gray-600" />;
        }
    };

    const getCategoryColor = (category: RevenueExpenseCategory) => {
        switch (category) {
            case RevenueExpenseCategory.RENT:
                return "bg-blue-100 text-blue-800";
            case RevenueExpenseCategory.FREIGHT:
                return "bg-purple-100 text-purple-800";
            case RevenueExpenseCategory.SALARY:
                return "bg-yellow-100 text-yellow-800";
            case RevenueExpenseCategory.UTILITIES:
                return "bg-indigo-100 text-indigo-800";
            case RevenueExpenseCategory.OFFICE_SUPPLIES:
                return "bg-pink-100 text-pink-800";
            case RevenueExpenseCategory.MAINTENANCE:
                return "bg-orange-100 text-orange-800";
            case RevenueExpenseCategory.TRAVEL:
                return "bg-teal-100 text-teal-800";
            case RevenueExpenseCategory.ENTERTAINMENT:
                return "bg-amber-100 text-amber-800";
            case RevenueExpenseCategory.ADVERTISING:
                return "bg-rose-100 text-rose-800";
            case RevenueExpenseCategory.INSURANCE:
                return "bg-lime-100 text-lime-800";
            case RevenueExpenseCategory.TAXES:
                return "bg-red-100 text-red-800";
            case RevenueExpenseCategory.DEPRECIATION:
                return "bg-gray-100 text-gray-800";
            case RevenueExpenseCategory.INTEREST:
                return "bg-emerald-100 text-emerald-800";
            case RevenueExpenseCategory.MISC:
                return "bg-gray-100 text-gray-800";
            case RevenueExpenseCategory.OTHER:
                return "bg-stone-100 text-stone-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const tableColumns: ColumnDef<ExpenseRevenueItem>[] = [
        {
            key: "description",
            label: "Transaction",
            sortable: true,
            render: (item) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{item.description}</span>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getTypeColor(item.revenueExpenseType)}`}>
                            {getTypeIcon(item.revenueExpenseType)}
                            <span className="ml-1">{item.revenueExpenseType.replace('_', ' ')}</span>
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {new Date(item.transactionDate).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            key: "revenueExpenseCategory",
            label: "Category",
            sortable: true,
            render: (item) => (
                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.revenueExpenseCategory)}`}>
                    <TagIcon className="h-3 w-3 mr-1" />
                    {item.revenueExpenseCategory.replace('_', ' ')}
                </span>
            ),
        },
        {
            key: "generalAccountId",
            label: "Account",
            render: (item) => (
                <div className="flex items-center">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">
                        {accounts.find(a => a.id === item.generalAccountId)?.accountName || "-"}
                    </span>
                </div>
            ),
        },
        {
            key: "amount",
            label: "Amount",
            sortable: true,
            render: (item) => (
                <div>
                    <span className={`text-sm font-medium ${item.revenueExpenseType === RevenueExpenseType.REVENUE ? 'text-green-600' : 'text-red-600'}`}>
                        {item.revenueExpenseType === RevenueExpenseType.REVENUE ? '+' : '-'}${item.amount.toFixed(2)}
                    </span>
                    {item.referenceNumber && (
                        <div className="text-xs text-gray-500 mt-1">Ref: {item.referenceNumber}</div>
                    )}
                </div>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (item) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => navigate(`/expense-revenue/view/${item.id}`)}
                        disabled={loading || exporting}
                        className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="View"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/expense-revenue/edit/${item.id}`)}
                        disabled={loading || exporting}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setItemToDelete(item);
                            setShowDeletePopup(true);
                        }}
                        disabled={loading || exporting}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    const tableToolbar = (
        <div className="flex items-center gap-2 relative">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={loading || exporting}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export"
                >
                    <DocumentArrowDownIcon className="h-5 w-5" />
                </button>

                {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-44 bg-white shadow-lg rounded-lg border border-gray-200 z-50">
                        <button
                            type="button"
                            onClick={exportPDF}
                            disabled={exporting}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                            Export PDF
                        </button>
                        <button
                            type="button"
                            onClick={exportExcel}
                            disabled={exporting}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                            Export Excel
                        </button>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                disabled={loading || exporting}
                className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-cyan-50 border-cyan-300 text-cyan-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Filters"
            >
                <FunnelIcon className="h-5 w-5" />
            </button>
        </div>
    );

    return (
        <>
            <PageMeta title="Expense & Revenue" description="Manage transaction items" />
            <PageBreadcrumb pageTitle="Expense & Revenue" />

            <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
                <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                        {/* <div>
                            <h1 className="text-2xl font-bold text-gray-900">Expense & Revenue</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Manage transaction items
                            </p>
                        </div> */}

                    <AddButton label="Add Transaction" onClick={() => navigate("/expense-revenue/add")} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        label="Total Transactions"
                        value={items.length}
                        gradient="from-cyan-50 to-blue-50"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-600"
                        icon={<DocumentDuplicateIcon className="h-6 w-6 text-cyan-600" />}
                    />
                    <StatsCard
                        label="Total Revenue"
                        value={`$${totalRevenue.toFixed(2)}`}
                        gradient="from-emerald-50 to-teal-50"
                        borderColor="border-emerald-100"
                        labelColor="text-emerald-600"
                        icon={<ArrowTrendingUpIcon className="h-6 w-6 text-emerald-600" />}
                    />
                    <StatsCard
                        label="Total Expenses"
                        value={`$${totalExpense.toFixed(2)}`}
                        gradient="from-rose-50 to-red-50"
                        borderColor="border-rose-100"
                        labelColor="text-rose-600"
                        icon={<ArrowTrendingDownIcon className="h-6 w-6 text-rose-600" />}
                    />
                    <StatsCard
                        label="Net Balance"
                        value={`$${(totalRevenue - totalExpense).toFixed(2)}`}
                        gradient="from-amber-50 to-orange-50"
                        borderColor="border-amber-100"
                        labelColor="text-amber-600"
                        icon={<CurrencyDollarIcon className="h-6 w-6 text-amber-600" />}
                    />
                </div>

                {/* Action Buttons */}
                <div className="mb-4 flex justify-end gap-2">
                    <button
                        onClick={resetToAllData}
                        disabled={loading || exporting}
                        className="px-4 py-2 bg-gray-600 !text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <DocumentDuplicateIcon className="h-4 w-4" />
                        )}
                        Show All Data
                    </button>
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        disabled={loading || exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChartBarIcon className="h-4 w-4" />
                        {showAdvancedFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}
                    </button>
                </div>

                {/* Advanced Filters Panel */}
                {showAdvancedFilters && (
                    <div className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <ChartBarIcon className="h-5 w-5 text-cyan-600" />
                            Advanced Filters & Reports
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Date Range Filter */}
                            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-cyan-600" />
                                    Date Range Filter
                                </h4>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                                    <select
                                        value={dateRangeFilter.type}
                                        onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, type: e.target.value })}
                                        disabled={loading || exporting}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select Type</option>
                                        {Object.values(RevenueExpenseType).map(t => (
                                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">From Date</label>
                                    <DatePicker
                                        selected={dateRangeFilter.fromDate}
                                        onChange={(date) => setDateRangeFilter({ ...dateRangeFilter, fromDate: date })}
                                        dateFormat="yyyy-MM-dd"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                        placeholderText="Select from date"
                                        disabled={loading || exporting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">To Date</label>
                                    <DatePicker
                                        selected={dateRangeFilter.toDate}
                                        onChange={(date) => setDateRangeFilter({ ...dateRangeFilter, toDate: date })}
                                        dateFormat="yyyy-MM-dd"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                        placeholderText="Select to date"
                                        disabled={loading || exporting}
                                    />
                                </div>
                                <button
                                    onClick={loadDateRangeData}
                                    disabled={loading || exporting}
                                    className="w-full px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Apply Filter"
                                    )}
                                </button>
                            </div>

                            {/* Summary Filter */}
                            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <ChartBarIcon className="h-4 w-4 text-purple-600" />
                                    Summary
                                </h4>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                                    <select
                                        value={summaryFilter.type}
                                        onChange={(e) => setSummaryFilter({ ...summaryFilter, type: e.target.value })}
                                        disabled={loading || exporting}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select Type</option>
                                        {Object.values(RevenueExpenseType).map(t => (
                                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">From Date</label>
                                    <DatePicker
                                        selected={summaryFilter.fromDate}
                                        onChange={(date) => setSummaryFilter({ ...summaryFilter, fromDate: date })}
                                        dateFormat="yyyy-MM-dd"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                        placeholderText="Select from date"
                                        disabled={loading || exporting}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">To Date</label>
                                    <DatePicker
                                        selected={summaryFilter.toDate}
                                        onChange={(date) => setSummaryFilter({ ...summaryFilter, toDate: date })}
                                        dateFormat="yyyy-MM-dd"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                        placeholderText="Select to date"
                                        disabled={loading || exporting}
                                    />
                                </div>
                                <button
                                    onClick={loadSummary}
                                    disabled={loading || exporting}
                                    className="w-full px-4 py-2 bg-purple-600 !text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Load Summary"
                                    )}
                                </button>
                            </div>

                            {/* Monthly Report */}
                            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <DocumentTextIcon className="h-4 w-4 text-green-600" />
                                    Monthly Report
                                </h4>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Year</label>
                                    <select
                                        value={reportFilter.year}
                                        onChange={(e) => setReportFilter({ ...reportFilter, year: Number(e.target.value) })}
                                        disabled={loading || exporting}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Month</label>
                                    <select
                                        value={reportFilter.month}
                                        onChange={(e) => setReportFilter({ ...reportFilter, month: Number(e.target.value) })}
                                        disabled={loading || exporting}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                            <option key={month} value={month}>
                                                {new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={loadReport}
                                    disabled={loading || exporting}
                                    className="w-full px-4 py-2 bg-green-600 !text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        "Load Report"
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Summary Display */}
                        {summary && (
                            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Summary Results</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-purple-50 p-4 rounded-lg">
                                        <p className="text-xs text-purple-600 mb-1">Type</p>
                                        <p className="text-lg font-semibold text-purple-700">{summaryFilter.type}</p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <p className="text-xs text-green-600 mb-1">Total Amount</p>
                                        <p className="text-lg font-semibold text-green-600">${summary.total.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <p className="text-xs text-blue-600 mb-1">Date Range</p>
                                        <p className="text-sm font-medium text-blue-700">
                                            {summaryFilter.fromDate?.toLocaleDateString()} - {summaryFilter.toDate?.toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Monthly Report Display */}
                        {monthlyReport && (
                            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <DocumentTextIcon className="h-4 w-4 text-green-600" />
                                    Monthly Report - {monthlyReport.month}
                                </h4>

                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    {(() => {
                                        const revenueTotal = monthlyReport.summary
                                            .filter(item => item.type === RevenueExpenseType.REVENUE)
                                            .reduce((sum, item) => sum + item.totalAmount, 0);
                                        const expenseTotal = monthlyReport.summary
                                            .filter(item => item.type === RevenueExpenseType.EXPENSE)
                                            .reduce((sum, item) => sum + item.totalAmount, 0);
                                        const netBalance = revenueTotal - expenseTotal;

                                        return (
                                            <>
                                                <div className="bg-green-50 p-4 rounded-lg">
                                                    <p className="text-xs text-green-600 mb-1">Total Revenue</p>
                                                    <p className="text-lg font-semibold text-green-600">${revenueTotal.toFixed(2)}</p>
                                                </div>
                                                <div className="bg-red-50 p-4 rounded-lg">
                                                    <p className="text-xs text-red-600 mb-1">Total Expense</p>
                                                    <p className="text-lg font-semibold text-red-600">${expenseTotal.toFixed(2)}</p>
                                                </div>
                                                <div className={`p-4 rounded-lg ${netBalance >= 0 ? 'bg-cyan-50' : 'bg-orange-50'}`}>
                                                    <p className={`text-xs ${netBalance >= 0 ? 'text-cyan-600' : 'text-orange-600'} mb-1`}>Net Balance</p>
                                                    <p className={`text-lg font-semibold ${netBalance >= 0 ? 'text-cyan-600' : 'text-orange-600'}`}>
                                                        ${netBalance.toFixed(2)}
                                                    </p>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Category Breakdown Table */}
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {monthlyReport.summary.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2">
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(item.type)}`}>
                                                            {getTypeIcon(item.type)}
                                                            <span className="ml-1">{item.type}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.category)}`}>
                                                            <TagIcon className="h-3 w-3 mr-1" />
                                                            {item.category.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-medium">
                                                        <span className={item.type === RevenueExpenseType.REVENUE ? 'text-green-600' : 'text-red-600'}>
                                                            ${item.totalAmount.toFixed(2)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Basic Filters Panel */}
                {showFilters && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Transaction Type</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setSelectedType("")}
                                        disabled={loading || exporting}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedType === "" ? 'bg-cyan-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        All
                                    </button>
                                    {Object.values(RevenueExpenseType).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setSelectedType(type)}
                                            disabled={loading || exporting}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedType === type ? 'bg-cyan-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {type.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Category</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    disabled={loading || exporting}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                    <option value="">All Categories</option>
                                    {Object.values(RevenueExpenseCategory).map(c => (
                                        <option key={c} value={c}>{c.replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>
                            {(selectedType || selectedCategory) && (
                                <button
                                    onClick={() => {
                                        setSelectedType("");
                                        setSelectedCategory("");
                                    }}
                                    disabled={loading || exporting}
                                    className="self-end px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Loading Overlay */}
                {(loading || exporting) && (
                    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4">
                            <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-700 font-medium">
                                {loading ? "Loading..." : "Exporting..."}
                            </p>
                        </div>
                    </div>
                )}

                <ReusableTable<ExpenseRevenueItem>
                    data={filteredItems}
                    columns={tableColumns}
                    loading={loading || exporting}
                    searchable
                    searchPlaceholder="Search transactions by description, reference, type, or category..."
                    searchFields={["description", "referenceNumber", "revenueExpenseCategory", "revenueExpenseType"]}
                    pageSize={ITEMS_PER_PAGE}
                    defaultSortKey="transactionDate"
                    defaultSortOrder="desc"
                    toolbar={tableToolbar}
                    onRowClick={(item) => !loading && !exporting && navigate(`/expense-revenue/view/${item.id}`)}
                    emptyState={
                        <div className="flex flex-col items-center justify-center">
                            <DocumentDuplicateIcon className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-gray-500 text-sm mb-1">No transactions found</p>
                            <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                        </div>
                    }
                />

                <DynamicPopup
                    isPopupOpen={showDeletePopup}
                    setIsPopupOpen={setShowDeletePopup}
                    icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                    iconBg="bg-red-100"
                    innerText="Delete Transaction"
                    subText={
                        itemToDelete
                            ? `Are you sure you want to delete "${itemToDelete.description}"?`
                            : "Are you sure you want to delete this transaction?"
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={handleDelete}
                    onCancel={() => setItemToDelete(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default ExpenseRevenueList;








import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    PencilSquareIcon,
    TrashIcon,
    DocumentTextIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CurrencyDollarIcon,
    TagIcon,
    DocumentDuplicateIcon,
    UserGroupIcon,
    UsersIcon,
    FunnelIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import StatsCard from "../../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import DynamicPopup from "../../../components/common/Popup";
import { AddButton } from "../../../components/common/AddButton";
import { BackButton } from "../../../components/common/BackButton";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/general-accounts";
const ACCOUNT_TYPE_API_URL = "/v1/api/invoice/general-accounts/accoutType/";
const PAGE_SIZE = 10;

export enum AccountType {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    INCOME = "INCOME",
    EXPENSE = "EXPENSE",
}

export enum Currency {
    USD = "USD",
    EUR = "EUR",
    GBP = "GBP",
    INR = "INR",
    AED = "AED",
    CAD = "CAD",
    AUD = "AUD",
    JPY = "JPY",
}

export interface GeneralAccount {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    isActive: boolean;
    description?: string;
    currency?: string;
    openingBalance: number;
    parentAccount?: GeneralAccount | null;
    allowTransactions: boolean;
    createdAt?: string;
}

const getTypeColor = (type: AccountType) => {
    switch (type) {
        case AccountType.ASSET: return "bg-blue-100 text-blue-800";
        case AccountType.LIABILITY: return "bg-yellow-100 text-yellow-800";
        case AccountType.EQUITY: return "bg-purple-100 text-purple-800";
        case AccountType.INCOME: return "bg-green-100 text-green-800";
        case AccountType.EXPENSE: return "bg-red-100 text-red-800";
        default: return "bg-gray-100 text-gray-800";
    }
};

const getTypeIcon = (type: AccountType) => {
    switch (type) {
        case AccountType.ASSET:
            return <CurrencyDollarIcon className="h-4 w-4 text-blue-500" />;
        case AccountType.LIABILITY:
            return <TagIcon className="h-4 w-4 text-yellow-500" />;
        case AccountType.EQUITY:
            return <BuildingOfficeIcon className="h-4 w-4 text-purple-500" />;
        case AccountType.INCOME:
            return <DocumentTextIcon className="h-4 w-4 text-green-500" />;
        case AccountType.EXPENSE:
            return <CurrencyDollarIcon className="h-4 w-4 text-red-500" />;
        default:
            return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
};

const GeneralLedgerList: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<GeneralAccount[]>([]);
    const [selectedType, setSelectedType] = useState<AccountType | "">("");
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState<GeneralAccount | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const res = await axios.get(API_URL);
            const sample = await axios.get(`${ACCOUNT_TYPE_API_URL}/ASSET`);
            const newSample = await axios.get('/v1/api/invoice/general-accounts/accoutType/count')
            void sample;
            console.log(newSample.data);
            setData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error loading accounts:", err);
            ToasterService.error("Failed to load accounts");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleDelete = async () => {
        if (!accountToDelete) return;
        try {
            await axios.delete(`${API_URL}/${accountToDelete.id}`);
            ToasterService.success("Account deleted");
            await loadData();
        } catch (err: unknown) {
            const errorMessage = axios.isAxiosError(err)
                ? err.response?.data?.message || "Delete failed"
                : "Delete failed";
            ToasterService.error(errorMessage);
        } finally {
            setAccountToDelete(null);
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("General Accounts Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        autoTable(doc, {
            head: [["Code", "Name", "Type", "Currency", "Active", "Opening Balance"]],
            body: data.map(a => [a.accountCode, a.accountName, a.accountType, a.currency || "USD", a.isActive ? "Yes" : "No", a.openingBalance.toFixed(2)]),
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
        });
        doc.save(`GeneralAccounts_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(data.map(a => ({
            Code: a.accountCode,
            Name: a.accountName,
            Type: a.accountType,
            Currency: a.currency || "USD",
            Active: a.isActive ? "Yes" : "No",
            'Opening Balance': a.openingBalance,
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Accounts");
        XLSX.writeFile(wb, `GeneralAccounts_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filteredAccounts = useMemo(
        () => data.filter((account) => {
            const matchType = selectedType ? account.accountType === selectedType : true;
            return matchType;
        }),
        [data, selectedType]
    );

    const tableColumns: ColumnDef<GeneralAccount>[] = [
        {
            key: "accountCode",
            label: "Code",
            sortable: true,
            render: (account) => (
                <span className="text-sm font-mono font-medium text-gray-900">
                    {account.accountCode}
                </span>
            ),
        },
        {
            key: "accountName",
            label: "Account Name",
            sortable: true,
            render: (account) => (
                <div>
                    <p className="text-sm font-medium text-gray-900">{account.accountName}</p>
                    {account.parentAccount && (
                        <p className="text-xs text-gray-500 mt-1">
                            Parent: {account.parentAccount.accountName}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: "accountType",
            label: "Type",
            sortable: true,
            render: (account) => (
                <div className="flex items-center">
                    {getTypeIcon(account.accountType)}
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(account.accountType)}`}>
                        {account.accountType}
                    </span>
                </div>
            ),
        },
        {
            key: "isActive",
            label: "Status",
            sortable: true,
            render: (account) =>
                account.isActive ? (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Active
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        Inactive
                    </span>
                ),
        },
        {
            key: "openingBalance",
            label: "Opening Balance",
            sortable: true,
            render: (account) => (
                <span className="text-sm font-medium text-gray-900">
                    {account.openingBalance.toFixed(2)} {account.currency || "USD"}
                </span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (account) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => navigate(`/generalLedger/view/${account.id}`)}
                        className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                        title="View"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/generalLedger/edit/${account.id}`)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Edit"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setAccountToDelete(account);
                            setShowDeletePopup(true);
                        }}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Export"
                >
                    <DocumentArrowDownIcon className="h-5 w-5" />
                </button>

                {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-44 bg-white shadow-lg rounded-lg border border-gray-200 z-50">
                        <button
                            type="button"
                            onClick={exportPDF}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                            Export PDF
                        </button>
                        <button
                            type="button"
                            onClick={exportExcel}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
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
                className={`p-2 rounded-lg border transition-colors ${showFilters ? "bg-cyan-50 border-cyan-300 text-cyan-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                title="Filters"
            >
                <FunnelIcon className="h-5 w-5" />
            </button>
        </div>
    );

    return (
        <>
            <PageMeta title="General Ledger" description="Manage general ledger accounts" />
            <PageBreadcrumb pageTitle="General Ledger (GL) Entries" />

            <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
                <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                        {/* <div>
                            <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Manage general ledger accounts
                            </p>
                        </div> */}

                    <AddButton label="Add Account" onClick={() => navigate("/generalLedger/add")} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        label="Total Accounts"
                        value={data.length}
                        gradient="from-cyan-50 to-blue-50"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-600"
                        icon={<DocumentDuplicateIcon className="h-6 w-6 text-cyan-600" />}
                    />
                    <StatsCard
                        label="Active Accounts"
                        value={data.filter((account) => account.isActive).length}
                        gradient="from-emerald-50 to-teal-50"
                        borderColor="border-emerald-100"
                        labelColor="text-emerald-600"
                        icon={<CheckCircleIcon className="h-6 w-6 text-emerald-600" />}
                    />
                    <StatsCard
                        label="Parent Accounts"
                        value={data.filter((account) => !account.parentAccount).length}
                        gradient="from-purple-50 to-pink-50"
                        borderColor="border-purple-100"
                        labelColor="text-purple-600"
                        icon={<UserGroupIcon className="h-6 w-6 text-purple-600" />}
                    />
                    <StatsCard
                        label="Sub-Accounts"
                        value={data.filter((account) => account.parentAccount).length}
                        gradient="from-amber-50 to-orange-50"
                        borderColor="border-amber-100"
                        labelColor="text-amber-600"
                        icon={<UsersIcon className="h-6 w-6 text-amber-600" />}
                    />
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Account Type</label>
                                <select
                                    value={selectedType}
                                    onChange={e => setSelectedType(e.target.value as AccountType | "")}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                >
                                    <option value="">All Types</option>
                                    {Object.values(AccountType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            {selectedType && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedType("")}
                                    className="self-end px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <ReusableTable<GeneralAccount>
                    data={filteredAccounts}
                    columns={tableColumns}
                    loading={isLoading}
                    searchable
                    searchPlaceholder="Search accounts by code, name, type, or currency..."
                    searchFields={["accountCode", "accountName", "accountType", "currency"]}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="accountCode"
                    defaultSortOrder="asc"
                    toolbar={tableToolbar}
                    onRowClick={(account) => navigate(`/generalLedger/view/${account.id}`)}
                    emptyState={
                        <div className="flex flex-col items-center justify-center">
                            <BuildingOfficeIcon className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-gray-500 text-sm mb-1">No accounts found</p>
                            <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                        </div>
                    }
                />

                <DynamicPopup
                    isPopupOpen={showDeletePopup}
                    setIsPopupOpen={setShowDeletePopup}
                    icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                    iconBg="bg-red-100"
                    innerText="Delete Account"
                    subText={
                        accountToDelete
                            ? `Are you sure you want to delete "${accountToDelete.accountName}"? This action cannot be undone.`
                            : "Are you sure you want to delete this account?"
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={handleDelete}
                    onCancel={() => setAccountToDelete(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default GeneralLedgerList;




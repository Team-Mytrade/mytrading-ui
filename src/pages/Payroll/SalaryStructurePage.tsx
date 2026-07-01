import React, { useEffect, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    BanknotesIcon,
    CalendarIcon,
    BriefcaseIcon,
    HomeIcon,
    GiftIcon,
    ShieldCheckIcon,
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

type SalaryStructure = {
    id: number;
    employeeId: string;
    basic: number;
    hra: number;
    allowances: number;
    totalDeductions: number;
    netSalary: number;
    ctc: number;
    effectiveFrom: string;
    createdAt?: string;
    updatedAt?: string;
};

const API_URL = "/v1/api/payroll/salary-structures";
const PAGE_SIZE = 10;

const SalaryStructurePage: React.FC = () => {
    const [data, setData] = useState<SalaryStructure[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof SalaryStructure>("effectiveFrom");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const [form, setForm] = useState({
        employeeId: '',
        basic: 0,
        hra: 0,
        allowances: 0,
        deductions: 0,
        effectiveFrom: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setData(response.data);
        } catch (err) {
            console.error("Error loading salary structures:", err);
            ToasterService.error("Failed to load salary structures");
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ 
            ...prev, 
            [name]: name === 'employeeId' || name === 'effectiveFrom' ? value : Number(value) 
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const netSalary = form.basic + form.hra + form.allowances - form.deductions;
        const ctc = (form.basic + form.hra + form.allowances) * 12;
        
        const payload = { 
            ...form, 
            netSalary, 
            ctc, 
            totalDeductions: form.deductions 
        };

        try {
            if (editingId !== null) {
                await axios.put(`${API_URL}/${editingId}`, payload);
                ToasterService.success("Salary structure updated successfully");
            } else {
                await axios.post(API_URL, payload);
                ToasterService.success("Salary structure created successfully");
            }
            await fetchAll();
            closeForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const openEdit = (record: SalaryStructure) => {
        setForm({
            employeeId: record.employeeId,
            basic: record.basic,
            hra: record.hra,
            allowances: record.allowances,
            deductions: record.totalDeductions || 0,
            effectiveFrom: record.effectiveFrom,
        });
        setEditingId(record.id);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({ 
            employeeId: '', 
            basic: 0, 
            hra: 0, 
            allowances: 0, 
            deductions: 0, 
            effectiveFrom: new Date().toISOString().split('T')[0] 
        });
    };

    const handleDelete = async (id: number) => {
        const ok = await confirm({
            message: "Are you sure you want to delete this salary structure? This action cannot be undone.",
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;
        
        try {
            await axios.delete(`${API_URL}/${id}`);
            ToasterService.success("Salary structure deleted successfully");
            await fetchAll();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const exportPDF = (record: SalaryStructure) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(31, 41, 55);
        doc.text("Compensation Schedule", 14, 20);
        doc.setFontSize(10);
        doc.text(`Employee ID: ${record.employeeId}`, 14, 28);
        doc.text(`Effective From: ${new Date(record.effectiveFrom).toLocaleDateString()}`, 14, 34);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

        autoTable(doc, {
            head: [['Component', 'Monthly Value (INR)', 'Annual Value (INR)']],
            body: [
                ['Basic Salary', record.basic.toLocaleString(), (record.basic * 12).toLocaleString()],
                ['House Rent Allowance (HRA)', record.hra.toLocaleString(), (record.hra * 12).toLocaleString()],
                ['Other Allowances', record.allowances.toLocaleString(), (record.allowances * 12).toLocaleString()],
                ['Gross Earnings', (record.basic + record.hra + record.allowances).toLocaleString(), ((record.basic + record.hra + record.allowances) * 12).toLocaleString()],
                ['Total Deductions', (record.totalDeductions || 0).toLocaleString(), ((record.totalDeductions || 0) * 12).toLocaleString()],
                ['Net Take-Home', record.netSalary.toLocaleString(), (record.netSalary * 12).toLocaleString()],
                ['Annual CTC', '', record.ctc.toLocaleString()],
            ],
            startY: 50,
            theme: 'striped',
            headStyles: { fillColor: [6, 182, 212] },
            styles: { fontSize: 10 },
        });
        doc.save(`Salary_Structure_${record.employeeId}_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportAllPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(31, 41, 55);
        doc.text("Salary Structures Report", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
        doc.text(`Total Records: ${data.length}`, 14, 34);

        autoTable(doc, {
            head: [['Employee ID', 'Basic', 'HRA', 'Allowances', 'Deductions', 'Net Salary', 'CTC (Annual)', 'Effective From']],
            body: data.map(s => [
                s.employeeId,
                `₹${s.basic.toLocaleString()}`,
                `₹${s.hra.toLocaleString()}`,
                `₹${s.allowances.toLocaleString()}`,
                `₹${(s.totalDeductions || 0).toLocaleString()}`,
                `₹${s.netSalary.toLocaleString()}`,
                `₹${s.ctc.toLocaleString()}`,
                new Date(s.effectiveFrom).toLocaleDateString(),
            ]),
            startY: 45,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`All_Salary_Structures_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(data.map(s => ({
            'Employee ID': s.employeeId,
            'Basic Salary': s.basic,
            'HRA': s.hra,
            'Other Allowances': s.allowances,
            'Total Deductions': s.totalDeductions || 0,
            'Net Salary': s.netSalary,
            'Annual CTC': s.ctc,
            'Effective From': new Date(s.effectiveFrom).toLocaleDateString(),
            'Created At': s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary Structures');
        XLSX.writeFile(workbook, `Salary_Structures_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = data.filter(d => {
        const matchSearch = d.employeeId.toLowerCase().includes(search.toLowerCase());
        const matchEmployee = selectedEmployeeFilter ? d.employeeId === selectedEmployeeFilter : true;
        return matchSearch && matchEmployee;
    });

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        
        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        if (typeof valA === "number" && typeof valB === "number") {
            return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        
        return 0;
    });

    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    const handleSort = (field: keyof SalaryStructure) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof SalaryStructure }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    // Calculate stats from real data
    const totalCTC = data.reduce((sum, s) => sum + s.ctc, 0);
    const avgBasic = data.length > 0 ? data.reduce((sum, s) => sum + s.basic, 0) / data.length : 0;
    const avgNet = data.length > 0 ? data.reduce((sum, s) => sum + s.netSalary, 0) / data.length : 0;

    // Get unique employee IDs for filter
    const uniqueEmployees = [...new Set(data.map(s => s.employeeId))];

    return (
        <>
            <PageMeta title="Salary Structures" description="Manage employee salary structures and compensation" />
            <PageBreadcrumb pageTitle="Salary Structures" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton label="Add Structure" onClick={() => setShowForm(true)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Structures" value={data.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-6 w-6" />} />
                    <StatsCard label="Total CTC Value" value={"Rs " + (totalCTC / 100000).toFixed(1) + "L"} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<ChartBarIcon className="h-6 w-6" />} />
                    <StatsCard label="Avg Basic Salary" value={"Rs " + Math.round(avgBasic).toLocaleString()} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<CurrencyDollarIcon className="h-6 w-6" />} />
                    <StatsCard label="Avg Net Salary" value={"Rs " + Math.round(avgNet).toLocaleString()} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-6 w-6" />} />
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Employee ID..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                disabled={data.length === 0}
                            >
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                    <button
                                        onClick={exportAllPDF}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                        All Records (PDF)
                                    </button>
                                    <button
                                        onClick={exportExcel}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <TableCellsIcon className="h-4 w-4 text-green-600" />
                                        Export to Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
                        </button>

                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                                <select
                                    value={selectedEmployeeFilter}
                                    onChange={e => { setSelectedEmployeeFilter(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Employees</option>
                                    {uniqueEmployees.map(empId => (
                                        <option key={empId} value={empId}>{empId}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedEmployeeFilter && (
                                <button
                                    onClick={() => setSelectedEmployeeFilter("")}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        { key: "employeeId", label: "Employee ID" },
                                        { key: "basic", label: "Basic" },
                                        { key: "hra", label: "HRA" },
                                        { key: "allowances", label: "Allowances" },
                                        { key: "totalDeductions", label: "Deductions" },
                                        { key: "netSalary", label: "Net Salary" },
                                        { key: "ctc", label: "Annual CTC" },
                                        { key: "effectiveFrom", label: "Effective From" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof SalaryStructure)}
                                            className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof SalaryStructure} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                                <p className="text-gray-500 text-sm">Loading salary structures...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(structure => (
                                    <tr
                                        key={structure.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-xs font-medium text-cyan-700">
                                                        {structure.employeeId.charAt(0)}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{structure.employeeId}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">₹{structure.basic.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">₹{structure.hra.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-green-600">₹{structure.allowances.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-red-600">₹{(structure.totalDeductions || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-cyan-600">₹{structure.netSalary.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-purple-600 font-medium">₹{(structure.ctc / 100000).toFixed(1)}L</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                                                <span className="text-sm text-gray-600">
                                                    {new Date(structure.effectiveFrom).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-right relative">
                                            <Menu as="div" className="relative inline-block text-left">
                                                <Menu.Button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                                    <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                                                </Menu.Button>
                                                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => exportPDF(structure)}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                            >
                                                                <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                                                Export PDF
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => openEdit(structure)}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                            >
                                                                <PencilSquareIcon className="h-4 w-4 text-cyan-600" />
                                                                Edit
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => handleDelete(structure.id)}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600`}
                                                            >
                                                                <TrashIcon className="h-4 w-4" />
                                                                Delete
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                </Menu.Items>
                                            </Menu>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No salary structures found</p>
                                                <p className="text-gray-400 text-xs">Click "Add Structure" to create one</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                                        <span className="font-medium">
                                            {Math.min(page * PAGE_SIZE, filtered.length)}
                                        </span>{' '}
                                        of <span className="font-medium">{filtered.length}</span> results
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum: number;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (page <= 3) {
                                                pageNum = i + 1;
                                            } else if (page >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = page - 2 + i;
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setPage(pageNum)}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                                                            ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                                                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Last
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={closeForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                {editingId ? "Edit Salary Structure" : "Add Salary Structure"}
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                                                    <input
                                                        type="text"
                                                        name="employeeId"
                                                        value={form.employeeId}
                                                        onChange={handleChange}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Basic Salary</label>
                                                        <input
                                                            type="number"
                                                            name="basic"
                                                            value={form.basic}
                                                            onChange={handleChange}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">HRA</label>
                                                        <input
                                                            type="number"
                                                            name="hra"
                                                            value={form.hra}
                                                            onChange={handleChange}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Allowances</label>
                                                        <input
                                                            type="number"
                                                            name="allowances"
                                                            value={form.allowances}
                                                            onChange={handleChange}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Deductions</label>
                                                        <input
                                                            type="number"
                                                            name="deductions"
                                                            value={form.deductions}
                                                            onChange={handleChange}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Effective From</label>
                                                    <input
                                                        type="date"
                                                        name="effectiveFrom"
                                                        value={form.effectiveFrom}
                                                        onChange={handleChange}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                        required
                                                    />
                                                </div>

                                                {/* Preview Section */}
                                                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                    <h4 className="text-sm font-medium text-gray-700 mb-3">Salary Preview</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Gross Monthly:</span>
                                                            <span className="font-medium text-gray-900">
                                                                ₹{(form.basic + form.hra + form.allowances).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Total Deductions:</span>
                                                            <span className="font-medium text-red-600">
                                                                ₹{form.deductions.toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between pt-2 border-t border-gray-200">
                                                            <span className="text-gray-700 font-medium">Net Salary:</span>
                                                            <span className="font-bold text-cyan-600 text-lg">
                                                                ₹{(form.basic + form.hra + form.allowances - form.deductions).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Annual CTC:</span>
                                                            <span className="font-medium text-purple-600">
                                                                ₹{((form.basic + form.hra + form.allowances) * 12).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        onClick={handleSubmit}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {editingId ? "Update" : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeForm}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

export default SalaryStructurePage;




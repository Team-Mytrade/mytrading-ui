import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
    UserGroupIcon,
    UsersIcon,
    PhoneIcon,
    EnvelopeIcon,
    BriefcaseIcon,
    CalendarIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import {
    Employee,
    Department
} from "../../shared/types/employee.types";

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";
const DEPARTMENT_API_URL = "/v1/api/payroll/department";
const PAGE_SIZE = 10;

const EmployeeRecordsPage: React.FC = () => {
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof Employee>("employeeCode");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
    const [selectedDept, setSelectedDept] = useState<string>("");
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
            const payload = res.data;
            setEmployees(Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
            console.error("Error loading employees:", err);
            ToasterService.error("Failed to load employees");
        } finally {
            setLoading(false);
        }
    };

    
    const fetchDepartments = async () => {
        try {
            const res = await axios.get(`${DEPARTMENT_API_URL}/listAll`);
            const payload = res.data;
            setDepartments(Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []);
        } catch (err) {
            console.error("Error loading departments:", err);
        }
    };

  const exportEmployees = async () => {
    setLoading(true);
    try {
        const response = await axios.get(`${EMPLOYEE_API_URL}/export`, {
            responseType: 'blob' // Important: tells axios to treat response as blob
        });
        
        // Create a blob from the response data
        const contentType = response.headers['content-type'];
        const blob = new Blob([response.data], { 
            type: typeof contentType === "string" ? contentType : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers['content-disposition'];
        let filename = `Employee_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        if (typeof contentDisposition === "string") {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        // Clean up the blob URL
        window.URL.revokeObjectURL(url);
        
        ToasterService.success('Employee records exported successfully');
        setShowExportMenu(false);
    } catch (err: any) {
        console.error("Error exporting employees:", err);
        
        // Try to parse error response if it's a blob
        if (err.response && err.response.data instanceof Blob) {
            const errorText = await err.response.data.text();
            try {
                const errorJson = JSON.parse(errorText);
                ToasterService.error(errorJson.message || "Export failed");
            } catch {
                ToasterService.error("Export failed. Please try again.");
            }
        } else {
            ToasterService.error(err.response?.data?.message || "Failed to export employees");
        }
    } finally {
        setLoading(false);
    }
};

    useEffect(() => {
        fetchEmployees();
        fetchDepartments();
    }, []);

    const handleDelete = async (id: number) => {
        const ok = await confirm({
            message: "Are you sure you want to delete this employee record? This action cannot be undone.",
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;
        try {
            await axios.delete(`${EMPLOYEE_API_URL}/delete/${id}`);
            ToasterService.success("Employee deleted successfully");
            fetchEmployees();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Employee Records Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        autoTable(doc, {
            head: [["Code", "Name", "Email", "Phone", "Department", "Designation", "Status"]],
            body: employees.map(e => [
                e.employeeCode,
                `${e.firstName} ${e.lastName}`,
                e.officialEmail,
                e.phone,
                e.department?.name || "-",
                e.designation || "-",
                e.active ? "Active" : "Inactive"
            ]),
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
        });
        doc.save(`EmployeeRecords_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(employees.map(e => ({
            Code: e.employeeCode,
            Name: `${e.firstName} ${e.lastName}`,
            Email: e.officialEmail,
            Phone: e.phone,
            Department: e.department?.name || "-",
            Designation: e.designation || "-",
            Status: e.active ? "Active" : "Inactive",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        XLSX.writeFile(wb, `EmployeeRecords_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = employees.filter(e => {
        const fullName = `${e.firstName ?? ""} ${e.lastName ?? ""}`.toLowerCase();
        const employeeCode = String(e.employeeCode ?? "").toLowerCase();
        const officialEmail = String(e.officialEmail ?? "").toLowerCase();
        const searchTerm = search.toLowerCase();
        const matchSearch = fullName.includes(searchTerm) ||
            employeeCode.includes(searchTerm) ||
            officialEmail.includes(searchTerm);
        const matchDept = selectedDept ? e.department?.name === selectedDept : true;
        return matchSearch && matchDept;
    });

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Handle special cases for nested properties
        if (sortKey === "department") {
            valA = a.department?.name || "";
            valB = b.department?.name || "";
        }

        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (typeof valA === "boolean" && typeof valB === "boolean") {
            return sortOrder === "asc" ? (valA === valB ? 0 : valA ? 1 : -1) : (valA === valB ? 0 : valA ? -1 : 1);
        }

        return 0;
    });

    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    const handleSort = (field: keyof Employee | "name") => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field as keyof Employee); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof Employee | "name" }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    // Calculate stats
    const activeEmployees = employees.filter(e => e.active).length;
    const totalDepartments = new Set(employees.map(e => e.department?.id)).size;

    return (
        <>
            <PageMeta title="Employee Records" description="Manage employee records and workforce" />
            <PageBreadcrumb pageTitle="Employee Master" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton label="Add Employee" onClick={() => navigate("/addEmployee")} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Employees" value={employees.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<UserGroupIcon className="h-6 w-6" />} />
                    <StatsCard label="Active Employees" value={activeEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Departments" value={departments.length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
                    <StatsCard
                        label="Onboarded (30d)"
                        value={employees.filter(e => {
                            if (!e.createdAt) return false;
                            const thirtyDaysAgo = new Date();
                            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                            return new Date(e.createdAt) >= thirtyDaysAgo;
                        }).length}
                        gradient="from-blue-50 to-cyan-50"
                        borderColor="border-blue-100"
                        labelColor="text-blue-600"
                        icon={<UsersIcon className="h-6 w-6" />}
                    />
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search employees by name, code, or email..."
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
                            >
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                    <button
                                        onClick={exportPDF}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                        PDF
                                    </button>
                                       <button
            onClick={exportEmployees}
            disabled={loading}
            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
            ) : (
                <TableCellsIcon className="h-4 w-4 text-green-600" />
            )}
            {loading ? 'Exporting...' : 'Export Excel'}
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                <select
                                    value={selectedDept}
                                    onChange={e => { setSelectedDept(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                            </div>
                            {selectedDept && (
                                <button
                                    onClick={() => setSelectedDept("")}
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
                                        { key: "employeeCode", label: "Code" },
                                        { key: "name", label: "Employee Name" },
                                        { key: null, label: "Contact" },
                                        { key: "department", label: "Department" },
                                        { key: "active", label: "Status" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof Employee | "name")}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof Employee | "name"} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                                <p className="text-gray-500 text-sm">Loading employees...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(employee => (
                                    <tr
                                        key={employee.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/employee-view/${employee.id}`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-mono font-medium text-gray-900">{employee.employeeCode}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-sm font-medium text-cyan-700">
                                                        {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {employee.firstName} {employee.lastName}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {employee.designation || "No designation"}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center text-xs text-gray-600">
                                                    <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400" />
                                                    {employee.officialEmail || "—"}
                                                </div>
                                                <div className="flex items-center text-xs text-gray-600">
                                                    <PhoneIcon className="h-3 w-3 mr-1 text-gray-400" />
                                                    {employee.phone || "—"}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                                <BuildingOfficeIcon className="h-3 w-3 mr-1" />
                                                {employee.department?.name || "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {employee.active ? (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                                    <XCircleIcon className="h-3 w-3 mr-1" />
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right relative" onClick={e => e.stopPropagation()}>
                                            <Menu as="div" className="relative inline-block text-left">
                                                <Menu.Button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                                    <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                                                </Menu.Button>
                                                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => navigate(`/employee-view/${employee.id}`)}
                                                                className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                            >
                                                                <EyeIcon className="h-4 w-4 text-blue-600" />
                                                                View Details
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => navigate(`/addEmployee?editId=${employee.id}`)}
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
                                                                onClick={() => handleDelete(employee.id)}
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
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <UserGroupIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No employees found</p>
                                                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
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
                                            <span className="sr-only">First</span>
                                            <span>First</span>
                                        </button>
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <span>Previous</span>
                                        </button>

                                        {/* Page Numbers */}
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
                                                    aria-current={page === pageNum ? "page" : undefined}
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
                                            <span className="sr-only">Next</span>
                                            <span>Next</span>
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="sr-only">Last</span>
                                            <span>Last</span>
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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

export default EmployeeRecordsPage;

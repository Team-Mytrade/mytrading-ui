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
import ReusableTable, { ColumnDef } from "../../components/common/Table";
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
    const [selectedDept, setSelectedDept] = useState<string>("");
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
            const data = res.data;
            setEmployees(Array.isArray(data) ? data : (data?.data || []));
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
            const data = res.data;
            setDepartments(Array.isArray(data) ? data : (data?.data || []));
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
        const blob = new Blob([response.data], { 
            type: (response.headers['content-type'] as string) || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Extract filename from Content-Disposition header if available
        const contentDisposition = response.headers['content-disposition'];
        let filename = `Employee_Records_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        if (contentDisposition) {
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

    const safeEmployees = Array.isArray(employees) ? employees : [];
    
    const filtered = safeEmployees.filter(e => {
        const firstName = e.firstName || "";
        const lastName = e.lastName || "";
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        
        const employeeCode = e.employeeCode || "";
        const email = e.officialEmail || "";

        const matchSearch = fullName.includes(search.toLowerCase()) ||
            employeeCode.toLowerCase().includes(search.toLowerCase()) ||
            email.toLowerCase().includes(search.toLowerCase());
            
        const matchDept = selectedDept ? e.department?.name === selectedDept : true;
        return matchSearch && matchDept;
    });

    const activeEmployees = safeEmployees.filter(e => e.active).length;

    const columns: ColumnDef<Employee>[] = [
        {
            key: "employeeCode",
            label: "Code",
            sortable: true,
            render: (row) => (
                <span className="text-xs font-mono font-medium text-gray-900">
                    {row.employeeCode}
                </span>
            )
        },
        {
            key: "name",
            label: "Employee Name",
            sortable: true,
            sortValueGetter: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
            render: (row) => {
                const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim();
                const initials = `${row.firstName?.charAt(0) || ''}${row.lastName?.charAt(0) || ''}`.toUpperCase() || 'E';
                return (
                    <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 shrink-0">
                            <span className="text-xs font-medium text-cyan-700">
                                {initials}
                            </span>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-900">
                                {fullName}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                                {row.designation || "—"}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            key: "contact",
            label: "Contact",
            render: (row) => (
                <div className="space-y-1">
                    <div className="flex items-center text-[10px] text-gray-600">
                        <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400 shrink-0" />
                        {row.officialEmail || "—"}
                    </div>
                    <div className="flex items-center text-[10px] text-gray-600">
                        <PhoneIcon className="h-3 w-3 mr-1 text-gray-400 shrink-0" />
                        {row.phone || "—"}
                    </div>
                </div>
            )
        },
        {
            key: "department",
            label: "Department",
            sortable: true,
            sortValueGetter: (row) => row.department?.name || "",
            render: (row) => (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    <BuildingOfficeIcon className="h-3 w-3 mr-1 shrink-0" />
                    {row.department?.name || "—"}
                </span>
            )
        },
        {
            key: "active",
            label: "Status",
            sortable: true,
            render: (row) => row.active ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" />
                    Active
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    <XCircleIcon className="h-3 w-3 mr-1 shrink-0" />
                    Inactive
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-36",
            className: "text-right w-36",
            render: (row) => (
                <div className="flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => navigate(`/employee-view/${row.id}`)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1 rounded-md transition-colors"
                        title="View Details"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => navigate(`/addEmployee?editId=${row.id}`)}
                        className="text-cyan-600 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 p-1 rounded-md transition-colors"
                        title="Edit"
                    >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => handleDelete(row.id)}
                        className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1 rounded-md transition-colors"
                        title="Delete"
                    >
                        <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <>
            <PageMeta title="Employee Records" description="Manage employee records and workforce" />
            <PageBreadcrumb pageTitle="Employee Master" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Employees" value={employees.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<UserGroupIcon className="h-6 w-6" />} />
                    <StatsCard label="Active Employees" value={activeEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Departments" value={departments.length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
                    <StatsCard
                        label="Onboarded (30d)"
                        value={safeEmployees.filter(e => {
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
                                onChange={e => { setSearch(e.target.value); }}
                                className="h-10 pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <AddButton label="Add Employee" className="h-10 !my-0" onClick={() => navigate("/addEmployee")} />

                        {/* Export Menu */}
                        <div className="relative flex h-10 items-center">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="h-10 w-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
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
                            className={`h-10 w-10 flex items-center justify-center border rounded-lg transition-colors ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
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
                                    onChange={e => { setSelectedDept(e.target.value); }}
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
                <ReusableTable
                    className="[&_th]:!px-2 [&_td]:!px-2"
                    data={filtered}
                    columns={columns}
                    loading={loading}
                    searchable={false}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="employeeCode"
                    defaultSortOrder="asc"
                    emptyState={
                        <div className="flex flex-col items-center">
                            <UserGroupIcon className="h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-gray-500 text-sm mb-2">No employees found</p>
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

export default EmployeeRecordsPage;

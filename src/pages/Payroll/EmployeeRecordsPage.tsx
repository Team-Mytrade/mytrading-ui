import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
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
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { PAGE_BODY, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, STATS_ROW, TOOL_BUTTON } from "./hrmsUi";
import { formatDate } from "../../company/format";

import { t } from "../../i18n/i18n";
import { stampCompany } from "../../company/pdfStamp";
import { brandShade } from "../../company/brand";
const EMPLOYEE_API_URL = "/v1/api/payroll/employee";
const DEPARTMENT_API_URL = "/v1/api/payroll/department";
const PAGE_SIZE = 10;

const EmployeeRecordsPage: React.FC = () => {
  const { canDelete, canExport, canUpdate } = usePermissions();
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [search, setSearch] = useState("");
    const [selectedDept, setSelectedDept] = useState<string>("");
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        if (showExportMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showExportMenu]);

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
            let filename = `Employee_Records_${todayIso()}.xlsx`;

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
        // The service keeps the record and marks the employee inactive
        const ok = await confirm({
            message: "Deactivate this employee? Their record stays, marked inactive.",
            confirmLabel: "Deactivate",
            variant: "danger",
        });
        if (!ok) return;
        try {
            await axios.delete(`${EMPLOYEE_API_URL}/delete/${id}`);
            ToasterService.success("Employee deactivated");
            fetchEmployees();
        } catch (err: any) {
            ToasterService.error(apiError(err, "The employee could not be deactivated"));
        }
    };

    const exportPDF = async () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Employee Records Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDate(new Date())}`, 14, 22);
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
            headStyles: { fillColor: brandShade(600) },
        });
        await stampCompany(doc);
        doc.save(`EmployeeRecords_${todayIso()}.pdf`);
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
        XLSX.writeFile(wb, `EmployeeRecords_${todayIso()}.xlsx`);
        setShowExportMenu(false);
    };

    const safeEmployees = Array.isArray(employees) ? employees : [];

    const filtered = safeEmployees.filter(e => {
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

    const activeEmployees = safeEmployees.filter(e => e.active).length;

    const columns: ColumnDef<Employee>[] = [
        {
            key: "employeeCode",
            label: "Code",
            sortable: true,
            render: (row) => (
                <span className="text-xs font-mono font-medium text-gray-900 dark:text-gray-300">
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
                        <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-[#222222] flex items-center justify-center mr-3 shrink-0">
                            <span className="text-xs font-medium text-cyan-700 dark:text-gray-300">
                                {initials}
                            </span>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-900 dark:text-white">
                                {fullName}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
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
                <div className="space-y-1 max-w-[120px]">
                    <div className="flex items-center text-[10px] text-gray-600 dark:text-gray-400" title={row.officialEmail || ""}>
                        <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500 shrink-0" />
                        <span className="truncate">{row.officialEmail || "—"}</span>
                    </div>
                    <div className="flex items-center text-[10px] text-gray-600 dark:text-gray-400" title={row.phone || ""}>
                        <PhoneIcon className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500 shrink-0" />
                        <span className="truncate">{row.phone || "—"}</span>
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
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-transparent dark:text-gray-300 dark:border dark:border-transparent">
                    <BuildingOfficeIcon className="h-3 w-3 mr-1 shrink-0 text-blue-600 dark:text-gray-400" />
                    {row.department?.name || "—"}
                </span>
            )
        },
        {
            key: "active",
            label: "Status",
            sortable: true,
            render: (row) => row.active ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-transparent dark:text-gray-300 dark:border dark:border-transparent">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                    {t("Active")}
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-transparent dark:text-gray-400 dark:border dark:border-transparent">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5 shrink-0" />
                    {t("Inactive")}
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-36",
            className: "text-right w-36",
            render: (row) => (
                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => navigate(`/employee-view/${row.id}`)}
                        className={ROW_ICON_BUTTON}
                        title={t("View Details")}
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    {canUpdate && (<button
                        type="button"
                        onClick={() => navigate(`/addEmployee?editId=${row.id}`)}
                        className={ROW_ICON_BUTTON}
                        title={t("Edit")}
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>)}
                    {canDelete && (<button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className={ROW_ICON_BUTTON_DANGER}
                        title={t("Delete")}
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>)}
                </div>
            )
        }
    ];

    return (
        <>
            <PageMeta title={t("Employee Records")} description="Manage employee records and workforce" />
            <PageBreadcrumb
                pageTitle="Employee Records"
                actions={
                    <div className="flex items-center gap-2">
                        {/* Export Menu */}
                        <div ref={exportMenuRef} className="relative inline-flex items-center">
                            {canExport && (<button
                                type="button"
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className={TOOL_BUTTON}
                                title={t("Export")}
                            >
                                <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                                {t("Export")}
                            </button>)}

                            {showExportMenu && (
                                <div className="absolute right-0 top-9 w-40 bg-white dark:bg-[#191919] shadow-lg rounded-md border border-gray-200 dark:border-transparent z-50 py-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExportMenu(false);
                                            exportPDF();
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] cursor-pointer"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600 dark:text-gray-400" />
                                        {t("PDF")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExportMenu(false);
                                            exportEmployees();
                                        }}
                                        disabled={loading}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {loading ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                        ) : (
                                            <TableCellsIcon className="h-4 w-4 text-green-600 dark:text-gray-400" />
                                        )}
                                        {t(loading ? 'Exporting...' : 'Export Excel')}
                                    </button>
                                </div>
                            )}
                        </div>
                        <AddButton label={t("Add Employee")} onClick={() => navigate("/addEmployee")} />
                    </div>
                }
            />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label={t("Total Employees")} value={safeEmployees.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<UserGroupIcon className="h-6 w-6" />} />
                    <StatsCard label={t("Active Employees")} value={activeEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label={t("Departments")} value={(Array.isArray(departments) ? departments : []).length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
                    <StatsCard
                        label={t("Onboarded (30d)")}
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

                {/* Table */}
                <ReusableTable
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
                            <p className="text-gray-500 text-sm mb-2">{t("No employees found")}</p>
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

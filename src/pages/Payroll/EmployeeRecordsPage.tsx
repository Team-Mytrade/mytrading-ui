import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { createPdf } from "../../utils/pdfDocument";
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
    ChevronDownIcon,
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
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { InlineSelect, InlineText, OverlaySelect } from "./InlineEdit";
import { formatDate, formatMoney } from "../../company/format";

import { t } from "../../i18n/i18n";
import { stampCompany } from "../../company/pdfStamp";
import { brandShade } from "../../company/brand";
const EMPLOYEE_API_URL = "/v1/api/common/employee";
const DEPARTMENT_API_URL = "/v1/api/common/department";
const PAGE_SIZE = 10;

/**
 * Active / Inactive as a dropdown on the status badge (a draft is finished on the form instead). A native select, so
 * its list opens above the table's scroll area on every row. Deactivating still asks first.
 */
const StatusMenu: React.FC<{
    active: boolean;
    canActivate: boolean;
    canDeactivate: boolean;
    onActivate: () => void;
    onDeactivate: () => void;
}> = ({ active, canActivate, canDeactivate, onActivate, onDeactivate }) => {
    const badge = active
        ? "bg-green-100 text-green-800 dark:bg-transparent dark:text-gray-300"
        : "bg-gray-100 text-gray-800 dark:bg-transparent dark:text-gray-400";
    const dot = active ? "bg-emerald-500" : "bg-gray-500";
    const canChange = active ? canDeactivate : canActivate;
    if (!canChange) {
        return (
            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${dot}`} />
                {t(active ? "Active" : "Inactive")}
            </span>
        );
    }
    return (
        <OverlaySelect label={t("Change status")} value={active ? "ACTIVE" : "INACTIVE"}
            options={[{ value: "ACTIVE", label: t("Active") }, { value: "INACTIVE", label: t("Inactive") }]}
            onChange={(next) => (next === "ACTIVE" ? onActivate() : onDeactivate())}>
            <span className={`inline-flex items-center whitespace-nowrap px-2 py-1 text-xs font-medium rounded-full ${badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${dot}`} />
                {t(active ? "Active" : "Inactive")}
                <ChevronDownIcon className="ml-1 h-3 w-3 shrink-0" aria-hidden="true" />
            </span>
        </OverlaySelect>
    );
};

const EmployeeRecordsPage: React.FC = () => {
  const { canDelete, canExport, canUpdate, canApprove } = usePermissions();
    const navigate = useNavigate();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    // Yearly CTC by employee id, from payroll: only finance / HR (approve rights) may read salaries
    const [ctcByEmployee, setCtcByEmployee] = useState<Record<number, { ctc: number; currency?: string }>>({});
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
            const res = await axios.get(`${EMPLOYEE_API_URL}/all?includeInactive=true`);
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

    const fetchCtc = async () => {
        try {
            const res = await axios.get(`/v1/api/payroll/employee-salaries`);
            const rows: { employeeId?: number; ctc?: number; currency?: string }[] = Array.isArray(res.data) ? res.data : [];
            setCtcByEmployee(Object.fromEntries(rows
                .filter((r) => r.employeeId != null && r.ctc != null)
                .map((r) => [Number(r.employeeId), { ctc: Number(r.ctc), currency: r.currency }])));
        } catch {
            setCtcByEmployee({}); // the column shows "—" rather than stopping the page
        }
    };

    useEffect(() => {
        fetchEmployees();
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (canApprove) fetchCtc();
    }, [canApprove]);

    // A draft that won't be completed is removed for good, with any salary saved for it (it was never paid)
    const handleDeleteDraft = async (row: { id: number; firstName?: string; lastName?: string }) => {
        const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || t("this draft");
        const ok = await confirm({
            message: `Delete the draft of ${name}? It is removed for good and can't be brought back.`,
            confirmLabel: "Delete draft",
            variant: "danger",
        });
        if (!ok) return;
        try {
            try {
                await axios.delete(`/v1/api/payroll/employee-salaries/${row.id}`);
            } catch (err: any) {
                // No salary saved for the draft yet is fine; anything else stops the delete
                if (err?.response?.status !== 404) throw err;
            }
            await axios.delete(`${EMPLOYEE_API_URL}/draft/${row.id}`);
            ToasterService.success("Draft deleted");
            fetchEmployees();
        } catch (err: any) {
            ToasterService.error(apiError(err, "The draft could not be deleted"));
        }
    };

    // One field changed in the table; the row takes what the service saved
    const mergeEmployee = (id: number, saved: Partial<Employee> | undefined) => {
        if (!saved) return;
        setEmployees((prev) => prev.map((e) => e.id !== id ? e : {
            ...e,
            firstName: saved.firstName ?? e.firstName,
            lastName: saved.lastName ?? e.lastName,
            officialEmail: saved.officialEmail ?? "",
            phone: saved.phone ?? "",
            department: saved.department ?? e.department,
            active: saved.active ?? e.active,
        }));
    };
    const saveField = async (id: number, field: string, value: string) => {
        const { data } = await axios.put(`${EMPLOYEE_API_URL}/update/${id}/field`, { field, value });
        mergeEmployee(id, data);
    };
    const saveFields = async (id: number, changed: Record<string, string>) => {
        for (const [field, value] of Object.entries(changed)) await saveField(id, field, value);
        ToasterService.success("Saved");
    };

    const reactivate = async (id: number) => {
        try {
            const { data } = await axios.put(`${EMPLOYEE_API_URL}/reactivate/${id}`);
            mergeEmployee(id, data);
            ToasterService.success("Employee is active again", "Their login is switched back on.");
        } catch (err) {
            ToasterService.error(apiError(err, "The employee could not be made active"));
        }
    };

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
        const doc = await createPdf();
        doc.setFontSize(18);
        doc.text("Employee Records Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDate(new Date())}`, 14, 22);
        autoTable(doc, {
            head: [["Code", "Name", "Email", "Phone", "Department", "Designation", "Status"]],
            body: filtered.map(e => [
                e.employeeCode,
                `${e.firstName} ${e.lastName}`,
                e.officialEmail,
                e.phone,
                e.department?.name || "-",
                e.designation || "-",
                e.draft ? "Draft" : e.active ? "Active" : "Inactive"
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
        const ws = XLSX.utils.json_to_sheet(filtered.map(e => ({
            Code: e.employeeCode,
            Name: `${e.firstName} ${e.lastName}`,
            Email: e.officialEmail,
            Phone: e.phone,
            Department: e.department?.name || "-",
            Designation: e.designation || "-",
            Status: e.draft ? "Draft" : e.active ? "Active" : "Inactive",
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

    // The cards follow the department chosen ("" = all)
    const inDepartment = selectedDept ? safeEmployees.filter(e => e.department?.name === selectedDept) : safeEmployees;
    const activeEmployees = inDepartment.filter(e => e.active).length;
    // The company's departments, plus any an employee is in but the list doesn't have
    const departmentNames = Array.from(new Set([
        ...(Array.isArray(departments) ? departments : []).map(d => d.name).filter(Boolean),
        ...safeEmployees.map(e => e.department?.name).filter((n): n is string => Boolean(n)),
    ])).sort((a, b) => a.localeCompare(b));

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
                        <div className="min-w-0 flex-1">
                            <InlineText label={t("name")} canEdit={canUpdate && !row.draft}
                                parts={[
                                    { key: "firstName", value: row.firstName || "", placeholder: t("First name"), required: true },
                                    { key: "lastName", value: row.lastName || "", placeholder: t("Last name"), required: true },
                                ]}
                                onSave={(changed) => saveFields(row.id, changed)}>
                                <div className="text-xs font-medium text-gray-900 dark:text-white">
                                    {fullName}
                                </div>
                            </InlineText>
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
            minWidth: 260, // whole work e-mail addresses
            render: (row) => (
                <div className="space-y-1 max-w-full">
                    <InlineText label={t("email")} canEdit={canUpdate && !row.draft}
                        parts={[{ key: "officialEmail", value: row.officialEmail || "", placeholder: t("Official email"), type: "email" }]}
                        onSave={(changed) => saveFields(row.id, changed)}>
                        <div className="flex items-center text-[10px] text-gray-600 dark:text-gray-400" title={row.officialEmail || ""}>
                            <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span className="truncate">{row.officialEmail || "—"}</span>
                        </div>
                    </InlineText>
                    <InlineText label={t("phone")} canEdit={canUpdate && !row.draft}
                        parts={[{ key: "phone", value: row.phone || "", placeholder: t("Phone"), type: "tel" }]}
                        onSave={(changed) => saveFields(row.id, changed)}>
                        <div className="flex items-center text-[10px] text-gray-600 dark:text-gray-400" title={row.phone || ""}>
                            <PhoneIcon className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500 shrink-0" />
                            <span className="truncate">{row.phone || "—"}</span>
                        </div>
                    </InlineText>
                </div>
            )
        },
        {
            key: "department",
            label: "Department",
            sortable: true,
            sortValueGetter: (row) => row.department?.name || "",
            render: (row) => (
                <InlineSelect label={t("department")} canEdit={canUpdate && !row.draft}
                    value={row.department?.id != null ? String(row.department.id) : ""}
                    options={(Array.isArray(departments) ? departments : [])
                        .filter((d) => d.id != null && d.name)
                        .map((d) => ({ value: String(d.id), label: d.name }))
                        .sort((a, b) => a.label.localeCompare(b.label))}
                    onSave={async (value) => { await saveField(row.id, "departmentId", value); ToasterService.success("Department changed"); }}>
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-transparent dark:text-gray-300 dark:border dark:border-transparent">
                        <BuildingOfficeIcon className="h-3 w-3 mr-1 shrink-0 text-blue-600 dark:text-gray-400" />
                        {row.department?.name || "—"}
                    </span>
                </InlineSelect>
            )
        },
        // Salary is confidential: the column is there only for finance / HR
        ...(canApprove ? [{
            key: "ctc",
            label: "CTC (yearly)",
            sortable: true,
            minWidth: 130,
            // Left-aligned like the other columns, so the amount doesn't press against Status
            sortValueGetter: (row: Employee) => ctcByEmployee[row.id]?.ctc ?? -1,
            render: (row: Employee) => {
                const pay = ctcByEmployee[row.id];
                return pay ? (
                    <span className="text-xs font-medium tabular-nums text-gray-900 dark:text-gray-200">
                        {formatMoney(pay.ctc, { currency: pay.currency, whole: true })}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400" title={t("No salary set up yet")}>—</span>
                );
            },
        } as ColumnDef<Employee>] : []),
        {
            key: "active",
            label: "Status",
            sortable: true,
            render: (row) => row.draft ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-transparent dark:text-amber-300 dark:border dark:border-transparent"
                    title={t("Saved part-filled: open it to complete the details")}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
                    {t("Draft")}
                </span>
            ) : (
                <StatusMenu active={row.active}
                    canActivate={canUpdate} canDeactivate={canDelete}
                    onActivate={() => reactivate(row.id)} onDeactivate={() => handleDelete(row.id)} />
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
                    {/* Drafts are deleted for good; employees saved in full are only deactivated (their history stays) */}
                    {canDelete && row.draft && (<button
                        type="button"
                        onClick={() => handleDeleteDraft(row)}
                        className={ROW_ICON_BUTTON_DANGER}
                        title={t("Delete draft")}
                        aria-label={t("Delete draft")}
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
                        <ToolbarSelect aria-label={t("Department")} value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                            <option value="">{t("All departments")}</option>
                            {departmentNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </ToolbarSelect>
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
                    <StatsCard label={t("Total Employees")} value={inDepartment.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<UserGroupIcon className="h-6 w-6" />} />
                    <StatsCard label={t("Active Employees")} value={activeEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label={t("Departments")} value={(Array.isArray(departments) ? departments : []).length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
                    <StatsCard
                        label={t("Onboarded (30d)")}
                        value={inDepartment.filter(e => {
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

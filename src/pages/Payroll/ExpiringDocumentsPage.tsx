import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
    ExclamationTriangleIcon,
    ClockIcon,
    ClipboardDocumentCheckIcon,
    ShieldExclamationIcon,
    TableCellsIcon,
    Cog6ToothIcon,
    PlayIcon,
    CheckCircleIcon,
    PencilSquareIcon,
    FolderOpenIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { todayIso } from "../../utils/localDate";
import { formatDate } from "../../company/format";
import { t } from "../../i18n/i18n";
import { PAGE_BODY, ROW_ICON_BUTTON, STATS_ROW, TOOL_BUTTON, TOOL_INPUT } from "./hrmsUi";
import { expiryBadge, expiryText } from "./DocumentManagementPage";
import { EMPLOYEE_DOCUMENT_TYPES, documentTypeLabel } from "./documentTypes";

const API = "/v1/api/payroll/empdocuments";

interface ExpiringRow {
    // The document's id (the table's row key)
    id: number;
    document: {
        id: number;
        employeeId: number;
        employeeCode?: string;
        employeeName?: string;
        documentType: string;
        documentNumber?: string | null;
        issueDate?: string | null;
        expiryDate: string;
        daysToExpiry: number;
        hasFile?: boolean;
    };
    department?: string | null;
    managerName?: string | null;
    taskId?: number | null;
    taskStatus?: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED" | null;
    taskAssignedTo?: string | null;
    taskNote?: string | null;
}

interface AlertSettings {
    leadDays: number[];
    notifyManager: boolean;
    notifyEmployee: boolean;
    createRenewalTask: boolean;
}

// Days-left filter: how far ahead to show
const WINDOWS: { value: string; label: string }[] = [
    { value: "", label: "All (next 12 months)" },
    { value: "expired", label: "Expired" },
    { value: "7", label: "Within 7 days" },
    { value: "30", label: "Within 30 days" },
    { value: "60", label: "Within 60 days" },
    { value: "90", label: "Within 90 days" },
];

const TASK_LABEL: Record<string, string> = { OPEN: "Open", IN_PROGRESS: "In progress", DONE: "Done", CANCELLED: "Cancelled" };
const TASK_STYLE: Record<string, string> = {
    OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    IN_PROGRESS: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    DONE: "bg-green-100 text-green-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    CANCELLED: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300",
};

const FIELD = "mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 outline-none focus:border-cyan-500 focus:ring-cyan-500 dark:!border-transparent dark:bg-[#222222] dark:text-white";

/** HRMS → Expiring documents (HR-1): visas, IDs, permits and passports about to expire, with their renewal tasks. */
const ExpiringDocumentsPage: React.FC = () => {
    const { canUpdate, canExport } = usePermissions();
    const [rows, setRows] = useState<ExpiringRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState("");
    const [department, setDepartment] = useState("");
    const [windowFilter, setWindowFilter] = useState("");
    const [settings, setSettings] = useState<AlertSettings | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [leadText, setLeadText] = useState("");
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<ExpiringRow | null>(null);
    const [assignedTo, setAssignedTo] = useState("");
    const [note, setNote] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const [list, alertSettings] = await Promise.all([
                axios.get(`${API}/expiring`, { params: { withinDays: 365 } }),
                axios.get(`${API}/alert-settings`).catch(() => null),
            ]);
            setRows((Array.isArray(list.data) ? list.data : []).map((r: ExpiringRow) => ({ ...r, id: r.document.id })));
            if (alertSettings?.data) setSettings(alertSettings.data);
        } catch (err) {
            ToasterService.error(apiError(err, "Expiring documents could not be loaded"));
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const departments = useMemo(
        () => [...new Set(rows.map((r) => r.department).filter((d): d is string => Boolean(d)))].sort(),
        [rows],
    );

    const filtered = useMemo(() => rows.filter((r) => {
        const days = r.document.daysToExpiry;
        if (type && r.document.documentType !== type) return false;
        if (department && r.department !== department) return false;
        if (windowFilter === "expired") return days < 0;
        if (windowFilter) return days <= Number(windowFilter);
        return true;
    }), [rows, type, department, windowFilter]);

    const expired = rows.filter((r) => r.document.daysToExpiry < 0).length;
    const within7 = rows.filter((r) => r.document.daysToExpiry >= 0 && r.document.daysToExpiry <= 7).length;
    const within30 = rows.filter((r) => r.document.daysToExpiry >= 0 && r.document.daysToExpiry <= 30).length;
    const openTasks = rows.filter((r) => r.taskStatus === "OPEN" || r.taskStatus === "IN_PROGRESS").length;

    const updateTask = async (row: ExpiringRow, body: { status?: string; assignedTo?: string; note?: string }) => {
        if (!row.taskId) return;
        try {
            const { data } = await axios.put(`${API}/renewal-tasks/${row.taskId}`, body);
            setRows((prev) => prev.map((r) => (r.taskId === row.taskId
                ? { ...r, taskStatus: data.status, taskAssignedTo: data.assignedTo, taskNote: data.note } : r)));
            ToasterService.success(t("Renewal task updated"));
        } catch (err) {
            ToasterService.error(apiError(err, "The renewal task was not updated"));
        }
    };

    const openEditor = (row: ExpiringRow) => {
        setEditing(row);
        setAssignedTo(row.taskAssignedTo ?? "");
        setNote(row.taskNote ?? "");
    };

    const saveEditor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        await updateTask(editing, { assignedTo, note });
        setEditing(null);
    };

    const openSettings = () => {
        setLeadText((settings?.leadDays ?? [60, 30, 7]).join(", "));
        setSettingsOpen(true);
    };

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        const leadDays = leadText.split(/[,\s]+/).filter(Boolean).map(Number);
        if (leadDays.some((d) => !Number.isInteger(d))) {
            ToasterService.error(t("Enter whole numbers of days, separated by commas"));
            return;
        }
        setSaving(true);
        try {
            const { data } = await axios.put(`${API}/alert-settings`, { ...settings, leadDays });
            setSettings(data);
            setSettingsOpen(false);
            ToasterService.success(t("Reminder settings saved"));
        } catch (err) {
            ToasterService.error(apiError(err, "The reminder settings were not saved"));
        } finally {
            setSaving(false);
        }
    };

    const exportExcel = () => {
        const sheet = XLSX.utils.json_to_sheet(filtered.map((r) => ({
            [t("Employee")]: r.document.employeeName ?? "",
            [t("Employee Code")]: r.document.employeeCode ?? "",
            [t("Department")]: r.department ?? "",
            [t("Manager")]: r.managerName ?? "",
            [t("Document Type")]: documentTypeLabel(r.document.documentType),
            [t("Document number")]: r.document.documentNumber ?? "",
            [t("Issue date")]: r.document.issueDate ? formatDate(r.document.issueDate) : "",
            [t("Expiry date")]: formatDate(r.document.expiryDate),
            [t("Days left")]: r.document.daysToExpiry,
            [t("Renewal task")]: r.taskStatus ? t(TASK_LABEL[r.taskStatus]) : "",
            [t("Handled by")]: r.taskAssignedTo ?? "",
            [t("Note")]: r.taskNote ?? "",
        })));
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Expiring documents");
        XLSX.writeFile(book, `Expiring_Documents_${todayIso()}.xlsx`);
    };

    const columns: ColumnDef<ExpiringRow>[] = [
        {
            key: "employee",
            label: "Employee",
            sortable: true,
            sortValueGetter: (r) => r.document.employeeName ?? "",
            render: (r) => (
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{r.document.employeeName || `${t("Employee")} ${r.document.employeeId}`}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{[r.document.employeeCode, r.department].filter(Boolean).join(" · ")}</span>
                </div>
            ),
        },
        {
            key: "documentType",
            label: "Document",
            sortable: true,
            sortValueGetter: (r) => documentTypeLabel(r.document.documentType),
            render: (r) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{documentTypeLabel(r.document.documentType)}</span>
                    {r.document.documentNumber && <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{r.document.documentNumber}</span>}
                </div>
            ),
        },
        {
            key: "expiryDate",
            label: "Expires",
            sortable: true,
            sortValueGetter: (r) => r.document.daysToExpiry,
            render: (r) => (
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs ${r.document.daysToExpiry < 0 ? "font-semibold text-red-700 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}>{formatDate(r.document.expiryDate)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${expiryBadge(r.document.daysToExpiry)}`}>{expiryText(r.document.daysToExpiry)}</span>
                </div>
            ),
        },
        {
            key: "managerName",
            label: "Manager",
            render: (r) => <span className="text-xs text-gray-600 dark:text-gray-400">{r.managerName || "-"}</span>,
        },
        {
            key: "taskStatus",
            label: "Renewal task",
            sortable: true,
            render: (r) => r.taskStatus ? (
                <div className="flex flex-col gap-0.5">
                    <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${TASK_STYLE[r.taskStatus]}`}>{t(TASK_LABEL[r.taskStatus])}</span>
                    {r.taskAssignedTo && <span className="text-[11px] text-gray-500 dark:text-gray-400">{r.taskAssignedTo}</span>}
                    {r.taskNote && <span className="line-clamp-1 text-[11px] text-gray-400" title={r.taskNote}>{r.taskNote}</span>}
                </div>
            ) : <span className="text-xs text-gray-400">{t("Not yet")}</span>,
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-36",
            className: "text-right w-36",
            render: (r) => {
                const open = r.taskStatus === "OPEN" || r.taskStatus === "IN_PROGRESS";
                return (
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {canUpdate && r.taskStatus === "OPEN" && (
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Start renewal")} onClick={() => updateTask(r, { status: "IN_PROGRESS" })}>
                                <PlayIcon className="h-4 w-4" />
                            </button>
                        )}
                        {canUpdate && open && (
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Mark renewed")} onClick={() => updateTask(r, { status: "DONE" })}>
                                <CheckCircleIcon className="h-4 w-4" />
                            </button>
                        )}
                        {canUpdate && r.taskId && (
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Who handles it and a note")} onClick={() => openEditor(r)}>
                                <PencilSquareIcon className="h-4 w-4" />
                            </button>
                        )}
                        <Link to={`/employees/${r.document.employeeId}/documents`} className={ROW_ICON_BUTTON} title={t("Employee's documents (upload the renewed one)")}>
                            <FolderOpenIcon className="h-4 w-4" />
                        </Link>
                    </div>
                );
            },
        },
    ];

    return (
        <>
            <PageMeta title={t("Expiring Documents")} description="Employee visas, IDs, permits and passports about to expire" />
            <PageBreadcrumb
                pageTitle="Expiring Documents"
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <select aria-label={t("Document Type")} className={TOOL_INPUT} value={type} onChange={(e) => setType(e.target.value)}>
                            <option value="">{t("All types")}</option>
                            {EMPLOYEE_DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{t(d.label)}</option>)}
                        </select>
                        <select aria-label={t("Department")} className={TOOL_INPUT} value={department} onChange={(e) => setDepartment(e.target.value)}>
                            <option value="">{t("All departments")}</option>
                            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select aria-label={t("Days left")} className={TOOL_INPUT} value={windowFilter} onChange={(e) => setWindowFilter(e.target.value)}>
                            {WINDOWS.map((w) => <option key={w.value} value={w.value}>{t(w.label)}</option>)}
                        </select>
                        {canExport && (
                            <button type="button" className={TOOL_BUTTON} onClick={exportExcel} disabled={filtered.length === 0}>
                                <TableCellsIcon className="h-3.5 w-3.5" />
                                {t("Export Excel")}
                            </button>
                        )}
                        {canUpdate && settings && (
                            <button type="button" className={TOOL_BUTTON} onClick={openSettings}>
                                <Cog6ToothIcon className="h-3.5 w-3.5" />
                                {t("Reminder settings")}
                            </button>
                        )}
                    </div>
                }
            />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label={t("Expired")} value={expired} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" icon={<ShieldExclamationIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Expiring in 7 days")} value={within7} gradient="from-orange-50 to-amber-50" borderColor="border-orange-100" labelColor="text-orange-600" icon={<ExclamationTriangleIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Expiring in 30 days")} value={within30} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Open renewal tasks")} value={openTasks} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />} onRefresh={load} />
                </div>

                {settings && (
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                        {t("Reminders go")} {settings.leadDays.join(", ")} {t("days before expiry and on the day it expires, to HR")}
                        {settings.notifyManager ? `, ${t("the employee's manager")}` : ""}
                        {settings.notifyEmployee ? `, ${t("the employee")}` : ""}.
                    </p>
                )}

                <ReusableTable
                    data={filtered}
                    columns={columns}
                    loading={loading}
                    searchable={false}
                    pageSize={10}
                    defaultSortKey="expiryDate"
                    defaultSortOrder="asc"
                    emptyState={
                        <div className="flex flex-col items-center">
                            <CheckCircleIcon className="mb-3 h-12 w-12 text-emerald-400" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t("No documents expire in this period")}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{t("Add expiry dates on HRMS → Documents so they show here")}</p>
                        </div>
                    }
                />

                <PaginatedPopup
                    isOpen={settingsOpen}
                    title={t("Reminder settings")}
                    onClose={() => setSettingsOpen(false)}
                    onSubmit={saveSettings}
                    submitLabel={t(saving ? "Saving..." : "Save")}
                    cancelLabel={t("Cancel")}
                    submitting={saving}
                    maxWidthClassName="max-w-lg dark:!border-transparent"
                    fields={settings ? [
                        <div key="lead" className="col-span-2">
                            <label htmlFor="lead-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("Days before expiry")}</label>
                            <input id="lead-days" className={FIELD} value={leadText} onChange={(e) => setLeadText(e.target.value)} placeholder="60, 30, 7" />
                            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{t("Up to 6 reminders, each 1 to 365 days before; one more goes on the day it expires.")}</p>
                        </div>,
                        <label key="manager" className="col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={settings.notifyManager} onChange={(e) => setSettings({ ...settings, notifyManager: e.target.checked })} />
                            {t("Remind the employee's manager")}
                        </label>,
                        <label key="employee" className="col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={settings.notifyEmployee} onChange={(e) => setSettings({ ...settings, notifyEmployee: e.target.checked })} />
                            {t("Remind the employee (self-service)")}
                        </label>,
                        <label key="task" className="col-span-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={settings.createRenewalTask} onChange={(e) => setSettings({ ...settings, createRenewalTask: e.target.checked })} />
                            {t("Open a renewal task with the first reminder")}
                        </label>,
                    ] : []}
                />

                <PaginatedPopup
                    isOpen={editing !== null}
                    title={t("Renewal task")}
                    subtitle={editing ? `${documentTypeLabel(editing.document.documentType)} · ${editing.document.employeeName ?? ""}` : undefined}
                    onClose={() => setEditing(null)}
                    onSubmit={saveEditor}
                    submitLabel={t("Save")}
                    cancelLabel={t("Cancel")}
                    maxWidthClassName="max-w-lg dark:!border-transparent"
                    fields={[
                        <div key="assigned" className="col-span-2">
                            <label htmlFor="task-assigned" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("Handled by")}</label>
                            <input id="task-assigned" className={FIELD} maxLength={120} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder={t("e.g. PRO, typing centre")} />
                        </div>,
                        <div key="note" className="col-span-2">
                            <label htmlFor="task-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("Note")}</label>
                            <textarea id="task-note" rows={3} className={FIELD} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                        </div>,
                    ]}
                />
            </div>
        </>
    );
};

export default ExpiringDocumentsPage;

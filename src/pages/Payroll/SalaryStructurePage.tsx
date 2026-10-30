import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
    PencilSquareIcon,
    TrashIcon,
    BuildingOfficeIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    CurrencyDollarIcon,
    BanknotesIcon,
    CalendarIcon,
    DocumentTextIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { PAGE_BODY, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, STATS_ROW, TOOL_BUTTON } from "./hrmsUi";
import { formatMoney, formatNumber, formatDate } from "../../company/format";

import { t } from "../../i18n/i18n";
import { stampCompany } from "../../company/pdfStamp";
import { brandShade } from "../../company/brand";
// Amounts are YEARLY, as payroll stores them; a month pays one twelfth
type SalaryStructure = {
    id: number;
    employeeId: string;
    employeeName?: string;
    basic: number;
    hra: number;
    allowances: number;
    totalDeductions: number;
    netSalary: number;
    ctc: number;
    effectiveFrom: string;
};

type EmployeeOption = { id: number; employeeCode?: string; firstName?: string; lastName?: string };

const API_URL = "/v1/api/payroll/salary-structures";
const EMPLOYEE_API_URL = "/v1/api/payroll/employee/all";
const PAGE_SIZE = 10;

const emptyForm = { employeeId: '', basic: 0, hra: 0, allowances: 0, ctc: 0, effectiveFrom: todayIso() };

const rupees = (value: number) => formatMoney(Math.round(value || 0));
const lakhs = (value: number) => formatMoney(value || 0, { compact: true });

const SalaryStructurePage: React.FC = () => {
  const { canDelete, canExport, canUpdate } = usePermissions();
    const [data, setData] = useState<SalaryStructure[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        fetchAll();
        axios.get(EMPLOYEE_API_URL)
            .then(res => setEmployees(Array.isArray(res.data) ? res.data : []))
            .catch(() => setEmployees([]));
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setData(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            ToasterService.error(apiError(err, "Failed to load salary structures"));
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'employeeId' || name === 'effectiveFrom') {
            setForm(prev => ({ ...prev, [name]: value }));
            return;
        }
        const raw = String(value).replace(/^0+(?=\d)/, "");
        const num = raw === "" ? 0 : Number(raw);
        setForm(prev => {
            const next = { ...prev, [name]: isNaN(num) ? 0 : num };
            // CTC follows the components until it is typed in (it may include employer contributions)
            const prevSum = prev.basic + prev.hra + prev.allowances;
            if (name !== 'ctc' && (prev.ctc === 0 || prev.ctc === prevSum)) {
                next.ctc = next.basic + next.hra + next.allowances;
            }
            return next;
        });
    };

    const gross = form.basic + form.hra + form.allowances;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.employeeId) {
            ToasterService.error("Choose the employee");
            return;
        }
        if (form.basic <= 0) {
            ToasterService.error("Enter the yearly basic salary");
            return;
        }
        if (form.ctc < gross) {
            ToasterService.error("The yearly CTC can't be less than the components");
            return;
        }
        const payload = { ...form, totalDeductions: 0 };
        setSaving(true);
        try {
            if (editingId !== null) {
                await axios.put(`${API_URL}/${editingId}`, payload);
                ToasterService.success("Salary structure updated");
            } else {
                await axios.post(API_URL, payload);
                ToasterService.success("Salary structure saved");
            }
            await fetchAll();
            closeForm();
        } catch (err) {
            ToasterService.error(apiError(err, "Save failed"));
        } finally {
            setSaving(false);
        }
    };

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, effectiveFrom: todayIso() });
        setShowForm(true);
    };

    const openEdit = (record: SalaryStructure) => {
        setForm({
            employeeId: record.employeeId,
            basic: record.basic,
            hra: record.hra,
            allowances: record.allowances,
            ctc: record.ctc,
            effectiveFrom: record.effectiveFrom || todayIso(),
        });
        setEditingId(record.id);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...emptyForm, effectiveFrom: todayIso() });
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
            ToasterService.success("Salary structure deleted");
            await fetchAll();
        } catch (err) {
            ToasterService.error(apiError(err, "Delete failed"));
        }
    };

    const label = (s: SalaryStructure) => s.employeeName || `Employee ${s.employeeId}`;

    const exportPDF = async (record: SalaryStructure) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(31, 41, 55);
        doc.text("Compensation Schedule", 14, 20);
        doc.setFontSize(10);
        doc.text(`Employee: ${label(record)}`, 14, 28);
        doc.text(`Effective From: ${record.effectiveFrom ? formatDate(record.effectiveFrom) : "-"}`, 14, 34);
        doc.text(`Generated: ${formatDate(new Date())}`, 14, 40);

        const monthly = (value: number) => formatNumber(Math.round((value || 0) / 12));
        autoTable(doc, {
            head: [['Component', 'Monthly Value (INR)', 'Annual Value (INR)']],
            body: [
                ['Basic Salary', monthly(record.basic), formatNumber(record.basic)],
                ['House Rent Allowance (HRA)', monthly(record.hra), formatNumber(record.hra)],
                ['Other Allowances', monthly(record.allowances), formatNumber(record.allowances)],
                ['Gross Earnings', monthly(record.netSalary), formatNumber(record.netSalary)],
                ['Annual CTC', '', formatNumber(record.ctc)],
            ],
            startY: 50,
            theme: 'striped',
            headStyles: { fillColor: brandShade(600) },
            styles: { fontSize: 10 },
        });
        await stampCompany(doc);
        doc.save(`Salary_Structure_${record.employeeId}_${todayIso()}.pdf`);
    };

    const exportAllPDF = async () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(31, 41, 55);
        doc.text("Salary Structures Report (yearly amounts)", 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDate(new Date())}`, 14, 28);
        doc.text(`Total Records: ${data.length}`, 14, 34);

        autoTable(doc, {
            head: [['Employee', 'Basic', 'HRA', 'Allowances', 'Gross', 'CTC', 'Effective From']],
            body: data.map(s => [
                label(s),
                formatNumber(s.basic),
                formatNumber(s.hra),
                formatNumber(s.allowances),
                formatNumber(s.netSalary),
                formatNumber(s.ctc),
                s.effectiveFrom ? formatDate(s.effectiveFrom) : "-",
            ]),
            startY: 45,
            styles: { fontSize: 8 },
            headStyles: { fillColor: brandShade(600) },
        });
        await stampCompany(doc);
        doc.save(`All_Salary_Structures_${todayIso()}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(data.map(s => ({
            'Employee': label(s),
            'Employee ID': s.employeeId,
            'Basic (yearly)': s.basic,
            'HRA (yearly)': s.hra,
            'Other Allowances (yearly)': s.allowances,
            'Gross (yearly)': s.netSalary,
            'Annual CTC': s.ctc,
            'Effective From': s.effectiveFrom ? formatDate(s.effectiveFrom) : "",
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Salary Structures');
        XLSX.writeFile(workbook, `Salary_Structures_${todayIso()}.xlsx`);
        setShowExportMenu(false);
    };

    const employeeOptions = useMemo(() => employees.map(e => ({
        id: String(e.id),
        name: `${`${e.firstName || ''} ${e.lastName || ''}`.trim() || `Employee ${e.id}`}${e.employeeCode ? ` (${e.employeeCode})` : ''}`,
    })), [employees]);

    const columns: ColumnDef<SalaryStructure>[] = [
        {
            key: "employeeName",
            label: "Employee",
            sortable: true,
            sortValueGetter: (row) => label(row),
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-50 text-xs font-medium text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                        {label(row).charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label(row)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{t("ID: #")}{row.employeeId}</p>
                    </div>
                </div>
            )
        },
        {
            key: "basic",
            label: "Basic (yearly)",
            sortable: true,
            render: (row) => <span className="text-sm text-slate-700 dark:text-slate-300">{rupees(row.basic)}</span>
        },
        {
            key: "hra",
            label: "HRA",
            sortable: true,
            render: (row) => <span className="text-sm text-slate-700 dark:text-slate-300">{rupees(row.hra)}</span>
        },
        {
            key: "allowances",
            label: "Allowances",
            sortable: true,
            render: (row) => <span className="text-sm text-slate-700 dark:text-slate-300">{rupees(row.allowances)}</span>
        },
        {
            key: "netSalary",
            label: "Gross (yearly)",
            sortable: true,
            render: (row) => (
                <div>
                    <p className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">{rupees(row.netSalary)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{rupees(row.netSalary / 12)} / month</p>
                </div>
            )
        },
        {
            key: "ctc",
            label: "Annual CTC",
            sortable: true,
            render: (row) => <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{lakhs(row.ctc)}</span>
        },
        {
            key: "effectiveFrom",
            label: "Effective From",
            sortable: true,
            render: (row) => (
                <span className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                    {row.effectiveFrom ? formatDate(row.effectiveFrom) : "-"}
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right",
            className: "text-right",
            render: (row) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {canExport && (
                        <button type="button" onClick={() => exportPDF(row)} className={ROW_ICON_BUTTON} title={t("Export PDF")}>
                            <DocumentArrowDownIcon className="h-4 w-4" />
                        </button>
                    )}
                    {canUpdate && (
                        <button type="button" onClick={() => openEdit(row)} className={ROW_ICON_BUTTON} title={t("Edit")}>
                            <PencilSquareIcon className="h-4 w-4" />
                        </button>
                    )}
                    {canDelete && (
                        <button type="button" onClick={() => handleDelete(row.id)} className={ROW_ICON_BUTTON_DANGER} title={t("Delete")}>
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    // Calculate stats from real data
    const totalCTC = data.reduce((sum, s) => sum + s.ctc, 0);
    const avgBasic = data.length > 0 ? data.reduce((sum, s) => sum + s.basic, 0) / data.length : 0;
    const avgGross = data.length > 0 ? data.reduce((sum, s) => sum + s.netSalary, 0) / data.length : 0;

    return (
        <>
            <PageMeta title={t("Salary Structures")} description="Manage employee salary structures and compensation" />
            <PageBreadcrumb
                pageTitle="Salary Structures"
                actions={
                    <div className="flex items-center gap-2">
                        {canExport && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className={TOOL_BUTTON}
                                    disabled={data.length === 0}
                                >
                                    <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                                    {t("Export")}
                                </button>
                                {showExportMenu && (
                                    <div className="absolute right-0 top-9 z-50 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-transparent dark:bg-[#191919]">
                                        <button
                                            type="button"
                                            onClick={exportAllPDF}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-[#222222]"
                                        >
                                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                            {t("All Records (PDF)")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={exportExcel}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-[#222222]"
                                        >
                                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                                            {t("Export to Excel")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <AddButton label={t("Add Structure")} onClick={openCreate} />
                    </div>
                }
            />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label={t("Total Structures")} value={data.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Total CTC Value")} value={lakhs(totalCTC)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<ChartBarIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Avg Basic (yearly)")} value={rupees(avgBasic)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<CurrencyDollarIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Avg Gross / Month")} value={rupees(avgGross / 12)} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-5 w-5" />} />
                </div>

                <ReusableTable
                    data={data}
                    columns={columns}
                    loading={loading}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="effectiveFrom"
                    defaultSortOrder="desc"
                    emptyState={
                        <div className="flex flex-col items-center justify-center py-12">
                            <BuildingOfficeIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                            <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">{t("No salary structures found")}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">Click "Add Structure" to create one</p>
                        </div>
                    }
                />
            </div>

            <PaginatedPopup
                isOpen={showForm}
                title={t(editingId ? "Edit Salary Structure" : "Add Salary Structure")}
                subtitle={t("Yearly amounts; payroll pays one twelfth each month")}
                onClose={closeForm}
                onSubmit={handleSubmit}
                submitting={saving}
                submitLabel={t(editingId ? "Update Structure" : "Save Structure")}
                maxWidthClassName="max-w-2xl"
                tabs={[
                    {
                        label: "Salary Details",
                        fields: [
                            <FloatingSelect
                                key="employeeId"
                                label={t("Employee")}
                                name="employeeId"
                                value={form.employeeId}
                                onChange={handleChange}
                                options={employeeOptions}
                                disabled={editingId !== null}
                                required
                            />,
                            <FloatingInput key="effectiveFrom" label={t("Effective From")} name="effectiveFrom" type="date" value={form.effectiveFrom} onChange={handleChange} required />,
                            <FloatingInput key="basic" label={t("Basic (yearly)")} name="basic" type="number" min={0} value={form.basic === 0 ? "" : form.basic} onChange={handleChange} required />,
                            <FloatingInput key="hra" label={t("HRA (yearly)")} name="hra" type="number" min={0} value={form.hra === 0 ? "" : form.hra} onChange={handleChange} />,
                            <FloatingInput key="allowances" label={t("Other Allowances (yearly)")} name="allowances" type="number" min={0} value={form.allowances === 0 ? "" : form.allowances} onChange={handleChange} />,
                            <FloatingInput key="ctc" label={t("Annual CTC")} name="ctc" type="number" min={0} value={form.ctc === 0 ? "" : form.ctc} onChange={handleChange} required />,
                            <div key="preview" className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-gray-700 dark:bg-[#222222]">
                                <div className="flex justify-between text-slate-600 dark:text-gray-400">
                                    <span>{t("Gross per year")}</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{rupees(gross)}</span>
                                </div>
                                <div className="mt-1 flex justify-between text-slate-600 dark:text-gray-400">
                                    <span>{t("Gross per month")}</span>
                                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">{rupees(gross / 12)}</span>
                                </div>
                            </div>,
                        ],
                    },
                ]}
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
        </>
    );
};

export default SalaryStructurePage;

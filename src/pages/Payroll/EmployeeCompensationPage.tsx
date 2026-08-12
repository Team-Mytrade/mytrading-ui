import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
    TrashIcon,
    PencilSquareIcon,
    CheckIcon,
    XMarkIcon,
    BriefcaseIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    ArrowLeftIcon,
    InformationCircleIcon,
    PlusIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// API endpoints
const COMPENSATION_API_URL = "/v1/api/payroll/employee";

// Types
interface ComponentDetail {
    [key: string]: number;
}

interface CompensationItem {
    employeeRole: string;
    componentDetails: ComponentDetail;
    isDefaultComponent?: boolean;
}

interface CompensationPayload {
    components: CompensationItem[];
}

interface CompensationFormData {
    employeeRole: string;
    components: { name: string; percentage: number }[];
    isDefaultComponent: boolean;
}

const EmployeeCompensationPage: React.FC = () => {
    const [compensations, setCompensations] = useState<CompensationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingRole, setEditingRole] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState<(() => void) | null>(null);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    // Form state
    const [formData, setFormData] = useState<CompensationFormData>({
        employeeRole: "",
        components: [{ name: "", percentage: 0 }],
        isDefaultComponent: false,
    });

    // Fetch compensations
    const fetchCompensations = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${COMPENSATION_API_URL}/getPayroleComponents`);
            let data = res.data;
            if (data.components && Array.isArray(data.components)) {
                setCompensations(data.components);
            } else if (Array.isArray(data)) {
                setCompensations(data);
            } else {
                setCompensations([]);
            }
        } catch (err) {
            console.error("Error loading compensations:", err);
            ToasterService.error("Failed to load compensations");
            setCompensations([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompensations();
    }, []);

    // Handle form input changes
    const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, employeeRole: e.target.value });
    };

    const handleComponentChange = (index: number, field: "name" | "percentage", value: string | number) => {
        const updatedComponents = [...formData.components];
        if (field === "name") {
            updatedComponents[index].name = value as string;
        } else {
            updatedComponents[index].percentage = Number(value);
        }
        setFormData({ ...formData, components: updatedComponents });
    };

    const handleToggleChange = () => {
        setFormData({ ...formData, isDefaultComponent: !formData.isDefaultComponent });
    };

    // Add component with validation
    const addComponent = () => {
        const lastComponent = formData.components[formData.components.length - 1];

        if (!lastComponent.name.trim()) {
            ToasterService.error("Please fill the current component name before adding a new one");
            return;
        }

        if (lastComponent.percentage <= 0 || lastComponent.percentage > 100) {
            ToasterService.error("Please enter a valid percentage (1-100) for the current component");
            return;
        }

        setFormData({
            ...formData,
            components: [...formData.components, { name: "", percentage: 0 }],
        });
    };

    const removeComponent = (index: number) => {
        if (formData.components.length === 1) {
            ToasterService.warning("At least one component is required");
            return;
        }
        const updatedComponents = formData.components.filter((_, i) => i !== index);
        setFormData({ ...formData, components: updatedComponents });
    };

    const resetForm = () => {
        setFormData({
            employeeRole: "",
            components: [{ name: "", percentage: 0 }],
            isDefaultComponent: false,
        });
        setEditingRole(null);
        setShowForm(false);
        setShowDisclaimerModal(false);
        setPendingSubmit(null);
    };

    // Show disclaimer when toggle is ON
    const showDisclaimer = (submitCallback: () => void) => {
        if (formData.isDefaultComponent) {
            setPendingSubmit(() => submitCallback);
            setShowDisclaimerModal(true);
        } else {
            submitCallback();
        }
    };

    // Actual submit logic
    const performSubmit = async () => {
        if (!formData.employeeRole.trim()) {
            ToasterService.error("Please enter employee role");
            return;
        }

        const emptyComponent = formData.components.find((c) => !c.name.trim());
        if (emptyComponent) {
            ToasterService.error("Please fill all component names");
            return;
        }

        const invalidComponent = formData.components.find(
            (c) => c.percentage <= 0 || c.percentage > 100
        );
        if (invalidComponent) {
            ToasterService.error("Please enter valid percentages (1-100) for all components");
            return;
        }

        // Build payload
        const componentDetails: ComponentDetail = {};
        formData.components.forEach((c) => {
            componentDetails[c.name] = c.percentage;
        });

        const payload: CompensationPayload = {
            components: [{
                employeeRole: formData.employeeRole,
                componentDetails: componentDetails,
                // isDefaultComponent: formData.isDefaultComponent,
            }]
        };

        try {
            if (editingRole) {
                await axios.put(`${COMPENSATION_API_URL}/update/payroleComponent`, payload);
                ToasterService.success("Compensation updated successfully");
            } else {
                await axios.post(`${COMPENSATION_API_URL}/create/payroleComponents`, payload);
                ToasterService.success("Compensation created successfully");
            }
            fetchCompensations();
            resetForm();
        } catch (err: any) {
            console.error("Error saving compensation:", err);
            ToasterService.error(err.response?.data?.message || "Operation failed");
        }
    };

    const handleSubmit = () => {
        showDisclaimer(performSubmit);
    };

    // Edit compensation
    const handleEdit = (compensationItem: CompensationItem) => {
        const components = Object.entries(compensationItem.componentDetails || {}).map(
            ([name, percentage]) => ({ name, percentage })
        );
        setFormData({
            employeeRole: compensationItem.employeeRole,
            components: components.length ? components : [{ name: "", percentage: 0 }],
            isDefaultComponent: compensationItem.isDefaultComponent || false,
        });
        setEditingRole(compensationItem.employeeRole);
        setShowForm(true);
    };

    // Delete compensation
    const handleDelete = async (role: string) => {
        const ok = await confirm({
            message: `Delete compensation configuration for "${role}"? This action cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;
        try {
            await axios.delete(`${COMPENSATION_API_URL}/delete/payroleComponent/${encodeURIComponent(role)}`);
            ToasterService.success("Compensation deleted successfully");
            fetchCompensations();
        } catch (err: any) {
            console.error("Error deleting compensation:", err);
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    // Export to PDF
    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Employee Compensation Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

        const tableData = compensations.flatMap((compItem) => {
            const components = compItem.componentDetails || {};
            return Object.entries(components).map(([compName, percentage]) => [
                compItem.employeeRole,
                compName,
                `${percentage}%`,
                compItem.isDefaultComponent ? "Yes" : "No",
            ]);
        });

        if (tableData.length === 0) {
            doc.text("No data available", 14, 40);
        } else {
            autoTable(doc, {
                head: [["Employee Role", "Component", "Percentage", "Is Default"]],
                body: tableData,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] },
            });
        }
        doc.save(`CompensationReport_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    // Export to Excel
    const exportExcel = () => {
        const excelData = compensations.flatMap((compItem) => {
            const components = compItem.componentDetails || {};
            return Object.entries(components).map(([compName, percentage]) => ({
                "Employee Role": compItem.employeeRole,
                Component: compName,
                Percentage: `${percentage}%`,
                "Is Default Component": compItem.isDefaultComponent ? "Yes" : "No",
            }));
        });
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Compensations");
        XLSX.writeFile(wb, `CompensationReport_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const totalRoles = compensations.length;
    const totalComponents = compensations.reduce((sum, item) => sum + Object.keys(item.componentDetails || {}).length, 0);
    const defaultConfigurations = compensations.filter(item => item.isDefaultComponent).length;
    const averageComponentsPerRole = totalRoles > 0 ? (totalComponents / totalRoles).toFixed(1) : "0.0";

    const tableData = useMemo(() => {
        return compensations.map((item, index) => {
            const components = item.componentDetails || {};
            const total = Object.values(components).reduce((sum, val) => sum + val, 0);
            return {
                id: item.employeeRole || `role-${index}`,
                employeeRole: item.employeeRole,
                componentDetails: components,
                total,
                isDefaultComponent: item.isDefaultComponent || false,
                rawItem: item,
            };
        });
    }, [compensations]);

    const columns: ColumnDef<any>[] = [
        {
            key: "employeeRole",
            label: "Employee Role",
            sortable: true,
            render: (row) => (
                <div className="flex items-center gap-2">
                    <BriefcaseIcon className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-gray-900">{row.employeeRole}</span>
                        {row.isDefaultComponent && (
                            <span className="ml-2 text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">
                                Default
                            </span>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: "componentDetails",
            label: "Components Breakdown",
            render: (row) => {
                const entries = Object.entries(row.componentDetails || {});
                if (entries.length === 0) return <span className="text-gray-400 text-xs">No components</span>;
                return (
                    <div className="flex flex-wrap gap-1.5 py-1">
                        {entries.map(([name, pct]) => (
                            <span key={name} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-800 border border-gray-200 shadow-2xsm">
                                <span className="font-semibold text-gray-600 mr-1">{name}:</span> {pct as number}%
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            key: "total",
            label: "Total %",
            sortable: true,
            render: (row) => (
                <span className="font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full text-xs border border-cyan-100">
                    {row.total}%
                </span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right",
            className: "text-right",
            render: (row) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => handleEdit(row.rawItem)}
                        className="p-1.5 text-gray-500 hover:text-cyan-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(row.employeeRole)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Employee Compensations" description="Configure compensation components by role" />
            <PageBreadcrumb pageTitle="Compensation Configuration" />

            <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
                {!showForm && (
                    <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                        <AddButton
                            label="Add Role Compensation"
                            onClick={() => {
                                resetForm();
                                setShowForm(true);
                            }}
                        />
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Roles Configured" value={totalRoles} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<BriefcaseIcon className="h-6 w-6" />} />
                    <StatsCard label="Components Mapped" value={totalComponents} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckIcon className="h-6 w-6" />} />
                    <StatsCard label="Default Configs" value={defaultConfigurations} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<InformationCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Avg Components / Role" value={averageComponentsPerRole} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BriefcaseIcon className="h-6 w-6" />} />
                </div>

                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="w-full sm:w-auto">
                        <h2 className="text-lg font-semibold text-gray-900">Compensation Configuration</h2>
                        <p className="text-sm text-gray-500">Define percentage-based compensation components for each employee role</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!showForm && (
                            <div className="relative flex h-10 items-center">
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className="h-10 w-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                                    disabled={compensations.length === 0}
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
                                            onClick={exportExcel}
                                            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                        >
                                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                                            Excel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div className="mb-8 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button
                                    onClick={resetForm}
                                    className="text-gray-500 hover:text-gray-700 sm:hidden"
                                >
                                    <ArrowLeftIcon className="h-5 w-5" />
                                </button>
                                <h3 className="text-md font-medium text-gray-900">
                                    {editingRole ? `Edit Compensation: ${editingRole}` : "Configure New Role Compensation"}
                                </h3>
                            </div>
                            <button
                                onClick={resetForm}
                                className="hidden sm:block text-gray-400 hover:text-gray-600"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6">
                            {/* Role Input */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Employee Role <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.employeeRole}
                                    onChange={handleRoleChange}
                                    placeholder="e.g., Senior Software Engineer, Technical Lead, Lead Architect"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    disabled={!!editingRole}
                                />
                                <p className="text-xs text-gray-500 mt-1">Enter the employee role name</p>
                            </div>

                            {/* Components Table */}
                            <div className="mb-6">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Compensation Components
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addComponent}
                                        className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Add Component
                                    </button>
                                </div>

                                <div className="hidden md:block overflow-x-auto">
                                    <table className="min-w-full border border-gray-200 rounded-lg">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Component Name
                                                </th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Percentage (%)
                                                </th>
                                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {formData.components.map((comp, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="text"
                                                            value={comp.name}
                                                            onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                                                            placeholder="e.g., Basic, HRA, Special Allowances"
                                                            className="w-full px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-cyan-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <input
                                                            type="number"
                                                            value={comp.percentage}
                                                            onChange={(e) => handleComponentChange(idx, "percentage", e.target.value)}
                                                            placeholder="0"
                                                            min="0"
                                                            max="100"
                                                            step="1"
                                                            className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-cyan-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeComponent(idx)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50">
                                            <tr>
                                                <td colSpan={2} className="px-4 py-2 text-right text-sm font-medium text-gray-700">
                                                    Total:
                                                </td>
                                                <td className="px-4 py-2 text-center text-sm font-semibold">
                                                    {formData.components.reduce((sum, c) => sum + c.percentage, 0)}%
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="md:hidden space-y-4">
                                    {formData.components.map((comp, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-xs font-medium text-gray-500">Component #{idx + 1}</span>
                                                <button
                                                    onClick={() => removeComponent(idx)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Component Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={comp.name}
                                                        onChange={(e) => handleComponentChange(idx, "name", e.target.value)}
                                                        placeholder="e.g., Basic, HRA, Special Allowances"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-cyan-500 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Percentage (%)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={comp.percentage}
                                                        onChange={(e) => handleComponentChange(idx, "percentage", e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                        max="100"
                                                        step="1"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-cyan-500 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-sm font-medium text-gray-700">Total:</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {formData.components.reduce((sum, c) => sum + c.percentage, 0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Toggle Switch Section */}
                            <div className="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <InformationCircleIcon className="h-5 w-5 text-cyan-600" />
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">
                                                Apply as Default Component
                                            </label>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                When enabled, this component will be applied to all new employees irrespective of roles
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleToggleChange}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${formData.isDefaultComponent ? "bg-cyan-600" : "bg-gray-200"
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isDefaultComponent ? "translate-x-6" : "translate-x-1"
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                                <button
                                    onClick={resetForm}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    {editingRole ? "Update" : "Save"} Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Compensations List Table */}
                {!showForm && (
                    <ReusableTable
                        data={tableData}
                        columns={columns}
                        loading={loading}
                        searchable={true}
                        searchPlaceholder="Search role..."
                        searchFields={["employeeRole"]}
                        pageSize={10}
                    />
                )}

                {/* Disclaimer Modal */}
                {showDisclaimerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <InformationCircleIcon className="h-6 w-6 text-amber-600" />
                                    <h3 className="text-lg font-semibold text-gray-900">Important Disclaimer</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowDisclaimerModal(false);
                                        setPendingSubmit(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-5">
                                <div className="space-y-4">
                                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                        <p className="text-sm text-amber-800 font-medium mb-2">
                                            You have enabled the "Apply as Default Component" option:
                                        </p>
                                        <p className="text-sm text-amber-700">
                                            <strong>This component/s will be applied to All New employees irrespective of Roles.</strong>
                                        </p>
                                    </div>

                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                        <p className="text-sm text-yellow-800">
                                            ⚠️ <strong>Warning:</strong> Enabling this option will set this compensation structure as the default template.
                                            All new employees created after this change will automatically have these component percentages applied.
                                        </p>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                        <p className="text-sm text-blue-800">
                                            ℹ️ <strong>Note:</strong>
                                            <br />- This change will affect all future employee creations
                                            <br />- Existing employees will not be affected
                                            <br />- You can change this setting at any time
                                            <br />- Multiple roles can have default components
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => {
                                            setShowDisclaimerModal(false);
                                            setPendingSubmit(null);
                                        }}
                                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDisclaimerModal(false);
                                            if (pendingSubmit) {
                                                pendingSubmit();
                                                setPendingSubmit(null);
                                            }
                                        }}
                                        className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
                                    >
                                        <CheckIcon className="h-4 w-4" />
                                        I Understand, Proceed
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

export default EmployeeCompensationPage;


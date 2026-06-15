import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    BuildingLibraryIcon,
    CheckCircleIcon,
    DocumentArrowDownIcon,
    DocumentDuplicateIcon,
    EyeIcon,
    FunnelIcon,
    GlobeAltIcon,
    PencilSquareIcon,
    ReceiptPercentIcon,
    ShareIcon,
    TableCellsIcon,
    TrashIcon,
    XMarkIcon,
    XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import { ToasterService } from "../../Services/ToasterService";

const API_URL = "/v1/api/invoice/tax-types";

export type Region =
    | "INDIA"
    | "EU"
    | "USA"
    | "QATAR"
    | "UAE"
    | "CANADA"
    | "AUSTRALIA"
    | "UK"
    | "OTHER";

interface TaxType {
    id?: number;
    taxName: string;
    taxRate: number;
    region: Region;
    isActive: boolean;
    description?: string;
}

type TaxTypeRow = TaxType & { id: number };

const PAGE_SIZE = 10;

const regionOptions: { value: Region; label: string }[] = [
    { value: "INDIA", label: "India" },
    { value: "USA", label: "USA" },
    { value: "UAE", label: "UAE" },
    { value: "QATAR", label: "Qatar" },
    { value: "EU", label: "European Union" },
    { value: "UK", label: "United Kingdom" },
    { value: "CANADA", label: "Canada" },
    { value: "AUSTRALIA", label: "Australia" },
    { value: "OTHER", label: "Other" },
];

const TaxTypePage: React.FC = () => {
    const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<TaxType>({
        taxName: "",
        taxRate: 0,
        region: "INDIA",
        isActive: true,
        description: "",
    });
    const [showFilters, setShowFilters] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState("");
    const [selectedTax, setSelectedTax] = useState<TaxType | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [taxToDelete, setTaxToDelete] = useState<TaxTypeRow | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(API_URL);
            setTaxTypes(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            ToasterService.error("Failed to load tax types");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleChange = (key: keyof TaxType, value: TaxType[keyof TaxType]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.taxName) {
            ToasterService.error("Tax name is required");
            return;
        }

        if (form.taxRate <= 0) {
            ToasterService.error("Tax rate must be greater than 0");
            return;
        }

        try {
            if (form.id) {
                await axios.put(`${API_URL}/${form.id}`, form);
                ToasterService.success("Tax type updated successfully");
            } else {
                await axios.post(`${API_URL}/create`, form);
                ToasterService.success("Tax type created successfully");
            }
            await loadData();
            clearForm();
        } catch (err: unknown) {
            console.error("Save failed", err);
            if (axios.isAxiosError(err) && err.response) {
                ToasterService.error(
                    `Error: ${String(err.response.data?.message || err.response.statusText)}`
                );
            } else {
                ToasterService.error("Save failed");
            }
        }
    };

    const handleEdit = (tax: TaxType) => {
        setForm({ ...tax });
        setShowDetailsModal(false);
        setShowForm(true);
    };

    const promptDelete = (tax: TaxTypeRow) => {
        setTaxToDelete(tax);
        setShowDeletePopup(true);
    };

    const handleDelete = async () => {
        if (!taxToDelete?.id) return;
        try {
            await axios.delete(`${API_URL}/${taxToDelete.id}`);
            ToasterService.success("Tax type deleted successfully");
            setTaxToDelete(null);
            await loadData();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                ToasterService.error(String(err.response?.data?.message || "Delete failed"));
            } else {
                ToasterService.error("Delete failed");
            }
            console.error(err);
        }
    };

    const handleViewDetails = (tax: TaxType) => {
        setSelectedTax(tax);
        setShowDetailsModal(true);
    };

    const closeDetailsModal = () => {
        setSelectedTax(null);
        setShowDetailsModal(false);
    };

    const clearForm = () => {
        setForm({
            taxName: "",
            taxRate: 0,
            region: "INDIA",
            isActive: true,
            description: "",
        });
        setShowForm(false);
    };

    const exportExcel = () => {
        const exportData = taxTypes.map((t) => ({
            "Tax Name": t.taxName,
            "Tax Rate": `${(t.taxRate * 100).toFixed(2)}%`,
            Region: t.region,
            Status: t.isActive ? "Active" : "Inactive",
            Description: t.description || "",
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TaxTypes");
        XLSX.writeFile(wb, `TaxTypes_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const exportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Tax Types Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

        autoTable(doc, {
            head: [["Name", "Rate", "Region", "Status", "Description"]],
            body: taxTypes.map((t) => [
                t.taxName,
                `${(t.taxRate * 100).toFixed(2)}%`,
                t.region,
                t.isActive ? "Active" : "Inactive",
                t.description || "",
            ]),
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
        });

        doc.save(`TaxTypes_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const filteredTaxTypes = useMemo(
        () => taxTypes.filter((tax) => (selectedRegion ? tax.region === selectedRegion : true)),
        [selectedRegion, taxTypes]
    );

    const tableData = useMemo(
        () => filteredTaxTypes.filter((tax): tax is TaxTypeRow => tax.id !== undefined),
        [filteredTaxTypes]
    );

    const getRegionColor = (region: Region) => {
        switch (region) {
            case "INDIA":
                return "bg-orange-100 text-orange-800";
            case "USA":
                return "bg-blue-100 text-blue-800";
            case "UAE":
                return "bg-green-100 text-green-800";
            case "QATAR":
                return "bg-purple-100 text-purple-800";
            case "EU":
                return "bg-yellow-100 text-yellow-800";
            case "UK":
                return "bg-red-100 text-red-800";
            case "CANADA":
                return "bg-indigo-100 text-indigo-800";
            case "AUSTRALIA":
                return "bg-pink-100 text-pink-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const tableColumns = useMemo<ColumnDef<TaxTypeRow>[]>(
        () => [
            {
                key: "taxName",
                label: "Name",
                sortable: true,
                render: (tax) => (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
                            <ReceiptPercentIcon className="h-5 w-5 text-cyan-600" />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">{tax.taxName}</p>
                            <p className="text-xs text-gray-500">ID: {tax.id}</p>
                        </div>
                    </div>
                ),
            },
            {
                key: "taxRate",
                label: "Rate",
                sortable: true,
                render: (tax) => (
                    <span className="font-semibold text-cyan-600">
                        {(tax.taxRate * 100).toFixed(2)}%
                    </span>
                ),
            },
            {
                key: "region",
                label: "Region",
                sortable: true,
                render: (tax) => (
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getRegionColor(
                            tax.region
                        )}`}
                    >
                        <GlobeAltIcon className="h-4 w-4" />
                        {tax.region}
                    </span>
                ),
            },
            {
                key: "isActive",
                label: "Status",
                sortable: true,
                render: (tax) =>
                    tax.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                            <CheckCircleIcon className="mr-1 h-4 w-4" />
                            Active
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            <XCircleIcon className="mr-1 h-4 w-4" />
                            Inactive
                        </span>
                    ),
            },
            {
                key: "description",
                label: "Description",
                render: (tax) => (
                    <span className="line-clamp-2 text-sm text-gray-600">
                        {tax.description || "No description"}
                    </span>
                ),
            },
            {
                key: "actions",
                label: "Actions",
                className: "w-40",
                render: (tax) => (
                    <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleViewDetails(tax)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-cyan-600"
                            title="View details"
                        >
                            <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => handleEdit(tax)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600"
                            title="Edit tax type"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => promptDelete(tax)}
                            className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Delete tax type"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                ),
            },
        ],
        []
    );

    const tableToolbar = (
        <>
            <div className="relative">
                <button
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    className="rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-50"
                    title="Export"
                >
                    <ShareIcon className="h-5 w-5 text-gray-600" />
                </button>

                {showExportMenu && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                            onClick={exportPDF}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                            PDF
                        </button>
                        <button
                            onClick={exportExcel}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                            Excel
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`rounded-lg border p-2 transition-colors ${
                    showFilters
                        ? "border-cyan-300 bg-cyan-50 text-cyan-600"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
                title="Toggle filters"
            >
                <FunnelIcon className="h-5 w-5" />
            </button>
        </>
    );

    return (
        <>
            <PageMeta title="Tax Types" description="Manage tax types and rates" />
            <PageBreadcrumb pageTitle="Tax Types" />

            <div className="mx-auto max-w-7xl p-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <BackButton />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Tax Types</h1>
                            <p className="mt-0.5 text-sm text-gray-500">
                                Manage tax types and rates without changing the existing integration flow.
                            </p>
                        </div>
                    </div>

                    <AddButton
                        label="Add Tax Type"
                        onClick={() => {
                            clearForm();
                            setShowForm(true);
                        }}
                    />
                </div>

                {showFilters && (
                    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-wrap gap-4">
                            <div className="min-w-[220px] flex-1">
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Region
                                </label>
                                <select
                                    value={selectedRegion}
                                    onChange={(e) => setSelectedRegion(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 p-2 focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Regions</option>
                                    {regionOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedRegion && (
                                <button
                                    onClick={() => setSelectedRegion("")}
                                    className="self-end text-sm font-medium text-red-600 hover:text-red-800"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatsCard
                        label="Total Tax Types"
                        value={taxTypes.length}
                        gradient="from-blue-50 to-white"
                        borderColor="border-blue-100"
                        labelColor="text-blue-700"
                        icon={<DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />}
                    />
                    <StatsCard
                        label="Active"
                        value={taxTypes.filter((tax) => tax.isActive).length}
                        gradient="from-green-50 to-white"
                        borderColor="border-green-100"
                        labelColor="text-green-700"
                        icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />}
                    />
                    <StatsCard
                        label="Regions"
                        value={new Set(taxTypes.map((tax) => tax.region)).size}
                        gradient="from-purple-50 to-white"
                        borderColor="border-purple-100"
                        labelColor="text-purple-700"
                        icon={<GlobeAltIcon className="h-6 w-6 text-purple-600" />}
                    />
                    <StatsCard
                        label="Filtered Results"
                        value={filteredTaxTypes.length}
                        gradient="from-cyan-50 to-white"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-700"
                        icon={<BuildingLibraryIcon className="h-6 w-6 text-cyan-600" />}
                    />
                </div>

                <ReusableTable<TaxTypeRow>
                    data={tableData}
                    columns={tableColumns}
                    loading={isLoading}
                    searchable
                    searchPlaceholder="Search tax types..."
                    searchFields={["taxName", "region", "description"]}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="taxName"
                    defaultSortOrder="asc"
                    toolbar={tableToolbar}
                    onRowClick={handleViewDetails}
                    emptyState={
                        <div className="flex flex-col items-center py-4 text-gray-400">
                            <ReceiptPercentIcon className="mb-3 h-12 w-12 text-gray-400" />
                            <p className="text-sm font-medium text-gray-500">No tax types found</p>
                            <p className="text-xs text-gray-400">
                                Try adjusting your search or filters
                            </p>
                        </div>
                    }
                />

                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
                            <div className="flex items-center justify-between border-b border-gray-100 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100">
                                        <ReceiptPercentIcon className="h-5 w-5 text-cyan-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {form.id ? "Edit Tax Type" : "Add New Tax Type"}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            Manage tax type details using the shared page pattern.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={clearForm}
                                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <form id="tax-type-form" onSubmit={handleSubmit} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            Tax Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                                            placeholder="e.g., VAT, GST, Sales Tax"
                                            value={form.taxName}
                                            onChange={(e) => handleChange("taxName", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            Tax Rate (%) <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full rounded-lg border border-gray-300 p-2 pr-8 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                                                placeholder="e.g., 18 for 18%"
                                                value={form.taxRate * 100}
                                                step="0.01"
                                                min="0.01"
                                                onChange={(e) =>
                                                    handleChange("taxRate", Number(e.target.value) / 100)
                                                }
                                                required
                                            />
                                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            Region <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            className="w-full rounded-lg border border-gray-300 p-2 focus:ring-2 focus:ring-cyan-500"
                                            value={form.region}
                                            onChange={(e) => handleChange("region", e.target.value as Region)}
                                            required
                                        >
                                            {regionOptions.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                                checked={form.isActive}
                                                onChange={(e) => handleChange("isActive", e.target.checked)}
                                            />
                                            <span className="ml-2 text-sm text-gray-700">Active</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-700">
                                            Description
                                        </label>
                                        <textarea
                                            className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                                            rows={3}
                                            placeholder="Enter description..."
                                            value={form.description}
                                            onChange={(e) => handleChange("description", e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={clearForm}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-lg bg-cyan-600 px-4 py-2 text-white transition-colors hover:bg-cyan-700"
                                    >
                                        {form.id ? "Update Tax Type" : "Create Tax Type"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showDetailsModal && selectedTax && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
                            <div className="flex items-center justify-between border-b border-gray-100 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100">
                                        <ReceiptPercentIcon className="h-5 w-5 text-cyan-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Tax Type Details</h3>
                                        <p className="text-sm text-gray-500">
                                            Review the selected tax type information.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeDetailsModal}
                                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="mb-4 flex justify-end">
                                    {selectedTax.isActive ? (
                                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                                            <CheckCircleIcon className="mr-1 h-4 w-4" />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                                            <XCircleIcon className="mr-1 h-4 w-4" />
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="rounded-lg bg-gray-50 p-4">
                                        <p className="mb-1 text-sm text-gray-500">Tax Name</p>
                                        <p className="text-lg font-semibold text-gray-900">
                                            {selectedTax.taxName}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-gray-50 p-4">
                                        <p className="mb-1 text-sm text-gray-500">Tax Rate</p>
                                        <p className="text-2xl font-bold text-cyan-600">
                                            {(selectedTax.taxRate * 100).toFixed(2)}%
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-6 rounded-lg bg-gray-50 p-4">
                                    <p className="mb-1 text-sm text-gray-500">Region</p>
                                    <div className="flex items-center gap-2">
                                        <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-sm font-medium ${getRegionColor(
                                                selectedTax.region
                                            )}`}
                                        >
                                            {selectedTax.region}
                                        </span>
                                    </div>
                                </div>

                                {selectedTax.description && (
                                    <div className="mb-6 rounded-lg bg-gray-50 p-4">
                                        <p className="mb-1 text-sm text-gray-500">Description</p>
                                        <p className="text-gray-900">{selectedTax.description}</p>
                                    </div>
                                )}

                                {selectedTax.id && (
                                    <div className="border-t pt-4">
                                        <p className="text-xs text-gray-500">ID: {selectedTax.id}</p>
                                    </div>
                                )}

                                <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                                    <button
                                        onClick={() => {
                                            handleEdit(selectedTax);
                                        }}
                                        className="rounded-lg bg-cyan-600 px-4 py-2 text-white transition-colors hover:bg-cyan-700"
                                    >
                                        Edit Tax Type
                                    </button>
                                    <button
                                        onClick={closeDetailsModal}
                                        className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DynamicPopup
                    isPopupOpen={showDeletePopup}
                    setIsPopupOpen={setShowDeletePopup}
                    icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                    iconBg="bg-red-100"
                    innerText="Delete this tax type?"
                    subText={
                        taxToDelete
                            ? `This will permanently remove ${taxToDelete.taxName}. This action cannot be undone.`
                            : "This action cannot be undone."
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                    onConfirm={handleDelete}
                    onCancel={() => setTaxToDelete(null)}
                />
            </div>
        </>
    );
};

export default TaxTypePage;


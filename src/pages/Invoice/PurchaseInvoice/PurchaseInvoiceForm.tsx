import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    CurrencyDollarIcon,
    ArrowLeftIcon,
    CheckIcon,
    BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/purchase-invoices";
const VENDORS_URL = "/v1/api/invoice/vendors";

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID";

interface Vendor {
    id: number;
    name: string;
}

interface PurchaseInvoice {
    id?: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    purchaseInvoiceStatus: Status;
    vendor: Vendor;
    currency: string;
    referenceNumber: string;
    notes: string;
}

const PurchaseInvoiceForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [loading, setLoading] = useState(true);
    const [vendors, setVendors] = useState<Vendor[]>([]);

    const emptyInvoice: PurchaseInvoice = {
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        totalAmount: 0,
        purchaseInvoiceStatus: "OPEN",
        vendor: { id: 0, name: "" },
        currency: "USD",
        referenceNumber: "",
        notes: "",
    };

    const [form, setForm] = useState<PurchaseInvoice>(emptyInvoice);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const vendorRes = await axios.get(VENDORS_URL);
                setVendors(vendorRes.data);

                if (isEdit) {
                    const res = await axios.get(`${BASE_URL}/${id}`);
                    setForm(res.data);
                }
            } catch (err) {
                console.error("Error loading purchase invoice form data:", err);
                ToasterService.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, isEdit]);

    const handleFieldChange = (field: keyof PurchaseInvoice, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.invoiceNumber || !form.vendor.id) {
            ToasterService.error("Please fill in Invoice # and Vendor");
            return;
        }

        try {
            if (isEdit) {
                await axios.put(`${BASE_URL}/${id}`, form);
                ToasterService.success("Purchase invoice updated");
            } else {
                await axios.post(BASE_URL, form);
                ToasterService.success("Purchase invoice created");
            }
            navigate("/payment-invoice");
        } catch (err) {
            console.error("Error saving purchase invoice:", err);
            ToasterService.error("Failed to save purchase invoice");
        }
    };

    if (loading) return <div className="p-6 text-center">Loading form...</div>;

    return (
        <>
            <PageMeta title={isEdit ? "Edit Purchase Invoice" : "Add Purchase Invoice"} description="Manage purchase invoice details" />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Purchase Invoice" : "Add Purchase Invoice"} />

            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-6">
                    <button
                        onClick={() => navigate("/payment-invoice")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-bold"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-8 text-white relative">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black italic tracking-tighter flex items-center gap-2 uppercase">
                                {isEdit ? "Reconfigure Document" : "New Purchase Entry"}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1 font-bold uppercase tracking-widest opacity-80">Documentation for incoming stock/services</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-10 space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            {/* Invoice Info */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Invoice Number</label>
                                    <input
                                        type="text"
                                        value={form.invoiceNumber}
                                        onChange={(e) => handleFieldChange("invoiceNumber", e.target.value)}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold text-gray-900 text-lg"
                                        placeholder="PO-00000"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Invoice Date</label>
                                        <input
                                            type="date"
                                            value={form.invoiceDate.split('T')[0]}
                                            onChange={(e) => handleFieldChange("invoiceDate", e.target.value)}
                                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Due Date</label>
                                        <input
                                            type="date"
                                            value={form.dueDate.split('T')[0]}
                                            onChange={(e) => handleFieldChange("dueDate", e.target.value)}
                                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Vendor & Amount */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Supplier / Vendor</label>
                                    <div className="relative">
                                        <select
                                            value={form.vendor.id}
                                            onChange={(e) => {
                                                const v = vendors.find(vend => vend.id === Number(e.target.value));
                                                handleFieldChange("vendor", v || { id: 0, name: "" });
                                            }}
                                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-cyan-500 appearance-none font-bold text-gray-900 pr-10"
                                            required
                                        >
                                            <option value={0}>Choose a vendor...</option>
                                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                        </select>
                                        <BuildingOfficeIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Amount</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.totalAmount}
                                            onChange={(e) => handleFieldChange("totalAmount", Number(e.target.value))}
                                            className="w-full p-3 pl-8 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-mono font-bold text-gray-900"
                                        />
                                        <CurrencyDollarIcon className="absolute left-3 top-[41px] text-gray-400 h-4 w-4" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Currency</label>
                                        <select
                                            value={form.currency}
                                            onChange={(e) => handleFieldChange("currency", e.target.value)}
                                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm font-bold appearance-none bg-no-repeat bg-[right_1rem_center] bg-[length:1em]"
                                            style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E")' }}
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="INR">INR</option>
                                            <option value="AED">AED</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Status & Reference */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-gray-50 rounded-3xl border border-gray-100">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Document Status</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(["OPEN", "PARTIALLY_PAID", "PAID"] as Status[]).map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => handleFieldChange("purchaseInvoiceStatus", s)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${form.purchaseInvoiceStatus === s
                                                        ? 'bg-cyan-600 text-white shadow-md'
                                                        : 'bg-white text-gray-400 border border-gray-200 hover:border-cyan-300 hover:text-cyan-600'
                                                    }`}
                                            >
                                                {s.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Reference / Tracking Number</label>
                                    <input
                                        type="text"
                                        value={form.referenceNumber}
                                        onChange={(e) => handleFieldChange("referenceNumber", e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                                        placeholder="Enter internal or vendor reference..."
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Notes & Remarks</label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => handleFieldChange("notes", e.target.value)}
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-cyan-500 text-sm min-h-[120px]"
                                    placeholder="Additional information about this purchase..."
                                />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex justify-end gap-4">
                            <button
                                type="button"
                                onClick={() => navigate("/payment-invoice")}
                                className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                className="px-10 py-3 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all font-black text-sm flex items-center gap-2 shadow-xl hover:translate-y-[-2px]"
                            >
                                <CheckIcon className="h-5 w-5" />
                                {isEdit ? "Commit Changes" : "Save Entry"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default PurchaseInvoiceForm;

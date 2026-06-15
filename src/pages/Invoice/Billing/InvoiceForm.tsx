import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    ArrowLeftIcon,
    TagIcon,
    PlusIcon,
    TrashIcon,
    ReceiptPercentIcon,
    CreditCardIcon,
    MapPinIcon,
    CheckCircleIcon,
    BuildingOfficeIcon,
    DocumentTextIcon,
    CalendarIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_INVOICES = "/v1/api/invoice/invoices";
const API_CUSTOMERS = "/v1/api/invoice/customers";
const API_TAX_TYPES = "/v1/api/invoice/tax-types";
const API_PAYMENT_TERMS = "/v1/api/invoice/payment-terms";
const API_PRODUCTS = "/v1/api/invoice/products";

interface Customer {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    customerCode?: string;
}

interface TaxType {
    id: number;
    taxName: string;
    taxRate: number;
    taxCode?: string;
    taxDescription?: string;
    taxCatagory?: string;
}

interface PaymentTerm {
    id: number;
    termCode: string;
    description?: string;
    dueDays?: number;
}

interface Product {
    id: number;
    name: string;
    sku?: string;
    description?: string;
    price?: number;
    category?: {
        id: number;
        name: string;
        categoryCode?: string;
    };
}

interface LineItem {
    id?: number;
    product?: Product;
    productCode?: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    lineTotal: number;
}

interface TaxDetail {
    id?: number;
    taxCode?: string;
    taxDescription?: string;
    taxRate: number;
    taxAmount: number;
    taxCatagory?: string;
    taxType?: { id: number } | null;
}

interface Invoice {
    id?: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    customer: { id: number };
    paymentTerm?: { id: number };
    billingAddress: string;
    shippingAddress: string;
    lineItems: LineItem[];
    taxDetails: TaxDetail[];
    subTotal: number;
    totalDiscount: number;
    totalTax: number;
    grandTotal: number;
    amountPaid: number;
    balance: number;
    status: string;
}

const InvoiceForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
    const [terms, setTerms] = useState<PaymentTerm[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<{ [key: number]: Product }>({});

    const emptyInvoice: Invoice = {
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: "USD",
        customer: { id: 0 },
        paymentTerm: undefined,
        billingAddress: "",
        shippingAddress: "",
        lineItems: [],
        taxDetails: [],
        subTotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 0,
        amountPaid: 0,
        balance: 0,
        status: "DRAFT",
    };

    const [form, setForm] = useState<Invoice>(emptyInvoice);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [custRes, taxRes, termRes, prodRes] = await Promise.all([
                    axios.get(API_CUSTOMERS),
                    axios.get(API_TAX_TYPES),
                    axios.get(API_PAYMENT_TERMS),
                    axios.get(API_PRODUCTS),
                ]);
                setCustomers(custRes.data || []);
                setTaxTypes(taxRes.data || []);
                setTerms(termRes.data || []);
                setProducts(prodRes.data || []);

                if (isEdit) {
                    const invRes = await axios.get(`${API_INVOICES}/${id}`);
                    const invData = invRes.data;
                    
                    // Map the response to our form structure
                    setForm({
                        id: invData.id,
                        invoiceNumber: invData.invoiceNumber || "",
                        invoiceDate: invData.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0],
                        dueDate: invData.dueDate?.split('T')[0] || "",
                        currency: invData.currency || "USD",
                        customer: { id: invData.customer?.id || 0 },
                        paymentTerm: invData.paymentTerm ? { id: invData.paymentTerm.id } : undefined,
                        billingAddress: invData.billingAddress || "",
                        shippingAddress: invData.shippingAddress || "",
                        lineItems: invData.lineItems?.map((item: any) => ({
                            id: item.id,
                            product: item.product,
                            productCode: item.productCode,
                            description: item.description,
                            quantity: item.quantity || 1,
                            unitPrice: item.unitPrice || 0,
                            discount: item.discount || 0,
                            taxRate: item.taxRate || 0,
                            lineTotal: item.lineTotal || 0,
                        })) || [],
                        taxDetails: invData.taxDetails?.map((tax: any) => ({
                            id: tax.id,
                            taxCode: tax.taxCode,
                            taxDescription: tax.taxDescription,
                            taxRate: tax.taxRate,
                            taxAmount: tax.taxAmount,
                            taxCatagory: tax.taxCatagory,
                            taxType: tax.taxType,
                        })) || [],
                        subTotal: invData.subTotal || 0,
                        totalDiscount: invData.totalDiscount || 0,
                        totalTax: invData.totalTax || 0,
                        grandTotal: invData.grandTotal || 0,
                        amountPaid: invData.amountPaid || 0,
                        balance: invData.balance || 0,
                        status: invData.status || "DRAFT",
                    });
                }
            } catch (err) {
                console.error("Error loading form data:", err);
                ToasterService.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, isEdit]);

    // Recalculate all totals whenever line items change
    const recalcTotals = (items: LineItem[], amountPaid: number) => {
        const subTotal = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
        const totalDiscount = items.reduce((sum, i) => sum + i.discount, 0);
        
        // Calculate tax based on line items
        const totalTax = items.reduce((sum, i) => sum + ((i.quantity * i.unitPrice - i.discount) * (i.taxRate / 100)), 0);
        const grandTotal = subTotal - totalDiscount + totalTax;
        
        // Update tax details based on line items
        const taxDetailsMap = new Map<number, TaxDetail>();
        items.forEach(item => {
            if (item.taxRate > 0) {
                const taxableAmount = (item.quantity * item.unitPrice) - item.discount;
                const taxAmount = taxableAmount * (item.taxRate / 100);
                
                if (taxDetailsMap.has(item.taxRate)) {
                    const existing = taxDetailsMap.get(item.taxRate)!;
                    existing.taxAmount += taxAmount;
                } else {
                    const taxType = taxTypes.find(t => t.taxRate === item.taxRate);
                    taxDetailsMap.set(item.taxRate, {
                        taxRate: item.taxRate,
                        taxAmount: taxAmount,
                        taxCode: taxType?.taxCode || `TAX_${item.taxRate}`,
                        taxDescription: taxType?.taxDescription || `${item.taxRate}% Tax`,
                        taxCatagory: taxType?.taxCatagory || "OUTPUT",
                        taxType: taxType ? { id: taxType.id } : null,
                    });
                }
            }
        });
        
        const taxDetails = Array.from(taxDetailsMap.values());
        
        setForm(prev => ({
            ...prev,
            lineItems: items,
            taxDetails,
            subTotal,
            totalDiscount,
            totalTax,
            grandTotal,
            amountPaid,
            balance: grandTotal - amountPaid
        }));
    };

    const handleFieldChange = (field: keyof Invoice, value: any) => {
        if (submitting) return;
        if (field === "amountPaid") {
            recalcTotals(form.lineItems, Number(value) || 0);
        } else if (field === "customer" || field === "paymentTerm") {
            setForm(prev => ({ ...prev, [field]: value }));
        } else {
            setForm(prev => ({ ...prev, [field]: value }));
        }
    };

    const addLineItem = () => {
        if (submitting) return;
        const newItems = [...form.lineItems, {
            quantity: 1,
            unitPrice: 0,
            discount: 0,
            taxRate: 0,
            lineTotal: 0,
            description: "",
        }];
        recalcTotals(newItems, form.amountPaid);
    };

    const removeLineItem = (index: number) => {
        if (submitting) return;
        const newItems = form.lineItems.filter((_, i) => i !== index);
        recalcTotals(newItems, form.amountPaid);
    };

    const updateLineItem = (index: number, changes: Partial<LineItem>) => {
        if (submitting) return;
        const newItems = [...form.lineItems];
        const updatedItem = { ...newItems[index], ...changes };
        
        // Recalculate line total
        updatedItem.lineTotal = (updatedItem.quantity * updatedItem.unitPrice) - updatedItem.discount;
        
        // If product is selected, populate product details
        if (changes.product && updatedItem.product) {
            updatedItem.productCode = updatedItem.product.sku;
            updatedItem.description = updatedItem.product.description || updatedItem.product.name;
            updatedItem.unitPrice = updatedItem.product.price || 0;
        }
        
        newItems[index] = updatedItem;
        recalcTotals(newItems, form.amountPaid);
    };

    const handleProductSelect = (index: number, productId: number) => {
        const selectedProduct = products.find(p => p.id === productId);
        if (selectedProduct) {
            updateLineItem(index, {
                product: selectedProduct,
                productCode: selectedProduct.sku,
                description: selectedProduct.description || selectedProduct.name,
                unitPrice: selectedProduct.price || 0,
                quantity: 1,
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.customer.id || form.customer.id === 0) {
            ToasterService.error("Please select a customer");
            return;
        }
        
        if (form.lineItems.length === 0) {
            ToasterService.error("Please add at least one line item");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                invoiceNumber: form.invoiceNumber,
                invoiceDate: form.invoiceDate,
                dueDate: form.dueDate,
                currency: form.currency,
                customer: { id: form.customer.id },
                paymentTerm: form.paymentTerm ? { id: form.paymentTerm.id } : undefined,
                billingAddress: form.billingAddress || "",
                shippingAddress: form.shippingAddress || "",
                lineItems: form.lineItems.map(item => ({
                    product: item.product ? { id: item.product.id } : undefined,
                    productCode: item.productCode,
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    lineTotal: item.lineTotal,
                })),
                taxDetails: form.taxDetails.map(tax => ({
                    taxCode: tax.taxCode,
                    taxDescription: tax.taxDescription,
                    taxRate: tax.taxRate,
                    taxAmount: tax.taxAmount,
                    taxCatagory: tax.taxCatagory,
                    taxType: tax.taxType,
                })),
                subTotal: form.subTotal,
                totalDiscount: form.totalDiscount,
                totalTax: form.totalTax,
                grandTotal: form.grandTotal,
                amountPaid: form.amountPaid,
                balance: form.balance,
                status: form.status
            };

            if (isEdit) {
                await axios.put(`${API_INVOICES}/${id}`, payload);
                ToasterService.success("Invoice updated successfully");
            } else {
                await axios.post(API_INVOICES, payload);
                ToasterService.success("Invoice created successfully");
            }
            navigate("/invoice-billing");
        } catch (err: any) {
            console.error("Error saving invoice:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save invoice");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading form...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageMeta title={isEdit ? "Edit Invoice" : "Create Invoice"} description="Manage invoice details" />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Invoice" : "Create Invoice"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/invoice-billing")}
                        disabled={submitting}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Information Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <DocumentTextIcon className="h-5 w-5" />
                                Basic Information
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={form.invoiceDate ? new Date(form.invoiceDate) : null}
                                            onChange={(date) => handleFieldChange("invoiceDate", date ? date.toISOString().split('T')[0] : "")}
                                            dateFormat="yyyy-MM-dd"
                                            disabled={submitting}
                                            className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                            placeholderText="Select date"
                                        />
                                        <CalendarIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={form.dueDate ? new Date(form.dueDate) : null}
                                            onChange={(date) => handleFieldChange("dueDate", date ? date.toISOString().split('T')[0] : "")}
                                            dateFormat="yyyy-MM-dd"
                                            disabled={submitting}
                                            className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                            placeholderText="Select date"
                                        />
                                        <CalendarIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                    <select
                                        value={form.currency}
                                        onChange={(e) => handleFieldChange("currency", e.target.value)}
                                        disabled={submitting}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                    >
                                        <option value="USD">USD - US Dollar</option>
                                        <option value="EUR">EUR - Euro</option>
                                        <option value="GBP">GBP - British Pound</option>
                                        <option value="INR">INR - Indian Rupee</option>
                                        <option value="JPY">JPY - Japanese Yen</option>
                                        <option value="AUD">AUD - Australian Dollar</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Customer Information Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <BuildingOfficeIcon className="h-5 w-5" />
                                Customer Information
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Customer <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={form.customer.id}
                                        onChange={(e) => handleFieldChange("customer", { id: Number(e.target.value) })}
                                        disabled={submitting}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        required
                                    >
                                        <option value={0}>Select Customer</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.customerCode ? `(${c.customerCode})` : ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Term</label>
                                    <select
                                        value={form.paymentTerm?.id || ""}
                                        onChange={(e) => handleFieldChange("paymentTerm", e.target.value ? { id: Number(e.target.value) } : undefined)}
                                        disabled={submitting}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                    >
                                        <option value="">Select Payment Term</option>
                                        {terms.map(t => <option key={t.id} value={t.id}>{t.termCode} {t.dueDays ? `(${t.dueDays} days)` : ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <MapPinIcon className="h-4 w-4 inline mr-1" />
                                        Billing Address
                                    </label>
                                    <textarea
                                        value={form.billingAddress || ""}
                                        onChange={(e) => handleFieldChange("billingAddress", e.target.value)}
                                        disabled={submitting}
                                        rows={3}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholder="Enter billing address..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <MapPinIcon className="h-4 w-4 inline mr-1" />
                                        Shipping Address
                                    </label>
                                    <textarea
                                        value={form.shippingAddress || ""}
                                        onChange={(e) => handleFieldChange("shippingAddress", e.target.value)}
                                        disabled={submitting}
                                        rows={3}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholder="Enter shipping address..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5 flex justify-between items-center">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <TagIcon className="h-5 w-5" />
                                Line Items
                            </h3>
                            <button
                                type="button"
                                onClick={addLineItem}
                                disabled={submitting}
                                className="px-3 py-1.5 bg-white text-cyan-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center gap-1"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Item
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {form.lineItems.map((item, i) => (
                                    <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                            <div className="md:col-span-3">
                                                <label className="block text-xs text-gray-500 mb-1">Product</label>
                                                <select
                                                    value={item.product?.id || ""}
                                                    onChange={(e) => handleProductSelect(i, Number(e.target.value))}
                                                    disabled={submitting}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                >
                                                    <option value="">Select Product</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} {p.sku ? `(${p.sku})` : ''} - ${p.price?.toFixed(2) || '0'}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="block text-xs text-gray-500 mb-1">Description</label>
                                                <input
                                                    type="text"
                                                    value={item.description || ""}
                                                    onChange={(e) => updateLineItem(i, { description: e.target.value })}
                                                    disabled={submitting}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                    placeholder="Item description"
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="block text-xs text-gray-500 mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
                                                    disabled={submitting}
                                                    min={1}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateLineItem(i, { unitPrice: Number(e.target.value) })}
                                                    disabled={submitting}
                                                    min={0}
                                                    step="0.01"
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="block text-xs text-gray-500 mb-1">Discount</label>
                                                <input
                                                    type="number"
                                                    value={item.discount}
                                                    onChange={(e) => updateLineItem(i, { discount: Number(e.target.value) })}
                                                    disabled={submitting}
                                                    min={0}
                                                    step="0.01"
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="block text-xs text-gray-500 mb-1">Tax Rate (%)</label>
                                                <select
                                                    value={item.taxRate}
                                                    onChange={(e) => updateLineItem(i, { taxRate: Number(e.target.value) })}
                                                    disabled={submitting}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                >
                                                    <option value={0}>0%</option>
                                                    {taxTypes.map(t => (
                                                        <option key={t.id} value={t.taxRate}>{t.taxRate}% - {t.taxName}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="md:col-span-1 flex items-end justify-between">
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Line Total</label>
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {form.currency} {(item.quantity * item.unitPrice - item.discount).toFixed(2)}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeLineItem(i)}
                                                    disabled={submitting}
                                                    className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {form.lineItems.length === 0 && (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                        <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-500 text-sm">No items added yet</p>
                                        <button
                                            type="button"
                                            onClick={addLineItem}
                                            className="mt-3 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
                                        >
                                            Add First Item
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tax Details Summary Card */}
                    {form.taxDetails.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                                <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                    <ReceiptPercentIcon className="h-5 w-5" />
                                    Tax Summary
                                </h3>
                            </div>
                            <div className="p-6">
                                <div className="space-y-2">
                                    {form.taxDetails.map((tax, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <p className="font-medium text-gray-900">{tax.taxCode || 'Tax'}</p>
                                                <p className="text-xs text-gray-500">{tax.taxDescription || `${tax.taxRate}% Tax`}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-green-600">{form.currency} {tax.taxAmount.toFixed(2)}</p>
                                                <p className="text-xs text-gray-500">{tax.taxCatagory || 'OUTPUT'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Summary Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <CreditCardIcon className="h-5 w-5" />
                                Financial Summary
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm pb-2 border-b">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span className="font-medium text-gray-900">{form.currency} {form.subTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pb-2 border-b">
                                        <span className="text-gray-600">Total Discount:</span>
                                        <span className="font-medium text-red-600">-{form.currency} {form.totalDiscount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pb-2 border-b">
                                        <span className="text-gray-600">Total Tax:</span>
                                        <span className="font-medium text-green-600">+{form.currency} {form.totalTax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold pt-2">
                                        <span>Grand Total:</span>
                                        <span className="text-cyan-600">{form.currency} {form.grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">Amount Paid:</label>
                                        <div className="relative w-40">
                                            <span className="absolute left-3 top-2 text-gray-500">{form.currency}</span>
                                            <input
                                                type="number"
                                                value={form.amountPaid ?? 0}
                                                onChange={(e) => handleFieldChange("amountPaid", Number(e.target.value))}
                                                disabled={submitting}
                                                min={0}
                                                step="0.01"
                                                className="w-full pl-12 pr-3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-right disabled:bg-gray-100"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-sm pt-2 border-t">
                                        <span className="font-medium text-gray-700">Balance Due:</span>
                                        <span className={`font-bold text-lg ${form.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {form.currency} {form.balance.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                        <label className="text-sm font-medium text-gray-700">Status:</label>
                                        <select
                                            value={form.status}
                                            onChange={(e) => handleFieldChange("status", e.target.value)}
                                            disabled={submitting}
                                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                        >
                                            <option value="">All Statuses</option>            
                  <option value="DRAFT">Draft</option>
                  <option value="PAID">Paid</option>
                  <option value="UNPAID">Un Paid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="SENT">Sent</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="VOID">Void</option>
                  <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/invoice-billing")}
                            disabled={submitting}
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[160px] justify-center font-medium shadow-sm"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    {isEdit ? "Updating..." : "Saving..."}
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="h-5 w-5" />
                                    {isEdit ? "Update Invoice" : "Create Invoice"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default InvoiceForm;
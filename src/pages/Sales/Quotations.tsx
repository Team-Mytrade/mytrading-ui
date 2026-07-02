import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type Address = {
  id: number;
  customerId: number;
  customerName: string;
  customerCode: string;
  type: "BILLING" | string;
  addressLine1: string;
  addressLine2: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  primaryAddress: boolean;
  defaultAddress: boolean;
};

type QuotationItem = {
  id: number;
  categoryId: number;
  categoryName: string;
  itemType: "PRODUCT" | "SERVICE" | string;
  productId: number;
  productName: string;
  serviceItemId: number;
  description: string;
  productCode: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  taxRate: number;
  taxCode: string;
  remarks: string;
  additionalDiscount: number;
};

type SalesPerson = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  name: string;
  code: string;
  email: string;
  region: string;
  active: boolean;
  userId: string | number | null;
  employeeId: number | null;
};

type Quotation = {
  id: number;
  customerId: number;
  quotationType: "PRODUCT" | "SERVICE" | string;
  validUntil: string;
  currencyCode: string;
  remarks: string;
  internalNotes: string;
  customerNotes: string;
  subject: string;
  email: string;
  billingAddress: Address;
  shippingAddress: Address;
  items: QuotationItem[];
  quoteNumber: string;
  quoteDate: string;
  status: string;
  subTotal: number;
  discountAmount: number;
  additionalDiscount: number;
  discountPercentage: number;
  taxAmount: number;
  grandTotal: number;
  salesPerson: SalesPerson;
  termsAndConditions: string;
  versionNo: number;
};

type QuotationForm = {
  tenantId: string;
  customerId: string;
  quotationType: string;
  validUntil: string;
  currencyCode: string;
  remarks: string;
  internalNotes: string;
  customerNotes: string;
  subject: string;
  email: string;
  quoteNumber: string;
  quoteDate: string;
  status: string;
  subTotal: string;
  discountAmount: string;
  additionalDiscount: string;
  discountPercentage: string;
  taxAmount: string;
  grandTotal: string;
  salesPersonId: string;
  termsAndConditions: string;
  versionNo: string;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingPostalCode: string;
  shippingAddressLine1: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  shippingPostalCode: string;
  itemCategoryId: string;
  itemCategoryName: string;
  itemType: string;
  itemProductId: string;
  itemProductName: string;
  itemServiceItemId: string;
  itemDescription: string;
  itemProductCode: string;
  itemUom: string;
  itemQuantity: string;
  itemUnitPrice: string;
  itemDiscountPercentage: string;
  itemDiscountAmount: string;
  itemTaxRate: string;
  itemTaxCode: string;
  itemRemarks: string;
  itemAdditionalDiscount: string;
};

const API_URL = "/v1/api/sales/quotations";
const PAGE_SIZE = 10;
const statusOptions = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];
const quotationTypeOptions = ["PRODUCT", "SERVICE"];

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "";
  } catch {
    return "";
  }
}

const today = new Date().toISOString().split("T")[0];

const emptyForm: QuotationForm = {
  tenantId: getStoredTenantId(),
  customerId: "",
  quotationType: "PRODUCT",
  validUntil: today,
  currencyCode: "INR",
  remarks: "",
  internalNotes: "",
  customerNotes: "",
  subject: "",
  email: "",
  quoteNumber: "",
  quoteDate: today,
  status: "DRAFT",
  subTotal: "0",
  discountAmount: "0",
  additionalDiscount: "0",
  discountPercentage: "0",
  taxAmount: "0",
  grandTotal: "0",
  salesPersonId: "",
  termsAndConditions: "",
  versionNo: "0",
  billingAddressLine1: "",
  billingCity: "",
  billingState: "",
  billingCountry: "",
  billingPostalCode: "",
  shippingAddressLine1: "",
  shippingCity: "",
  shippingState: "",
  shippingCountry: "",
  shippingPostalCode: "",
  itemCategoryId: "",
  itemCategoryName: "",
  itemType: "PRODUCT",
  itemProductId: "",
  itemProductName: "",
  itemServiceItemId: "0",
  itemDescription: "",
  itemProductCode: "",
  itemUom: "",
  itemQuantity: "1",
  itemUnitPrice: "0",
  itemDiscountPercentage: "0",
  itemDiscountAmount: "0",
  itemTaxRate: "0",
  itemTaxCode: "",
  itemRemarks: "",
  itemAdditionalDiscount: "0",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (String(data?.error || "").includes("feign.Response$Body.asInputStream")) {
      return "Backend could not resolve one of the referenced IDs. Check tenantId, customerId, salesPersonId, productId, serviceItemId, and categoryId.";
    }
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function toNumber(value: string | number | undefined | null) {
  return Number(value || 0);
}

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function optionalPositiveNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function isPercent(value: string) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;
}

function buildAddress(form: QuotationForm, type: "BILLING" | "SHIPPING"): Address {
  const prefix = type === "BILLING" ? "billing" : "shipping";
  return {
    id: 0,
    customerId: toNumber(form.customerId),
    customerName: "",
    customerCode: "",
    type: "BILLING",
    addressLine1: form[`${prefix}AddressLine1` as keyof QuotationForm] as string,
    addressLine2: "",
    street: "",
    city: form[`${prefix}City` as keyof QuotationForm] as string,
    state: form[`${prefix}State` as keyof QuotationForm] as string,
    country: form[`${prefix}Country` as keyof QuotationForm] as string,
    postalCode: form[`${prefix}PostalCode` as keyof QuotationForm] as string,
    primaryAddress: type === "BILLING",
    defaultAddress: true,
  };
}

function calculateItem(form: QuotationForm) {
  const quantity = toNumber(form.itemQuantity);
  const unitPrice = toNumber(form.itemUnitPrice);
  const grossAmount = quantity * unitPrice;
  const percentageDiscount = (grossAmount * toNumber(form.itemDiscountPercentage)) / 100;
  const discountAmount = toNumber(form.itemDiscountAmount) || Number(percentageDiscount.toFixed(2));
  const additionalDiscount = toNumber(form.itemAdditionalDiscount);
  const taxableAmount = Math.max(0, grossAmount - discountAmount - additionalDiscount);
  const taxAmount = Number(((taxableAmount * toNumber(form.itemTaxRate)) / 100).toFixed(2));
  return { grossAmount, discountAmount, additionalDiscount, taxAmount, lineTotal: taxableAmount + taxAmount };
}

const Quotations: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [form, setForm] = useState<QuotationForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [deleteQuotation, setDeleteQuotation] = useState<Quotation | null>(null);

  useEffect(() => {
    fetchQuotations();
    fetchSalesPersons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSalesPerson = salesPersons.find((person) => String(person.id) === form.salesPersonId);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Quotation[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setQuotations(data);
      if (data.length === 0) ToasterService.noData("No quotations found");
    } catch (error) {
      ToasterService.error("Failed to load quotations", getErrorMessage(error, "Please try again."));
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPersons = async () => {
    try {
      const res = await axios.get<SalesPerson[]>("/v1/api/sales/sales-persons", { headers });
      setSalesPersons(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load sales persons", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Quotation ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<Quotation>(`${API_URL}/${lookupId}`, { headers });
      setQuotations([res.data]);
      ToasterService.success("Quotation loaded");
    } catch (error) {
      ToasterService.error("Failed to load quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "salesPersonId") {
        const person = salesPersons.find((item) => String(item.id) === value);
        next.email = person?.email || "";
      }
      return next;
    });
  };

  const buildItem = () => {
    const item: Partial<QuotationItem> = {
      id: 0,
      categoryName: form.itemCategoryName,
      itemType: form.itemType,
      productName: form.itemProductName,
      description: form.itemDescription,
      productCode: form.itemProductCode,
      uom: form.itemUom,
      quantity: toNumber(form.itemQuantity),
      unitPrice: toNumber(form.itemUnitPrice),
      discountPercentage: toNumber(form.itemDiscountPercentage),
      discountAmount: calculateItem(form).discountAmount,
      taxRate: toNumber(form.itemTaxRate),
      taxCode: form.itemTaxCode,
      remarks: form.itemRemarks,
      additionalDiscount: toNumber(form.itemAdditionalDiscount),
    };

    const categoryId = optionalPositiveNumber(form.itemCategoryId);
    if (categoryId && !form.itemCategoryName.trim()) item.categoryId = categoryId;

    if (form.itemType === "SERVICE") {
      const serviceItemId = optionalPositiveNumber(form.itemServiceItemId);
      if (serviceItemId) item.serviceItemId = serviceItemId;
    } else {
      item.productId = toNumber(form.itemProductId);
    }

    return item;
  };

  const buildSalesPerson = (): Partial<SalesPerson> => ({
    id: toNumber(form.salesPersonId),
    tenantId: form.tenantId.trim(),
    name: selectedSalesPerson?.name || "",
    code: selectedSalesPerson?.code || "",
    email: selectedSalesPerson?.email || "",
    region: selectedSalesPerson?.region || "",
    active: selectedSalesPerson?.active ?? true,
    userId: selectedSalesPerson?.userId ?? null,
    employeeId: selectedSalesPerson?.employeeId ?? null,
  });

  const buildPayload = () => ({
    id: editingId || 0,
    tenantId: form.tenantId.trim(),
    customerId: toNumber(form.customerId),
    quotationType: form.quotationType,
    validUntil: form.validUntil,
    currencyCode: form.currencyCode,
    remarks: form.remarks,
    internalNotes: form.internalNotes,
    customerNotes: form.customerNotes,
    subject: form.subject,
    email: form.email,
    billingAddress: buildAddress(form, "BILLING"),
    shippingAddress: buildAddress(form, "SHIPPING"),
    items: [buildItem()],
    quoteNumber: form.quoteNumber,
    quoteDate: form.quoteDate,
    status: form.status,
    subTotal: toNumber(form.subTotal),
    discountAmount: toNumber(form.discountAmount),
    additionalDiscount: toNumber(form.additionalDiscount),
    discountPercentage: toNumber(form.discountPercentage),
    taxAmount: toNumber(form.taxAmount),
    grandTotal: toNumber(form.grandTotal),
    salesPerson: buildSalesPerson(),
    termsAndConditions: form.termsAndConditions,
    versionNo: toNumber(form.versionNo),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.tenantId.trim()) {
      ToasterService.error("Tenant ID is required");
      return;
    }
    if (!isPositiveNumber(form.customerId) || !form.validUntil || !form.quoteDate) {
      ToasterService.error("Required fields missing", "Customer ID, quote date, and valid until date are required.");
      return;
    }
    if (!isPositiveNumber(form.salesPersonId)) {
      ToasterService.error("Sales person required", "Select a sales person from the dropdown.");
      return;
    }
    if (!isPositiveNumber(form.itemQuantity) || !isPositiveNumber(form.itemUnitPrice)) {
      ToasterService.error("Line item required", "Quantity and unit price must be greater than zero.");
      return;
    }
    if (form.itemType === "PRODUCT" && !isPositiveNumber(form.itemProductId)) {
      ToasterService.error("Product ID required", "For PRODUCT quotations, enter a valid product ID.");
      return;
    }
    if (form.itemType === "SERVICE" && !isPositiveNumber(form.itemServiceItemId)) {
      ToasterService.error("Service item ID required", "For SERVICE quotations, enter a valid service item ID.");
      return;
    }
    if (!isPercent(form.discountPercentage) || !isPercent(form.itemDiscountPercentage) || !isPercent(form.itemTaxRate)) {
      ToasterService.error("Invalid percentage", "Discount and tax percentages must be between 0 and 100.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const res = editingId
        ? await axios.put<Quotation>(`${API_URL}/${editingId}`, payload, { headers })
        : await axios.post<Quotation>(API_URL, payload, { headers });

      setQuotations((current) => {
        const exists = current.some((item) => item.id === res.data.id);
        if (exists) return current.map((item) => (item.id === res.data.id ? res.data : item));
        return [res.data, ...current];
      });
      ToasterService.success(editingId ? "Quotation updated" : "Quotation created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const applyCalculatedTotals = () => {
    const item = calculateItem(form);
    setForm((current) => ({
      ...current,
      subTotal: String(item.grossAmount),
      discountAmount: String(item.discountAmount),
      additionalDiscount: String(item.additionalDiscount),
      taxAmount: String(item.taxAmount),
      grandTotal: String(Number(item.lineTotal.toFixed(2))),
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, tenantId: getStoredTenantId(), validUntil: today, quoteDate: today });
    setShowFormModal(true);
  };

  const openEdit = async (quotation: Quotation) => {
    try {
      setLoading(true);
      const res = await axios.get<Quotation>(`${API_URL}/${quotation.id}`, { headers });
      const full = res.data;
      const firstItem = full.items?.[0];
      setEditingId(full.id);
      setForm({
        tenantId: getStoredTenantId(),
        customerId: String(full.customerId || ""),
        quotationType: full.quotationType || "PRODUCT",
        validUntil: full.validUntil || today,
        currencyCode: full.currencyCode || "INR",
        remarks: full.remarks || "",
        internalNotes: full.internalNotes || "",
        customerNotes: full.customerNotes || "",
        subject: full.subject || "",
        email: full.email || "",
        quoteNumber: full.quoteNumber || "",
        quoteDate: full.quoteDate || today,
        status: full.status || "DRAFT",
        subTotal: String(full.subTotal || 0),
        discountAmount: String(full.discountAmount || 0),
        additionalDiscount: String(full.additionalDiscount || 0),
        discountPercentage: String(full.discountPercentage || 0),
        taxAmount: String(full.taxAmount || 0),
        grandTotal: String(full.grandTotal || 0),
        salesPersonId: String(full.salesPerson?.id || ""),
        termsAndConditions: full.termsAndConditions || "",
        versionNo: String(full.versionNo || 0),
        billingAddressLine1: full.billingAddress?.addressLine1 || "",
        billingCity: full.billingAddress?.city || "",
        billingState: full.billingAddress?.state || "",
        billingCountry: full.billingAddress?.country || "",
        billingPostalCode: full.billingAddress?.postalCode || "",
        shippingAddressLine1: full.shippingAddress?.addressLine1 || "",
        shippingCity: full.shippingAddress?.city || "",
        shippingState: full.shippingAddress?.state || "",
        shippingCountry: full.shippingAddress?.country || "",
        shippingPostalCode: full.shippingAddress?.postalCode || "",
        itemCategoryId: String(firstItem?.categoryId || ""),
        itemCategoryName: firstItem?.categoryName || "",
        itemType: firstItem?.itemType || "PRODUCT",
        itemProductId: String(firstItem?.productId || ""),
        itemProductName: firstItem?.productName || "",
        itemServiceItemId: String(firstItem?.serviceItemId || 0),
        itemDescription: firstItem?.description || "",
        itemProductCode: firstItem?.productCode || "",
        itemUom: firstItem?.uom || "",
        itemQuantity: String(firstItem?.quantity || 1),
        itemUnitPrice: String(firstItem?.unitPrice || 0),
        itemDiscountPercentage: String(firstItem?.discountPercentage || 0),
        itemDiscountAmount: String(firstItem?.discountAmount || 0),
        itemTaxRate: String(firstItem?.taxRate || 0),
        itemTaxCode: firstItem?.taxCode || "",
        itemRemarks: firstItem?.remarks || "",
        itemAdditionalDiscount: String(firstItem?.additionalDiscount || 0),
      });
      setShowFormModal(true);
    } catch (error) {
      ToasterService.error("Failed to load quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const confirmDelete = async () => {
    if (!deleteQuotation) return;

    try {
      await axios.delete(`${API_URL}/${deleteQuotation.id}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setQuotations((current) => current.filter((item) => item.id !== deleteQuotation.id));
      ToasterService.success("Quotation deleted");
    } catch (error) {
      ToasterService.error("Failed to delete quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteQuotation(null);
    }
  };

  const filteredQuotations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quotations;
    return quotations.filter((quotation) =>
      [
        quotation.id,
        quotation.quoteNumber,
        quotation.customerId,
        quotation.subject,
        quotation.email,
        quotation.status,
        quotation.salesPerson?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [quotations, search]);

  const stats = useMemo(() => ({
    total: quotations.length,
    draft: quotations.filter((item) => item.status === "DRAFT").length,
    accepted: quotations.filter((item) => item.status === "ACCEPTED").length,
    grandTotal: quotations.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0),
  }), [quotations]);

  const columns: ColumnDef<Quotation>[] = [
    {
      key: "quoteNumber",
      label: "Quotation",
      sortable: true,
      render: (quotation) => (
        <div>
          <div className="font-medium text-cyan-700">{quotation.quoteNumber || `Quote #${quotation.id}`}</div>
          <div className="text-xs text-slate-500">{quotation.subject || "No subject"}</div>
        </div>
      ),
    },
    { key: "customerId", label: "Customer", sortable: true },
    {
      key: "salesPerson",
      label: "Sales Person",
      sortable: true,
      render: (quotation) => quotation.salesPerson?.name || `#${quotation.salesPerson?.id || "--"}`,
    },
    {
      key: "quoteDate",
      label: "Quote Date",
      sortable: true,
      render: (quotation) => quotation.quoteDate || "--",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (quotation) => (
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {quotation.status || "N/A"}
        </span>
      ),
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      sortable: true,
      render: (quotation) => <span className="font-semibold text-slate-900">{money(quotation.grandTotal)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (quotation) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(quotation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteQuotation(quotation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
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
      <PageMeta title="Quotations" description="Manage sales quotations" />
      <PageBreadcrumb pageTitle="Quotations" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Quotation" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Quotations" value={stats.total} icon={<DocumentTextIcon />} />
          <StatsCard
            label="Draft"
            value={stats.draft}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<CalendarDaysIcon />}
          />
          <StatsCard
            label="Accepted"
            value={stats.accepted}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<DocumentTextIcon />}
          />
          <StatsCard
            label="Grand Total"
            value={money(stats.grandTotal)}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BanknotesIcon />}
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FloatingInput
              label="Quotation ID"
              type="number"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button
              type="button"
              onClick={fetchById}
              className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Get By ID
            </button>
            <button
              type="button"
              onClick={fetchQuotations}
              className="h-[52px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Load All
            </button>
          </div>
        </div>

        <div className="relative w-full sm:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search quotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <ReusableTable
          data={filteredQuotations}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="quoteDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No quotations found</p>
              <button type="button" onClick={openCreate} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                Create your first quotation
              </button>
            </div>
          }
        />
      </div>

      {showFormModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingId ? "Edit Quotation" : "Create Quotation"}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">Enter quotation details from the API schema</p>
                </div>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
                  <FloatingInput label="Customer ID" name="customerId" type="number" value={form.customerId} onChange={handleChange} required />
                  <FloatingSelect
                    label="Sales Person"
                    name="salesPersonId"
                    value={form.salesPersonId}
                    onChange={handleChange}
                    emptyOptionLabel="Select sales person"
                    options={salesPersons.map((person) => ({
                      id: String(person.id),
                      name: person.name || `Person #${person.id}`,
                    }))}
                  />
                  <FloatingSelect
                    label="Quotation Type"
                    name="quotationType"
                    value={form.quotationType}
                    onChange={handleChange}
                    includeEmptyOption={false}
                    options={quotationTypeOptions.map((item) => ({ id: item, name: item }))}
                  />
                  <FloatingInput label="Quote Number" name="quoteNumber" value={form.quoteNumber} onChange={handleChange} />
                  <FloatingDatePicker label="Quote Date" name="quoteDate" value={form.quoteDate} onChange={handleChange} required />
                  <FloatingDatePicker label="Valid Until" name="validUntil" value={form.validUntil} onChange={handleChange} required />
                  <FloatingSelect
                    label="Status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    includeEmptyOption={false}
                    options={statusOptions.map((item) => ({ id: item, name: item }))}
                  />
                  <FloatingInput label="Currency Code" name="currencyCode" value={form.currencyCode} onChange={handleChange} />
                  <FloatingInput label="Subject" name="subject" value={form.subject} onChange={handleChange} />
                  <FloatingInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
                  <FloatingInput label="Version No" name="versionNo" type="number" value={form.versionNo} onChange={handleChange} />
                  <FloatingInput label="Sub Total" name="subTotal" type="number" value={form.subTotal} onChange={handleChange} />
                  <FloatingInput label="Discount Amount" name="discountAmount" type="number" value={form.discountAmount} onChange={handleChange} />
                  <FloatingInput label="Additional Discount" name="additionalDiscount" type="number" value={form.additionalDiscount} onChange={handleChange} />
                  <FloatingInput label="Discount %" name="discountPercentage" type="number" value={form.discountPercentage} onChange={handleChange} />
                  <FloatingInput label="Tax Amount" name="taxAmount" type="number" value={form.taxAmount} onChange={handleChange} />
                  <FloatingInput label="Grand Total" name="grandTotal" type="number" value={form.grandTotal} onChange={handleChange} />
                </div>

                <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FloatingInput label="Billing Address" name="billingAddressLine1" value={form.billingAddressLine1} onChange={handleChange} />
                  <FloatingInput label="Shipping Address" name="shippingAddressLine1" value={form.shippingAddressLine1} onChange={handleChange} />
                  <FloatingInput label="Billing City" name="billingCity" value={form.billingCity} onChange={handleChange} />
                  <FloatingInput label="Shipping City" name="shippingCity" value={form.shippingCity} onChange={handleChange} />
                  <FloatingInput label="Billing State" name="billingState" value={form.billingState} onChange={handleChange} />
                  <FloatingInput label="Shipping State" name="shippingState" value={form.shippingState} onChange={handleChange} />
                  <FloatingInput label="Billing Country" name="billingCountry" value={form.billingCountry} onChange={handleChange} />
                  <FloatingInput label="Shipping Country" name="shippingCountry" value={form.shippingCountry} onChange={handleChange} />
                  <FloatingInput label="Billing Postal Code" name="billingPostalCode" value={form.billingPostalCode} onChange={handleChange} />
                  <FloatingInput label="Shipping Postal Code" name="shippingPostalCode" value={form.shippingPostalCode} onChange={handleChange} />
                </div>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Quotation Item</h4>
                    <button
                      type="button"
                      onClick={applyCalculatedTotals}
                      className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Calculate Totals
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FloatingInput label="Category ID Optional" name="itemCategoryId" type="number" value={form.itemCategoryId} onChange={handleChange} />
                    <FloatingInput label="Category Name" name="itemCategoryName" value={form.itemCategoryName} onChange={handleChange} />
                    <FloatingSelect
                      label="Item Type"
                      name="itemType"
                      value={form.itemType}
                      onChange={handleChange}
                      includeEmptyOption={false}
                      options={[
                        { id: "PRODUCT", name: "PRODUCT" },
                        { id: "SERVICE", name: "SERVICE" },
                      ]}
                    />
                    <FloatingInput label="Product ID" name="itemProductId" type="number" value={form.itemProductId} onChange={handleChange} required />
                    <FloatingInput label="Product Name" name="itemProductName" value={form.itemProductName} onChange={handleChange} />
                    <FloatingInput label="Service Item ID" name="itemServiceItemId" type="number" value={form.itemServiceItemId} onChange={handleChange} />
                    <FloatingInput label="Product Code" name="itemProductCode" value={form.itemProductCode} onChange={handleChange} />
                    <FloatingInput label="Description" name="itemDescription" value={form.itemDescription} onChange={handleChange} />
                    <FloatingInput label="UOM" name="itemUom" value={form.itemUom} onChange={handleChange} />
                    <FloatingInput label="Quantity" name="itemQuantity" type="number" value={form.itemQuantity} onChange={handleChange} required />
                    <FloatingInput label="Unit Price" name="itemUnitPrice" type="number" value={form.itemUnitPrice} onChange={handleChange} required />
                    <FloatingInput label="Item Discount %" name="itemDiscountPercentage" type="number" value={form.itemDiscountPercentage} onChange={handleChange} />
                    <FloatingInput label="Item Discount Amount" name="itemDiscountAmount" type="number" value={form.itemDiscountAmount} onChange={handleChange} />
                    <FloatingInput label="Item Additional Discount" name="itemAdditionalDiscount" type="number" value={form.itemAdditionalDiscount} onChange={handleChange} />
                    <FloatingInput label="Tax Rate" name="itemTaxRate" type="number" value={form.itemTaxRate} onChange={handleChange} />
                    <FloatingInput label="Tax Code" name="itemTaxCode" value={form.itemTaxCode} onChange={handleChange} />
                    <FloatingInput label="Item Remarks" name="itemRemarks" value={form.itemRemarks} onChange={handleChange} />
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FloatingTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={3} />
                  <FloatingTextarea label="Terms and Conditions" name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} rows={3} />
                  <FloatingTextarea label="Internal Notes" name="internalNotes" value={form.internalNotes} onChange={handleChange} rows={3} />
                  <FloatingTextarea label="Customer Notes" name="customerNotes" value={form.customerNotes} onChange={handleChange} rows={3} />
                </div>

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button type="button" onClick={closeForm} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Quotation" : "Create Quotation"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      <DynamicPopup
        isPopupOpen={!!deleteQuotation}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteQuotation(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Quotation"
        subText={deleteQuotation ? `Are you sure you want to delete quotation #${deleteQuotation.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteQuotation(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default Quotations;

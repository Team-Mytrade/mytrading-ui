import React, {
  useState,
  useEffect,
  FormEvent,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  UserPlusIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowRightCircleIcon,
} from "@heroicons/react/24/outline";
import axios, { AxiosRequestConfig } from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import DynamicPopup from "../../components/common/Popup";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import {
  CUSTOMER_TYPE_OPTIONS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_OPTIONS,
  apiError,
  emailProblem,
  phoneProblem,
  phoneExample,
  fieldErrorOf,
} from "./crmShared";
import { usePermissions } from "../../access/usePermissions";
import { useUserDirectory, userOptions } from "../../access/useUserDirectory";
import { MineAllToggle, OwnRecordsNote, OwnerCell, isMine, useCrmSettings, useMineOnly, useMyUsername } from "./crmOwnership";
import { countries } from "../../company/regional";
import { addressStyle } from "../../company/regionalAddress";
import { companyCurrency, currencyChoices, formatDateTime } from "../../company/format";
import { t } from "../../i18n/i18n";
const API_URL = "/v1/api/crm/leads";
const CUSTOMER_API = "/v1/api/common/customers";
const SALES_PERSONS_API = "/v1/api/sales/sales-persons";
const getToken = () => localStorage.getItem("accessToken") || "";

// Service values; DISQUALIFIED is shown as "Lost"
type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED" | "CONVERTED";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  customer?: { id: number; name?: string; customerName?: string } | null;
  // Who looks after the lead (a login's username); empty = unassigned
  owner: string;
  ownerName?: string | null;
  // 8.3.2: who they are, where they came from and what they want
  companyName: string;
  jobTitle: string;
  source: string;
  country: string;
  city: string;
  interest: string;
  expectedValue: number | null;
  currencyCode: string;
  notes: string;
  // Why a Lost lead was lost (from CRM Settings)
  lostReason: string;
  // 8.4.15: the person's consent as captured (the website form's tick): when and where, and the notice word for
  // word. Read-only; shown in the lead's details
  consent: string;
  consentNotice: string;
}

// The form keeps text as typed (the expected value too); consent is never edited
type LeadForm = Omit<Lead, "id" | "ownerName" | "expectedValue" | "consent" | "consentNotice"> & { expectedValue: string };

interface Customer {
  id: number;
  name?: string;
  customerName?: string;
}

interface SalesPerson {
  id: number;
  name: string;
  userId?: string | number | null;
  active?: boolean;
}

// A lead or customer with the same email or phone (409 from the service)
interface DuplicateMatch {
  kind: "LEAD" | "CUSTOMER";
  id: number | null;
  name: string;
  reason: "email" | "phone";
  ownerName?: string | null;
  visible: boolean;
}

interface ConvertForm {
  customerName: string;
  customerType: string;
  taxNumber: string;
  addressLine1: string;
  city: string;
  country: string;
  postalCode: string;
  salesPersonId: string;
}

const PAGE_SIZE = 10;

const getArrayPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["data", "content", "items", "results"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
};

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const normalizeLead = (
  lead: Partial<Lead> & Record<string, unknown>,
  index: number
): Lead => {
  const rawStatus = String(lead.status ?? "NEW").toUpperCase();
  const status: LeadStatus =
    rawStatus in LEAD_STATUS_LABELS ? (rawStatus as LeadStatus) : "NEW";

  return {
    id: Number(lead.id ?? index + 1),
    name: text(lead.name),
    email: text(lead.email),
    phone: text(lead.phone),
    status,
    customer:
      lead.customer && typeof lead.customer === "object"
        ? {
            id: Number((lead.customer as any).id),
            name: (lead.customer as any).name,
            customerName: (lead.customer as any).customerName,
          }
        : null,
    owner: text(lead.owner),
    ownerName: lead.ownerName ? String(lead.ownerName) : null,
    companyName: text(lead.companyName),
    jobTitle: text(lead.jobTitle),
    source: text(lead.source),
    country: text(lead.country),
    city: text(lead.city),
    interest: text(lead.interest),
    expectedValue: lead.expectedValue == null || String(lead.expectedValue) === "" ? null : Number(lead.expectedValue),
    currencyCode: text(lead.currencyCode),
    notes: text(lead.notes),
    lostReason: text(lead.lostReason),
    // Kept in UTC by the service
    consent: lead.consentAt
      ? `${t("Given")} ${formatDateTime(`${String(lead.consentAt)}Z`)}${lead.consentSource ? ` · ${t(String(lead.consentSource))}` : ""}`
      : "",
    consentNotice: text(lead.consentNotice),
  };
};

const normalizeCustomer = (
  c: Partial<Customer> & Record<string, unknown>,
  index: number
): Customer => ({
  id: Number(c.id ?? index + 1),
  name: String(c.name ?? c.customerName ?? "").trim(),
  customerName: String(c.customerName ?? "").trim() || undefined,
});

const getCustomerLabel = (c: Customer) =>
  c.customerName || c.name || `Customer #${c.id}`;

const emptyForm = (owner: string): LeadForm => ({
  name: "",
  email: "",
  phone: "",
  status: "NEW",
  customer: null,
  owner,
  companyName: "",
  jobTitle: "",
  source: "",
  country: "",
  city: "",
  interest: "",
  expectedValue: "",
  currencyCode: "",
  notes: "",
  lostReason: "",
});

const formOf = (lead: Lead): LeadForm => ({
  name: lead.name,
  email: lead.email,
  phone: lead.phone,
  status: lead.status,
  customer: lead.customer ?? null,
  owner: lead.owner,
  companyName: lead.companyName,
  jobTitle: lead.jobTitle,
  source: lead.source,
  country: lead.country,
  city: lead.city,
  interest: lead.interest,
  expectedValue: lead.expectedValue == null ? "" : String(lead.expectedValue),
  currencyCode: lead.currencyCode,
  notes: lead.notes,
  lostReason: lead.lostReason,
});

/** "TRN" in the UAE (and Bahrain, Oman), "VAT number" in Saudi Arabia, "GSTIN" in India; else "Tax number". */
const taxLabelFor = (country: string) => {
  const lower = country.trim().toLowerCase();
  const style = addressStyle(country);
  if (lower === "india" || lower === "in") return "GSTIN";
  if (style === "AE" || ["bahrain", "oman"].includes(lower)) return "TRN";
  if (style === "SA") return "VAT number";
  return "Tax number";
};

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const me = useMyUsername();
  const { users: directoryUsers } = useUserDirectory();
  const { settings: crmSettings } = useCrmSettings();
  const [mineOnly, setMineOnly] = useMineOnly("leads");
  const leadSearchParams = new URLSearchParams(location.search);
  const scopedLeadId = Number(leadSearchParams.get("leadId")) || null;
  const scopedLeadName = leadSearchParams.get("leadName") || "Selected lead";
  const isLeadScoped = leadSearchParams.has("leadId");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search] = useState("");
  const [selectedStatus] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );

  const [formData, setFormData] = useState<LeadForm>(emptyForm(""));
  // Leads or customers with the same email or phone, found when saving
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  // Choosing Lost in the list asks why
  const [lostPrompt, setLostPrompt] = useState<{ lead: Lead; reason: string } | null>(null);
  // Convert to customer: the customer's details
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm | null>(null);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${getToken()}` }),
    []
  );

  const countryOptions = useMemo(
    () => countries().map((c) => ({ value: c.name, label: c.name, keywords: [c.isoCode] })),
    []
  );
  const sourceOptions = (current: string) => {
    const list = crmSettings.leadSources.map((s) => ({ id: s, name: s }));
    // A source no longer on the list stays visible on the lead that has it
    return current && !list.some((o) => o.id.toLowerCase() === current.toLowerCase()) ? [...list, { id: current, name: current }] : list;
  };
  const lostReasonOptions = (current: string) => {
    const list = crmSettings.lostReasons.map((s) => ({ id: s, name: s }));
    return current && !list.some((o) => o.id.toLowerCase() === current.toLowerCase()) ? [...list, { id: current, name: current }] : list;
  };

  /* ---------------- Fetch ---------------- */

  const fetchData = async () => {
    try {
      const res = await axios.get(API_URL, { headers: authHeaders });
      const next = getArrayPayload<Partial<Lead>>(res.data).map(normalizeLead);
      setLeads(next);
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(CUSTOMER_API, { headers: authHeaders });
      setCustomers(
        getArrayPayload<Partial<Customer>>(res.data).map(normalizeCustomer)
      );
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  // Sales persons are read only when someone converts a lead (it needs SALES:VIEW; without it the field stays empty)
  const fetchSalesPersons = async (): Promise<SalesPerson[]> => {
    try {
      const res = await axios.get(SALES_PERSONS_API, { headers: authHeaders });
      const list = getArrayPayload<SalesPerson>(res.data).filter((p) => p.active !== false);
      setSalesPersons(list);
      return list;
    } catch {
      setSalesPersons([]);
      return [];
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leads.length === 0) return;
    const editId = new URLSearchParams(location.search).get("editId");
    if (!editId) return;
    const lead = leads.find((l) => l.id === Number(editId));
    if (lead) {
      setFormData(formOf(lead));
      setFormErrors({});
      setEditingId(lead.id);
      setShowModal(true);
      // Open once: otherwise the form reopens every time the list reloads (e.g. after saving)
      const params = new URLSearchParams(location.search);
      params.delete("editId");
      navigate({ search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, location.search]);

  /* ---------------- Derived ---------------- */

  // Mine: the leads the signed-in person owns
  const shownLeads = useMemo(
    () => (mineOnly ? leads.filter((lead) => isMine(lead.owner, me)) : leads),
    [leads, mineOnly, me]
  );

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return shownLeads
      .filter((lead) => {
        const matchesSearch =
          !term ||
          [lead.name, lead.companyName, lead.email, lead.phone, lead.status, lead.source]
            .some((value) => value.toLowerCase().includes(term));
        const matchesStatus = selectedStatus
          ? lead.status === selectedStatus
          : true;
        const matchesScope = !isLeadScoped || lead.id === scopedLeadId;
        return matchesSearch && matchesStatus && matchesScope;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shownLeads, search, selectedStatus, isLeadScoped, scopedLeadId]);

  const stats = useMemo(
    () => ({
      total: shownLeads.length,
      new: shownLeads.filter((l) => l.status === "NEW").length,
      contacted: shownLeads.filter((l) => l.status === "CONTACTED").length,
      qualified: shownLeads.filter((l) => l.status === "QUALIFIED").length,
    }),
    [shownLeads]
  );

  /* ---------------- Form ---------------- */

  // Shown under each field when Save finds a problem (and cleared as the field is edited)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const editField = (field: keyof LeadForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
  };

  // A new lead is the signed-in person's unless another owner is picked
  const resetForm = () => {
    setFormErrors({});
    setFormData(emptyForm(me));
    setEditingId(null);
  };

  const closeModal = () => {
    if (isSaving) return;
    setShowModal(false);
    resetForm();
  };

  const formProblems = (): Record<string, string> => {
    const problems: Record<string, string> = {};
    if (!formData.name.trim()) problems.name = "Enter the lead name";
    if (!formData.email.trim()) problems.email = "Enter the email";
    else if (emailProblem(formData.email)) problems.email = emailProblem(formData.email) as string;
    if (!formData.phone.trim()) problems.phone = "Enter the phone number";
    else if (phoneProblem(formData.phone)) problems.phone = phoneProblem(formData.phone) as string;
    if (formData.status === "DISQUALIFIED" && !formData.lostReason) problems.lostReason = "Choose why the lead was lost";
    const value = formData.expectedValue.trim();
    if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) problems.expectedValue = "Enter an amount of zero or more";
    return problems;
  };

  // allowDuplicate: saved even though a lead or customer has the same email or phone
  const saveLead = async (allowDuplicate: boolean) => {
    const problems = formProblems();
    setFormErrors(problems);
    if (Object.keys(problems).length > 0) return;
    try {
      setIsSaving(true);
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        // Empty = unassigned
        owner: formData.owner,
        companyName: formData.companyName,
        jobTitle: formData.jobTitle,
        source: formData.source,
        country: formData.country,
        city: formData.city,
        interest: formData.interest,
        expectedValue: formData.expectedValue.trim() === "" ? null : Number(formData.expectedValue),
        currencyCode: formData.currencyCode || null,
        notes: formData.notes,
        lostReason: formData.status === "DISQUALIFIED" ? formData.lostReason : null,
      };
      // quiet: this page shows its own messages (and the duplicates dialog instead of an error toast)
      const config = {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        params: allowDuplicate ? { allowDuplicate: true } : undefined,
        quiet: true,
      } as AxiosRequestConfig;
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, config);
        ToasterService.success("Lead updated successfully!");
      } else {
        await axios.post(API_URL, payload, config);
        ToasterService.success("Lead added successfully!");
      }
      setDuplicates(null);
      await fetchData();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      const found = err?.response?.status === 409 ? err.response.data?.duplicates : null;
      if (Array.isArray(found) && found.length > 0) {
        // Show who it may be; the user decides
        setDuplicates(found);
        return;
      }
      console.error("Error saving lead:", err);
      const message = apiError(err, "Failed to save lead");
      // A field the service refused is shown under that field
      const onField = fieldErrorOf(message);
      const shown = ["name", "email", "phone", "lostReason", "expectedValue", "companyName", "jobTitle", "city", "interest", "notes"];
      if (Object.keys(onField).some((f) => shown.includes(f))) setFormErrors((prev) => ({ ...prev, ...onField }));
      else ToasterService.error(Object.values(onField)[0] || message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveLead(false);
  };

  /* ---------------- Delete ---------------- */

  const confirmDelete = async () => {
    if (!deleteLead) return;
    try {
      await axios.delete(`${API_URL}/${deleteLead.id}`, {
        headers: authHeaders,
      });
      await fetchData();
      ToasterService.success("Lead deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting lead:", err);
      ToasterService.error(apiError(err, "Failed to delete lead"));
    } finally {
      setDeleteLead(null);
      setShowDeletePopup(false);
    }
  };

  /* ---------------- Convert to customer ---------------- */

  // Opens the customer form, filled in from the lead (and its owner's sales person)
  const openConvert = async (lead: Lead) => {
    if (lead.customer) {
      ToasterService.info(
        `"${lead.name}" is already linked to ${
          lead.customer.customerName || lead.customer.name || "a customer"
        }`
      );
      return;
    }
    setConvertLead(lead);
    setConvertForm({
      customerName: lead.companyName || lead.name,
      customerType: "WHOLESALE",
      taxNumber: "",
      addressLine1: "",
      city: lead.city,
      country: lead.country,
      postalCode: "",
      salesPersonId: "",
    });
    const persons = await fetchSalesPersons();
    const user = directoryUsers.find((u) => isMine(u.username, lead.owner));
    const ownerPerson = user ? persons.find((p) => String(p.userId ?? "") === String(user.userId)) : undefined;
    if (ownerPerson) setConvertForm((prev) => (prev ? { ...prev, salesPersonId: String(ownerPerson.id) } : prev));
  };

  const closeConvert = () => {
    if (convertingId) return;
    setConvertLead(null);
    setConvertForm(null);
  };

  const submitConvert = async (e: FormEvent) => {
    e.preventDefault();
    if (!convertLead || !convertForm) return;
    if (!convertForm.customerName.trim()) {
      ToasterService.error("Enter the customer name");
      return;
    }
    const person = salesPersons.find((p) => String(p.id) === convertForm.salesPersonId);
    try {
      setConvertingId(convertLead.id);
      const res = await axios.post(
        `${API_URL}/${convertLead.id}/convert`,
        {
          customerName: convertForm.customerName,
          customerType: convertForm.customerType,
          taxNumber: convertForm.taxNumber,
          addressLine1: convertForm.addressLine1,
          city: convertForm.city,
          country: convertForm.country,
          postalCode: convertForm.postalCode,
          salesPersonId: person ? person.id : null,
          salesPersonName: person ? person.name : null,
        },
        { headers: { ...authHeaders, "Content-Type": "application/json" } }
      );
      const customerName = res.data?.customer?.customerName;
      ToasterService.success(
        `"${convertLead.name}" converted${customerName ? ` — customer ${customerName} created` : " to a customer"}`
      );
      setConvertLead(null);
      setConvertForm(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error converting lead:", err);
      const message = apiError(err, "Failed to convert lead");
      ToasterService.error(Object.values(fieldErrorOf(message))[0] || message);
    } finally {
      setConvertingId(null);
    }
  };

  /* ---------------- Link to existing customer (kept for flexibility) ---------------- */

  const openLinkModal = (leadId: number) => {
    setSelectedLeadId(leadId);
    setSelectedCustomerId(null);
    setShowLinkModal(true);
    fetchCustomers();
  };

  const handleLinkCustomer = async () => {
    if (!selectedLeadId || !selectedCustomerId) {
      ToasterService.warning("Please select a customer.");
      return;
    }
    try {
      await axios.post(
        `${API_URL}/${selectedLeadId}/customer/${selectedCustomerId}`,
        {},
        { headers: authHeaders }
      );
      ToasterService.success("Lead linked to customer successfully!");
      setShowLinkModal(false);
      setSelectedCustomerId(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error linking customer:", err);
      ToasterService.error(apiError(err, "Failed to link customer"));
    }
  };

  /* ---------------- Inline status ---------------- */

  // Only the status (and, for Lost, the reason) is sent: the lead's other details stay as they are
  const handleInlineStatusChange = async (lead: Lead, status: LeadStatus, lostReason?: string) => {
    if (lead.status === status) return;
    if (status === "DISQUALIFIED" && !lostReason) {
      setLostPrompt({ lead, reason: crmSettings.lostReasons[0] ?? "" });
      return;
    }
    const previous = leads;
    setLeads((cur) =>
      cur.map((item) => (item.id === lead.id ? { ...item, status, lostReason: lostReason ?? "" } : item))
    );
    try {
      setStatusUpdatingId(lead.id);
      await axios.put(
        `${API_URL}/${lead.id}`,
        status === "DISQUALIFIED" ? { status, lostReason } : { status },
        { headers: { ...authHeaders, "Content-Type": "application/json" } }
      );
      ToasterService.success("Lead status updated successfully!");
    } catch (err) {
      console.error("Error updating lead status:", err);
      setLeads(previous);
      ToasterService.error(apiError(err, "Failed to update lead status"));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const getStatusBadgeColor = (status: LeadStatus) => {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-800";
      case "CONTACTED":
        return "bg-yellow-100 text-yellow-800";
      case "QUALIFIED":
        return "bg-green-100 text-green-800";
      case "DISQUALIFIED":
        return "bg-red-100 text-red-800";
      case "CONVERTED":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  /* ---------------- Columns ---------------- */

  const tableColumns: ColumnDef<Lead>[] = [
    {
      key: "name",
      label: "Lead Name",
      sortable: true,
      render: (lead) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-sm font-medium text-cyan-700">
              {(lead.name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {lead.name || "Unnamed lead"}
            </div>
            {lead.customer ? (
              <div className="text-xs text-gray-500 truncate">
                {t("Customer:")} {lead.customer.customerName || lead.customer.name}
              </div>
            ) : lead.companyName ? (
              <div className="text-xs text-gray-500 truncate" title={lead.jobTitle || undefined}>
                {lead.companyName}
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (lead) => (
        <div
          className="flex items-center text-sm text-gray-600 truncate"
          title={lead.email}
        >
          <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate">{lead.email || "-"}</span>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      render: (lead) => (
        <div className="flex items-center text-sm text-gray-600">
          <PhoneIcon className="h-3 w-3 mr-1 truncate whitespace-nowrap text-gray-400 flex-shrink-0" />
          {lead.phone || "-"}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (lead) =>
        // A converted lead stays converted (it is linked to its customer)
        lead.status === "CONVERTED" || !canUpdate ? (
          <span
            className={`inline-flex w-[112px] items-center rounded-lg px-2 py-1.5 text-xs font-semibold ${getStatusBadgeColor(lead.status)}`}
            title={lead.lostReason || undefined}
          >
            {t(LEAD_STATUS_LABELS[lead.status] ?? "")}
          </span>
        ) : (
        <div onClick={(e) => e.stopPropagation()} title={lead.lostReason ? `${t("Lost reason")}: ${lead.lostReason}` : undefined}>
          <select
            value={lead.status}
            onChange={(e) =>
              handleInlineStatusChange(lead, e.target.value as LeadStatus)
            }
            disabled={statusUpdatingId === lead.id}
            className={`w-[112px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${getStatusBadgeColor(
              lead.status
            )} ${
              statusUpdatingId === lead.id
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer"
            }`}
          >
            {LEAD_STATUS_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(option.name)}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      render: (lead) => <span className="text-sm text-gray-600">{lead.source || "-"}</span>,
    },
    {
      key: "ownerName",
      label: "Owner",
      sortable: true,
      sortValueGetter: (lead) => lead.ownerName || lead.owner || "",
      render: (lead) => <OwnerCell owner={lead.owner} ownerName={lead.ownerName} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (lead) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Convert to Customer (or already-linked indicator) */}
          {!lead.customer ? (
            canCreate && <button
              type="button"
              onClick={() => openConvert(lead)}
              disabled={convertingId === lead.id}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
              title={t("Convert to Customer")}
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate(`/crm-view/customers/${lead.customer!.id}`, { state: { from: "leads" } })
              }
              className="rounded-lg p-2 text-emerald-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
              title={`View linked customer: ${
                lead.customer.customerName || lead.customer.name
              }`}
            >
              <UsersIcon className="h-4 w-4" />
            </button>
          )}

          {/* Link to an existing customer (opens modal) — hidden if already linked */}
          {!lead.customer && canCreate && (
            <button
              type="button"
              onClick={() => openLinkModal(lead.id)}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
              title={t("Link to existing customer")}
            >
              <UserPlusIcon className="h-4 w-4" />
            </button>
          )}

          {/* Edit */}
          {canUpdate && (
            <button
              type="button"
              onClick={() => {
                setFormData(formOf(lead));
                setFormErrors({});
                setEditingId(lead.id);
                setShowModal(true);
              }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title={t("Edit Lead")}
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setDeleteLead(lead);
                setShowDeletePopup(true);
              }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title={t("Delete Lead")}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const modalShell = (title: string, subtitle: string, onClose: () => void, body: React.ReactNode) =>
    createPortal(
      <div data-overlay-dim data-overlay className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
        <div data-overlay-panel className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto">
          <div data-overlay-header className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="p-5">{body}</div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <PageMeta title={t("Leads")} description="Manage your sales leads" />
      <PageBreadcrumb pageTitle="Leads" showAddButton addButtonLabel="Add Lead" onAddClick={() => { resetForm(); setShowModal(true); }} />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">
        {isLeadScoped && <div className="mb-4 mx-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900"><span>{t("Showing lead:")} <strong>{scopedLeadName}</strong></span><button type="button" onClick={() => navigate("/leads")} className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline">{t("View all leads")}</button></div>}
        <OwnRecordsNote settings={crmSettings} />
        <div className="py-4 px-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-[17px]">
            <StatsCard
              label={t("Total Leads")}
              value={stats.total}
              gradient="from-cyan-50 to-blue-50"
              borderColor="border-cyan-100"
              labelColor="text-cyan-600"
            />
            <StatsCard
              label={t("New")}
              value={stats.new}
              gradient="from-green-50 to-emerald-50"
              borderColor="border-green-100"
              labelColor="text-green-600"
            />
            <StatsCard
              label={t("Contacted")}
              value={stats.contacted}
              gradient="from-purple-50 to-pink-50"
              borderColor="border-purple-100"
              labelColor="text-purple-600"
            />
            <StatsCard
              label={t("Qualified")}
              value={stats.qualified}
              gradient="from-orange-50 to-yellow-50"
              borderColor="border-orange-100"
              labelColor="text-orange-600"
            />
          </div>

          <ReusableTable<Lead>
            data={filteredLeads}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="name"
            defaultSortOrder="asc"
            toolbar={<MineAllToggle mineOnly={mineOnly} onChange={setMineOnly} mineLabel="My leads" />}
            enableRowDetails={true}
            detailLabels={{ consent: t("Consent"), consentNotice: t("What they agreed to") }}
           hiddenDetailKeys={[
              "id",
              "owner",
               "tenantId",
             "createdBy",
              "updatedBy",
              "deletedBy",
             "createdAt",
              "updatedAt",
              "deletedAt",
             ]}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <UsersIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm mb-1">{t("No leads found")}</p>
                {search ? (
                  <p className="text-gray-400 text-xs">
                    {t("Try adjusting your search")}
                  </p>
                ) : (
                  canCreate && <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowModal(true);
                    }}
                    className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                  >
                    {t("Add your first lead")}
                  </button>
                )}
              </div>
            }
          />
        </div>

        {/* Link to Existing Customer Modal */}
        {showLinkModal &&
          createPortal(
            <div data-overlay-dim data-overlay className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
              <div data-overlay-panel className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
                <div data-overlay-header className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t("Link to Existing Customer")}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t("Choose an existing customer record to link this lead to")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowLinkModal(false);
                      setSelectedCustomerId(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5">
                  <div className="mb-4 pt-2">
                    <FloatingSelect
                      label={t("Select Customer")}
                      name="customerId"
                      value={selectedCustomerId ?? ""}
                      onChange={(e) =>
                        setSelectedCustomerId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      options={customers.map((c) => ({
                        id: c.id,
                        name: getCustomerLabel(c),
                      }))}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowLinkModal(false);
                        setSelectedCustomerId(null);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      {t("Cancel")}
                    </button>
                    <button
                      onClick={handleLinkCustomer}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 shadow-sm"
                    >
                      {t("Link Customer")}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Add/Edit Lead */}
      <PaginatedPopup
        isOpen={showModal}
        title={t(editingId ? "Edit Lead" : "Add New Lead")}
        subtitle={t(editingId ? "Update lead information" : "Add a new lead to your pipeline")}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitLabel={t(editingId ? "Update Lead" : "Add Lead")}
        submitting={isSaving}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Lead",
            fields: [
              <FloatingInput
                key="name"
                label={t("Lead Name")}
                name="name"
                value={formData.name}
                onChange={(e) => editField("name", e.target.value)}
                example={t("e.g. Al Noor Trading")}
                error={formErrors.name}
                required
              />,
              <FloatingInput
                key="companyName"
                label={t("Company")}
                name="companyName"
                value={formData.companyName}
                onChange={(e) => editField("companyName", e.target.value)}
                example={t("When the lead is a person: the company they buy for")}
                error={formErrors.companyName}
              />,
              <FloatingInput
                key="jobTitle"
                label={t("Job title")}
                name="jobTitle"
                value={formData.jobTitle}
                onChange={(e) => editField("jobTitle", e.target.value)}
                error={formErrors.jobTitle}
              />,
              <FloatingInput
                key="email"
                label={t("Email")}
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => editField("email", e.target.value)}
                example="name@company.com"
                error={formErrors.email}
                required
              />,
              <FloatingInput
                key="phone"
                label={t("Phone")}
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => editField("phone", e.target.value)}
                example={phoneExample()}
                error={formErrors.phone}
                required
              />,
              <FloatingSelect
                key="status"
                label={t("Status")}
                name="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                disabled={formData.status === "CONVERTED"}
                options={
                  formData.status === "CONVERTED"
                    ? [{ id: "CONVERTED", name: LEAD_STATUS_LABELS.CONVERTED }]
                    : LEAD_STATUS_OPTIONS
                }
              />,
              ...(formData.status === "DISQUALIFIED"
                ? [
                    <div key="lostReason">
                      <FloatingSelect
                        label={t("Lost reason")}
                        name="lostReason"
                        value={formData.lostReason}
                        onChange={(e) => editField("lostReason", e.target.value)}
                        options={lostReasonOptions(formData.lostReason)}
                        required
                      />
                      {formErrors.lostReason && <p className="error-text mt-1 text-xs text-red-600">{t(formErrors.lostReason)}</p>}
                    </div>,
                  ]
                : []),
              <FloatingSelect
                key="source"
                label={t("Source")}
                name="source"
                value={formData.source}
                onChange={(e) => editField("source", e.target.value)}
                options={sourceOptions(formData.source)}
                emptyOptionLabel="Not known"
              />,
              <FloatingSelect
                key="owner"
                label={t("Owner")}
                name="owner"
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                options={userOptions(directoryUsers, formData.owner)}
                includeEmptyOption={false}
              />,
            ],
          },
          {
            label: "Details",
            fields: [
              <SearchableSelect
                key="country"
                label={t("Country")}
                value={formData.country}
                options={countryOptions}
                onChange={(value) => editField("country", value)}
                emptyOptionLabel="Not known"
              />,
              <FloatingInput
                key="city"
                label={t("City")}
                name="city"
                value={formData.city}
                onChange={(e) => editField("city", e.target.value)}
                error={formErrors.city}
              />,
              <FloatingInput
                key="expectedValue"
                label={t("Expected value")}
                name="expectedValue"
                type="number"
                value={formData.expectedValue}
                onChange={(e) => editField("expectedValue", e.target.value)}
                example={t("What the business could be worth")}
                error={formErrors.expectedValue}
              />,
              <FloatingSelect
                key="currencyCode"
                label={t("Currency")}
                name="currencyCode"
                value={formData.currencyCode || companyCurrency()}
                onChange={(e) => editField("currencyCode", e.target.value)}
                options={currencyChoices(formData.currencyCode || undefined).map((c) => ({ id: c, name: c }))}
                includeEmptyOption={false}
              />,
              <div key="interest" className="md:col-span-2">
                <FloatingInput
                  label={t("Interested in")}
                  name="interest"
                  value={formData.interest}
                  onChange={(e) => editField("interest", e.target.value)}
                  example={t("e.g. 40 laptops for a new branch")}
                  error={formErrors.interest}
                />
              </div>,
              <div key="notes" className="md:col-span-2">
                <FloatingTextarea
                  label={t("Notes")}
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => editField("notes", e.target.value)}
                  error={formErrors.notes}
                />
              </div>,
            ],
          },
        ]}
      />

      {/* The same email or phone is already in the CRM */}
      {duplicates &&
        modalShell(
          t("This may already be in the CRM"),
          t("A lead or customer has the same email or phone. Check before adding it again."),
          () => setDuplicates(null),
          <>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {duplicates.map((match, index) => (
                <li key={`${match.kind}-${match.id ?? index}`} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${match.kind === "CUSTOMER" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {t(match.kind === "CUSTOMER" ? "Customer" : "Lead")}
                      </span>
                      <span className="truncate font-medium text-gray-900">{match.name}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {t(match.reason === "email" ? "Same email" : "Same phone")}
                      {match.ownerName ? ` · ${t("Owner")}: ${match.ownerName}` : ""}
                      {!match.visible ? ` · ${t("Another sales person's lead")}` : ""}
                    </div>
                  </div>
                  {match.visible && match.id != null && (
                    <button
                      type="button"
                      onClick={() => {
                        setDuplicates(null);
                        setShowModal(false);
                        resetForm();
                        navigate(match.kind === "CUSTOMER" ? `/crm-view/customers/${match.id}` : `/leads?editId=${match.id}`);
                      }}
                      className="shrink-0 text-xs font-semibold text-cyan-700 hover:underline"
                    >
                      {t("Open")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicates(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                {t("Go back")}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => saveLead(true)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 shadow-sm disabled:opacity-60"
              >
                {t("Save anyway")}
              </button>
            </div>
          </>
        )}

      {/* Lost: why? (from the list) */}
      {lostPrompt &&
        modalShell(
          t("Why was the lead lost?"),
          lostPrompt.lead.name,
          () => setLostPrompt(null),
          <>
            <FloatingSelect
              label={t("Lost reason")}
              name="lostPromptReason"
              value={lostPrompt.reason}
              onChange={(e) => setLostPrompt({ ...lostPrompt, reason: e.target.value })}
              options={lostReasonOptions(lostPrompt.reason)}
              includeEmptyOption={false}
              required
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLostPrompt(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={!lostPrompt.reason}
                onClick={() => {
                  const { lead, reason } = lostPrompt;
                  setLostPrompt(null);
                  handleInlineStatusChange(lead, "DISQUALIFIED", reason);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm disabled:opacity-60"
              >
                {t("Mark as Lost")}
              </button>
            </div>
          </>
        )}

      {/* Convert to customer: the customer's details, filled in from the lead */}
      <PaginatedPopup
        isOpen={!!convertForm}
        title={t("Convert to Customer")}
        subtitle={t("A new customer is made from the lead; check the details first.")}
        onClose={closeConvert}
        onSubmit={submitConvert}
        submitLabel={t("Convert")}
        submitting={!!convertingId}
        maxWidthClassName="max-w-2xl"
        itemsPerPage={20}
        fields={
          convertForm
            ? [
                <div key="customerName">
                  <FloatingInput
                    label={t("Customer name")}
                    name="customerName"
                    value={convertForm.customerName}
                    onChange={(e) => setConvertForm({ ...convertForm, customerName: e.target.value })}
                    required
                  />
                  {/* Shown, not a placeholder: the name is filled in, so a placeholder would never be seen */}
                  {convertLead && convertForm.customerName.trim().toLowerCase() !== convertLead.name.trim().toLowerCase() && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("{name} becomes its main contact", { name: convertLead.name })}
                    </p>
                  )}
                </div>,
                <FloatingSelect
                  key="customerType"
                  label={t("Customer type")}
                  name="customerType"
                  value={convertForm.customerType}
                  onChange={(e) => setConvertForm({ ...convertForm, customerType: e.target.value })}
                  options={CUSTOMER_TYPE_OPTIONS}
                  includeEmptyOption={false}
                />,
                <SearchableSelect
                  key="country"
                  label={t("Country")}
                  value={convertForm.country}
                  options={countryOptions}
                  onChange={(value) => setConvertForm({ ...convertForm, country: value })}
                  emptyOptionLabel="Not known"
                />,
                <FloatingInput
                  key="city"
                  label={t("City")}
                  name="city"
                  value={convertForm.city}
                  onChange={(e) => setConvertForm({ ...convertForm, city: e.target.value })}
                />,
                <FloatingInput
                  key="addressLine1"
                  label={t("Address")}
                  name="addressLine1"
                  value={convertForm.addressLine1}
                  onChange={(e) => setConvertForm({ ...convertForm, addressLine1: e.target.value })}
                  example={t("Building, street, area")}
                />,
                <FloatingInput
                  key="postalCode"
                  label={t(addressStyle(convertForm.country) === "AE" ? "P.O. Box" : "Postal code")}
                  name="postalCode"
                  value={convertForm.postalCode}
                  onChange={(e) => setConvertForm({ ...convertForm, postalCode: e.target.value })}
                />,
                <FloatingInput
                  key="taxNumber"
                  label={t(taxLabelFor(convertForm.country))}
                  name="taxNumber"
                  value={convertForm.taxNumber}
                  onChange={(e) => setConvertForm({ ...convertForm, taxNumber: e.target.value })}
                  example={t("Needed on tax invoices; you can add it later")}
                />,
                <FloatingSelect
                  key="salesPersonId"
                  label={t("Sales person")}
                  name="salesPersonId"
                  value={convertForm.salesPersonId}
                  onChange={(e) => setConvertForm({ ...convertForm, salesPersonId: e.target.value })}
                  options={salesPersons.map((p) => ({ id: String(p.id), name: p.name }))}
                  emptyOptionLabel="None"
                />,
              ]
            : []
        }
      />

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText={t("Delete Lead")}
        subText={
          deleteLead
            ? t('Are you sure you want to delete "{name}"? This action cannot be undone.', { name: String(deleteLead.name ?? "") })
            : "Are you sure you want to delete this lead?"
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteLead(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default Leads;

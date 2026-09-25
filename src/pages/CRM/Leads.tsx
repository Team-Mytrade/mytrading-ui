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
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import DynamicPopup from "../../components/common/Popup";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
const API_URL = "/v1/api/crm/leads";
const CUSTOMER_API = "/v1/api/crm/customers";
const getToken = () => localStorage.getItem("accessToken") || "";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "LOST";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  customer?: { id: number; name?: string; customerName?: string } | null;
}

interface Customer {
  id: number;
  name?: string;
  customerName?: string;
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

const normalizeLead = (
  lead: Partial<Lead> & Record<string, unknown>,
  index: number
): Lead => {
  const rawStatus = String(lead.status ?? "NEW").toUpperCase();
  const status: LeadStatus = (
    ["NEW", "CONTACTED", "QUALIFIED", "LOST"] as const
  ).includes(rawStatus as LeadStatus)
    ? (rawStatus as LeadStatus)
    : "NEW";

  return {
    id: Number(lead.id ?? index + 1),
    name: String(lead.name ?? "").trim(),
    email: String(lead.email ?? "").trim(),
    phone: String(lead.phone ?? "").trim(),
    status,
    customer:
      lead.customer && typeof lead.customer === "object"
        ? {
            id: Number((lead.customer as any).id),
            name: (lead.customer as any).name,
            customerName: (lead.customer as any).customerName,
          }
        : null,
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

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const leadSearchParams = new URLSearchParams(location.search);
  const scopedLeadId = Number(leadSearchParams.get("leadId")) || null;
  const scopedLeadName = leadSearchParams.get("leadName") || "Selected lead";
  const isLeadScoped = leadSearchParams.has("leadId");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [showConvertPopup, setShowConvertPopup] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );

  const [formData, setFormData] = useState<Omit<Lead, "id">>({
    name: "",
    email: "",
    phone: "",
    status: "NEW",
    customer: null,
  });

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${getToken()}` }),
    []
  );

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
      setFormData({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        customer: lead.customer ?? null,
      });
      setEditingId(lead.id);
      setShowModal(true);
    }
  }, [leads, location.search]);

  /* ---------------- Derived ---------------- */

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const matchesSearch =
          !term ||
          lead.name.toLowerCase().includes(term) ||
          lead.email.toLowerCase().includes(term) ||
          lead.phone.toLowerCase().includes(term) ||
          lead.status.toLowerCase().includes(term);
        const matchesStatus = selectedStatus
          ? lead.status === selectedStatus
          : true;
        const matchesScope = !isLeadScoped || lead.id === scopedLeadId;
        return matchesSearch && matchesStatus && matchesScope;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, search, selectedStatus, isLeadScoped, scopedLeadId]);

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((l) => l.status === "NEW").length,
      contacted: leads.filter((l) => l.status === "CONTACTED").length,
      qualified: leads.filter((l) => l.status === "QUALIFIED").length,
    }),
    [leads]
  );

  /* ---------------- Form ---------------- */

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      status: "NEW",
      customer: null,
    });
    setEditingId(null);
  };

  const closeModal = () => {
    if (isSaving) return;
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      ToasterService.error("Lead name is required");
      return;
    }
    if (!formData.email.trim()) {
      ToasterService.error("Email is required");
      return;
    }
    try {
      setIsSaving(true);
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
      };
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, {
          headers: { ...authHeaders, "Content-Type": "application/json" },
        });
        ToasterService.success("Lead updated successfully!");
      } else {
        await axios.post(API_URL, payload, {
          headers: { ...authHeaders, "Content-Type": "application/json" },
        });
        ToasterService.success("Lead added successfully!");
      }
      await fetchData();
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      console.error("Error saving lead:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to save lead"
      );
    } finally {
      setIsSaving(false);
    }
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
      ToasterService.error(
        err.response?.data?.message || "Failed to delete lead"
      );
    } finally {
      setDeleteLead(null);
      setShowDeletePopup(false);
    }
  };

 /* Opens the confirm popup (does NOT call the API) */
const openConvertPopup = (lead: Lead) => {
  if (lead.customer) {
    ToasterService.info(
      `"${lead.name}" is already linked to ${
        lead.customer.customerName || lead.customer.name || "a customer"
      }`
    );
    return;
  }
  setConvertLead(lead);
  setShowConvertPopup(true);
};

/* Actually converts — called by the popup's Confirm */
const confirmConvert = async () => {
  if (!convertLead) return;
  try {
    setConvertingId(convertLead.id);
    setShowConvertPopup(false);

    try {
      await axios.post(
        `${API_URL}/${convertLead.id}/convert`,
        {},
        { headers: authHeaders }
      );
      ToasterService.success(
        `"${convertLead.name}" converted to customer successfully!`
      );
    } catch (primaryErr: any) {
      console.warn(
        "Convert endpoint unavailable:",
        primaryErr?.response?.status
      );
      ToasterService.error(
        primaryErr?.response?.data?.message ||
          "Conversion endpoint not available yet. Please contact your administrator."
      );
    }
    await fetchData();
  } catch (err: any) {
    console.error("Error converting lead:", err);
    ToasterService.error(
      err.response?.data?.message || "Failed to convert lead"
    );
  } finally {
    setConvertingId(null);
    setConvertLead(null);
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
      // Try dedicated endpoint first; fallback to full PUT
      try {
        await axios.post(
          `${API_URL}/${selectedLeadId}/customer/${selectedCustomerId}`,
          {},
          { headers: authHeaders }
        );
      } catch {
        const lead = leads.find((l) => l.id === selectedLeadId);
        if (!lead) throw new Error("Lead not found");
        await axios.put(
          `${API_URL}/${selectedLeadId}`,
          { ...lead, customer: { id: selectedCustomerId } },
          {
            headers: { ...authHeaders, "Content-Type": "application/json" },
          }
        );
      }
      ToasterService.success("Lead linked to customer successfully!");
      setShowLinkModal(false);
      setSelectedCustomerId(null);
      await fetchData();
    } catch (err: any) {
      console.error("Error linking customer:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to link customer"
      );
    }
  };

  /* ---------------- Inline status ---------------- */

  const handleInlineStatusChange = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;
    const previous = leads;
    setLeads((cur) =>
      cur.map((item) => (item.id === lead.id ? { ...item, status } : item))
    );
    try {
      setStatusUpdatingId(lead.id);
      await axios.put(
        `${API_URL}/${lead.id}`,
        {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          status,
        },
        { headers: { ...authHeaders, "Content-Type": "application/json" } }
      );
      ToasterService.success("Lead status updated successfully!");
    } catch (err) {
      console.error("Error updating lead status:", err);
      setLeads(previous);
      ToasterService.error("Failed to update lead status");
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
      case "LOST":
        return "bg-red-100 text-red-800";
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
          <div>
            <div className="text-sm font-medium text-gray-900">
              {lead.name || "Unnamed lead"}
            </div>
            {lead.customer && (
              <div className="text-xs text-gray-500">
                Customer: {lead.customer.customerName || lead.customer.name}
              </div>
            )}
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
      render: (lead) => (
        <div onClick={(e) => e.stopPropagation()}>
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
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      ),
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
            <button
              type="button"
              onClick={() => openConvertPopup(lead)}
              disabled={convertingId === lead.id}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
              title="Convert to Customer"
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate(`/customer-management/${lead.customer!.id}`)
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
          {!lead.customer && (
            <button
              type="button"
              onClick={() => openLinkModal(lead.id)}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
              title="Link to existing customer"
            >
              <UserPlusIcon className="h-4 w-4" />
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => {
              setFormData({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                status: lead.status,
                customer: lead.customer ?? null,
              });
              setEditingId(lead.id);
              setShowModal(true);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title="Edit Lead"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => {
              setDeleteLead(lead);
              setShowDeletePopup(true);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete Lead"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Leads" description="Manage your sales leads" />
      <PageBreadcrumb pageTitle="Leads" showAddButton addButtonLabel="Add Lead" onAddClick={() => { resetForm(); setShowModal(true); }} />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">
        {isLeadScoped && <div className="mb-4 mx-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900"><span>Showing lead: <strong>{scopedLeadName}</strong></span><button type="button" onClick={() => navigate("/leads")} className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline">View all leads</button></div>}
        <div className="py-4 px-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-[17px]">
            <StatsCard
              label="Total Leads"
              value={stats.total}
              gradient="from-cyan-50 to-blue-50"
              borderColor="border-cyan-100"
              labelColor="text-cyan-600"
            />
            <StatsCard
              label="New"
              value={stats.new}
              gradient="from-green-50 to-emerald-50"
              borderColor="border-green-100"
              labelColor="text-green-600"
            />
            <StatsCard
              label="Contacted"
              value={stats.contacted}
              gradient="from-purple-50 to-pink-50"
              borderColor="border-purple-100"
              labelColor="text-purple-600"
            />
            <StatsCard
              label="Qualified"
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
            enableRowDetails={true}
           hiddenDetailKeys={[
              "id",
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
                <p className="text-gray-500 text-sm mb-1">No leads found</p>
                {search ? (
                  <p className="text-gray-400 text-xs">
                    Try adjusting your search
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowModal(true);
                    }}
                    className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                  >
                    Add your first lead
                  </button>
                )}
              </div>
            }
          />
        </div>

        

        {/* Link to Existing Customer Modal */}
        {showLinkModal &&
          createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Link to Existing Customer
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Choose an existing customer record to link this lead to
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
                      label="Select Customer"
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
                      Cancel
                    </button>
                    <button
                      onClick={handleLinkCustomer}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 shadow-sm"
                    >
                      Link Customer
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
      {/* Add/Edit Lead (PaginatedPopup) */}
<PaginatedPopup
  isOpen={showModal}
  title={editingId ? "Edit Lead" : "Add New Lead"}
  subtitle={
    editingId
      ? "Update lead information"
      : "Add a new lead to your pipeline"
  }
  onClose={closeModal}
  onSubmit={handleSubmit}
  submitLabel={editingId ? "Update Lead" : "Add Lead"}
  submitting={isSaving}
  fields={[
    <FloatingInput
      key="name"
      label="Lead Name"
      name="name"
      value={formData.name}
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      required
    />,
    <FloatingInput
      key="email"
      label="Email"
      name="email"
      type="email"
      value={formData.email}
      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      required
    />,
    <FloatingInput
      key="phone"
      label="Phone"
      name="phone"
      value={formData.phone}
      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      required
    />,
    <FloatingSelect
      key="status"
      label="Status"
      name="status"
      value={formData.status}
      onChange={(e) =>
        setFormData({ ...formData, status: e.target.value as LeadStatus })
      }
      options={[
        { id: "NEW", name: "New" },
        { id: "CONTACTED", name: "Contacted" },
        { id: "QUALIFIED", name: "Qualified" },
        { id: "LOST", name: "Lost" },
      ]}
    />,
  ]}
/>

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Lead"
        subText={
          deleteLead
            ? `Are you sure you want to delete "${deleteLead.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this lead?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteLead(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
      <DynamicPopup
  isPopupOpen={showConvertPopup}
  setIsPopupOpen={setShowConvertPopup}
  icon={<ArrowRightCircleIcon className="h-6 w-6 text-emerald-600" />}
  iconBg="bg-emerald-100"
  innerText="Convert to Customer"
  subText={
    convertLead
      ? `Convert "${convertLead.name}" to a customer? A new customer record will be created and this lead marked as CONVERTED.`
      : "Convert this lead to a customer?"
  }
  confirmLabel="Convert"
  cancelLabel="Cancel"
  onConfirm={confirmConvert}
  onCancel={() => {
    setConvertLead(null);
    setShowConvertPopup(false);
  }}
  confirmBtnClass="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white"
/>
    </>
  );
};

export default Leads;

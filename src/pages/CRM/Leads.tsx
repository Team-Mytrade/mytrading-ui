import React, { useState, useEffect, FormEvent } from "react";
import { createPortal } from "react-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TagIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import DynamicPopup from "../../components/common/Popup";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_URL = "/v1/api/crm/leads";
const getToken = () => localStorage.getItem("accessToken") || "";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "LOST";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
}

interface Customer {
  id: number;
  name: string;
}

const PAGE_SIZE = 10;

const getArrayPayload = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const candidates = ["data", "content", "items", "results"];

    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }

  return [];
};

const normalizeLead = (lead: Partial<Lead> & Record<string, unknown>, index: number): Lead => ({
  id: Number(lead.id ?? index + 1),
  name: String(lead.name ?? "").trim(),
  email: String(lead.email ?? "").trim(),
  phone: String(lead.phone ?? "").trim(),
  status:
    lead.status === "CONTACTED" ||
    lead.status === "QUALIFIED" ||
    lead.status === "LOST"
      ? lead.status
      : "NEW",
});

const normalizeCustomer = (
  customer: Partial<Customer> & Record<string, unknown>,
  index: number
): Customer => ({
  id: Number(customer.id ?? index + 1),
  name: String(customer.name ?? customer.customerName ?? "").trim(),
});

const Leads: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<Omit<Lead, "id">>({
    name: "",
    email: "",
    phone: "",
    status: "NEW",
  });

  // Fetch Leads
  const fetchData = async () => {
    try {
      const res = await axios.get<Lead[]>(API_URL, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const nextLeads = getArrayPayload<Partial<Lead>>(res.data).map(normalizeLead);
      setLeads(nextLeads);
      setFilteredLeads(nextLeads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
      setFilteredLeads([]);
    }
  };

  // Fetch Customers (for assign modal)
  const fetchCustomers = async () => {
    try {
      const res = await axios.get<Customer[]>("/v1/api/crm/customers", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setCustomers(getArrayPayload<Partial<Customer>>(res.data).map(normalizeCustomer));
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  const location = useLocation();

  useEffect(() => {
    fetchData();
  }, []);

  // Handle deep-linked edit modal
  useEffect(() => {
    if (leads.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const editId = searchParams.get("editId");
      if (editId) {
        const leadToEdit = leads.find((l) => l.id === Number(editId));
        if (leadToEdit) {
          setFormData({
            name: leadToEdit.name,
            email: leadToEdit.email,
            phone: leadToEdit.phone,
            status: leadToEdit.status,
          });
          setEditingId(leadToEdit.id);
          setShowModal(true);
        }
      }
    }
  }, [leads, location.search]);

  // Search and Filter Effect
  useEffect(() => {
    const term = search.toLowerCase();
    let result = leads.filter((lead) => {
      const matchesSearch =
        lead.name.toLowerCase().includes(term) ||
        lead.email.toLowerCase().includes(term) ||
        lead.phone.toLowerCase().includes(term) ||
        lead.status.toLowerCase().includes(term);

      const matchesStatus = selectedStatus ? lead.status === selectedStatus : true;

      return matchesSearch && matchesStatus;
    });

    result = [...result].sort((a, b) => a.name.localeCompare(b.name));

    setFilteredLeads(result);
  }, [search, leads, selectedStatus]);



  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", status: "NEW" });
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, formData, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        });
      } else {
        await axios.post(`${API_URL}`, formData, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        });
      }

      fetchData();
      resetForm();
      setShowModal(false);
      ToasterService.success(editingId ? "Lead updated successfully!" : "Lead added successfully!");
    } catch (error) {
      console.error("Error saving lead:", error);
      ToasterService.error("Failed to save lead");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchData();
      setDeleteLead(null);
      setShowDeletePopup(false);
      ToasterService.success("Lead deleted successfully!");
    } catch (error) {
      console.error("Error deleting lead:", error);
      ToasterService.error("Failed to delete lead");
    }
  };

  const handleAssignCustomer = async () => {
    if (!selectedLead || !selectedCustomer) {
      ToasterService.warning("Please select a customer.");
      return;
    }
    const leadDetails = leads.find((lead) => lead.id === selectedLead);

    const payload = {
      ...leadDetails,
      customers: {
        id: selectedCustomer,
      },
    };

    try {
      await axios.put(`${API_URL}/${selectedLead}`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      ToasterService.success("Customer assigned successfully!");
      setShowAssignModal(false);
      setSelectedCustomer(null);
      fetchData();
    } catch (err) {
      console.error("Error assigning customer:", err);
      ToasterService.error("Failed to assign customer");
    }
  };

  const handleInlineStatusChange = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;

    const previousLeads = leads;
    setLeads((current) =>
      current.map((item) => (item.id === lead.id ? { ...item, status } : item))
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
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );
      ToasterService.success("Lead status updated successfully!");
    } catch (error) {
      console.error("Error updating lead status:", error);
      setLeads(previousLeads);
      ToasterService.error("Failed to update lead status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openAssignModal = (leadId: number) => {
    setSelectedLead(leadId);
    setShowAssignModal(true);
    fetchCustomers();
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
          <div className="text-sm font-medium text-gray-900">{lead.name || "Unnamed lead"}</div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (lead) => (
        <div className="flex items-center text-xs text-gray-600 truncate max-w-[100px]" title={lead.email}>
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
        <div className="flex items-center text-xs text-gray-600">
          <PhoneIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          {lead.phone || "-"}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (lead) => (
        <div onClick={(event) => event.stopPropagation()}>
          <select
            value={lead.status}
            onChange={(event) => handleInlineStatusChange(lead, event.target.value as LeadStatus)}
            disabled={statusUpdatingId === lead.id}
            className={`w-[112px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${getStatusBadgeColor(
              lead.status
            )} ${statusUpdatingId === lead.id ? "cursor-not-allowed opacity-70" : ""}`}
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
      headerClassName: "text-center",
      className: "text-center",
      render: (lead) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openAssignModal(lead.id)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
            title="Assign Customer"
          >
            <UserPlusIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate(`/customer-management?leadId=${lead.id}`)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
            title="View Customers"
          >
            <UsersIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setFormData({
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                status: lead.status,
              });
              setEditingId(lead.id);
              setShowModal(true);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title="Edit Lead"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

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
      <PageBreadcrumb pageTitle="Leads" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            label="Add Lead"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Leads"
            value={leads.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="New"
            value={leads.filter((l) => l.status === "NEW").length}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Contacted"
            value={leads.filter((l) => l.status === "CONTACTED").length}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Qualified"
            value={leads.filter((l) => l.status === "QUALIFIED").length}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads by name, email, phone or status..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FilterPopover
              title="Filter Leads"
              buttonLabel="Filters"
              label="Lead Status"
              value={selectedStatus}
              options={[
                { label: "All Statuses", value: "" },
                { label: "New", value: "NEW" },
                { label: "Contacted", value: "CONTACTED" },
                { label: "Qualified", value: "QUALIFIED" },
                { label: "Lost", value: "LOST" },
              ]}
              onChange={setSelectedStatus}
              onReset={() => setSelectedStatus("")}
              onApply={() => undefined}
            />
          </div>
        </div>

        {/* Table */}
        <ReusableTable<Lead>
          data={filteredLeads}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          onRowClick={(lead) => navigate(`/crm-view/leads/${lead.id}`, { state: { from: "leads" } })}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <UsersIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-1">No leads found</p>
              {search ? (
                <p className="text-gray-400 text-xs">Try adjusting your search</p>
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

        {/* Add/Edit Lead Modal */}
        {showModal &&
          createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingId ? "Edit Lead" : "Add New Lead"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingId ? "Update lead information" : "Add a new lead to your pipeline"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="space-y-4 pt-2">
                  <FloatingInput
                    label="Lead Name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />

                  <FloatingInput
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />

                  <FloatingInput
                    label="Phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />

                  <FloatingSelect
                    label="Status"
                    name="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                    options={[
                      { id: "NEW", name: "New" },
                      { id: "CONTACTED", name: "Contacted" },
                      { id: "QUALIFIED", name: "Qualified" },
                      { id: "LOST", name: "Lost" },
                    ]}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
                  >
                    {editingId ? "Update Lead" : "Add Lead"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Assign Customer Modal */}
        {showAssignModal &&
          createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Assign Customer</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select a customer to assign to this lead
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedCustomer(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5">
                <div className="mb-4 pt-2">
                  <FloatingSelect
                    label="Select Customer"
                    name="customerId"
                    value={selectedCustomer || ""}
                    onChange={(e) => setSelectedCustomer(Number(e.target.value))}
                    options={customers.map(customer => ({ id: customer.id, name: customer.name }))}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedCustomer(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignCustomer}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
                  >
                    Assign Customer
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

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
        onConfirm={() => {
          if (deleteLead) {
            handleDelete(deleteLead.id);
          }
        }}
        onCancel={() => setDeleteLead(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Animation Styles */}
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        tr { animation: fade-in 0.25s ease-out; cursor: pointer; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
};

export default Leads;

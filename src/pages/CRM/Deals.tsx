import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  TagIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useLocation, Link } from "react-router-dom";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import { FloatingInput, FloatingSelect1 as FloatingSelect, FloatingDatePicker } from "../../components/inputfeild/FloatingInput";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";

const API_URL = "/v1/api/crm/deals";
const PAGE_SIZE = 10;

const stageOptions = [
  { id: "PROSPECTING", name: "Prospecting" },
  { id: "NEGOTIATION", name: "Negotiation" },
  { id: "CLOSED_WON", name: "Closed Won" },
  { id: "CLOSED_LOST", name: "Closed Lost" },
];

const normalizeStage = (stage?: string) =>
  stage ? stage.trim().toUpperCase().replace(/\s+/g, "_") : "PROSPECTING";

const getStageLabel = (stage?: string) => {
  const normalized = normalizeStage(stage);
  return stageOptions.find((option) => option.id === normalized)?.name || stage || "-";
};

interface Opportunity {
  id: number;
  dealName: string;
  amount: number;
  expectedCloseDate: string;
  stage: string;
  status: "ACTIVE" | "INACTIVE";
  lead?: { id: number; name: string };
  customer?: { id: number; name?: string; customerName?: string };
}

interface Lead {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  status?: string;
  converted?: boolean;
}

interface Customer {
  id: number;
  name?: string;
  customerName?: string;
}

export default function Deals() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<Partial<Opportunity>>({});
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [inlineUpdatingId, setInlineUpdatingId] = useState<number | null>(null);

  const location = useLocation();

  useEffect(() => {
    if (showForm || showDeletePopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [showForm, showDeletePopup]);

  useEffect(() => {
    fetchOpportunities();
    fetchLeads();
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (opportunities.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const editId = searchParams.get("editId");
      if (editId) {
        const oppToEdit = opportunities.find((o) => o.id === Number(editId));
        if (oppToEdit) {
          setForm(oppToEdit);
          setShowForm(true);
        }
      }
    }
  }, [opportunities, location.search]);

  const fetchOpportunities = async () => {
    try {
      const res = await axios.get(API_URL);
      setOpportunities(res.data);
    } catch (err) {
      console.error("Error fetching opportunities", err);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await axios.get("/v1/api/crm/leads");
      setLeads(res.data);
    } catch (err) {
      console.error("Error fetching leads", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get("/v1/api/crm/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error("Error fetching customers", err);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "amount" ? Number(value) : value }));
  };

  const buildDealPayload = () => {
    const selectedLead = leads.find((lead) => lead.id === form.lead?.id);
    const selectedCustomer = customers.find((customer) => customer.id === form.customer?.id);

    return {
      dealName: form.dealName?.trim(),
      amount: Number(form.amount) || 0,
      stage: normalizeStage(form.stage),
      expectedCloseDate: form.expectedCloseDate || null,
      status: form.status || "ACTIVE",
      lead: selectedLead
        ? {
            id: selectedLead.id,
            name: selectedLead.name,
            email: selectedLead.email,
            phone: selectedLead.phone,
            status: selectedLead.status,
            converted: selectedLead.converted,
          }
        : { id: form.lead?.id },
      customer: selectedCustomer ? { id: selectedCustomer.id } : undefined,
    };
  };

  const buildOpportunityPayload = (opportunity: Opportunity) => ({
    dealName: opportunity.dealName?.trim(),
    amount: Number(opportunity.amount) || 0,
    stage: normalizeStage(opportunity.stage),
    expectedCloseDate: opportunity.expectedCloseDate || null,
    status: opportunity.status || "ACTIVE",
    lead: opportunity.lead ? { ...opportunity.lead } : undefined,
    customer: opportunity.customer ? { id: opportunity.customer.id } : undefined,
  });

  const handleInlineOpportunityChange = async (
    opportunity: Opportunity,
    changes: Partial<Pick<Opportunity, "stage" | "status">>
  ) => {
    const nextOpportunity = {
      ...opportunity,
      ...changes,
      stage: changes.stage ? normalizeStage(changes.stage) : opportunity.stage,
    };

    if (
      nextOpportunity.stage === opportunity.stage &&
      nextOpportunity.status === opportunity.status
    ) {
      return;
    }

    const previousOpportunities = opportunities;
    setOpportunities((current) =>
      current.map((item) => (item.id === opportunity.id ? nextOpportunity : item))
    );

    try {
      setInlineUpdatingId(opportunity.id);
      await axios.put(`${API_URL}/${opportunity.id}`, buildOpportunityPayload(nextOpportunity));
      ToasterService.success("Opportunity updated successfully!");
    } catch (err: any) {
      console.error("Error updating opportunity", err);
      setOpportunities(previousOpportunities);
      ToasterService.error(err.response?.data?.message || "Failed to update opportunity");
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, buildDealPayload());
        ToasterService.success("Opportunity updated successfully!");
      } else if (form.lead?.id) {
        await axios.post(`${API_URL}/lead/${form.lead.id}`, buildDealPayload());
        ToasterService.success("Opportunity created successfully!");
      } else {
        ToasterService.warning("Please select a lead before creating an opportunity");
        return;
      }
      fetchOpportunities();
      setShowForm(false);
      setForm({});
    } catch (err: any) {
      console.error("Error saving opportunity", err);
      ToasterService.error(err.response?.data?.message || "Failed to save opportunity");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API_URL}/${deleteId}`);
      ToasterService.success("Opportunity deleted successfully!");
      fetchOpportunities();
      setDeleteId(null);
      setShowDeletePopup(false);
    } catch (err) {
      console.error("Error deleting opportunity", err);
      ToasterService.error("Failed to delete opportunity");
    }
  };

  const filtered = opportunities.filter((o) => {
    const matchesSearch = [o.dealName, o.stage, o.status].some((field) =>
      field?.toLowerCase().includes(search.toLowerCase())
    );
    let matchesFilter = true;
    if (activeFilter === "ACTIVE") matchesFilter = o.status === "ACTIVE";
    else if (activeFilter === "INACTIVE") matchesFilter = o.status === "INACTIVE";
    return matchesSearch && matchesFilter;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const getStageColor = (stage: string) => {
    switch (normalizeStage(stage)) {
      case "PROSPECTING": return "border-blue-200 bg-blue-50 text-blue-700";
      case "NEGOTIATION": return "border-yellow-200 bg-yellow-50 text-yellow-700";
      case "CLOSED_WON": return "border-green-200 bg-green-50 text-green-700";
      case "CLOSED_LOST": return "border-red-200 bg-red-50 text-red-700";
      default: return "border-gray-200 bg-gray-50 text-gray-700";
    }
  };

  const handleRowClick = (opportunity: Opportunity) => {
    navigate(`/crm-view/opportunities/${opportunity.id}`, { state: { from: "opportunities" } });
  };

  const tableColumns: ColumnDef<Opportunity>[] = [
    {
      key: "dealName",
      label: "Deal Name",
      sortable: true,
      render: (o) => (
        <div className="flex items-center overflow-hidden">
          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-sm font-medium text-cyan-700">{o.dealName.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{o.dealName}</div>
            {(o.lead || o.customer) && (
              <div className="text-xs text-gray-500 truncate max-w-[150px]">{o.lead?.name || o.customer?.name || o.customer?.customerName}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (o) => (
        <div className="flex items-center text-sm font-medium text-gray-900">
          <CurrencyDollarIcon className="h-3.5 w-3.5 mr-0.5 text-gray-400 flex-shrink-0" />
          {formatCurrency(o.amount)}
        </div>
      ),
    },
    {
      key: "expectedCloseDate",
      label: "Closing Date",
      sortable: true,
      render: (o) => (
        <div className="flex items-center text-xs text-gray-600">
          <CalendarIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          {o.expectedCloseDate
            ? new Date(o.expectedCloseDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
            : "-"}
        </div>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      render: (o) => (
        <div onClick={(event) => event.stopPropagation()}>
          <select
            value={normalizeStage(o.stage)}
            onChange={(event) => handleInlineOpportunityChange(o, { stage: event.target.value })}
            disabled={inlineUpdatingId === o.id}
            className={`w-[118px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${getStageColor(
              o.stage
            )} ${inlineUpdatingId === o.id ? "cursor-not-allowed opacity-70" : ""}`}
          >
            {stageOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (o) => (
        <div onClick={(event) => event.stopPropagation()}>
          <select
            value={o.status}
            onChange={(event) =>
              handleInlineOpportunityChange(o, { status: event.target.value as Opportunity["status"] })
            }
            disabled={inlineUpdatingId === o.id}
            className={`w-[88px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${
              o.status === "ACTIVE"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            } ${inlineUpdatingId === o.id ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
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
      render: (o) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { setForm(o); setShowForm(true); }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="Edit">
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          {!o.lead ? (
            <button type="button" onClick={() => ToasterService.info("Add Lead functionality coming soon")}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600" title="Add Lead">
              <PlusIcon className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => navigate(`/crm-view/leads/${o.lead?.id}`, { state: { from: "opportunities" } })}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600" title="View Lead">
              <UsersIcon className="h-4 w-4" />
            </button>
          )}

          {!o.customer ? (
            <button type="button" onClick={() => ToasterService.info("Add Customer functionality coming soon")}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Add Customer">
              <BuildingOfficeIcon className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => navigate(`/customer-management/${o.customer?.id}`)}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="View Customer">
              <BuildingOfficeIcon className="h-4 w-4" />
            </button>
          )}

          <button type="button" onClick={() => { setDeleteId(o.id); setShowDeletePopup(true); }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Deals" description="Manage your sales opportunities" />
      <PageBreadcrumb pageTitle="Deals" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => { setForm({ status: "ACTIVE", stage: "PROSPECTING" }); setShowForm(true); }} label="Add Opportunity" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Opportunities"
            value={opportunities.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Active"
            value={opportunities.filter((o) => o.status === "ACTIVE").length}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Value"
            value={formatCurrency(opportunities.reduce((acc, o) => acc + (o.amount || 0), 0))}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Avg. Deal Size"
            value={opportunities.length > 0
              ? formatCurrency(opportunities.reduce((acc, o) => acc + (o.amount || 0), 0) / opportunities.length)
              : formatCurrency(0)}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md md:-mt-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search opportunities by name, stage, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
            <FilterPopover
              title="Filter Opportunities"
              buttonLabel="Filters"
              label="Filter by Status"
              value={activeFilter}
              options={[
                { label: "All Opportunities", value: "ALL" },
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable<Opportunity>
          data={filtered}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="dealName"
          defaultSortOrder="asc"
          onRowClick={handleRowClick}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No opportunities found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => { setForm({ status: "ACTIVE", stage: "PROSPECTING" }); setShowForm(true); }}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first opportunity
                </button>
              )}
            </div>
          }
        />

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto overflow-y-auto max-h-[90vh]">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {form.id ? "Edit Opportunity" : "Create New Opportunity"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.id ? "Update opportunity details" : "Add a new sales opportunity"}
                  </p>
                </div>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-4">
                    <FloatingInput
                      label="Deal Name"
                      name="dealName"
                      value={form.dealName || ""}
                      onChange={handleChange}
                      required
                    />

                    <FloatingInput
                      label="Amount"
                      name="amount"
                      type="number"
                      value={form.amount || ""}
                      onChange={handleChange}
                      required
                    />

                    <FloatingDatePicker
                      label="Expected Close Date"
                      name="expectedCloseDate"
                      value={form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString().split('T')[0] : ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, expectedCloseDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <FloatingSelect
                      label="Stage"
                      name="stage"
                      value={form.stage || ""}
                      onChange={handleChange}
                      options={stageOptions}
                    />

                    <FloatingSelect
                      label="Status"
                      name="status"
                      value={form.status || ""}
                      onChange={handleChange}
                      options={[
                        { id: "ACTIVE", name: "Active" },
                        { id: "INACTIVE", name: "Inactive" }
                      ]}
                    />

                    <FloatingSelect
                      label="Lead"
                      name="leadId"
                      value={form.lead?.id || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, lead: e.target.value ? { id: parseInt(e.target.value), name: "" } : undefined }))}
                      options={leads.map(lead => ({ id: lead.id, name: lead.name }))}
                      required={!form.id}
                    />

                    <FloatingSelect
                      label="Customer (Optional)"
                      name="customerId"
                      value={form.customer?.id || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, customer: e.target.value ? { id: parseInt(e.target.value), name: "" } : undefined }))}
                      options={customers.map(c => ({ id: c.id, name: c.customerName || c.name || `Customer #${c.id}` }))}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm">
                    {form.id ? "Update Opportunity" : "Create Opportunity"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Opportunity"
        subText={
          deleteId
            ? `Are you sure you want to delete "${opportunities.find((o) => o.id === deleteId)?.dealName || "this opportunity"}"? This action cannot be undone.`
            : "Are you sure you want to delete this opportunity?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        tr { animation: fade-in 0.25s ease-out; cursor: pointer; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}

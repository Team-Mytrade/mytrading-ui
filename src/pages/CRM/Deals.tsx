import {
  useEffect,
  useRef,
  useState,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  UsersIcon,
  XMarkIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  TagIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useLocation } from "react-router-dom";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingDatePicker,
} from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import PaginatedPopup from "../../components/common/unpopup";
import "./Deals.css";

const API_URL = "/v1/api/crm/deals";
const LEADS_API = "/v1/api/crm/leads";
const CUSTOMERS_API = "/v1/api/crm/customers";
const PAGE_SIZE = 10;

const stageOptions = [
  { id: "PROSPECTING", name: "Prospecting" },
  { id: "NEGOTIATION", name: "Negotiation" },
  { id: "CLOSED_WON", name: "Closed Won" },
  { id: "CLOSED_LOST", name: "Closed Lost" },
];

const normalizeStage = (stage?: string) =>
  stage ? stage.trim().toUpperCase().replace(/\s+/g, "_") : "PROSPECTING";

type OwnerType = "LEAD" | "CUSTOMER";

interface Opportunity {
  id: number;
  dealName: string;
  amount: number;
  expectedCloseDate: string;
  stage: string;
  status: "ACTIVE" | "INACTIVE";
  lead?: { id: number; name: string } | null;
  customer?: { id: number; name?: string; customerName?: string } | null;
}

interface Lead {
  id: number;
  name: string;
}

interface Customer {
  id: number;
  name?: string;
  customerName?: string;
}

const getToken = () => localStorage.getItem("accessToken") || "";

export default function Deals() {
  const navigate = useNavigate();
  const location = useLocation();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [form, setForm] = useState<Partial<Opportunity>>({});
  const [ownerType, setOwnerType] = useState<OwnerType>("LEAD");
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineUpdatingId, setInlineUpdatingId] = useState<number | null>(null);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${getToken()}` }),
    []
  );

  useEffect(() => {
    if (showForm || showDeletePopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showForm, showDeletePopup]);

  useEffect(() => {
    fetchOpportunities();
    fetchLeads();
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (opportunities.length === 0) return;
    const editId = new URLSearchParams(location.search).get("editId");
    if (!editId) return;
    const opp = opportunities.find((o) => o.id === Number(editId));
    if (opp) {
      setForm(opp);
      setOwnerType(opp.lead ? "LEAD" : "CUSTOMER");
      setShowForm(true);
    }
  }, [opportunities, location.search]);

  const fetchOpportunities = async () => {
    try {
      const res = await axios.get(API_URL, { headers: authHeaders });
      setOpportunities(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching opportunities", err);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await axios.get(LEADS_API, { headers: authHeaders });
      setLeads(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching leads", err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(CUSTOMERS_API, { headers: authHeaders });
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching customers", err);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "amount" ? Number(value) : value,
    }));
  };

  const buildPayload = () => {
    const selectedLead = leads.find((l) => l.id === form.lead?.id);
    const selectedCustomer = customers.find(
      (c) => c.id === form.customer?.id
    );

    // Enforce exclusivity
    const owner =
      ownerType === "LEAD" && selectedLead
        ? { lead: { id: selectedLead.id, name: selectedLead.name }, customer: undefined }
        : ownerType === "CUSTOMER" && selectedCustomer
        ? { customer: { id: selectedCustomer.id }, lead: undefined }
        : { lead: undefined, customer: undefined };

    return {
      dealName: form.dealName?.trim(),
      amount: Number(form.amount) || 0,
      stage: normalizeStage(form.stage),
      expectedCloseDate: form.expectedCloseDate || null,
      status: form.status || "ACTIVE",
      ...owner,
    };
  };

  const buildInlinePayload = (o: Opportunity) => ({
    dealName: o.dealName?.trim(),
    amount: Number(o.amount) || 0,
    stage: normalizeStage(o.stage),
    expectedCloseDate: o.expectedCloseDate || null,
    status: o.status || "ACTIVE",
    lead: o.lead ? { id: o.lead.id, name: o.lead.name } : undefined,
    customer: o.customer ? { id: o.customer.id } : undefined,
  });

  const handleInlineChange = async (
    o: Opportunity,
    changes: Partial<Pick<Opportunity, "stage" | "status">>
  ) => {
    const next = {
      ...o,
      ...changes,
      stage: changes.stage ? normalizeStage(changes.stage) : o.stage,
    };
    if (next.stage === o.stage && next.status === o.status) return;

    const previous = opportunities;
    setOpportunities((cur) =>
      cur.map((item) => (item.id === o.id ? next : item))
    );

    try {
      setInlineUpdatingId(o.id);
      await axios.put(
        `${API_URL}/${o.id}`,
        buildInlinePayload(next),
        { headers: { ...authHeaders, "Content-Type": "application/json" } }
      );
      ToasterService.success("Opportunity updated successfully!");
    } catch (err: any) {
      console.error("Error updating opportunity", err);
      setOpportunities(previous);
      ToasterService.error(
        err.response?.data?.message || "Failed to update opportunity"
      );
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.dealName?.trim()) {
      ToasterService.error("Deal name is required");
      return;
    }
    if (!form.lead?.id && !form.customer?.id) {
      ToasterService.error("Please link this deal to a lead or a customer");
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildPayload();
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload, {
          headers: { ...authHeaders, "Content-Type": "application/json" },
        });
        ToasterService.success("Opportunity updated successfully!");
      } else if (ownerType === "LEAD" && form.lead?.id) {
        await axios.post(`${API_URL}/lead/${form.lead.id}`, payload, {
          headers: { ...authHeaders, "Content-Type": "application/json" },
        });
        ToasterService.success("Opportunity created successfully!");
      } else {
        // Plain create endpoint (BE must add — see ticket P1 #4)
        await axios.post(API_URL, payload, {
          headers: { ...authHeaders, "Content-Type": "application/json" },
        });
        ToasterService.success("Opportunity created successfully!");
      }
      await fetchOpportunities();
      setShowForm(false);
      setForm({});
    } catch (err: any) {
      console.error("Error saving opportunity", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to save opportunity"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API_URL}/${deleteId}`, { headers: authHeaders });
      ToasterService.success("Opportunity deleted successfully!");
      await fetchOpportunities();
    } catch (err: any) {
      console.error("Error deleting opportunity", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to delete opportunity"
      );
    } finally {
      setDeleteId(null);
      setShowDeletePopup(false);
    }
  };

  const filtered = opportunities.filter((o) => {
    const term = (searchInputRef.current?.value || "").toLowerCase();
    if (!term) return true;
    return [o.dealName, o.stage, o.status].some((f) =>
      f?.toLowerCase().includes(term)
    );
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
      case "PROSPECTING":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "NEGOTIATION":
        return "border-yellow-200 bg-yellow-50 text-yellow-700";
      case "CLOSED_WON":
        return "border-green-200 bg-green-50 text-green-700";
      case "CLOSED_LOST":
        return "border-red-200 bg-red-50 text-red-700";
      default:
        return "border-gray-200 bg-gray-50 text-gray-700";
    }
  };

  const tableColumns: ColumnDef<Opportunity>[] = [
    {
      key: "dealName",
      label: "Deal Name",
      sortable: true,
      render: (o) => (
        <div className="flex items-center overflow-hidden">
          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-sm font-medium text-cyan-700">
              {o.dealName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
              {o.dealName}
            </div>
            {(o.lead || o.customer) && (
              <div className="text-xs text-gray-500 truncate max-w-[150px]">
                {o.lead?.name ||
                  o.customer?.customerName ||
                  o.customer?.name ||
                  ""}
              </div>
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
            ? new Date(o.expectedCloseDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "-"}
        </div>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      render: (o) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={normalizeStage(o.stage)}
            onChange={(e) =>
              handleInlineChange(o, { stage: e.target.value })
            }
            disabled={inlineUpdatingId === o.id}
            className={`w-[118px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${getStageColor(
              o.stage
            )} ${
              inlineUpdatingId === o.id
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer"
            }`}
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
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={o.status}
            onChange={(e) =>
              handleInlineChange(o, {
                status: e.target.value as Opportunity["status"],
              })
            }
            disabled={inlineUpdatingId === o.id}
            className={`w-[88px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${
              o.status === "ACTIVE"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            } ${
              inlineUpdatingId === o.id
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer"
            }`}
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
      headerClassName: "text-right",
      className: "text-right",
      render: (o) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setForm(o);
              setOwnerType(o.lead ? "LEAD" : "CUSTOMER");
              setShowForm(true);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          {o.lead ? (
            <button
              type="button"
              onClick={() =>
                navigate(`/crm-view/leads/${o.lead!.id}`, {
                  state: { from: "opportunities" },
                })
              }
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="View Lead"
            >
              <UsersIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                ToasterService.info("Add Lead functionality coming soon")
              }
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="Add Lead"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          )}

          {o.customer ? (
            <button
              type="button"
              onClick={() =>
                navigate(`/customer-management/${o.customer!.id}`)
              }
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="View Customer"
            >
              <BuildingOfficeIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                ToasterService.info("Add Customer functionality coming soon")
              }
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Add Customer"
            >
              <BuildingOfficeIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setDeleteId(o.id);
              setShowDeletePopup(true);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
      <PageMeta title="Deals" description="Manage your sales opportunities" />
      <PageBreadcrumb
        pageTitle="Deals"
        className="crm-report-breadcrumb"
        actions={
          <>
            <AddButton
              onClick={() => {
                setForm({ status: "ACTIVE", stage: "PROSPECTING" });
                setOwnerType("LEAD");
                setShowForm(true);
              }}
              label="Add Opportunity"
            />
          </>
        }
      />

      <div className="crm-report-page w-full max-w-none px-0 sm:px-0 lg:px-0 py-4">
        <div className="mb-[17px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard label="Total Deals" value={opportunities.length} />
            <StatsCard
              label="Active Deals"
              value={opportunities.filter((o) => o.status === "ACTIVE").length}
            />
            <StatsCard
              label="Total Value"
              value={formatCurrency(
                opportunities.reduce((a, o) => a + (o.amount || 0), 0)
              )}
            />
            <StatsCard
              label="Average Deal Size"
              value={
                opportunities.length
                  ? formatCurrency(
                      opportunities.reduce((a, o) => a + (o.amount || 0), 0) /
                        opportunities.length
                    )
                  : formatCurrency(0)
              }
            />
          </div>
        </div>

        <ReusableTable<Opportunity>
          data={filtered}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="dealName"
          defaultSortOrder="asc"
          enableRowDetails={true}
          rowDetailsTitle={(o) => o.dealName || "Deal details"}
          rowDetailsSubtitle="Opportunity details"
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
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">
                No opportunities found
              </p>
              <button
                type="button"
                onClick={() => {
                  setForm({ status: "ACTIVE", stage: "PROSPECTING" });
                  setOwnerType("LEAD");
                  setShowForm(true);
                }}
                className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
              >
                Add your first opportunity
              </button>
            </div>
          }
        />
        <PaginatedPopup
  isOpen={showForm}
  title={form.id ? "Edit Opportunity" : "Create New Opportunity"}
  subtitle={
    form.id
      ? "Update opportunity details"
      : "Add a new sales opportunity"
  }
  onClose={() => !isSaving && setShowForm(false)}
  onSubmit={handleSubmit}
  submitLabel={form.id ? "Update Opportunity" : "Create Opportunity"}
  submitting={isSaving}
  maxWidthClassName="max-w-2xl"
  tabs={[
    {
      label: "Deal Info",
      fields: [
        <FloatingInput
          key="dealName"
          label="Deal Name"
          name="dealName"
          value={form.dealName || ""}
          onChange={handleChange}
          required
        />,
        <FloatingInput
          key="amount"
          label="Amount"
          name="amount"
          type="number"
          value={form.amount || ""}
          onChange={handleChange}
          required
        />,
        <FloatingDatePicker
          key="expectedCloseDate"
          label="Expected Close Date"
          name="expectedCloseDate"
          value={
            form.expectedCloseDate
              ? new Date(form.expectedCloseDate).toISOString().split("T")[0]
              : ""
          }
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              expectedCloseDate: e.target.value,
            }))
          }
        />,
        <FloatingSelect
          key="stage"
          label="Stage"
          name="stage"
          value={form.stage || ""}
          onChange={handleChange}
          options={stageOptions}
        />,
        <FloatingSelect
          key="status"
          label="Status"
          name="status"
          value={form.status || ""}
          onChange={handleChange}
          options={[
            { id: "ACTIVE", name: "Active" },
            { id: "INACTIVE", name: "Inactive" },
          ]}
        />,
      ],
    },
    {
      label: "Link",
      fields: [
        <div key="ownerType" className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="ownerType"
                value="LEAD"
                checked={ownerType === "LEAD"}
                onChange={() => {
                  setOwnerType("LEAD");
                  setForm((f) => ({ ...f, customer: undefined }));
                }}
              />
              Lead
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="ownerType"
                value="CUSTOMER"
                checked={ownerType === "CUSTOMER"}
                onChange={() => {
                  setOwnerType("CUSTOMER");
                  setForm((f) => ({ ...f, lead: undefined }));
                }}
              />
              Customer
            </label>
          </div>

          {ownerType === "LEAD" ? (
            <FloatingSelect
              label="Lead *"
              name="leadId"
              value={form.lead?.id || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  lead: e.target.value
                    ? {
                        id: parseInt(e.target.value),
                        name:
                          leads.find((l) => l.id === parseInt(e.target.value))
                            ?.name || "",
                      }
                    : undefined,
                }))
              }
              options={leads.map((l) => ({ id: l.id, name: l.name }))}
              required={!form.id}
            />
          ) : (
            <FloatingSelect
              label="Customer *"
              name="customerId"
              value={form.customer?.id || ""}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  customer: e.target.value
                    ? { id: parseInt(e.target.value) }
                    : undefined,
                }))
              }
              options={customers.map((c) => ({
                id: c.id,
                name: c.customerName || c.name || `Customer #${c.id}`,
              }))}
              required={!form.id}
            />
          )}
        </div>,
      ],
    },
  ]}
/>
      </div>

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Opportunity"
        subText={
          deleteId
            ? `Are you sure you want to delete "${
                opportunities.find((o) => o.id === deleteId)?.dealName ||
                "this opportunity"
              }"? This action cannot be undone.`
            : "Are you sure you want to delete this opportunity?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
}
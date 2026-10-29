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
  BanknotesIcon,
  TagIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
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
import "../../styles/Deals.css";
import { formatMoney } from "../Dashboard/dashboardKit";
import {
  DEAL_STAGE_OPTIONS,
  DEAL_STATUS_LABELS,
  OPEN_DEAL_STATUS_OPTIONS,
  apiError,
  isClosedStage,
} from "./crmShared";
import { usePermissions } from "../../access/usePermissions";
import { formatDate, companyCurrency, moneyDecimals } from "../../company/format";
import { cellInput, NumberCell } from "../Purchase/LineItemsEditor";

const API_URL = "/v1/api/crm/deals";
const LEADS_API = "/v1/api/crm/leads";
const CUSTOMERS_API = "/v1/api/common/customers";
const PRODUCTS_API = "/v1/api/common/products";
const PAGE_SIZE = 10;

const stageOptions = DEAL_STAGE_OPTIONS;

const normalizeStage = (stage?: string) =>
  stage ? stage.trim().toUpperCase().replace(/\s+/g, "_") : "PROSPECTING";

type OwnerType = "LEAD" | "CUSTOMER";

interface Opportunity {
  id: number;
  dealName: string;
  amount: number;
  expectedCloseDate: string;
  stage: string;
  // ACTIVE / CANCELLED while open; WON / LOST follow the stage (set by the service)
  status: string;
  lead?: { id: number; name: string } | null;
  customer?: { id: number; name?: string; customerName?: string; currencyCode?: string } | null;
  // What the customer asked for; a quotation made from the deal copies these lines
  items?: DealLine[];
  quotationId?: number | null;
  quotationNumber?: string | null;
}

interface DealLine {
  productId?: number | null;
  productName: string;
  productCode?: string;
  quantity: number;
  expectedPrice?: number | null;
  remarks?: string;
}

interface Product {
  id: number;
  productName: string;
  productCode?: string;
  sellingPrice?: number;
  active?: boolean;
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

/** What the priced lines come to (the server works the deal value out the same way). */
const linesTotal = (items?: DealLine[]) =>
  (items || []).reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.expectedPrice) || 0), 0);

export default function Deals() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

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
    fetchProducts();
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
      // Open once: otherwise the form reopens every time the list reloads (e.g. after saving)
      const params = new URLSearchParams(location.search);
      params.delete("editId");
      navigate({ search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Needs PRODUCT_CATALOGUE:VIEW; without it lines are typed in by name
  const fetchProducts = async () => {
    try {
      const res = await axios.get(PRODUCTS_API, { headers: authHeaders });
      setProducts((Array.isArray(res.data) ? res.data : []).filter((p: Product) => p.active !== false));
    } catch (err) {
      console.error("Error fetching products", err);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      // An empty amount is worked out from the product lines
      [name]: name === "amount" ? (value === "" ? undefined : Number(value)) : value,
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
      amount: form.amount == null || String(form.amount) === "" ? null : Number(form.amount),
      stage: normalizeStage(form.stage),
      items: (form.items || []).filter((l) => l.productId || l.productName?.trim()),
      expectedCloseDate: form.expectedCloseDate || null,
      status: form.status || "ACTIVE",
      ...owner,
    };
  };

  const buildInlinePayload = (o: Opportunity) => ({
    dealName: o.dealName?.trim(),
    amount: o.amount ?? null,
    stage: normalizeStage(o.stage),
    expectedCloseDate: o.expectedCloseDate || null,
    status: o.status || "ACTIVE",
    lead: o.lead ? { id: o.lead.id, name: o.lead.name } : undefined,
    customer: o.customer ? { id: o.customer.id } : undefined,
  });

  // The amount follows the lines until the user types their own
  const setLines = (items: DealLine[]) =>
    setForm((prev) => {
      const followsLines = prev.amount == null || Number(prev.amount) === linesTotal(prev.items);
      const total = linesTotal(items);
      return { ...prev, items, amount: followsLines ? (total || undefined) : prev.amount };
    });

  const updateLine = (index: number, patch: Partial<DealLine>) =>
    setLines((form.items || []).map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const pickLineProduct = (index: number, productId: string) => {
    const product = products.find((p) => String(p.id) === productId);
    updateLine(index, {
      productId: product?.id ?? null,
      productName: product?.productName || "",
      productCode: product?.productCode || "",
      expectedPrice: product?.sellingPrice ?? null,
    });
  };

  /** Deals → Quotations, filled in from the deal. A lead must be converted to a customer first. */
  const createQuotation = (o: Opportunity) => {
    if (!o.customer?.id) {
      ToasterService.error("This deal has no customer yet", "Convert its lead to a customer first, then create the quotation.");
      return;
    }
    navigate(`/quotations?dealId=${o.id}`);
  };

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
      // Won / Lost set the status on the server
      await fetchOpportunities();
    } catch (err: any) {
      console.error("Error updating opportunity", err);
      setOpportunities(previous);
      ToasterService.error(apiError(err, "Failed to update opportunity"));
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
        // Deal for a customer: the customer travels in the body
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
      ToasterService.error(apiError(err, "Failed to save opportunity"));
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
      ToasterService.error(apiError(err, "Failed to delete opportunity"));
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

  // Rupees, like the rest of the app (a deal's customer may use another currency)
  const formatCurrency = (amount: number, currency?: string) =>
    formatMoney(Number(amount) || 0, currency || companyCurrency());

  const getStageColor = (stage: string) => {
    switch (normalizeStage(stage)) {
      case "PROSPECTING":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "QUALIFIED":
        return "border-cyan-200 bg-cyan-50 text-cyan-700";
      case "NEGOTIATION":
        return "border-yellow-200 bg-yellow-50 text-yellow-700";
      case "WON":
        return "border-green-200 bg-green-50 text-green-700";
      case "LOST":
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
            {o.quotationNumber && (
              <div className="text-xs text-cyan-700 truncate max-w-[150px]">Quotation {o.quotationNumber}</div>
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
          <BanknotesIcon className="h-3.5 w-3.5 mr-1 text-gray-400 flex-shrink-0" />
          {formatCurrency(o.amount, o.customer?.currencyCode)}
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
            ? formatDate(o.expectedCloseDate)
            : "-"}
        </div>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      sortable: true,
      render: (o) => !canUpdate ? (
        <span className={`inline-flex w-[118px] items-center rounded-lg border px-2 py-1.5 text-xs font-semibold ${getStageColor(o.stage)}`}>
          {stageOptions.find((option) => option.id === normalizeStage(o.stage))?.name ?? o.stage}
        </span>
      ) : (
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
      render: (o) =>
        // Won / Lost come from the stage; only an open deal can be made active or cancelled
        isClosedStage(normalizeStage(o.stage)) ? (
          <span className={`inline-flex w-[96px] items-center rounded-lg border px-2 py-1.5 text-xs font-semibold ${getStageColor(o.stage)}`}>
            {DEAL_STATUS_LABELS[o.status] ?? o.status}
          </span>
        ) : !canUpdate ? (
          <span className={`inline-flex w-[96px] items-center rounded-lg border px-2 py-1.5 text-xs font-semibold ${
            o.status === "ACTIVE" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {DEAL_STATUS_LABELS[o.status] ?? o.status}
          </span>
        ) : (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={o.status}
            onChange={(e) =>
              handleInlineChange(o, {
                status: e.target.value as Opportunity["status"],
              })
            }
            disabled={inlineUpdatingId === o.id}
            className={`w-[96px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${
              o.status === "ACTIVE"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            } ${
              inlineUpdatingId === o.id
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer"
            }`}
          >
            {OPEN_DEAL_STATUS_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
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
          {canUpdate && (
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
          )}

          {o.quotationId ? (
            <button
              type="button"
              onClick={() => navigate("/quotations")}
              className="rounded-lg p-2 text-cyan-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
              title={`View quotation ${o.quotationNumber || ""}`.trim()}
            >
              <DocumentTextIcon className="h-4 w-4" />
            </button>
          ) : (
            normalizeStage(o.stage) !== "LOST" && (
              <button
                type="button"
                onClick={() => createQuotation(o)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                title={o.customer ? "Create quotation" : "Create quotation (convert the lead to a customer first)"}
              >
                <DocumentTextIcon className="h-4 w-4" />
              </button>
            )
          )}

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
            canUpdate && <button
              type="button"
              onClick={() => {
                setForm(o);
                setOwnerType("LEAD");
                setShowForm(true);
              }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="Link a lead"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          )}

          {o.customer ? (
            <button
              type="button"
              onClick={() =>
                navigate(`/crm-view/customers/${o.customer!.id}`, { state: { from: "opportunities" } })
              }
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="View Customer"
            >
              <BuildingOfficeIcon className="h-4 w-4" />
            </button>
          ) : (
            canUpdate && <button
              type="button"
              onClick={() => {
                setForm(o);
                setOwnerType("CUSTOMER");
                setShowForm(true);
              }}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Link a customer"
            >
              <BuildingOfficeIcon className="h-4 w-4" />
            </button>
          )}

          {canDelete && (
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
          )}
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
             "items",
             "quotationId",
              ]}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">
                No opportunities found
              </p>
              {canCreate && (
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
              )}
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
          label="Amount (empty = total of the product lines)"
          name="amount"
          type="number"
          value={form.amount ?? ""}
          onChange={handleChange}
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
          value={isClosedStage(normalizeStage(form.stage)) ? normalizeStage(form.stage) : form.status || "ACTIVE"}
          onChange={handleChange}
          disabled={isClosedStage(normalizeStage(form.stage))}
          options={
            isClosedStage(normalizeStage(form.stage))
              ? [{ id: normalizeStage(form.stage), name: DEAL_STATUS_LABELS[normalizeStage(form.stage)] }]
              : OPEN_DEAL_STATUS_OPTIONS
          }
        />,
      ],
    },
    {
      label: "Products",
      fields: [
        <div key="items" className="md:col-span-2 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            What the customer is asking for. "Create quotation" copies these lines; the price is optional (the catalogue price is used when empty).
          </p>
          {(form.items || []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-1 py-1">Product</th>
                    <th className="px-1 py-1 w-24">Quantity</th>
                    <th className="px-1 py-1 w-32">Expected price</th>
                    <th className="px-1 py-1 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {(form.items || []).map((line, index) => (
                    <tr key={index} className="align-top">
                      <td className="px-1 py-1 space-y-1">
                        {products.length > 0 && (
                          <select
                            aria-label={`Line ${index + 1} product`}
                            className={cellInput}
                            value={line.productId ? String(line.productId) : ""}
                            onChange={(e) => pickLineProduct(index, e.target.value)}
                          >
                            <option value="">Not in the catalogue (type the name)</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.productCode ? `${p.productCode} - ${p.productName}` : p.productName}
                              </option>
                            ))}
                          </select>
                        )}
                        {!line.productId && (
                          <input
                            aria-label={`Line ${index + 1} name`}
                            className={cellInput}
                            placeholder="Product or service asked for"
                            maxLength={200}
                            value={line.productName}
                            onChange={(e) => updateLine(index, { productName: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <NumberCell label={`Line ${index + 1} quantity`} decimals={3} value={line.quantity}
                          onValue={(quantity) => updateLine(index, { quantity })} />
                      </td>
                      <td className="px-1 py-1">
                        <NumberCell label={`Line ${index + 1} expected price`} decimals={moneyDecimals(form.customer?.currencyCode)}
                          value={line.expectedPrice ?? ""} onValue={(expectedPrice) => updateLine(index, { expectedPrice: expectedPrice || null })} />
                      </td>
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => setLines((form.items || []).filter((_, i) => i !== index))}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove line"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            onClick={() => setLines([...(form.items || []), { productId: null, productName: "", quantity: 1, expectedPrice: null }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
          >
            <PlusIcon className="h-4 w-4" /> Add product
          </button>
        </div>,
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

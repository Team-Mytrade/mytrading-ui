import {
  useEffect,
  useRef,
  useState,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import axios from "axios";
import { createPortal } from "react-dom";
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
  ViewColumnsIcon,
  TableCellsIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import DealsBoard from "./DealsBoard";
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
import { useUserDirectory, userOptions } from "../../access/useUserDirectory";
import { MineAllToggle, OwnRecordsNote, OwnerCell, isMine, useCrmSettings, useMineOnly, useMyUsername } from "./crmOwnership";
import { formatDate, companyCurrency, moneyDecimals, currencyChoices } from "../../company/format";
import { cellInput, NumberCell } from "../Purchase/LineItemsEditor";

import { t } from "../../i18n/i18n";
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
  // The deal's currency (AED, SAR, KWD...); none: the company's
  currencyCode?: string | null;
  // What the customer asked for; a quotation made from the deal copies these lines
  items?: DealLine[];
  quotationId?: number | null;
  quotationNumber?: string | null;
  // Who works the deal (a login's username); none = unassigned
  owner?: string | null;
  ownerName?: string | null;
  // 8.3.3: how likely it is to be won (0–100; none on older deals: the stage's default), why it was lost, when it closed
  probability?: number | null;
  lostReason?: string | null;
  lostNote?: string | null;
  closedOn?: string | null;
  // The amount in the company's currency at the latest exchange rate (none when finance has no rate)
  companyAmount?: number | null;
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
  // A converted lead has become a customer: new deals go to the customer instead
  converted?: boolean;
  status?: string;
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

// Board or table, remembered on this browser; the owner filter's "nobody" choice
const VIEW_KEY = "crm.dealsView";
const UNASSIGNED = "__unassigned__";
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

export default function Deals() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const me = useMyUsername();
  const { users: directoryUsers } = useUserDirectory();
  const { settings: crmSettings } = useCrmSettings();
  const [mineOnly, setMineOnly] = useMineOnly("deals");

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [form, setForm] = useState<Partial<Opportunity>>({});
  const [ownerType, setOwnerType] = useState<OwnerType>("LEAD");
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inlineUpdatingId, setInlineUpdatingId] = useState<number | null>(null);
  // Choosing Lost in the list asks why
  const [lostPrompt, setLostPrompt] = useState<{ deal: Opportunity; reason: string } | null>(null);
  // Board (8.3.4): which view, its filters (they apply to the table too), and a deal dropped on Won awaiting confirmation
  const [view, setView] = useState<"board" | "table">(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "table";
    } catch {
      return "table";
    }
  });
  const changeView = (next: "board" | "table") => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  };
  const [ownerFilter, setOwnerFilter] = useState("");
  const [closeFilter, setCloseFilter] = useState("");
  const [wonConfirm, setWonConfirm] = useState<Opportunity | null>(null);

  // A stage's default win probability (CRM Settings); a deal without its own shows this
  const stageProbability = (stage?: string) => crmSettings.stageProbabilities[normalizeStage(stage)] ?? 0;
  const probabilityOf = (o: Partial<Opportunity>) => (o.probability ?? stageProbability(o.stage)) as number;
  const lostReasonOptions = (current?: string | null) => {
    const list = crmSettings.lostReasons.map((s) => ({ id: s, name: s }));
    return current && !list.some((o) => o.id.toLowerCase() === current.toLowerCase()) ? [...list, { id: current, name: current }] : list;
  };

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
      currencyCode: form.currencyCode || companyCurrency(),
      // The person working the deal; empty = unassigned
      owner: form.owner ?? "",
      // Won and Lost fix it (100 / 0) on the server
      probability: form.probability == null || String(form.probability) === "" ? null : Number(form.probability),
      lostReason: normalizeStage(form.stage) === "LOST" ? form.lostReason || "" : null,
      lostNote: normalizeStage(form.stage) === "LOST" ? form.lostNote || "" : null,
      ...owner,
    };
  };

  // An inline stage change sends no probability (the new stage's default applies) and, for Lost, the reason asked for
  const buildInlinePayload = (o: Opportunity, lostReason?: string) => ({
    dealName: o.dealName?.trim(),
    amount: o.amount ?? null,
    stage: normalizeStage(o.stage),
    expectedCloseDate: o.expectedCloseDate || null,
    status: o.status || "ACTIVE",
    currencyCode: o.currencyCode || undefined,
    lead: o.lead ? { id: o.lead.id, name: o.lead.name } : undefined,
    customer: o.customer ? { id: o.customer.id } : undefined,
    ...(lostReason ? { lostReason } : {}),
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
    changes: Partial<Pick<Opportunity, "stage" | "status">>,
    lostReason?: string
  ) => {
    const next = {
      ...o,
      ...changes,
      stage: changes.stage ? normalizeStage(changes.stage) : o.stage,
    };
    if (next.stage === o.stage && next.status === o.status) return;
    // Moving to Lost asks why first
    if (next.stage === "LOST" && normalizeStage(o.stage) !== "LOST" && !lostReason) {
      setLostPrompt({ deal: o, reason: crmSettings.lostReasons[0] ?? "" });
      return;
    }

    const previous = opportunities;
    setOpportunities((cur) =>
      cur.map((item) => (item.id === o.id ? next : item))
    );

    try {
      setInlineUpdatingId(o.id);
      await axios.put(
        `${API_URL}/${o.id}`,
        buildInlinePayload(next, lostReason),
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
    if (normalizeStage(form.stage) === "LOST" && !form.lostReason) {
      ToasterService.error("Choose why the deal was lost");
      return;
    }
    const probability = form.probability == null ? null : Number(form.probability);
    if (probability != null && (!Number.isFinite(probability) || probability < 0 || probability > 100)) {
      ToasterService.error("Probability is a percentage from 0 to 100");
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

  // Mine: the deals the signed-in person owns; then the owner and close-month filters (both views and the cards)
  const thisMonth = monthKey(new Date());
  const nextMonth = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
  const todayKey = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const matchesClose = (o: Opportunity) => {
    const date = (o.expectedCloseDate || "").slice(0, 10);
    switch (closeFilter) {
      case "":
        return true;
      case "none":
        return !date;
      case "overdue":
        return !!date && date < todayKey && !isClosedStage(normalizeStage(o.stage)) && o.status !== "CANCELLED";
      case "this":
        return date.slice(0, 7) === thisMonth;
      case "next":
        return date.slice(0, 7) === nextMonth;
      default:
        return date.slice(0, 7) === closeFilter;
    }
  };
  const shownDeals = opportunities
    .filter((o) => !mineOnly || isMine(o.owner, me))
    .filter((o) => !ownerFilter || (ownerFilter === UNASSIGNED ? !o.owner : isMine(o.owner, ownerFilter)))
    .filter(matchesClose);
  const ownerChoices = Array.from(
    new Map(opportunities.filter((o) => o.owner).map((o) => [String(o.owner).toLowerCase(), { id: String(o.owner), name: o.ownerName || String(o.owner) }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
  const closeMonths = Array.from(new Set(opportunities.map((o) => (o.expectedCloseDate || "").slice(0, 7)).filter(Boolean))).sort();

  // Board: a card dropped on another column. Won asks first; Lost asks why (handleInlineChange)
  const moveDeal = (deal: { id: number }, stage: string) => {
    const full = opportunities.find((o) => o.id === deal.id);
    if (!full || normalizeStage(full.stage) === stage) return;
    if (stage === "WON") {
      setWonConfirm(full);
      return;
    }
    handleInlineChange(full, { stage });
  };

  const filtered = shownDeals.filter((o) => {
    const term = (searchInputRef.current?.value || "").toLowerCase();
    if (!term) return true;
    return [o.dealName, o.stage, o.status].some((f) =>
      f?.toLowerCase().includes(term)
    );
  });

  // The cards count open, active deals only: cancelled, won and lost deals are not in the pipeline. Money is in the
  // company's currency (each deal at the latest exchange rate, from the service); a deal finance has no rate for is
  // left out and named under the cards.
  const activeDeals = shownDeals.filter((o) => o.status === "ACTIVE" && !isClosedStage(normalizeStage(o.stage)));
  const valued = activeDeals.filter((o) => o.companyAmount != null);
  const pipelineValue = valued.reduce((sum, o) => sum + Number(o.companyAmount), 0);
  const weightedValue = valued.reduce((sum, o) => sum + (Number(o.companyAmount) * probabilityOf(o)) / 100, 0);
  const unvalued = activeDeals.filter((o) => o.companyAmount == null && o.amount != null && Number(o.amount) !== 0);
  const unvaluedCurrencies = Array.from(new Set(unvalued.map((o) => o.currencyCode || "?")));

  // A new deal is the signed-in person's unless another owner is picked
  const openNewDeal = () => {
    setForm({ status: "ACTIVE", stage: "PROSPECTING", owner: me });
    setOwnerType("LEAD");
    setShowForm(true);
  };

  // In the deal's currency, else the company's (formatted the company's way: 1,320,000 or 13,20,000)
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
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${o.customer ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                  {t(o.customer ? "Customer" : "Lead")}
                </span>
                <span className="truncate" title={o.customer?.customerName || o.customer?.name || o.lead?.name || ""}>
                  {o.customer?.customerName || o.customer?.name || o.lead?.name || ""}
                </span>
              </div>
            )}
            {o.quotationNumber && (
              <div className="text-xs text-cyan-700 truncate max-w-[150px]">{t("Quotation")} {o.quotationNumber}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (o) => {
        const foreign = !!o.currencyCode && o.currencyCode !== companyCurrency();
        return (
          <div>
            <div className="flex items-center text-sm font-medium text-gray-900">
              <BanknotesIcon className="h-3.5 w-3.5 mr-1 text-gray-400 flex-shrink-0" />
              {formatCurrency(o.amount, o.currencyCode || o.customer?.currencyCode)}
            </div>
            {/* In another currency: what it comes to in the company's (or that there is no rate yet) */}
            {foreign && o.amount != null && (
              <div className="ps-[18px] text-xs text-gray-500">
                {o.companyAmount != null ? `≈ ${formatCurrency(o.companyAmount)}` : t("No exchange rate")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "probability",
      label: "Probability",
      sortable: true,
      sortValueGetter: (o) => probabilityOf(o),
      render: (o) => <span className="text-sm text-gray-700">{probabilityOf(o)}%</span>,
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
          {t(String(stageOptions.find((option) => option.id === normalizeStage(o.stage))?.name ?? o.stage ?? ""))}
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
                {t(option.name)}
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
          <div>
            <span
              className={`inline-flex w-[96px] items-center rounded-lg border px-2 py-1.5 text-xs font-semibold ${getStageColor(o.stage)}`}
              title={[o.lostReason, o.lostNote].filter(Boolean).join(" — ") || undefined}
            >
              {t(DEAL_STATUS_LABELS[o.status] ?? o.status ?? "")}
            </span>
            {/* When it closed and, for a lost deal, why */}
            {(o.closedOn || o.lostReason) && (
              <div className="mt-0.5 max-w-[150px] truncate text-[11px] text-gray-500" title={o.lostNote || undefined}>
                {[o.closedOn ? formatDate(o.closedOn) : null, o.lostReason].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        ) : !canUpdate ? (
          <span className={`inline-flex w-[96px] items-center rounded-lg border px-2 py-1.5 text-xs font-semibold ${
            o.status === "ACTIVE" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {t(DEAL_STATUS_LABELS[o.status] ?? o.status ?? "")}
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
              <option key={option.id} value={option.id}>{t(option.name)}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      key: "ownerName",
      label: "Owner",
      sortable: true,
      sortValueGetter: (o) => o.ownerName || o.owner || "",
      render: (o) => <OwnerCell owner={o.owner} ownerName={o.ownerName} />,
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
              title={t("Edit")}
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
                title={t(o.customer ? "Create quotation" : "Create quotation (convert the lead to a customer first)")}
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
              title={t("View Lead")}
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
              title={t("Link a lead")}
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
              title={t("View Customer")}
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
              title={t("Link a customer")}
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
              title={t("Delete")}
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
      <PageMeta title={t("Deals")} description="Manage your sales opportunities" />
      <PageBreadcrumb
        pageTitle="Deals"
        className="crm-report-breadcrumb"
        actions={
          <>
            <AddButton
              onClick={openNewDeal}
              label={t("Add Opportunity")}
            />
          </>
        }
      />

      <div className="crm-report-page w-full max-w-none px-0 sm:px-0 lg:px-0 py-4">
        <OwnRecordsNote settings={crmSettings} />
        <div className="mb-[17px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
            <StatsCard label={t("Total Deals")} value={shownDeals.length} />
            <StatsCard
              label={t("Active Deals")}
              value={activeDeals.length}
            />
            <StatsCard
              label={t("Pipeline value")}
              value={formatCurrency(pipelineValue)}
            />
            <StatsCard
              label={t("Weighted pipeline")}
              value={formatCurrency(weightedValue)}
            />
            <StatsCard
              label={t("Average Deal Size")}
              value={formatCurrency(valued.length ? pipelineValue / valued.length : 0)}
            />
          </div>
          {unvalued.length > 0 && (
            <p className="mx-3 mt-2 text-xs text-amber-700 dark:text-amber-400">
              {t("{count} open deal(s) in {currencies} aren't counted: finance has no exchange rate for them yet.", {
                count: String(unvalued.length),
                currencies: unvaluedCurrencies.join(", "),
              })}
            </p>
          )}
        </div>

        {/* Board or table, and the filters both use */}
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("View")} className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-transparent">
            {(["board", "table"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => changeView(option)}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === option ? "bg-cyan-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                }`}
              >
                {option === "board" ? <ViewColumnsIcon className="h-4 w-4" /> : <TableCellsIcon className="h-4 w-4" />}
                {t(option === "board" ? "Board" : "Table")}
              </button>
            ))}
          </div>
          <MineAllToggle mineOnly={mineOnly} onChange={setMineOnly} mineLabel="My deals" />
          <select
            aria-label={t("Owner")}
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 py-0 text-xs leading-none text-gray-700 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">{t("All owners")}</option>
            <option value={UNASSIGNED}>{t("Unassigned")}</option>
            {ownerChoices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select
            aria-label={t("Close month")}
            value={closeFilter}
            onChange={(e) => setCloseFilter(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 py-0 text-xs leading-none text-gray-700 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">{t("Any close date")}</option>
            <option value="overdue">{t("Close date passed")}</option>
            <option value="this">{t("Closing this month")}</option>
            <option value="next">{t("Closing next month")}</option>
            {closeMonths.filter((m) => m !== thisMonth && m !== nextMonth).map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
            <option value="none">{t("No close date")}</option>
          </select>
          {(ownerFilter || closeFilter) && (
            <button type="button" onClick={() => { setOwnerFilter(""); setCloseFilter(""); }}
              className="text-xs font-semibold text-cyan-700 hover:underline">
              {t("Clear filters")}
            </button>
          )}
        </div>

        {view === "board" ? (
          <DealsBoard
            deals={shownDeals.map((o) => ({ ...o, stage: normalizeStage(o.stage) }))}
            stages={stageOptions}
            probabilityOf={(d) => probabilityOf(d as Opportunity)}
            canUpdate={canUpdate}
            updatingId={inlineUpdatingId}
            onMove={moveDeal}
            onOpen={(d) => {
              const full = opportunities.find((o) => o.id === d.id);
              if (!full) return;
              setForm(full);
              setOwnerType(full.lead ? "LEAD" : "CUSTOMER");
              setShowForm(true);
            }}
          />
        ) : (
        <ReusableTable<Opportunity>
          data={filtered}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="dealName"
          defaultSortOrder="asc"
          enableRowDetails={true}
          rowDetailsTitle={(o) => o.dealName || "Deal details"}
          rowDetailsSubtitle={t("Opportunity details")}
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
             "items",
             "quotationId",
              ]}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">
                {t("No opportunities found")}
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={openNewDeal}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  {t("Add your first opportunity")}
                </button>
              )}
            </div>
          }
        />
        )}
        <PaginatedPopup
  isOpen={showForm}
  title={t(form.id ? "Edit Opportunity" : "Create New Opportunity")}
  subtitle={t(
    form.id
      ? "Update opportunity details"
      : "Add a new sales opportunity"
  )}
  onClose={() => !isSaving && setShowForm(false)}
  onSubmit={handleSubmit}
  submitLabel={t(form.id ? "Update Opportunity" : "Create Opportunity")}
  submitting={isSaving}
  maxWidthClassName="max-w-2xl"
  tabs={[
    {
      label: "Deal Info",
      fields: [
        <FloatingInput
          key="dealName"
          label={t("Deal Name")}
          name="dealName"
          value={form.dealName || ""}
          onChange={handleChange}
          required
        />,
        <FloatingInput
          key="amount"
          label={t("Amount (empty = total of the product lines)")}
          name="amount"
          type="number"
          value={form.amount ?? ""}
          onChange={handleChange}
        />,
        <FloatingSelect
          key="currencyCode"
          label={t("Currency")}
          name="currencyCode"
          value={form.currencyCode || companyCurrency()}
          onChange={(e) => setForm((prev) => ({ ...prev, currencyCode: e.target.value }))}
          options={currencyChoices(form.currencyCode).map((c) => ({ id: c, name: c }))}
        />,
        <FloatingDatePicker
          key="expectedCloseDate"
          label={t("Expected Close Date")}
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
          label={t("Stage")}
          name="stage"
          value={form.stage || ""}
          // A new stage brings its default probability (change it after if this deal is different)
          onChange={(e) => {
            const stage = e.target.value;
            setForm((prev) => ({ ...prev, stage, probability: stageProbability(stage) }));
          }}
          options={stageOptions}
        />,
        ...(normalizeStage(form.stage) === "LOST"
          ? [
              <FloatingSelect
                key="lostReason"
                label={t("Lost reason")}
                name="lostReason"
                value={form.lostReason || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, lostReason: e.target.value }))}
                options={lostReasonOptions(form.lostReason)}
                required
              />,
              <FloatingInput
                key="lostNote"
                label={t("Lost note")}
                name="lostNote"
                value={form.lostNote || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, lostNote: e.target.value }))}
                example={t("e.g. went with another supplier at 4% less")}
              />,
            ]
          : isClosedStage(normalizeStage(form.stage))
            ? []
            : [
                <FloatingInput
                  key="probability"
                  label={t("Probability (%)")}
                  name="probability"
                  type="number"
                  value={form.probability ?? stageProbability(form.stage)}
                  onChange={(e) => setForm((prev) => ({ ...prev, probability: e.target.value === "" ? null : Number(e.target.value) }))}
                  example={t("How likely it is to be won")}
                />,
              ]),
        <FloatingSelect
          key="status"
          label={t("Status")}
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
        <FloatingSelect
          key="owner"
          label={t("Owner")}
          name="owner"
          value={form.owner || ""}
          onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))}
          options={userOptions(directoryUsers, form.owner || undefined)}
          includeEmptyOption={false}
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
                    <th className="px-1 py-1">{t("Product")}</th>
                    <th className="px-1 py-1 w-24">{t("Quantity")}</th>
                    <th className="px-1 py-1 w-32">{t("Expected price")}</th>
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
                            <option value="">{t("Not in the catalogue (type the name)")}</option>
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
                            placeholder={t("Product or service asked for")}
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
                        <NumberCell label={`Line ${index + 1} expected price`} decimals={moneyDecimals(form.currencyCode || form.customer?.currencyCode)}
                          value={line.expectedPrice ?? ""} onValue={(expectedPrice) => updateLine(index, { expectedPrice: expectedPrice || null })} />
                      </td>
                      <td className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => setLines((form.items || []).filter((_, i) => i !== index))}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title={t("Remove line")}
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
            <PlusIcon className="h-4 w-4" /> {t("Add product")}
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
              {t("Lead")}
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
              {t("Customer")}
            </label>
          </div>

          {ownerType === "LEAD" ? (
            <FloatingSelect
              label={t("Lead *")}
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
              options={leads
                .filter((l) => !(l.converted || l.status === "CONVERTED") || l.id === form.lead?.id)
                .map((l) => ({ id: l.id, name: l.name }))}
              required={!form.id}
            />
          ) : (
            <FloatingSelect
              label={t("Customer *")}
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

      {/* Lost: why? (from the company's list) */}
      {lostPrompt &&
        createPortal(
          <div data-overlay-dim data-overlay className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div data-overlay-panel className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div data-overlay-header className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t("Why was the deal lost?")}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{lostPrompt.deal.dealName}</p>
                </div>
                <button type="button" onClick={() => setLostPrompt(null)} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <FloatingSelect
                  label={t("Lost reason")}
                  name="dealLostReason"
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
                      const { deal, reason } = lostPrompt;
                      setLostPrompt(null);
                      handleInlineChange(deal, { stage: "LOST" }, reason);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm disabled:opacity-60"
                  >
                    {t("Mark as Lost")}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Board: a deal dropped on Won is confirmed first (it closes the deal at 100%) */}
      <DynamicPopup
        isPopupOpen={!!wonConfirm}
        setIsPopupOpen={(open: boolean) => { if (!open) setWonConfirm(null); }}
        icon={<CheckBadgeIcon className="h-6 w-6 text-emerald-600" />}
        iconBg="bg-emerald-100"
        innerText={t("Mark the deal as won?")}
        subText={wonConfirm
          ? t('"{name}" will be closed as won at 100%, dated today.', { name: wonConfirm.dealName })
          : ""}
        confirmLabel={t("Mark as won")}
        cancelLabel={t("Cancel")}
        onConfirm={() => {
          const deal = wonConfirm;
          setWonConfirm(null);
          if (deal) handleInlineChange(deal, { stage: "WON" });
        }}
        onCancel={() => setWonConfirm(null)}
        confirmBtnClass="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white"
      />

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText={t("Delete Opportunity")}
        subText={
          deleteId
            ? t('Are you sure you want to delete "{name}"? This action cannot be undone.', { name: String((
                opportunities.find((o) => o.id === deleteId)?.dealName ||
                "this opportunity"
              ) ?? "") })
            : "Are you sure you want to delete this opportunity?"
        }
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
}

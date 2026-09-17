import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  DocumentTextIcon,
  TagIcon,
  UserGroupIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  EnvelopeIcon,
  PhoneIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useParams, useNavigate} from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import {
  FloatingInput,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import StatsCard from "../../components/common/Statscard";
import "./Deals.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Customer {
  id: number;
  name?: string;
  industry?: string;
  email?: string;
  phone?: string;
  status?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

interface SegmentCustomer {
  customerId: number;
  customerName?: string;
  customerCode?: string;
  active?: boolean;
  email?: string;
  phone?: string;
  assignedAt?: string;
}

interface CustomerSegment {
  id: number;
  code?: string;
  name: string;
  description?: string;
  active?: boolean;
  segmentCustomers?: SegmentCustomer[];
}

/* ------------------------------------------------------------------ */
/*  Constants + tenant helpers                                         */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/crm/segments";
const CUSTOMER_API = "/v1/api/crm/customers";
const PAGE_SIZE = 10;

const getTenantIdFromToken = (token: string) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload))?.tenantId || null;
  } catch {
    return null;
  }
};

const getTenantId = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user?.tenantId) return user.tenantId;
    }
    const token = localStorage.getItem("accessToken");
    return token ? getTenantIdFromToken(token) : null;
  } catch {
    return null;
  }
};

const safeString = (v?: string, fallback = "N/A") =>
  v && String(v).trim() ? v : fallback;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Segments: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // const location = useLocation();

  const token = localStorage.getItem("accessToken");
  const tenantId = getTenantId();
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  /* ---------------- State ---------------- */

  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  // Segment form modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<CustomerSegment>>({});
  // const processedEditIdRef = useRef<number | null>(null);

  // Customer management modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [customerModalMode, setCustomerModalMode] = useState<"add" | "manage">(
    "add"
  );
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Delete confirmation
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<CustomerSegment | null>(
    null
  );

  /* ---------------- Fetch ---------------- */

  const fetchSegments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<CustomerSegment[]>(API_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setSegments(id ? list.filter((s) => s.id === Number(id)) : list);
    } catch (err) {
      console.error("Error fetching segments", err);
      setSegments([]);
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, tenantId, id]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await axios.get<Customer[]>(CUSTOMER_API, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching customers", err);
      setCustomers([]);
    }
  }, [authHeaders, tenantId]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  useEffect(() => {
    if (showCustomerModal) fetchCustomers();
  }, [showCustomerModal, fetchCustomers]);

  /* ---------------- Deep-link edit (?editId=) ---------------- */

 
  /* ---------------- Derived values ---------------- */

  const getCustomerCount = (segment: CustomerSegment) =>
    segment.segmentCustomers?.length ?? 0;

  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) || null,
    [segments, activeSegmentId]
  );

  /** Assigned customers, deduped, converted to Customer shape */
  const assignedCustomers = useMemo<Customer[]>(() => {
    const list = activeSegment?.segmentCustomers || [];
    const byId = new Map<number, Customer>();
    for (const sc of list) {
      if (byId.has(sc.customerId)) continue;
      byId.set(sc.customerId, {
        id: sc.customerId,
        name: sc.customerName,
        email: sc.email,
        phone: sc.phone,
        status: sc.active ? "Active" : "Inactive",
      });
    }
    return Array.from(byId.values());
  }, [activeSegment]);

  /** Customers NOT yet in the segment */
  const availableCustomers = useMemo(() => {
    const existing = new Set(assignedCustomers.map((c) => c.id));
    return customers.filter((c) => !existing.has(c.id));
  }, [customers, assignedCustomers]);

  /** Tab-dependent source list */
  const sourceList =
    customerModalMode === "add" ? availableCustomers : assignedCustomers;

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.industry || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [sourceList, customerSearch]);

  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedCustomerIds.includes(c.id));

  const filteredSegments = useMemo(() => {
    return segments.filter((segment) => {
      if (activeFilter === "ACTIVE") return getCustomerCount(segment) > 0;
      if (activeFilter === "INACTIVE") return getCustomerCount(segment) === 0;
      return true;
    });
  }, [segments, activeFilter]);

  const stats = useMemo(
    () => ({
      totalSegments: segments.length,
      activeSegments: segments.filter((s) => getCustomerCount(s) > 0).length,
      totalCustomers: segments.reduce((a, s) => a + getCustomerCount(s), 0),
      emptySegments: segments.filter((s) => getCustomerCount(s) === 0).length,
    }),
    [segments]
  );

  /* ---------------- Segment form handlers ---------------- */

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

 const openCreateSegment = () => {
  setForm({});
  setEditingId(null);
  setShowFormModal(true);
};

  const handleEdit = (segment: CustomerSegment) => {
  setForm(segment);
  setEditingId(segment.id);
  setShowFormModal(true);
};

 const closeSegmentModal = () => {
  setShowFormModal(false);
  setEditingId(null);
  setForm({});
};

  const handleSubmitSegment = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      ToasterService.error("Segment name is required");
      return;
    }
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, {
              headers: authHeaders,
            })
          : await axios.post(API_URL, form, { headers: authHeaders });

      if (res.status === 200 || res.status === 201) {
        const createdSegmentId =
          editingId === null && res.data?.id ? res.data.id : null;

        ToasterService.success(
          editingId !== null
            ? "Segment updated successfully!"
            : "Segment added successfully!"
        );

                setShowFormModal(false);
        setForm({});
        setEditingId(null);

        await fetchSegments();
        // Auto-open the customer modal on the newly-created segment
        if (createdSegmentId) {
          openCustomerModal(createdSegmentId);
        }
      }
    } catch (err) {
      console.error("Error saving segment", err);
      ToasterService.error("Failed to save segment");
    }
  };

  const goToCustomerDetail = (customerId: number) => {
  if (!customerId) return;
  navigate(`/customer-management/${customerId}`, {
    state: {
      from: "segments-customer-modal",
      segmentId: activeSegmentId,
    },
  });
};

  /* ---------------- Customer modal handlers ---------------- */

  const openCustomerModal = (segmentId: number) => {
    setActiveSegmentId(segmentId);
    setCustomerModalMode("add"); // always start on Add tab
    setShowCustomerModal(true);
    setSelectedCustomerIds([]);
    setCustomerSearch("");
  };

  const closeCustomerModal = () => {
    if (isAssigning) return; // prevent close during request
    setShowCustomerModal(false);
    setSelectedCustomerIds([]);
    setCustomerSearch("");
    setActiveSegmentId(null);
    setCustomerModalMode("add");
  };

  const switchCustomerTab = (tab: "add" | "manage") => {
    setCustomerModalMode(tab);
    setSelectedCustomerIds([]);
    setCustomerSearch("");
  };

  const toggleCustomer = (customerId: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((x) => x !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visible = new Set(filteredCustomers.map((c) => c.id));
      setSelectedCustomerIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const merged = new Set([
        ...selectedCustomerIds,
        ...filteredCustomers.map((c) => c.id),
      ]);
      setSelectedCustomerIds(Array.from(merged));
    }
  };

  /* ---------------- Assign / Remove ---------------- */

  const handleAssignCustomers = async () => {
    if (!activeSegmentId || selectedCustomerIds.length === 0) {
      ToasterService.error("Please select at least one customer");
      return;
    }
    try {
      setIsAssigning(true);

      // Backend endpoint: POST /segments/{segmentId}/customers/{customerId}
      await Promise.all(
        selectedCustomerIds.map((cid) =>
          axios.post(
            `${API_URL}/${activeSegmentId}/customers/${cid}`,
            {},
            { headers: authHeaders }
          )
        )
      );

      ToasterService.success(
        `${selectedCustomerIds.length} customer${
          selectedCustomerIds.length > 1 ? "s" : ""
        } added successfully!`
      );

      await fetchSegments();
      setSelectedCustomerIds([]);
      // Stay on Add tab so the user can add more immediately
    } catch (err: any) {
      console.error("Error assigning customers", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to assign customers"
      );
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveCustomers = async () => {
    if (!activeSegmentId || selectedCustomerIds.length === 0) {
      ToasterService.error("Please select at least one customer to remove");
      return;
    }
    try {
      setIsAssigning(true);

      // Backend endpoint: DELETE /segments/{segmentId}/customers/{customerId}
      await Promise.all(
        selectedCustomerIds.map((cid) =>
          axios.delete(`${API_URL}/${activeSegmentId}/customers/${cid}`, {
            headers: authHeaders,
          })
        )
      );

      ToasterService.success(
        `${selectedCustomerIds.length} customer${
          selectedCustomerIds.length > 1 ? "s" : ""
        } removed!`
      );

      await fetchSegments();
      setSelectedCustomerIds([]);
    } catch (err: any) {
      console.error("Error removing customers", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to remove customers"
      );
    } finally {
      setIsAssigning(false);
    }
  };

  /* ---------------- Delete segment ---------------- */

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSegmentToDelete(segments.find((s) => s.id === id) || null);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!segmentToDelete) return;
    try {
      await axios.delete(`${API_URL}/${segmentToDelete.id}`, {
        headers: authHeaders,
      });
      ToasterService.success("Segment deleted successfully!");
      setShowDeletePopup(false);
      setSegmentToDelete(null);
      fetchSegments();
    } catch (err) {
      console.error("Error deleting segment", err);
      ToasterService.error("Failed to delete segment");
    }
  };

  /* ---------------- Table columns ---------------- */

  const tableColumns: ColumnDef<CustomerSegment>[] = [
    {
      key: "name",
      label: "SEGMENT NAME",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (segment) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {segment.name?.charAt(0).toUpperCase() || "S"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {segment.name || "Unnamed Segment"}
          </span>
        </div>
      ),
    },
    {
      key: "description",
      label: "DESCRIPTION",
      sortable: true,
      headerClassName: "w-[38%] text-left",
      className: "w-[38%]",
      render: (segment) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <DocumentTextIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span
            className="truncate font-medium text-slate-600"
            title={segment.description}
          >
            {segment.description || (
              <span className="text-slate-400 italic">
                No description provided
              </span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "customers",
      label: "CUSTOMERS",
      sortable: true,
      headerClassName: "w-[15%] text-center",
      className: "w-[15%] text-center",
      sortValueGetter: (segment) => getCustomerCount(segment),
      render: (segment) => {
        const count = getCustomerCount(segment);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openCustomerModal(segment.id);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40 hover:bg-cyan-100 transition-colors"
            title={count > 0 ? "Manage customers" : "Add customers"}
          >
            <UserGroupIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
            {count} customer{count === 1 ? "" : "s"}
          </button>
        );
      },
    },
    {
      key: "actions",
      label: "ACTIONS",
      sortable: false,
      headerClassName: "w-[22%] text-right pr-4",
      className: "w-[22%] text-right",
      render: (segment) => {
        const count = getCustomerCount(segment);
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* View segment */}
            <button
              type="button"
              onClick={() =>
                navigate(`/crm-view/segments/${segment.id}`, {
                  state: { from: "segments" },
                })
              }
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
              title="View Segment"
            >
              <EyeIcon className="h-4 w-4" />
            </button>

            {/* Edit segment */}
            <button
              type="button"
              onClick={() => handleEdit(segment)}
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
              title="Edit Segment"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>

            {/* Manage / Add customers — always opens the modal */}
            <button
              type="button"
              onClick={() => openCustomerModal(segment.id)}
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
              title={count > 0 ? "Manage Customers" : "Add Customers"}
            >
              {count > 0 ? (
                <UsersIcon className="h-4 w-4" />
              ) : (
                <UserPlusIcon className="h-4 w-4" />
              )}
            </button>

            {/* Delete segment */}
            <button
              type="button"
              onClick={(e) => handleDelete(segment.id, e)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
              title="Delete Segment"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  /* ---------------- Render ---------------- */

  return (
    <>
      <PageMeta title="Customer Segments" description="Manage your segments" />
      <PageBreadcrumb
        pageTitle="Segments"
        className="crm-report-breadcrumb"
        actions={
          <>
            <AddButton onClick={openCreateSegment} label="Add Segment" />
          </>
        }
      />

      <div className="crm-report-page w-full max-w-none px-0 sm:px-0 lg:px-0 py-4">
        <div className="mb-[17px] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Total Segments" value={stats.totalSegments} />
          <StatsCard label="Active Segments" value={stats.activeSegments} />
          <StatsCard label="Total Customers" value={stats.totalCustomers} />
          <StatsCard label="Empty Segments" value={stats.emptySegments} />
        </div>

        <ReusableTable
          data={filteredSegments}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          rowDetailsTitle={(segment) => segment.name || "Segment details"}
          rowDetailsSubtitle="Customer segment details"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center">
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No segments found</p>
              {activeFilter !== "ALL" ? (
                <button
                  type="button"
                  onClick={() => setActiveFilter("ALL")}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreateSegment()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first segment
                </button>
              )}
            </div>
          }
        />

        {/* -------- Segment Form Modal -------- */}
        {showFormModal &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingId !== null ? "Edit Segment" : "Create New Segment"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {editingId !== null
                        ? "Update your segment details"
                        : "Add a new customer segment"}
                    </p>
                  </div>
                  <button
                    onClick={closeSegmentModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form
                  onSubmit={handleSubmitSegment}
                  className="p-5 max-h-[70vh] overflow-y-auto"
                >
                  <div className="space-y-4 pt-2">
                    <FloatingInput
                      label="Segment Name"
                      name="name"
                      value={form.name || ""}
                      onChange={handleChange}
                      required
                    />
                    <FloatingTextarea
                      label="Description"
                      name="description"
                      value={form.description || ""}
                      onChange={handleChange}
                      rows={4}
                    />
                  </div>

                  <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeSegmentModal}
                      className="px-4 py-2 !mb-0 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
                    >
                      {editingId !== null ? "Update Segment" : "Create Segment"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}

        {/* -------- Customer Modal (Add / In Segment tabs) -------- */}
        {showCustomerModal &&
          createPortal(
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto animate-slide-up max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Manage Customers
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activeSegment?.name
                        ? `Segment: ${activeSegment.name}`
                        : "Select customers"}
                    </p>
                  </div>
                  <button
                    onClick={closeCustomerModal}
                    disabled={isAssigning}
                    className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
                    aria-label="Close"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => switchCustomerTab("add")}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      customerModalMode === "add"
                        ? "border-cyan-600 text-cyan-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Add Customers
                    <span className="ml-1.5 text-xs text-gray-400">
                      ({availableCustomers.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchCustomerTab("manage")}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      customerModalMode === "manage"
                        ? "border-cyan-600 text-cyan-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    In Segment
                    <span className="ml-1.5 text-xs text-gray-400">
                      ({assignedCustomers.length})
                    </span>
                  </button>
                </div>

                {/* Search + Select All */}
                <div className="p-5 border-b border-gray-100 space-y-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search customers by name, email, or industry..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>

                  {filteredCustomers.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="text-gray-600 font-medium">
                          Select all ({filteredCustomers.length})
                        </span>
                      </label>
                      {selectedCustomerIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerIds([])}
                          className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-5">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-8">
                      <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        {customerModalMode === "add"
                          ? availableCustomers.length === 0
                            ? "All customers are already in this segment"
                            : "No customers found"
                          : "No customers in this segment yet"}
                      </p>
                      {customerSearch && (
                        <p className="text-gray-400 text-xs mt-1">
                          Try adjusting your search
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCustomers.map((customer) => {
                        const isSelected = selectedCustomerIds.includes(
                          customer.id
                        );
                        return (
                          <div
                            key={`customer-${customer.id}`}
                            className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? "border-cyan-500 bg-cyan-50 shadow-md"
                                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                            onClick={() => toggleCustomer(customer.id)}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCustomer(customer.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 flex-shrink-0"
                              />

                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
  <div className="h-8 w-8 rounded-md bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
    {safeString(customer.name).charAt(0).toUpperCase()}
  </div>
  <div className="min-w-0 flex-1">
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-gray-900 truncate">
        {safeString(customer.name)}
      </h4>

      {/* View customer detail */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();  // don't toggle the checkbox
          goToCustomerDetail(customer.id);
        }}
        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600 flex-shrink-0"
        title="View customer details"
        aria-label="View customer details"
      >
        <EyeIcon className="h-4 w-4" />
      </button>
    </div>

    <div className="flex flex-wrap items-center gap-2 !mb-0">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
        <BriefcaseIcon className="h-3 w-3 mr-1" />
        {safeString(customer.industry)}
      </span>
      {customer.status && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            customer.status === "Active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {customer.status}
        </span>
      )}
    </div>
  </div>
</div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                  <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="truncate">
                                      {safeString(customer.email)}
                                    </span>
                                  </div>
                                  {customer.phone && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
                                      <span>{customer.phone}</span>
                                    </div>
                                  )}
                                </div>

                                {customer.address &&
                                  (customer.address.city ||
                                    customer.address.country) && (
                                    <div className="mt-2 text-xs text-gray-500">
                                      {safeString(customer.address.city)},{" "}
                                      {safeString(customer.address.country)}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-600">
                    {selectedCustomerIds.length > 0 ? (
                      <span className="flex items-center gap-1">
                        <CheckIcon className="h-4 w-4 text-green-600" />
                        {selectedCustomerIds.length} customer
                        {selectedCustomerIds.length > 1 ? "s" : ""} selected
                      </span>
                    ) : (
                      <span className="text-gray-400">No customer selected</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeCustomerModal}
                      disabled={isAssigning}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Close
                    </button>

                    {customerModalMode === "add" ? (
                      <button
                        onClick={handleAssignCustomers}
                        disabled={
                          selectedCustomerIds.length === 0 || isAssigning
                        }
                        className={`px-4 py-2 rounded-lg text-sm !mb-0 font-medium transition-all duration-200 flex items-center gap-2 ${
                          selectedCustomerIds.length > 0 && !isAssigning
                            ? "bg-gradient-to-r from-cyan-600 to-blue-600 !text-white hover:from-cyan-700 hover:to-blue-700 shadow-sm"
                            : "bg-gray-100 !text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <UserPlusIcon className="h-4 w-4" />
                        {isAssigning
                          ? "Adding..."
                          : `Add ${selectedCustomerIds.length || ""} to Segment`.trim()}
                      </button>
                    ) : (
                      <button
                        onClick={handleRemoveCustomers}
                        disabled={
                          selectedCustomerIds.length === 0 || isAssigning
                        }
                        className={`px-4 py-2 rounded-lg text-sm !mb-0 font-medium transition-all duration-200 flex items-center gap-2 ${
                          selectedCustomerIds.length > 0 && !isAssigning
                            ? "bg-red-600 !text-white hover:bg-red-700 shadow-sm"
                            : "bg-gray-100 !text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <TrashIcon className="h-4 w-4" />
                        {isAssigning
                          ? "Removing..."
                          : `Remove ${selectedCustomerIds.length || ""}`.trim()}
                      </button>
                    )}
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
        innerText="Delete Segment"
        subText={
          segmentToDelete
            ? `Are you sure you want to delete "${segmentToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this segment?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setSegmentToDelete(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
};

export default Segments;
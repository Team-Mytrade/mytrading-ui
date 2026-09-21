import React, { useEffect, useState, ChangeEvent, FormEvent, useRef, useMemo } from "react";
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
import { useParams, useNavigate, useLocation } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import StatsCard from "../../components/common/Statscard";
import "./Deals.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Customer {
  id: number;
  customerName?: string;
  tradeName?: string;
  customerCode?: string;
  customerType?: string;
  status?: string;
  phone?: string;
  email?: string;
  website?: string;
  active?: boolean;
  addresses?: Array<{
    city?: string;
    country?: string;
    state?: string;
    defaultAddress?: boolean;
  }>;
  contacts?: Array<{
    id: number;
    fullName: string;
    email?: string;
    phone?: string;
    role?: string;
  }>;
  segments?: unknown[];
}

interface SegmentCustomer {
  customerId: number;
  customerName: string;
  customerCode: string;
  active: boolean;
  email?: string;
  phone?: string;
  assignedAt?: string;
}

interface CustomerSegment {
  id: number;
  code?: string;
  name: string;
  description: string;
  active?: boolean;
  segmentCustomers?: SegmentCustomer[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/crm/segments";
const PAGE_SIZE = 10;

const getTenantIdFromToken = (token: string) => {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded?.tenantId || null;
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
    if (token) return getTenantIdFromToken(token);
    return null;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Segments: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [form, setForm] = useState<Partial<CustomerSegment>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);

  // Customer modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<"add" | "manage">("add");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<CustomerSegment | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [customers, setCustomers] = useState<Customer[]>([]);

  const token = localStorage.getItem("accessToken");
  const tenantId = getTenantId();
  const processedEditIdRef = useRef<number | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  /* ---------------- Fetching ---------------- */

  useEffect(() => {
    fetchSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (segments.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const editId = searchParams.get("editId");

      if (editId && editingId === null && processedEditIdRef.current !== Number(editId)) {
        const segmentToEdit = segments.find((s) => s.id === Number(editId));
        if (segmentToEdit) {
          processedEditIdRef.current = Number(editId);
          handleEdit(segmentToEdit);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, location.search]);

  useEffect(() => {
    if (!showFormModal) {
      processedEditIdRef.current = null;
      if (location.search.includes("editId")) {
        navigate("/customer-segment", { replace: true });
      }
    }
  }, [showFormModal, navigate, location.search]);

  useEffect(() => {
    if (showCustomerModal) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCustomerModal]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get("/v1/api/crm/customers", {
        headers: { Authorization: `Bearer ${token}` },
        params: tenantId ? { tenantId } : {},
      });
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  const fetchSegments = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<CustomerSegment[]>(API_URL, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        params: tenantId ? { tenantId } : {},
      });
      const data = Array.isArray(res.data) ? res.data : [];
      if (id) {
        setSegments(data.filter((seg) => seg.id === Number(id)));
      } else {
        setSegments(data);
      }
    } catch (err) {
      console.error("Error fetching segments", err);
      setSegments([]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- Segment form ---------------- */

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

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
              headers: { Authorization: `Bearer ${token}` },
            })
          : await axios.post(API_URL, form, {
              headers: { Authorization: `Bearer ${token}` },
            });

      if (res.status === 200 || res.status === 201) {
        const createdSegmentId =
          editingId === null && res.data?.id ? res.data.id : null;

        ToasterService.success(
          editingId !== null ? "Segment updated successfully!" : "Segment added successfully!"
        );

        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        processedEditIdRef.current = null;
        navigate("/customer-segment", { replace: true });
        await fetchSegments();

        if (createdSegmentId) {
          openCustomerModal(createdSegmentId, "add");
        }
      }
    } catch (err) {
      console.error("Error submitting segment", err);
      ToasterService.error("Failed to save segment");
    }
  };

  const handleEdit = (segment: CustomerSegment) => {
    setForm(segment);
    setEditingId(segment.id);
    setShowFormModal(true);
    if (!location.search.includes("editId")) {
      navigate(`/customer-segment?editId=${segment.id}`, { replace: true });
    }
  };

  const openCreateSegment = () => {
    if (location.search.includes("editId")) {
      navigate("/customer-segment", { replace: true });
    }
    setShowFormModal(true);
    setForm({});
    setEditingId(null);
    processedEditIdRef.current = null;
  };

  const closeSegmentModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
    processedEditIdRef.current = null;
    if (location.search.includes("editId")) {
      navigate("/customer-segment", { replace: true });
    }
  };

  /* ---------------- Customer modal ---------------- */

  const openCustomerModal = (segmentId: number, mode: "add" | "manage" = "add") => {
    setActiveSegmentId(segmentId);
    setCustomerModalMode(mode);
    setShowCustomerModal(true);
    setSelectedCustomerIds([]);
    setCustomerSearch("");
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomerIds([]);
    setCustomerSearch("");
    setActiveSegmentId(null);
    setCustomerModalMode("add");
    setIsAssigning(false);
  };

  const activeSegment = useMemo(
    () => segments.find((s) => s.id === activeSegmentId) || null,
    [segments, activeSegmentId]
  );

  /* ---------------- Deduped assigned customers ---------------- */

  const assignedCustomers = useMemo<SegmentCustomer[]>(() => {
    const seen = new Set<number>();
    return (activeSegment?.segmentCustomers || []).filter((c) => {
      if (seen.has(c.customerId)) return false;
      seen.add(c.customerId);
      return true;
    });
  }, [activeSegment]);

  /* ---------------- Available customers (not yet in segment) ---------------- */

  const availableCustomers = useMemo<Customer[]>(() => {
    const existingIds = new Set(
      (activeSegment?.segmentCustomers || []).map((c) => c.customerId)
    );
    return customers.filter((c) => !existingIds.has(c.id));
  }, [customers, activeSegment]);

  /* ---------------- Source list for modal ---------------- */

  const sourceList = useMemo<(Customer | SegmentCustomer)[]>(
    () => (customerModalMode === "add" ? availableCustomers : assignedCustomers),
    [customerModalMode, availableCustomers, assignedCustomers]
  );

  /* ---------------- Filter (mode-aware) ---------------- */

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    // In manage mode with no search → show all (no hidden rows)
    if (customerModalMode === "manage" && !q) return sourceList;

    return sourceList.filter((c) => {
      const name = (("customerName" in c && c.customerName) || ("name" in c && (c as Customer).customerName) || "").toString().toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const code = (("customerCode" in c && c.customerCode) || "").toString().toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        code.includes(q)
      );
    });
  }, [sourceList, customerSearch, customerModalMode]);

  /* ---------------- Selection helpers ---------------- */

  const toggleCustomer = (customerId: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((x) => x !== customerId)
        : [...prev, customerId]
    );
  };

  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => {
      const id = "customerId" in c ? c.customerId : (c as Customer).id;
      return selectedCustomerIds.includes(id);
    });

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(
        filteredCustomers.map((c) => ("customerId" in c ? c.customerId : (c as Customer).id))
      );
      setSelectedCustomerIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const merged = new Set([
        ...selectedCustomerIds,
        ...filteredCustomers.map((c) => ("customerId" in c ? c.customerId : (c as Customer).id)),
      ]);
      setSelectedCustomerIds(Array.from(merged));
    }
  };

  /* ---------------- Add / Remove customers ---------------- */

  const handleAssignCustomers = async () => {
    if (!activeSegmentId || selectedCustomerIds.length === 0) {
      ToasterService.error("Please select at least one customer");
      return;
    }
    try {
      setIsAssigning(true);

      const results = await Promise.allSettled(
        selectedCustomerIds.map((cid) =>
          axios.post(
            `${API_URL}/${activeSegmentId}/customers/${cid}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      if (failed === 0) {
        ToasterService.success(`All ${succeeded} customer(s) added!`);
      } else if (succeeded === 0) {
        ToasterService.error(`Failed to add all ${failed} customer(s)`);
      } else {
        ToasterService.error(`${succeeded} added, ${failed} failed`);
      }

      closeCustomerModal();
      await fetchSegments();
    } catch (error: any) {
      console.error("Error assigning customers:", error);
      ToasterService.error(error.response?.data?.message || "Failed to assign customers");
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

      const results = await Promise.allSettled(
        selectedCustomerIds.map((cid) =>
          axios.delete(`${API_URL}/${activeSegmentId}/customers/${cid}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;

      if (failed === 0) {
        ToasterService.success(`All ${succeeded} customer(s) removed!`);
      } else if (succeeded === 0) {
        ToasterService.error(`Failed to remove all ${failed} customer(s)`);
      } else {
        ToasterService.error(`${succeeded} removed, ${failed} failed`);
      }

      setSelectedCustomerIds([]);
      await fetchSegments();
    } catch (error: any) {
      console.error("Error removing customers:", error);
      ToasterService.error(error.response?.data?.message || "Failed to remove customers");
    } finally {
      setIsAssigning(false);
    }
  };

  /* ---------------- Delete segment ---------------- */

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = segments.find((s) => s.id === id) || null;
    setSegmentToDelete(target);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!segmentToDelete) return;
    try {
      await axios.delete(`${API_URL}/${segmentToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  /* ---------------- Helpers ---------------- */

  const getCustomerCount = (segment: CustomerSegment) => {
    const ids = new Set((segment.segmentCustomers || []).map((c) => c.customerId));
    return ids.size;
  };

  const getSafeString = (value: string | undefined, fallback = "N/A") =>
    value && value.trim() ? value : fallback;

  const filteredSegments = useMemo(() => {
    return segments.filter((segment) => {
      let matches = true;
      if (activeFilter === "ACTIVE") matches = getCustomerCount(segment) > 0;
      else if (activeFilter === "INACTIVE") matches = getCustomerCount(segment) === 0;
      return matches;
    });
  }, [segments, activeFilter]);

  const stats = useMemo(
    () => ({
      totalSegments: segments.length,
      activeSegments: segments.filter((s) => getCustomerCount(s) > 0).length,
      totalCustomers: segments.reduce((acc, s) => acc + getCustomerCount(s), 0),
      emptySegments: segments.filter((s) => getCustomerCount(s) === 0).length,
    }),
    [segments]
  );

  /* ---------------- Table columns ---------------- */

  const tableColumns: ColumnDef<CustomerSegment>[] = [
    {
      key: "name",
      label: "Segment Name",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (segment) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {segment.name ? segment.name.charAt(0).toUpperCase() : "S"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate leading-snug">
              {segment.name || "Unnamed Segment"}
            </div>
            {segment.code && (
              <div className="text-xs text-slate-400 font-mono">{segment.code}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[38%] text-left",
      className: "w-[38%]",
      render: (segment) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <DocumentTextIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium text-slate-600" title={segment.description}>
            {segment.description || (
              <span className="text-slate-400 italic">No description provided</span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "customers",
      label: "Customers",
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
              const customerIds = [...new Set((segment.segmentCustomers || []).map((customer) => customer.customerId))];
              navigate(`/customer-management?segmentId=${segment.id}&segmentName=${encodeURIComponent(segment.name || "Segment")}&customerIds=${customerIds.join(",")}`);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40 hover:bg-cyan-100 hover:underline transition-colors"
            title={`View customers in ${segment.name || "this segment"}`}
          >
            <UserGroupIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
            {count} customer{count === 1 ? "" : "s"}
          </button>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
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
            <button
              type="button"
              onClick={() =>
                navigate(`/crm-view/segments/${segment.id}`, { state: { from: "segments" } })
              }
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
              title="View Segment"
            >
              <EyeIcon className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => handleEdit(segment)}
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
              title="Edit Segment"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>

            <button
  type="button"
  onClick={() => openCustomerModal(segment.id, count > 0 ? "manage" : "add")}
  className="rounded-lg p-2 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
  title={count > 0 ? "Manage Customers" : "Add Customers"}
>
  {count > 0 ? <UsersIcon className="h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
</button>

            <button
              type="button"
              onClick={(e) => handleDelete(segment.id, e)}
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
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
        actions={<AddButton onClick={openCreateSegment} label="Add Segment" />}
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

        {/* -------- Segment form modal -------- */}
        {showFormModal &&
          createPortal(
            <div
              key="segment-modal"
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
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitSegment} className="p-5 max-h-[70vh] overflow-y-auto">
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

        {/* -------- Customer modal (Add / Manage) -------- */}
        {showCustomerModal &&
          createPortal(
            <div
              key="customer-modal"
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto animate-slide-up max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Manage Customers
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activeSegment?.name ? `Segment: ${activeSegment.name}` : "Select customers"}
                    </p>
                  </div>
                  <button
                    onClick={closeCustomerModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-5">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerModalMode("add");
                      setSelectedCustomerIds([]);
                    }}
                    className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                      customerModalMode === "add"
                        ? "border-cyan-600 text-cyan-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Add Customers ({availableCustomers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerModalMode("manage");
                      setSelectedCustomerIds([]);
                    }}
                    className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      customerModalMode === "manage"
                        ? "border-cyan-600 text-cyan-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    In Segment ({assignedCustomers.length})
                  </button>
                </div>

                {/* Search + Select All */}
                <div className="p-5 border-b border-gray-100 space-y-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                        <p className="text-gray-400 text-xs mt-1">Try adjusting your search</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCustomers.map((item) => {
  const id = "customerId" in item ? item.customerId : (item as Customer).id;
  const displayName =
    ("customerName" in item && item.customerName) || "Unnamed Customer";
  const email = item.email || "";
  const phone = item.phone || "";
  const code = "customerCode" in item ? item.customerCode : (item as Customer).customerCode;
  const isSelected = selectedCustomerIds.includes(id);

  return (
    <div
      key={`customer-${id}`}
      className={`border rounded-lg p-4 transition-all duration-200 ${
        isSelected
          ? "border-cyan-500 bg-cyan-50 shadow-md"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox — stops propagation so it doesn't trigger row click */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleCustomer(id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 flex-shrink-0"
        />

        {/* Clickable body → opens customer profile */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => navigate(`/crm-view/customers/${id}`, { state: { from: "segments" } })}
          title="View customer profile"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {displayName}
              </h4>
              {code && (
                <div className="text-xs text-gray-400 font-mono truncate">{code}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400" />
              <span className="truncate">{email || "N/A"}</span>
            </div>
            {phone && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
                <span>{phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Explicit eye icon (optional but clearer) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm-view/customers/${id}`, { state: { from: "segments" } });
          }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
          title="View customer profile"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
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
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>

                    {customerModalMode === "add" ? (
                      <button
                        onClick={handleAssignCustomers}
                        disabled={selectedCustomerIds.length === 0 || isAssigning}
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
                        disabled={selectedCustomerIds.length === 0 || isAssigning}
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
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
};

export default Segments;

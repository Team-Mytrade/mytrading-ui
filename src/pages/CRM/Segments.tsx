import React, { useEffect, useState, ChangeEvent, FormEvent, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import PaginatedPopup from "../../components/common/unpopup";
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
  EnvelopeIcon,
  PhoneIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import ManageCustomersDrawer from "./ManageCustomer";
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
  const [isSaving, setIsSaving] = useState(false);


  // NEW: Customer drawer
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(false);
  const [drawerSegmentId, setDrawerSegmentId] = useState<number | null>(null);

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

  // Fetch customers when the drawer opens
  useEffect(() => {
    if (showCustomerDrawer) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCustomerDrawer]);

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
      setIsSaving(true);
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
          openCustomerDrawer(createdSegmentId);
        }
      }
    } catch (err) {
      console.error("Error submitting segment", err);
      ToasterService.error("Failed to save segment");
    }
     finally {
    setIsSaving(false);
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

  /* ---------------- Customer drawer ---------------- */

  const openCustomerDrawer = (segmentId: number) => {
    setDrawerSegmentId(segmentId);
    setShowCustomerDrawer(true);
  };

  const closeCustomerDrawer = () => {
    setShowCustomerDrawer(false);
    setDrawerSegmentId(null);
  };

  /* ---------------- NEW: Drawer segment + assigned customers ---------------- */

  const drawerSegment = useMemo(
    () => segments.find((s) => s.id === drawerSegmentId) || null,
    [segments, drawerSegmentId]
  );

  const drawerAssignedCustomers = useMemo<SegmentCustomer[]>(() => {
    const seen = new Set<number>();
    return (drawerSegment?.segmentCustomers || []).filter((c) => {
      if (seen.has(c.customerId)) return false;
      seen.add(c.customerId);
      return true;
    });
  }, [drawerSegment]);

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

            {/* Opens the drawer */}
            <button
              type="button"
              onClick={() => openCustomerDrawer(segment.id)}
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
<PaginatedPopup
  isOpen={showFormModal}
  title={editingId !== null ? "Edit Segment" : "Create Segment"}
  subtitle={
    editingId !== null
      ? "Update segment details"
      : "Add a new customer segment"
  }
  onClose={closeSegmentModal}
  onSubmit={handleSubmitSegment}
  submitLabel={editingId !== null ? "Update Segment" : "Create Segment"}
  submitting={isSaving}
  fields={[
    <FloatingInput
      key="name"
      label="Segment Name"
      name="name"
      value={form.name || ""}
      onChange={handleChange}
      required
    />,
    <div key="description" className="md:col-span-2">
      <FloatingTextarea
        label="Description"
        name="description"
        value={form.description || ""}
        onChange={handleChange}
        rows={4}
      />
    </div>,
  ]}
/>

        {/* -------- Customer modal (unchanged — used only for auto-open after create) -------- */}
       
      </div>

      {/* NEW: Manage Customers Drawer — opened only from the Actions column icon */}
      <ManageCustomersDrawer
        isOpen={showCustomerDrawer}
        segmentId={drawerSegmentId}
        segmentName={drawerSegment?.name}
        segmentDescription={drawerSegment?.description}
        segmentCode={drawerSegment?.code}
        assignedCustomers={drawerAssignedCustomers}
        allCustomers={customers}
        onClose={closeCustomerDrawer}
        onRefresh={fetchSegments}
        onViewCustomer={(cid) =>
          navigate(`/crm-view/customers/${cid}`, { state: { from: "segments" } })
        }
      />

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
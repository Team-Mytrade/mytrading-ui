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
  FunnelIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface Customer {
  id: number;
  name?: string;
  industry?: string;
  website?: string;
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

interface CustomerSegment {
  id: number;
  name: string;
  description: string;
  customers?: Customer[];
}

const API_URL = "/v1/api/crm/segments";
const PAGE_SIZE = 10;

const CustomerSegmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [form, setForm] = useState<Partial<CustomerSegment>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<CustomerSegment | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const token = localStorage.getItem("accessToken");

  const processedEditIdRef = useRef<number | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

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
  }, [segments, location.search, editingId]);

  useEffect(() => {
    if (!showFormModal) {
      processedEditIdRef.current = null;
      if (location.search.includes('editId')) {
        navigate("/customer-segment", { replace: true });
      }
    }
  }, [showFormModal, navigate, location.search]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    if (showCustomerModal) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCustomerModal]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get("/v1/api/crm/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Ensure customers is always an array
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
  };

  const fetchSegments = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<CustomerSegment[]>(API_URL);
      if (id) {
        const filteredSegment = res.data.filter((seg) => seg.id === Number(id));
        setSegments(filteredSegment);
      } else {
        setSegments(res.data);
      }
    } catch (err) {
      console.error("Error fetching segments", err);
    } finally {
      setIsLoading(false);
    }
  };

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
        ToasterService.success(
          editingId !== null
            ? "Segment updated successfully!"
            : "Segment added successfully!"
        );

        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        processedEditIdRef.current = null;
        navigate("/customer-segment", { replace: true });
        await fetchSegments();
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

    if (!location.search.includes('editId')) {
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

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomerId(null);
    setCustomerSearch("");
    setActiveSegmentId(null);
  };

  const openCustomerModal = (segmentId: number) => {
    setActiveSegmentId(segmentId);
    setShowCustomerModal(true);
    setSelectedCustomerId(null);
    setCustomerSearch("");
  };

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

  // Safe filter for customers with null checks
  const filteredCustomers = useMemo(
    () =>
      customers.filter((customer) => {
        const companyName = (customer.name || "").toLowerCase();
        const email = (customer.email || "").toLowerCase();
        const industry = (customer.industry || "").toLowerCase();
        const searchTerm = customerSearch.toLowerCase();

        return (
          companyName.includes(searchTerm) ||
          email.includes(searchTerm) ||
          industry.includes(searchTerm)
        );
      }),
    [customers, customerSearch]
  );

  const getCustomerCount = (segment: CustomerSegment) => {
    return segment.customers?.length || 0;
  };

  // Safe text display function
  const getSafeString = (value: string | undefined, defaultValue: string = "N/A") => {
    return value && value.trim() ? value : defaultValue;
  };

  const filteredSegments = useMemo(() => {
    return segments.filter((segment) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (segment.name || "").toLowerCase().includes(term) ||
        (segment.description || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "ACTIVE") {
        matchesFilter = getCustomerCount(segment) > 0;
      } else if (activeFilter === "INACTIVE") {
        matchesFilter = getCustomerCount(segment) === 0;
      }

      return matchesSearch && matchesFilter;
    });
  }, [segments, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalSegments: segments.length,
      activeSegments: segments.filter((segment) => getCustomerCount(segment) > 0).length,
      totalCustomers: segments.reduce((acc, segment) => acc + getCustomerCount(segment), 0),
    }),
    [segments]
  );

  const tableColumns: ColumnDef<CustomerSegment>[] = [
    {
      key: "name",
      label: "Segment Name",
      sortable: true,
      headerClassName: "w-[28%] text-left",
      className: "w-[28%]",
      render: (segment) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {segment.name ? segment.name.charAt(0).toUpperCase() : "S"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {segment.name || "Unnamed Segment"}
          </span>
        </div>
      )
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[32%] text-left",
      className: "w-[32%]",
      render: (segment) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <DocumentTextIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium text-slate-600" title={segment.description}>
            {segment.description || <span className="text-slate-400 italic">No description provided</span>}
          </span>
        </div>
      )
    },
    {
      key: "customers",
      label: "Customers",
      sortable: true,
      headerClassName: "w-[20%] text-center",
      className: "w-[20%] text-center",
      sortValueGetter: (segment) => getCustomerCount(segment),
      render: (segment) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <UserGroupIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {getCustomerCount(segment)} customers
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[20%] text-right pr-4",
      className: "w-[20%] text-right",
      render: (segment) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate(`/crm-view/segments/${segment.id}`, { state: { from: "segments" } })}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handleEdit(segment)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Segment"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          {getCustomerCount(segment) > 0 ? (
            <button
              type="button"
              onClick={() => navigate(`/customer-management/${segment.id}`)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
              title="View Customers"
            >
              <UsersIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openCustomerModal(segment.id)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600"
              title="Add Customers"
            >
              <UserPlusIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleDelete(segment.id, e)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Segment"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Customer Segments" description="Manage your segments" />
      <PageBreadcrumb pageTitle="Segments" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreateSegment} label="Add Segment" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Segments"
            value={stats.totalSegments}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Active Segments"
            value={stats.activeSegments}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Customers"
            value={stats.totalCustomers}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredSegments.length}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search segments by name or description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg border p-2 flex items-center justify-center transition-colors h-[40px] w-[40px] ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-slide-down">
            <div className="flex flex-wrap gap-4">
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
                <FloatingSelect
                  label="Filter by Status"
                  name="filter"
                  value={activeFilter}
                  onChange={(e) => { setActiveFilter(e.target.value); }}
                  includeEmptyOption={false}
                  className="!mb-0"
                  options={[
                    { id: "ALL", name: "All Segments" },
                    { id: "ACTIVE", name: "Active (Has Customers)" },
                    { id: "INACTIVE", name: "Inactive (No Customers)" }
                  ]}
                />
              </div>
              {activeFilter !== "ALL" && (
                <button
                  onClick={() => { setActiveFilter("ALL"); }}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable
          data={filteredSegments}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          onRowClick={(segment) => navigate(`/crm-view/segments/${segment.id}`, { state: { from: "segments" } })}
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No segments found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
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

        {/* Segment Modal */}
        {showFormModal &&
          createPortal(
          <div key="segment-modal" className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center">
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

        {/* Redesigned Customer Modal */}
        {showCustomerModal &&
          createPortal(
          <div key="customer-modal" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto animate-slide-up max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Add Customers to Segment
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Select customers to add to this customer segment
                  </p>
                </div>
                <button
                  onClick={closeCustomerModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-5 border-b border-gray-100">
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
              </div>

              {/* Customer List */}
              <div className="flex-1 overflow-y-auto p-5">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-8">
                    <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No customers found</p>
                    {customerSearch && (
                      <p className="text-gray-400 text-xs mt-1">Try adjusting your search</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredCustomers.map((customer) => (
                      <div
                        key={`customer-${customer.id}`}
                        className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedCustomerId === customer.id
                          ? 'border-cyan-500 bg-cyan-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold text-xs">
                                {getSafeString(customer.name).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {getSafeString(customer.name)}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 !mb-0">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                    <BriefcaseIcon className="h-3 w-3 mr-1" />
                                    {getSafeString(customer.industry)}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${customer.status === 'Active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                    }`}>
                                    {getSafeString(customer.status, 'Active')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                              <div className="flex !mb-0 items-center gap-2 text-xs text-gray-600">
                                <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400" />
                                <span className="truncate">{getSafeString(customer.email)}</span>
                              </div>
                              {customer.phone && (
                                <div className="flex !mb-0 items-center gap-2 text-xs text-gray-600">
                                  <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                            </div>

                            {customer.address && (customer.address.city || customer.address.country) && (
                              <div className="mt-2 text-xs text-gray-500">
                                {getSafeString(customer.address.city)}, {getSafeString(customer.address.country)}
                              </div>
                            )}
                          </div>

                          {selectedCustomerId === customer.id && (
                            <div className="ml-3">
                              <div className="h-5 w-5 rounded-full bg-cyan-500 flex items-center justify-center">
                                <CheckIcon className="h-3 w-3 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  {selectedCustomerId ? (
                    <span className="flex items-center gap-1">
                      <CheckIcon className="h-4 w-4 text-green-600" />
                      1 customer selected
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
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedCustomerId || !activeSegmentId) {
                        ToasterService.error("Please select a customer");
                        return;
                      }

                      try {
                        const response = await axios.post(
                          `/v1/api/crm/segments/${activeSegmentId}/assign/${selectedCustomerId}`,
                          {},
                          {
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );

                        if (response.status === 200) {
                          ToasterService.success("Customer assigned successfully!");
                          closeCustomerModal();
                          fetchSegments();
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      } catch (error: any) {
                        console.error("Error assigning customer:", error);
                        ToasterService.error(
                          error.response?.data?.message || "Failed to assign customer"
                        );
                      }
                    }}
                    disabled={!selectedCustomerId}
                    className={`px-4 py-2 rounded-lg text-sm !mb-0  font-medium transition-all duration-200 flex items-center gap-2 ${selectedCustomerId
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 !text-white hover:from-cyan-700 hover:to-blue-700 shadow-sm'
                      : 'bg-gray-100 !text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    Add to Segment
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

      {/* Animation Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
        
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

export default CustomerSegmentDetails;


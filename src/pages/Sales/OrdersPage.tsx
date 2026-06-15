import React, { useEffect, useMemo, useState, Fragment } from "react";
import axios from "axios";
import { Transition, Dialog } from "@headlessui/react";
import {
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  BuildingStorefrontIcon,
  CurrencyRupeeIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";

interface Customer {
  id: number;
  name: string;
}

interface SalesChannel {
  id: number;
  name: string;
}

type OrderStatus = "NEW" | "PENDING" | "COMPLETED" | "CANCELLED";

interface SalesOrder {
  id?: number;
  orderDate: string;
  status: OrderStatus;
  salesOrderStatus: string;
  customer: Customer | { id: number; name?: string };
  totalAmount: number;
  salesChannel: SalesChannel | { id: number; name?: string };
  paid: boolean;
}

const BASE_URL = "/v1/api/sales/sales-orders";
const PAGE_SIZE = 10;

export default function SalesOrderPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<SalesOrder | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof SalesOrder | "customer" | "salesChannel">("orderDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const emptyForm: SalesOrder = {
    orderDate: new Date().toISOString().split("T")[0],
    status: "NEW",
    salesOrderStatus: "PENDING",
    customer: { id: 0, name: "" },
    totalAmount: 0,
    salesChannel: { id: 0, name: "" },
    paid: false,
  };

  const [form, setForm] = useState<SalesOrder>(emptyForm);

  useEffect(() => {
    fetchAll();
    fetchDropdowns();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await axios.get<SalesOrder[]>(BASE_URL, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [custRes, chanRes] = await Promise.all([
        axios.get<Customer[]>("/v1/api/sales/customers", {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }),
        axios.get<SalesChannel[]>("/v1/api/sales/channels", {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }),
      ]);
      setCustomers(custRes.data);
      setChannels(chanRes.data);
    } catch (err) {
      console.error("Failed to load dropdown data", err);
    }
  };

  const handleCreate = async () => {
    try {
      const customerId = (form.customer as any).id;
      await axios.post(`${BASE_URL}/customer/${customerId}`, form, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await fetchAll();
      closeModal();
    } catch (err) {
      console.error("Create failed", err);
      alert("Failed to create order");
    }
  };

  const handleUpdateStatus = async (order: SalesOrder) => {
    if (!order.id) return;
    try {
      await axios.put(`${BASE_URL}/${order.id}/status`, { status: order.status }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await fetchAll();
      closeModal();
    } catch (err) {
      console.error("Update failed", err);
      alert("Failed to update order status");
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      await axios.delete(`${BASE_URL}/${id}/cancel`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      await fetchAll();
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to cancel order");
    }
  };

  const handleView = (order: SalesOrder) => {
    setViewOrder(order);
    setShowViewModal(true);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditMode(false);
    setSelectedOrder(null);
    setShowModal(true);
  };

  const openEdit = (order: SalesOrder) => {
    setForm({
      ...order,
      customer: { id: order.customer?.id || 0, name: (order.customer as any)?.name || "" },
      salesChannel: { id: (order.salesChannel as any)?.id || 0, name: (order.salesChannel as any)?.name || "" }
    });
    setEditMode(true);
    setSelectedOrder(order);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setSelectedOrder(null);
    setForm(emptyForm);
  };

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: orders.length,
      new: orders.filter(o => o.status === 'NEW').length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      completed: orders.filter(o => o.status === 'COMPLETED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
      totalRevenue: orders.reduce((sum, o) => sum + (o.status === 'COMPLETED' ? o.totalAmount : 0), 0),
    };
  }, [orders]);

  const filtered = useMemo(() => {
    let filtered = orders;

    // Apply search filter
    if (query.trim()) {
      const q = query.toLowerCase();
      filtered = filtered.filter((o) => {
        const cust = (o.customer as any)?.name || "";
        const chan = (o.salesChannel as any)?.name || "";
        return (
          String(o.id ?? "").includes(q) ||
          o.orderDate.includes(q) ||
          cust.toLowerCase().includes(q) ||
          chan.toLowerCase().includes(q) ||
          String(o.totalAmount).includes(q) ||
          o.status.toLowerCase().includes(q) ||
          (o.salesOrderStatus || "").toLowerCase().includes(q)
        );
      });
    }

    // Apply status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    return filtered;
  }, [orders, query, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const get = (item: SalesOrder, key: typeof sortKey) => {
        if (key === "customer") return ((item.customer as any)?.name || "").toString().toLowerCase();
        if (key === "salesChannel") return ((item.salesChannel as any)?.name || "").toString().toLowerCase();
        const val = (item as any)[key];
        if (typeof val === "string") return val.toLowerCase();
        if (typeof val === "number") return val;
        return "";
      };
      const A = get(a, sortKey as any);
      const B = get(b, sortKey as any);
      if (A < B) return sortOrder === "asc" ? -1 : 1;
      if (A > B) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const statusBadge = (s: OrderStatus) => {
    const base = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border";
    switch (s) {
      case "NEW":
        return (
          <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>
            <ClockIcon className="h-3 w-3 mr-1" />
            NEW
          </span>
        );
      case "PENDING":
        return (
          <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>
            <ArrowPathIcon className="h-3 w-3 mr-1" />
            PENDING
          </span>
        );
      case "COMPLETED":
        return (
          <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            COMPLETED
          </span>
        );
      case "CANCELLED":
        return (
          <span className={`${base} bg-red-50 text-red-700 border-red-200`}>
            <XCircleIcon className="h-3 w-3 mr-1" />
            CANCELLED
          </span>
        );
      default:
        return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>{s}</span>;
    }
  };

  const paymentStatusBadge = (paid: boolean) => {
    const base = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border";

    if (paid) {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}>
          <CheckCircleSolid className="h-3 w-3 mr-1" />
          PAID
        </span>
      );
    } else {
      return (
        <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
          <XCircleIcon className="h-3 w-3 mr-1" />
          UNPAID
        </span>
      );
    }
  };

  const StatCard = ({ icon: Icon, label, value, color, bgColor }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageMeta title="Order Management" description="Manage your Orders" />
      <PageBreadcrumb pageTitle="Order Management" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
              <AddButton className="!mb-0" label="Add Order" onClick={openCreate} />

        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <StatCard
            icon={BuildingStorefrontIcon}
            label="Total Orders"
            value={stats.total}
            color="text-cyan-600"
            bgColor="bg-cyan-50"
          />
          <StatCard
            icon={ClockIcon}
            label="New"
            value={stats.new}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <StatCard
            icon={ArrowPathIcon}
            label="Pending"
            value={stats.pending}
            color="text-yellow-600"
            bgColor="bg-yellow-50"
          />
          <StatCard
            icon={CheckCircleIcon}
            label="Completed"
            value={stats.completed}
            color="text-green-600"
            bgColor="bg-green-50"
          />
          <StatCard
            icon={CurrencyRupeeIcon}
            label="Revenue"
            value={`₹${stats.totalRevenue.toLocaleString()}`}
            color="text-purple-600"
            bgColor="bg-purple-50"
          />
        </div>

        {/* Search + Filters + Add */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative group">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-cyan-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10 pr-10 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-lg border transition-all ${showFilters || statusFilter !== "ALL"
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-600'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}
              >
                <FunnelIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <Transition
            show={showFilters}
            as={Fragment}
            enter="transition duration-200 ease-out"
            enterFrom="opacity-0 -translate-y-2"
            enterTo="opacity-100 translate-y-0"
            leave="transition duration-150 ease-in"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 -translate-y-2"
          >
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as OrderStatus | "ALL");
                      setPage(1);
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                {statusFilter !== "ALL" && (
                  <button
                    onClick={() => setStatusFilter("ALL")}
                    className="px-4 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          </Transition>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        { key: "orderDate", label: "Date", align: "left" },
                        { key: "customer", label: "Customer", align: "left" },
                        { key: "status", label: "Status", align: "left" },
                        { key: null, label: "Payment", align: "left" },
                        { key: "salesChannel", label: "Channel", align: "left" },
                        { key: "totalAmount", label: "Amount", align: "right" },
                        { key: null, label: "Actions", align: "right" },
                      ].map((column, index) => (
                        <th
                          key={index}
                          onClick={() => column.key && handleSort(column.key as any)}
                          className={`px-6 py-4 text-${column.align} text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                            }`}
                        >
                          <div className={`flex items-center ${column.align === 'right' ? 'justify-end' : ''} gap-1`}>
                            {column.label}
                            {column.key === sortKey && (
                              sortOrder === "asc" ?
                                <ChevronUpIcon className="h-4 w-4 text-cyan-600" /> :
                                <ChevronDownIcon className="h-4 w-4 text-cyan-600" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginated.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-900">
                            <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                            {new Date(o.orderDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {((o.customer as any)?.name || '?').charAt(0)}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {(o.customer as any)?.name || (o.customer as any)?.companyName || "-"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">{statusBadge(o.status as OrderStatus)}</td>
                        <td className="px-6 py-4">{paymentStatusBadge(o.paid)}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {(o.salesChannel as any)?.name || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">
                            ₹ {o.totalAmount.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleView(o)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-600 transition-colors" title="View Details">
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button onClick={() => openEdit(o)} className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition-colors" title="Edit">
                              <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button onClick={() => handleDelete(o.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors" title="Cancel Order">
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {paginated.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="bg-gray-100 rounded-full p-4 mb-4">
                              <BuildingStorefrontIcon className="h-12 w-12 text-gray-400" />
                            </div>
                            <p className="text-gray-600 text-lg font-medium mb-2">No orders found</p>
                            <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(page * PAGE_SIZE, filtered.length)}
                        </span>{' '}
                        of <span className="font-medium">{filtered.length}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setPage(1)}
                          disabled={page === 1}
                          className="relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          First
                        </button>
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <ChevronUpIcon className="h-4 w-4 rotate-90" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum = page;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${page === pageNum
                                ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                                : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <ChevronDownIcon className="h-4 w-4 rotate-90" />
                        </button>
                        <button
                          onClick={() => setPage(totalPages)}
                          disabled={page === totalPages}
                          className="relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          Last
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Transition show={showModal} as={Fragment}>
          <Dialog onClose={closeModal} className="relative z-50">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-2xl transform transition-all">
                    <div className="flex justify-between items-center p-6 border-b">
                      <Dialog.Title className="text-xl font-semibold text-gray-900">
                        {editMode ? "Update Order Status" : "Create Sales Order"}
                      </Dialog.Title>
                      <button
                        onClick={closeModal}
                        className="text-gray-400 hover:text-gray-500 transition-colors rounded-lg p-1 hover:bg-gray-100"
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (editMode && selectedOrder) {
                          await handleUpdateStatus({ ...form, id: selectedOrder.id });
                        } else {
                          await handleCreate();
                        }
                      }}
                      className="p-6 space-y-6"
                    >
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Order Date <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              name="orderDate"
                              value={form.orderDate}
                              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
                              type="date"
                              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status <span className="text-red-500">*</span>
                          </label>
                          <select
                            name="status"
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                          >
                            <option value="NEW">NEW</option>
                            <option value="PENDING">PENDING</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sales Order Status
                          </label>
                          <input
                            name="salesOrderStatus"
                            value={form.salesOrderStatus}
                            onChange={(e) => setForm({ ...form, salesOrderStatus: e.target.value })}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            placeholder="Enter status"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total Amount <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <CurrencyRupeeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              name="totalAmount"
                              value={form.totalAmount}
                              onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })}
                              type="number"
                              step="0.01"
                              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <select
                              name="customer"
                              value={(form.customer as any).id}
                              onChange={(e) => setForm({ ...form, customer: { id: Number(e.target.value) } })}
                              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                              required
                            >
                              <option value={0}>Select Customer</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sales Channel <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <BuildingStorefrontIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <select
                              name="salesChannel"
                              value={(form.salesChannel as any).id}
                              onChange={(e) => setForm({ ...form, salesChannel: { id: Number(e.target.value) } })}
                              className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                              required
                            >
                              <option value={0}>Select Channel</option>
                              {channels.map((ch) => (
                                <option key={ch.id} value={ch.id}>
                                  {ch.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="col-span-2">
                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.paid}
                              onChange={(e) => setForm({ ...form, paid: e.target.checked })}
                              className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">Mark as Paid</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-lg hover:from-cyan-700 hover:to-cyan-600 transition-colors font-medium shadow-lg shadow-cyan-500/25"
                        >
                          {editMode ? "Update Order" : "Create Order"}
                        </button>
                      </div>
                    </form>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* View Order Modal */}
        <Transition show={showViewModal} as={Fragment}>
          <Dialog onClose={() => setShowViewModal(false)} className="relative z-50">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
                    <div className="flex justify-between items-center p-6 border-b">
                      <Dialog.Title className="text-xl font-semibold text-gray-900">
                        Order Details
                      </Dialog.Title>
                      <button
                        onClick={() => setShowViewModal(false)}
                        className="text-gray-400 hover:text-gray-500 transition-colors rounded-lg p-1 hover:bg-gray-100"
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {viewOrder && (
                      <div className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-500">Order ID</span>
                            <span className="text-lg font-semibold text-gray-900">#{viewOrder.id}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Status</span>
                            {statusBadge(viewOrder.status as OrderStatus)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-3">Order Information</h4>
                            <div className="space-y-3">
                              <div className="flex items-center text-sm">
                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-600">Date:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  {new Date(viewOrder.orderDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <CurrencyRupeeIcon className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-600">Amount:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  ₹ {viewOrder.totalAmount.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                {viewOrder.paid ? (
                                  <CheckCircleSolid className="h-4 w-4 text-green-500 mr-2" />
                                ) : (
                                  <XCircleIcon className="h-4 w-4 text-red-500 mr-2" />
                                )}
                                <span className="text-gray-600">Payment:</span>
                                <span className="ml-2 font-medium">
                                  {viewOrder.paid ? 'Paid' : 'Unpaid'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-3">Customer Information</h4>
                            <div className="space-y-3">
                              <div className="flex items-center text-sm">
                                <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-600">Name:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  {(viewOrder.customer as any)?.name || '-'}
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-gray-600">Channel:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                  {(viewOrder.salesChannel as any)?.name || '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-2">
                            <h4 className="text-sm font-medium text-gray-500 mb-3">Additional Information</h4>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Sales Order Status:</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {viewOrder.salesOrderStatus || 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end">
                      <button
                        onClick={() => setShowViewModal(false)}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        Close
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </>
  );
}
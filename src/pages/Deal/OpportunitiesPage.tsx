import React, { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  TagIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "../../components/common/Statscard";

interface Opportunity {
  id: number;
  title: string;
  account: string;
  amount: number;
  stage: string;
  status: string;
  closeDate: string;
}

const stageOptions = ["Prospecting", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
const statusOptions = ["Active", "On Hold", "Won", "Lost"];
const PAGE_SIZE = 10;

const OpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Opportunity, "id">>({
    title: "",
    account: "",
    amount: 0,
    stage: "Prospecting",
    status: "Active",
    closeDate: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }));
  };

  const resetForm = () => {
    setFormData({ title: "", account: "", amount: 0, stage: "Prospecting", status: "Active", closeDate: "" });
    setEditId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId !== null) {
      setOpportunities((prev) => prev.map((op) => (op.id === editId ? { id: editId, ...formData } : op)));
    } else {
      setOpportunities((prev) => [{ id: Date.now(), ...formData }, ...prev]);
    }
    resetForm();
    setShowModal(false);
  };

  const handleEditClick = (op: Opportunity) => {
    setFormData({
      title: op.title,
      account: op.account,
      amount: op.amount,
      stage: op.stage,
      status: op.status,
      closeDate: op.closeDate,
    });
    setEditId(op.id);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this opportunity?")) {
      setOpportunities((prev) => prev.filter((op) => op.id !== id));
    }
  };

  // Filtered & paginated
  const filtered = opportunities.filter((op) => {
    const term = search.toLowerCase();
    const matchSearch =
      op.title.toLowerCase().includes(term) ||
      op.account.toLowerCase().includes(term) ||
      op.stage.toLowerCase().includes(term) ||
      op.status.toLowerCase().includes(term);
    const matchStage = selectedStage ? op.stage === selectedStage : true;
    return matchSearch && matchStage;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Stats
  const activeCount = opportunities.filter((op) => op.status === "Active").length;
  const totalValue = opportunities.reduce((sum, op) => sum + op.amount, 0);
  const avgDeal = opportunities.length > 0 ? totalValue / opportunities.length : 0;

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case "Prospecting": return "bg-blue-100 text-blue-800";
      case "Qualified": return "bg-cyan-100 text-cyan-800";
      case "Proposal": return "bg-purple-100 text-purple-800";
      case "Negotiation": return "bg-yellow-100 text-yellow-800";
      case "Closed Won": return "bg-green-100 text-green-800";
      case "Closed Lost": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800";
      case "On Hold": return "bg-yellow-100 text-yellow-800";
      case "Won": return "bg-emerald-100 text-emerald-800";
      case "Lost": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <PageMeta title="Opportunities" description="Manage your sales opportunities and deals" />
      <PageBreadcrumb pageTitle="Opportunities" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Opportunities"
            value={opportunities.length}
            icon={
              <div className="p-3 bg-blue-100 rounded-full">
                <TagIcon className="h-6 w-6 text-blue-600" />
              </div>
            }
          />
          <StatsCard
            label="Active"
            value={activeCount}
            icon={
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
            }
          />
          <StatsCard
            label="Total Value"
            value={`$${totalValue.toLocaleString()}`}
            icon={
              <div className="p-3 bg-purple-100 rounded-full">
                <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
              </div>
            }
          />
          <StatsCard
            // label="Avg. Deal Size"
            value={`$${avgDeal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={
              <div className="p-3 bg-cyan-100 rounded-full">
                <ChartBarIcon className="h-6 w-6 text-cyan-600" />
              </div>
            }
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search opportunities by name, stage, or status..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border ${
                showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
            </button>

            {/* Add Opportunity Button */}
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="px-4 !mb-0 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Add Opportunity</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <select
                  value={selectedStage}
                  onChange={(e) => { setSelectedStage(e.target.value); setPage(1); }}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Stages</option>
                  {stageOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {selectedStage && (
                <button
                  onClick={() => setSelectedStage("")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Deal Name", "Account", "Amount", "Closing Date", "Stage", "Status", "Actions"].map((label, i) => (
                    <th
                      key={i}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length > 0 ? (
                  paginated.map((op) => (
                    <tr key={op.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      {/* Deal Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-sm font-medium text-cyan-700">
                              {op.title.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                            {op.title}
                          </div>
                        </div>
                      </td>

                      {/* Account */}
                      <td className="px-6 py-4">
                        <div className="flex items-center text-xs text-gray-600">
                          <BuildingOfficeIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                          {op.account || "—"}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <CurrencyDollarIcon className="h-3.5 w-3.5 mr-0.5 text-gray-400 flex-shrink-0" />
                          {op.amount.toLocaleString()}
                        </div>
                      </td>

                      {/* Closing Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center text-xs text-gray-600">
                          <CalendarIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                          {op.closeDate || "—"}
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStageBadgeColor(op.stage)}`}>
                          {op.stage}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(op.status)}`}>
                          {op.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(op)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(op.id)}
                            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <TagIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No opportunities found</p>
                        {search || selectedStage ? (
                          <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                          >
                            Add your first opportunity
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{" "}
                    <span className="font-medium">{Math.min(page * PAGE_SIZE, filtered.length)}</span>{" "}
                    of <span className="font-medium">{filtered.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (page <= 3) pageNum = i + 1;
                      else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = page - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pageNum
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
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto animate-slide-up">
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editId !== null ? "Edit Opportunity" : "Add New Opportunity"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editId !== null ? "Update deal information" : "Add a new deal to your pipeline"}
                  </p>
                </div>
                <button
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Deal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Enter deal name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Account Name</label>
                  <input
                    name="account"
                    value={formData.account}
                    onChange={handleChange}
                    placeholder="Enter account name"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Amount ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="amount"
                      type="number"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Close Date</label>
                    <input
                      name="closeDate"
                      type="date"
                      value={formData.closeDate}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Stage</label>
                    <select
                      name="stage"
                      value={formData.stage}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    >
                      {stageOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
                  >
                    {editId !== null ? "Update Opportunity" : "Add Opportunity"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

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

export default OpportunitiesPage;

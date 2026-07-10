import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TagIcon,
  HashtagIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaveType {
  id?: number;
  code: string;
  name: string;
  paid: boolean;
  trackBalance: boolean;
  unit: "DAY" | "HOUR";
  carryForwardAllowed: boolean;
  encashmentAllowed: boolean;
  eligibilityRule: string;
  totalRequests?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/leave-types";

const PAGE_SIZE = 10;

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: LeaveType = {
  code: "",
  name: "",
  paid: false,
  trackBalance: false,
  unit: "DAY",
  carryForwardAllowed: false,
  encashmentAllowed: false,
  eligibilityRule: "",
};

// ─── Boolean Badge helper ─────────────────────────────────────────────────────

const BoolBadge: React.FC<{ value: boolean; trueLabel?: string; falseLabel?: string }> = ({
  value, trueLabel = "Yes", falseLabel = "No",
}) => value
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />{trueLabel}</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircleIcon className="h-3 w-3" />{falseLabel}</span>;

// ─── Page ─────────────────────────────────────────────────────────────────────

const LeaveTypePage: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveType>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [selectedPaid, setSelectedPaid] = useState<string>("");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await axios.get<LeaveType[]>(API_URL);
      setLeaveTypes(res.data);
    } catch (err) {
      console.error("Failed to load leave types", err);
      ToasterService.error("Failed to load leave types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof LeaveType, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingLeaveType(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setEditingLeaveType(null);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('leave-type-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const editLeaveType = (lt: LeaveType) => {
    setForm({ ...lt });
    setEditingLeaveType(lt);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('leave-type-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name) {
      ToasterService.error("Leave name is required");
      return;
    }

    try {
      if (editingLeaveType?.id) {
        await axios.put(`${API_URL}/${editingLeaveType.id}`, form);
        ToasterService.success("Leave type updated successfully");
      } else {
        await axios.post(API_URL, form);
        ToasterService.success("Leave type created successfully");
      }
      await loadAll();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this leave type? This may affect existing leave balances and requests.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Leave type deleted successfully");
      await loadAll();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  // Filter data for stats
  const getFilteredData = () => {
    let filtered = [...leaveTypes];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(lt =>
        lt.name?.toLowerCase().includes(searchTerm) ||
        lt.code?.toLowerCase().includes(searchTerm) ||
        lt.eligibilityRule?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedUnit) {
      filtered = filtered.filter(lt => lt.unit === selectedUnit);
    }

    if (selectedPaid !== "") {
      filtered = filtered.filter(lt => lt.paid === (selectedPaid === "true"));
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  const totalRecords = filteredData.length;
  const totalPaid = filteredData.filter(lt => lt.paid).length;
  const totalCarryForward = filteredData.filter(lt => lt.carryForwardAllowed).length;
  const totalEncashment = filteredData.filter(lt => lt.encashmentAllowed).length;

  // Get unique units for filter
  const uniqueUnits = [...new Set(leaveTypes.map(lt => lt.unit).filter(Boolean))];

  // Count active filters
  const activeFilterCount = [selectedUnit, selectedPaid, search].filter(Boolean).length;

  // Generate code from name (auto-generate)
  const generateCode = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 5);
  };

  // ─── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<LeaveType>[] = [
    {
      key: "code", label: "Code", sortable: true,
      render: (_: LeaveType, v: unknown) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono font-semibold text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "name", label: "Name", sortable: true,
      render: (_: LeaveType, v: unknown) => (
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "unit", label: "Unit", sortable: true,
      render: (_: LeaveType, v: unknown) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-600 uppercase">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "paid", label: "Paid", sortable: true,
      render: (_: LeaveType, v: unknown) => <BoolBadge value={Boolean(v)} />,
    },
    {
      key: "trackBalance", label: "Track Balance", sortable: true,
      render: (_: LeaveType, v: unknown) => <BoolBadge value={Boolean(v)} />,
    },
    {
      key: "carryForwardAllowed", label: "Carry Forward", sortable: true,
      render: (_: LeaveType, v: unknown) => (
        <div className="flex items-center gap-1">
          <ArrowPathIcon className="h-3.5 w-3.5 text-gray-400" />
          <BoolBadge value={Boolean(v)} />
        </div>
      ),
    },
    {
      key: "encashmentAllowed", label: "Encashment", sortable: true,
      render: (_: LeaveType, v: unknown) => (
        <div className="flex items-center gap-1">
          <CurrencyRupeeIcon className="h-3.5 w-3.5 text-gray-400" />
          <BoolBadge value={Boolean(v)} />
        </div>
      ),
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row: LeaveType) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => editLeaveType(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
            title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Leave Types" description="Manage leave types and policies" />
      <PageBreadcrumb pageTitle="Leave Types" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        {!showForm && (
          <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
            <AddButton label="Add Leave Type" onClick={openCreateForm} />
          </div>
        )}


        {/* Conditional Rendering: Form OR Stats & Table */}
        {showForm ? (
          // Form View
          <div id="leave-type-form" className={`${cardCls} mb-6`}>
            <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    {editingLeaveType ? (
                      <PencilSquareIcon className="h-5 w-5 text-cyan-600" />
                    ) : (
                      <PlusIcon className="h-5 w-5 text-cyan-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingLeaveType ? "Edit Leave Type" : "Add Leave Type"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingLeaveType ? "Update leave type details" : "Configure a new leave type"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to list"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={submitForm} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    required
                    onChange={e => {
                      const name = e.target.value;
                      handleChange("name", name);
                      if (!editingLeaveType && !form.code) {
                        handleChange("code", generateCode(name));
                      }
                    }}
                    placeholder="e.g. Casual Leave"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    required
                    onChange={e => handleChange("code", e.target.value.toUpperCase())}
                    placeholder="e.g. CL"
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">Unique identifier for this leave type</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => handleChange("unit", e.target.value as "DAY" | "HOUR")}
                    className={inputCls}
                  >
                    <option value="DAY">Day</option>
                    <option value="HOUR">Hour</option>
                  </select>
                </div>
              </div>

              {/* Toggle checkboxes */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Policy Settings</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {([
                  { key: "paid", label: "Paid Leave" },
                  { key: "trackBalance", label: "Track Balance" },
                  { key: "carryForwardAllowed", label: "Carry Forward Allowed" },
                  { key: "encashmentAllowed", label: "Encashment Allowed" },
                ] as { key: keyof LeaveType; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer w-fit">
                    <input
                      type="checkbox"
                      checked={!!form[key]}
                      onChange={e => handleChange(key, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Eligibility Rule <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.eligibilityRule}
                  onChange={e => handleChange("eligibilityRule", e.target.value)}
                  rows={3}
                  placeholder="Describe eligibility conditions..."
                  className={inputCls}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {editingLeaveType ? (
                    <>
                      <PencilSquareIcon className="h-4 w-4" />
                      Update Leave Type
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Add Leave Type
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to List
                </button>
              </div>
            </form>
          </div>
        ) : (
          // Table View
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <StatsCard label="Total Types" value={totalRecords} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<TagIcon className="h-6 w-6" />} />
              <StatsCard label="Paid Leaves" value={totalPaid} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
              <StatsCard label="Carry Forward" value={totalCarryForward} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<ArrowPathIcon className="h-6 w-6" />} />
              <StatsCard label="Encashment" value={totalEncashment} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<CurrencyRupeeIcon className="h-6 w-6" />} />
            </div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, code, or eligibility rule..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`relative px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 shadow-sm ${showFilters || activeFilterCount > 0
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-600'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  <FunnelIcon className="h-4 w-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 bg-cyan-600 text-white text-xs rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {(search || activeFilterCount > 0) && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedUnit("");
                      setSelectedPaid("");
                      setShowFilters(false);
                    }}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-800 rounded-lg border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      value={selectedUnit}
                      onChange={e => setSelectedUnit(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Units</option>
                      {uniqueUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid Status</label>
                    <select
                      value={selectedPaid}
                      onChange={e => setSelectedPaid(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All</option>
                      <option value="true">Paid</option>
                      <option value="false">Unpaid</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Reusable Table */}
            <ReusableTable<LeaveType>
              data={filteredData}
              columns={columns}
              loading={loading}
              searchable={false}
              pageSize={PAGE_SIZE}
              defaultSortKey="name"
              defaultSortOrder="asc"
              emptyState={
                <div className="flex flex-col items-center py-12">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <TagIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No leave types found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add your first leave type
                  </button>
                </div>
              }
            />
          </>
        )}

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    </>
  );
};
export default LeaveTypePage;

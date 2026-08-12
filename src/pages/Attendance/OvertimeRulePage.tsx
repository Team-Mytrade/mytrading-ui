import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  HashtagIcon,
  TagIcon,
  BoltIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarDaysIcon,
  StarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import FilterPopover from "../../components/common/filter";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PaginatedPopup from "../../components/common/unpopup";
import { AddButton } from "../../components/common/AddButton";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OvertimeRule {
  id?: number;
  ruleName: string;
  description: string;
  multiplier: number;
  applicableOnWeekends: boolean;
  applicableOnHolidays: boolean;
  minDuration: string;
  thresholdHours: string;
  priority: number;
  active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/overtime-rules";

const PAGE_SIZE = 10;

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: OvertimeRule = {
  ruleName: "",
  description: "",
  multiplier: 1,
  applicableOnWeekends: false,
  applicableOnHolidays: false,
  minDuration: "",
  thresholdHours: "",
  priority: 1,
  active: true,
};

// ─── Boolean Badge ────────────────────────────────────────────────────────────

const BoolBadge: React.FC<{ value: boolean }> = ({ value }) =>
  value
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Yes</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircleIcon className="h-3 w-3" />No</span>;

// ─── Helper Functions ─────────────────────────────────────────────────────────

const formatDuration = (duration: string): string => {
  if (!duration) return "—";
  const match = duration.match(/(\d+)([MH])/);
  if (match) {
    const value = match[1];
    const unit = match[2];
    if (unit === 'M') return `${value} minute${parseInt(value) !== 1 ? 's' : ''}`;
    if (unit === 'H') return `${value} hour${parseInt(value) !== 1 ? 's' : ''}`;
  }
  return duration;
};

const formatDurationForAPI = (value: string, unit: "M" | "H"): string => {
  if (!value || parseFloat(value) <= 0) return "";
  return `${value}${unit}`;
};

const parseDuration = (duration: string): { value: string; unit: "M" | "H" } => {
  if (!duration) return { value: "", unit: "M" };
  const match = duration.match(/(\d+)([MH])/);
  if (match) {
    return { value: match[1], unit: match[2] as "M" | "H" };
  }
  return { value: "", unit: "M" };
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const OvertimeRulePage: React.FC = () => {
  const [rules, setRules] = useState<OvertimeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<OvertimeRule | null>(null);
  const [form, setForm] = useState<OvertimeRule>({ ...emptyForm });
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>("");
  const [selectedWeekendFilter, setSelectedWeekendFilter] = useState<string>("");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Duration field states
  const [minDurationValue, setMinDurationValue] = useState<string>("");
  const [minDurationUnit, setMinDurationUnit] = useState<"M" | "H">("M");
  const [thresholdValue, setThresholdValue] = useState<string>("");
  const [thresholdUnit, setThresholdUnit] = useState<"M" | "H">("H");

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await axios.get<OvertimeRule[]>(API_URL);
      setRules(res.data);
    } catch (err) {
      console.error("Failed to load data", err);
      ToasterService.error("Failed to load overtime rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const filteredRules = useMemo(() => {
    let filtered = [...rules];

    if (selectedActiveFilter !== "") {
      filtered = filtered.filter(r => r.active === (selectedActiveFilter === "active"));
    }

    if (selectedWeekendFilter !== "") {
      filtered = filtered.filter(r => r.applicableOnWeekends === (selectedWeekendFilter === "yes"));
    }

    return filtered;
  }, [rules, selectedActiveFilter, selectedWeekendFilter]);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof OvertimeRule, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleMinDurationChange = (value: string, unit: "M" | "H") => {
    setMinDurationValue(value);
    setMinDurationUnit(unit);
    if (value && parseFloat(value) > 0) {
      const duration = formatDurationForAPI(value, unit);
      handleChange("minDuration", duration);
    } else {
      handleChange("minDuration", "");
    }
  };

  const handleThresholdChange = (value: string, unit: "M" | "H") => {
    setThresholdValue(value);
    setThresholdUnit(unit);
    if (value && parseFloat(value) > 0) {
      const duration = formatDurationForAPI(value, unit);
      handleChange("thresholdHours", duration);
    } else {
      handleChange("thresholdHours", "");
    }
  };

  const parseDurationsForEdit = (minDuration: string, thresholdHours: string) => {
    if (minDuration) {
      const { value, unit } = parseDuration(minDuration);
      setMinDurationValue(value);
      setMinDurationUnit(unit);
    }
    if (thresholdHours) {
      const { value, unit } = parseDuration(thresholdHours);
      setThresholdValue(value);
      setThresholdUnit(unit);
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setMinDurationValue("");
    setMinDurationUnit("M");
    setThresholdValue("");
    setThresholdUnit("H");
    setEditingRule(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setMinDurationValue("");
    setMinDurationUnit("M");
    setThresholdValue("");
    setThresholdUnit("H");
    setEditingRule(null);
    setShowForm(true);
  };

  const openEditForm = (rule: OvertimeRule) => {
    setForm({ ...rule });
    parseDurationsForEdit(rule.minDuration, rule.thresholdHours);
    setEditingRule(rule);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.ruleName) {
      ToasterService.error("Please enter a rule name");
      return;
    }

    const payload = {
      ruleName: form.ruleName,
      description: form.description,
      multiplier: form.multiplier,
      applicableOnWeekends: form.applicableOnWeekends,
      applicableOnHolidays: form.applicableOnHolidays,
      minDuration: form.minDuration,
      thresholdHours: form.thresholdHours,
      priority: form.priority,
      active: form.active,
    };

    try {
      if (editingRule?.id) {
        await axios.put(`${API_URL}/${editingRule.id}`, payload);
        ToasterService.success("Overtime rule updated successfully");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Overtime rule created successfully");
      }
      await loadRules();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this overtime rule? This may affect existing overtime entries.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Overtime rule deleted successfully");
      await loadRules();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: filteredRules.length,
    active: filteredRules.filter(r => r.active).length,
    weekends: filteredRules.filter(r => r.applicableOnWeekends).length,
    holidays: filteredRules.filter(r => r.applicableOnHolidays).length,
  };

  // Count active filters
  const activeFilterCount = [selectedActiveFilter, selectedWeekendFilter].filter(Boolean).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<OvertimeRule>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v ?? "—")}</span>
        </div>
      ),
    },
    {
      key: "ruleName", label: "Rule Name", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{String(v)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description", label: "Description", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[180px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "multiplier", label: "Multiplier", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
          <BoltIcon className="h-3 w-3" />{String(v)}×
        </span>
      ),
    },
    {
      key: "minDuration", label: "Min Duration", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{formatDuration(v as string)}</span>
        </div>
      ),
    },
    {
      key: "thresholdHours", label: "Threshold", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <div className="flex items-center gap-2">
          <StarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{formatDuration(v as string)}</span>
        </div>
      ),
    },
    {
      key: "priority", label: "Priority", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
          Priority {String(v)}
        </span>
      ),
    },
    {
      key: "applicableOnWeekends", label: "Weekends", sortable: true,
      render: (_: OvertimeRule, v: unknown) => <BoolBadge value={Boolean(v)} />,
    },
    {
      key: "applicableOnHolidays", label: "Holidays", sortable: true,
      render: (_: OvertimeRule, v: unknown) => (
        <div className="flex items-center gap-1">
          <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400" />
          <BoolBadge value={Boolean(v)} />
        </div>
      ),
    },
    {
      key: "active", label: "Active", sortable: true,
      render: (_: OvertimeRule, v: unknown) => <BoolBadge value={Boolean(v)} />,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row: OvertimeRule) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openEditForm(row)}
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
      <PageMeta title="Overtime Rules" description="Manage overtime rules" />
      <PageBreadcrumb pageTitle="Overtime Rules" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overtime Rules</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configure overtime multipliers and eligibility policies</p>
          </div>
          <AddButton label="Add Rule" onClick={openCreateForm} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Rules"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<BoltIcon className="h-6 w-6" />}
          />
          <StatsCard
            label="Active Rules"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon className="h-6 w-6" />}
          />
          <StatsCard
            label="Weekend Rules"
            value={stats.weekends}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<CalendarDaysIcon className="h-6 w-6" />}
          />
          <StatsCard
            label="Holiday Rules"
            value={stats.holidays}
            gradient="from-amber-50 to-yellow-50"
            borderColor="border-amber-100"
            labelColor="text-yellow-600"
            icon={<StarIcon className="h-6 w-6" />}
          />
        </div>

        {/* Reusable Table */}
        <ReusableTable<OvertimeRule>
          data={filteredRules}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search by rule name or description..."
          searchFields={["ruleName", "description"]}
          pageSize={PAGE_SIZE}
          defaultSortKey="priority"
          defaultSortOrder="asc"
          toolbar={
            <FilterPopover
              title="Filter Rules"
              buttonLabel="Filter"
              onReset={() => {
                setSelectedActiveFilter("");
                setSelectedWeekendFilter("");
              }}
              showFooter={true}
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={selectedActiveFilter}
                    onChange={e => setSelectedActiveFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All Rules</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Weekend Applicable</label>
                  <select
                    value={selectedWeekendFilter}
                    onChange={e => setSelectedWeekendFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All</option>
                    <option value="yes">Applicable on Weekends</option>
                    <option value="no">Not Applicable on Weekends</option>
                  </select>
                </div>
              </div>
            </FilterPopover>
          }
          emptyState={
            <div className="flex flex-col items-center py-12">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BoltIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No rules found</p>
              <button
                onClick={openCreateForm}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add your first rule
              </button>
            </div>
          }
        />

        {/* Overtime Rule Form Modal */}
        <PaginatedPopup
          isOpen={showForm}
          title={editingRule ? "Edit Overtime Rule" : "Add Overtime Rule"}
          subtitle={editingRule ? "Update overtime rule details" : "Configure a new overtime rule"}
          onClose={resetForm}
          onSubmit={submitForm}
          submitLabel={editingRule ? "Update Rule" : "Add Rule"}
          fields={[
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.ruleName}
                required
                onChange={e => handleChange("ruleName", e.target.value)}
                placeholder="e.g., Weekday OT"
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Multiplier</label>
              <input
                type="number"
                step="0.1"
                min={1}
                value={form.multiplier}
                onChange={e => handleChange("multiplier", parseFloat(e.target.value))}
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <input
                type="number"
                step="1"
                min={1}
                value={form.priority}
                onChange={e => handleChange("priority", parseInt(e.target.value))}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">Lower number = Higher priority</p>
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Duration</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={minDurationValue}
                  onChange={e => handleMinDurationChange(e.target.value, minDurationUnit)}
                  placeholder="Enter duration"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <select
                  value={minDurationUnit}
                  onChange={e => handleMinDurationChange(minDurationValue, e.target.value as "M" | "H")}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="M">Minutes</option>
                  <option value="H">Hours</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500">Minimum overtime duration required</p>
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Threshold Hours</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={thresholdValue}
                  onChange={e => handleThresholdChange(e.target.value, thresholdUnit)}
                  placeholder="Enter threshold"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <select
                  value={thresholdUnit}
                  onChange={e => handleThresholdChange(thresholdValue, e.target.value as "M" | "H")}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="M">Minutes</option>
                  <option value="H">Hours</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500">Hours after which overtime applies</p>
            </div>,
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={e => handleChange("description", e.target.value)}
                rows={2}
                placeholder="Describe when this rule applies..."
                className={inputCls}
              />
            </div>,
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Applicability</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { key: "applicableOnWeekends", label: "Applicable on Weekends" },
                  { key: "applicableOnHolidays", label: "Applicable on Holidays" },
                  { key: "active", label: "Active Rule" },
                ] as { key: keyof OvertimeRule; label: string }[]).map(({ key, label }) => (
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
            </div>
          ]}
        />

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

export default OvertimeRulePage;

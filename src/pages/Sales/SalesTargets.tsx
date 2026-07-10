import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowPathIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PresentationChartLineIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import FilterPopover from "../../components/common/filter";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import PaginatedPopup from "../../components/common/unpopup";
import {
  FloatingDateRangePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type TargetStatus =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "MISSED"
  | "EXCEEDED"
  | "ONGOING"
  | "COMPLETED";

type TargetType = "REVENUE" | "QUANTITY" | "ORDERS" | "CUSTOMERS" | "PROFIT";

type Period = {
  year: number;
  month: string;
  monthValue: number;
  leapYear: boolean;
};

type SalesTarget = {
  id: number;
  salesPersonId: number;
  salesPersonName: string;
  salesPersonCode: string;
  targetType: TargetType | string;
  targetAmount: number;
  period?: Period | string;
  achievedAmount: number;
  targetYear: number;
  targetMonth: number;
  startDate: string;
  endDate: string;
  remarks: string;
  status: TargetStatus | string;
};

type SalesPersonOption = {
  id: number;
  name?: string;
  code?: string;
  active?: boolean;
};

type TargetForm = {
  salesPersonId: string;
  salesPersonName: string;
  salesPersonCode: string;
  targetType: TargetType;
  targetAmount: string;
  achievedAmount: string;
  targetYear: string;
  targetMonth: string;
  startDate: string;
  endDate: string;
  remarks: string;
  status: TargetStatus;
};

const API_URL = "/v1/api/sales/sales-targets";
const PAGE_SIZE = 10;

const statusOptions: TargetStatus[] = [
  "NOT_STARTED",
  "ON_TRACK",
  "MISSED",
  "EXCEEDED",
  "ONGOING",
  "COMPLETED",
];

const targetTypeOptions: TargetType[] = ["REVENUE", "QUANTITY", "ORDERS", "CUSTOMERS", "PROFIT"];

const monthNames = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const emptyForm: TargetForm = {
  salesPersonId: "",
  salesPersonName: "",
  salesPersonCode: "",
  targetType: "REVENUE",
  targetAmount: "",
  achievedAmount: "0",
  targetYear: String(new Date().getFullYear()),
  targetMonth: String(new Date().getMonth() + 1),
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .split("T")[0],
  remarks: "",
  status: "NOT_STARTED",
};

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  return { start, end };
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function buildPeriod(year: number, month: number): Period {
  return {
    year,
    month: monthNames[Math.max(0, Math.min(11, month - 1))],
    monthValue: month,
    leapYear: isLeapYear(year),
  };
}

function formatPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getPeriodYear(period?: Period | string) {
  if (!period) return undefined;
  if (typeof period === "string") return Number(period.split("-")[0]);
  return period.year;
}

function getPeriodMonth(period?: Period | string) {
  if (!period) return undefined;
  if (typeof period === "string") return Number(period.split("-")[1]);
  return period.monthValue;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function toCurrency(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function toFriendlyStatus(status: string) {
  return String(status || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function toDateValue(value?: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toInputDateValue(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const SalesTargets: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [form, setForm] = useState<TargetForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [achievedUpdatingId, setAchievedUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TargetStatus | "">("");
  const [salesPersonFilter, setSalesPersonFilter] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SalesTarget | null>(null);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);

  useEffect(() => {
    fetchAllTargets(true);
    fetchSalesPersons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertTarget = (target: SalesTarget) => {
    setTargets((current) => {
      const exists = current.some((item) => item.id === target.id);
      if (exists) return current.map((item) => (item.id === target.id ? target : item));
      return [target, ...current];
    });
  };

  const fetchAllTargets = async (silent = false) => {
    try {
      setLoading(true);
      const res = await axios.get<SalesTarget[]>(`${API_URL}/getAll`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setTargets(data);
      if (!silent) {
        data.length ? ToasterService.success("Sales targets loaded") : ToasterService.noData("No sales targets found");
      }
    } catch (error) {
      ToasterService.error("Failed to load sales targets", getErrorMessage(error, "Please try again."));
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchByRange = async (start = rangeStart, end = rangeEnd, silent = false) => {
    if (!start || !end) {
      ToasterService.error("Start and end date are required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<SalesTarget[]>(`${API_URL}/range`, {
        headers,
        params: { start, end },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setTargets(data);
      if (!silent) {
        data.length ? ToasterService.success("Sales targets loaded") : ToasterService.noData("No sales targets found");
      }
    } catch (error) {
      ToasterService.error("Failed to load sales targets", getErrorMessage(error, "Please try again."));
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPersons = async () => {
    try {
      const res = await axios.get<SalesPersonOption[]>("/v1/api/sales/sales-persons", { headers });
      setSalesPersons(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load sales persons", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Target ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<SalesTarget>(`${API_URL}/${lookupId}`, { headers });
      setTargets([res.data]);
      ToasterService.success("Sales target loaded");
    } catch (error) {
      ToasterService.error("Failed to load target", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchByStatus = async () => {
    if (!statusFilter) {
      ToasterService.error("Status is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<SalesTarget[]>(`${API_URL}/status/${statusFilter}`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setTargets(data);
      data.length ? ToasterService.success("Sales targets loaded") : ToasterService.noData("No sales targets found");
    } catch (error) {
      ToasterService.error("Failed to load targets by status", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchBySalesPerson = async () => {
    if (!salesPersonFilter) {
      ToasterService.error("Sales person ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<SalesTarget[]>(`${API_URL}/salesperson/${salesPersonFilter}`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setTargets(data);
      data.length ? ToasterService.success("Sales targets loaded") : ToasterService.noData("No sales targets found");
    } catch (error) {
      ToasterService.error("Failed to load salesperson targets", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "salesPersonId") {
        const person = salesPersons.find((item) => String(item.id) === value);
        next.salesPersonName = person?.name || "";
        next.salesPersonCode = person?.code || "";
      }
      if (name === "targetYear" || name === "targetMonth") {
        const year = Number(name === "targetYear" ? value : next.targetYear);
        const month = Number(name === "targetMonth" ? value : next.targetMonth);
        if (year && month >= 1 && month <= 12) {
          next.startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
          next.endDate = new Date(year, month, 0).toISOString().split("T")[0];
        }
      }
      return next;
    });
  };

  const buildPayload = () => {
    const year = Number(form.targetYear);
    const month = Number(form.targetMonth);

    return {
      id: editingId || 0,
      salesPersonId: Number(form.salesPersonId),
      salesPersonName: form.salesPersonName,
      salesPersonCode: form.salesPersonCode,
      targetType: form.targetType,
      targetAmount: Number(form.targetAmount || 0),
      period: formatPeriod(year, month),
      achievedAmount: Number(form.achievedAmount || 0),
      targetYear: year,
      targetMonth: month,
      startDate: form.startDate,
      endDate: form.endDate,
      remarks: form.remarks,
      status: form.status,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.salesPersonId || !form.targetAmount || !form.targetYear || !form.targetMonth) {
      ToasterService.error("Required fields missing", "Sales person, target amount, year, and month are required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const res = editingId
        ? await axios.put<SalesTarget>(`${API_URL}/${editingId}`, payload, { headers })
        : await axios.post<SalesTarget>(API_URL, payload, { headers });

      upsertTarget(res.data);
      ToasterService.success(editingId ? "Sales target updated" : "Sales target created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save sales target", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const buildPayloadFromTarget = (
    target: SalesTarget,
    status: TargetStatus | string = target.status
  ) => {
    const targetYear = Number(target.targetYear || getPeriodYear(target.period) || new Date().getFullYear());
    const targetMonth = Number(target.targetMonth || getPeriodMonth(target.period) || new Date().getMonth() + 1);
    const person = salesPersons.find((item) => Number(item.id) === Number(target.salesPersonId));

    return {
      id: target.id,
      salesPersonId: Number(target.salesPersonId),
      salesPersonName: target.salesPersonName || person?.name || "",
      salesPersonCode: target.salesPersonCode || person?.code || "",
      targetType: targetTypeOptions.includes(target.targetType as TargetType)
        ? (target.targetType as TargetType)
        : "REVENUE",
      targetAmount: Number(target.targetAmount || 0),
      period: formatPeriod(targetYear, targetMonth),
      achievedAmount: Number(target.achievedAmount || 0),
      targetYear,
      targetMonth,
      startDate: target.startDate || "",
      endDate: target.endDate || "",
      remarks: target.remarks || "",
      status,
    };
  };

  const handleInlineStatusChange = async (target: SalesTarget, nextStatus: string) => {
    if (String(target.status) === nextStatus) return;

    try {
      setStatusUpdatingId(target.id);
      const payload = buildPayloadFromTarget(target, nextStatus);
      const res = await axios.put<SalesTarget>(`${API_URL}/${target.id}`, payload, { headers });
      upsertTarget(res.data);
      ToasterService.success("Sales target status updated");
    } catch (error) {
      ToasterService.error("Failed to update target status", getErrorMessage(error, "Please try again."));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (target: SalesTarget) => {
    setEditingId(target.id);
    setForm({
      salesPersonId: String(target.salesPersonId || ""),
      salesPersonName: target.salesPersonName || "",
      salesPersonCode: target.salesPersonCode || "",
      targetType: targetTypeOptions.includes(target.targetType as TargetType)
        ? (target.targetType as TargetType)
        : "REVENUE",
      targetAmount: String(target.targetAmount ?? ""),
      achievedAmount: String(target.achievedAmount ?? 0),
      targetYear: String(target.targetYear || getPeriodYear(target.period) || new Date().getFullYear()),
      targetMonth: String(target.targetMonth || getPeriodMonth(target.period) || new Date().getMonth() + 1),
      startDate: target.startDate || "",
      endDate: target.endDate || "",
      remarks: target.remarks || "",
      status: (target.status as TargetStatus) || "NOT_STARTED",
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = Number(deleteTarget.id);

    if (!Number.isFinite(targetId) || targetId <= 0) {
      ToasterService.error("Invalid target ID", "Only saved sales targets can be deleted.");
      setDeleteTarget(null);
      return;
    }

    try {
      await axios.delete(`${API_URL}/${targetId}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setTargets((current) => current.filter((target) => Number(target.id) !== targetId));
      ToasterService.success("Sales target deleted");
    } catch (error) {
      ToasterService.error("Failed to delete sales target", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteTarget(null);
    }
  };

  const markTargetAsAchieved = async (target: SalesTarget) => {
    try {
      setAchievedUpdatingId(target.id);

      const patchResponse = await axios.patch<SalesTarget>(`${API_URL}/${target.id}/achieved`, null, {
        headers,
        params: { amount: Number(target.targetAmount || 0) },
        skipSessionExpiredHandling: true,
      } as any);

      const achievedTarget: SalesTarget = {
        ...patchResponse.data,
        achievedAmount: Number(patchResponse.data.achievedAmount || target.targetAmount || 0),
        status: "COMPLETED",
      };

      const payload = buildPayloadFromTarget(achievedTarget, "COMPLETED");
      const updateResponse = await axios.put<SalesTarget>(`${API_URL}/${target.id}`, payload, { headers });

      upsertTarget({
        ...updateResponse.data,
        achievedAmount: Number(updateResponse.data.achievedAmount || achievedTarget.achievedAmount),
        status: "COMPLETED",
      });
      ToasterService.success("Target marked as achieved");
    } catch (error) {
      ToasterService.error("Failed to mark target as achieved", getErrorMessage(error, "Please try again."));
    } finally {
      setAchievedUpdatingId(null);
    }
  };

  const getStatusSelectClasses = (status: string) => {
    if (status === "COMPLETED" || status === "EXCEEDED") {
      return "border-green-200 bg-green-50 text-green-700";
    }
    if (status === "MISSED") {
      return "border-red-200 bg-red-50 text-red-700";
    }
    if (status === "ON_TRACK" || status === "ONGOING") {
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    }
    return "border-blue-200 bg-blue-50 text-blue-700";
  };

  const filteredTargets = useMemo(() => {
    return targets.filter((target) => {
      const person = salesPersons.find((item) => Number(item.id) === Number(target.salesPersonId));
      const periodYear = target.targetYear || getPeriodYear(target.period) || "";
      const periodMonth = target.targetMonth || getPeriodMonth(target.period) || "";
      const periodLabel =
        periodMonth && periodYear
          ? `${monthNames[Number(periodMonth) - 1] || ""} ${periodYear}`.trim()
          : "";
      const targetStart = target.startDate || "";
      const targetEnd = target.endDate || "";
      const matchesStatus = !statusFilter || String(target.status) === statusFilter;
      const matchesStart = !rangeStart || (targetStart && targetStart >= rangeStart);
      const matchesEnd = !rangeEnd || (targetEnd && targetEnd <= rangeEnd);
      const term = searchableText(search);

      const haystack = [
        target.salesPersonName,
        target.salesPersonCode,
        person?.name,
        person?.code,
        target.targetType,
        target.status,
        toFriendlyStatus(String(target.status)),
        target.remarks,
        target.id,
        target.salesPersonId,
        target.targetAmount,
        target.achievedAmount,
        target.targetYear,
        target.targetMonth,
        target.startDate,
        target.endDate,
        periodLabel,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      const matchesSearch = !term || haystack.includes(term);
      return matchesStatus && matchesStart && matchesEnd && matchesSearch;
    });
  }, [rangeEnd, rangeStart, salesPersons, search, statusFilter, targets]);

  const stats = useMemo(
    () => ({
      total: targets.length,
      targetAmount: targets.reduce((sum, target) => sum + Number(target.targetAmount || 0), 0),
      achievedAmount: targets.reduce((sum, target) => sum + Number(target.achievedAmount || 0), 0),
      completed: targets.filter((target) => target.status === "COMPLETED" || target.status === "EXCEEDED").length,
    }),
    [targets]
  );

  const columns: ColumnDef<SalesTarget>[] = [
    {
      key: "salesPersonName",
      label: "Sales Person",
      sortable: true,
      render: (target) => {
        const person = salesPersons.find((item) => Number(item.id) === Number(target.salesPersonId));
        const name = target.salesPersonName || person?.name || `Person #${target.salesPersonId}`;
        const code = target.salesPersonCode || person?.code || "";

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
              <UserIcon className="h-4 w-4 text-cyan-700" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">{name}</div>
              <div className="text-xs text-slate-500">{code || `ID: ${target.salesPersonId}`}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "targetType",
      label: "Type",
      sortable: true,
      render: (target) => (
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {target.targetType}
        </span>
      ),
    },
    {
      key: "targetAmount",
      label: "Target",
      sortable: true,
      render: (target) => <span className="font-semibold text-slate-900">{toCurrency(target.targetAmount)}</span>,
    },
    {
      key: "achievedAmount",
      label: "Achieved",
      sortable: true,
      render: (target) => <span className="font-semibold text-green-700">{toCurrency(target.achievedAmount)}</span>,
    },
    {
      key: "targetMonth",
      label: "Period",
      sortable: true,
      render: (target) => (
        <span className="text-sm text-slate-700">
          {monthNames[(target.targetMonth || getPeriodMonth(target.period) || 1) - 1]} {target.targetYear || getPeriodYear(target.period)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (target) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={String(target.status)}
            onChange={(e) => handleInlineStatusChange(target, e.target.value)}
            disabled={statusUpdatingId === target.id}
            className={`w-[96px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${getStatusSelectClasses(String(target.status))} ${
              statusUpdatingId === target.id ? "cursor-not-allowed opacity-70" : ""
            }`}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {toFriendlyStatus(status)}
              </option>
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
      render: (target) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(target)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void markTargetAsAchieved(target)}
            disabled={achievedUpdatingId === target.id}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-70"
            title="Mark achieved"
          >
            <PresentationChartLineIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(target)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const selectedYear = Number(form.targetYear);
  const selectedMonth = Number(form.targetMonth);
  const rangeMinDate =
    selectedYear && selectedMonth >= 1 && selectedMonth <= 12
      ? new Date(selectedYear, selectedMonth - 1, 1)
      : undefined;
  const rangeMaxDate =
    selectedYear && selectedMonth >= 1 && selectedMonth <= 12
      ? new Date(selectedYear, selectedMonth, 0)
      : undefined;
  const selectedStartDate = toDateValue(form.startDate);
  const selectedEndDate = toDateValue(form.endDate);

  return (
    <>
      <PageMeta title="Sales Targets" description="Manage sales targets" />
      <PageBreadcrumb pageTitle="Sales Targets" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Target" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Targets" value={stats.total} icon={<PresentationChartLineIcon />} />
          <StatsCard
            label="Target Amount"
            value={toCurrency(stats.targetAmount)}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<BanknotesIcon />}
          />
          <StatsCard
            label="Achieved"
            value={toCurrency(stats.achievedAmount)}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Completed"
            value={stats.completed}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<CalendarDaysIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search targets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <FilterPopover
            title="Filter Sales Targets"
            buttonLabel="Filters"
            widthClassName="w-[21rem] sm:w-[23rem]"
            showFooter={false}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as TargetStatus | "")}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">Any status</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {toFriendlyStatus(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div />
              </div>

              <FloatingDateRangePicker
                label="Date Range"
                startDate={toDateValue(rangeStart)}
                endDate={toDateValue(rangeEnd)}
                onChange={([start, end]) => {
                  setRangeStart(toInputDateValue(start));
                  setRangeEnd(toInputDateValue(end));
                }}
                placeholder=""
              />

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLookupId("");
                    setSalesPersonFilter("");
                    setStatusFilter("");
                    setRangeStart("");
                    setRangeEnd("");
                    void fetchAllTargets(true);
                  }}
                  className="h-9 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Reset
                </button>
                <div className="col-span-2 flex items-center justify-center rounded-lg border border-dashed border-cyan-200 bg-cyan-50 px-3 text-xs font-medium text-cyan-700">
                  Filters apply live
                </div>
              </div>
            </div>
          </FilterPopover>
        </div>

        <ReusableTable
          data={filteredTargets}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="targetMonth"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <PresentationChartLineIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No sales targets found</p>
              <button
                type="button"
                onClick={() => fetchAllTargets()}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reload all targets
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Sales Target" : "Create Sales Target"}
        subtitle="Enter target details from the sales target API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Target" : "Create Target"}
        maxWidthClassName="max-w-3xl"
        tabs={[
          {
            label: "Target Info",
            fields: [
              <FloatingSelect
                label="Sales Person"
                name="salesPersonId"
                value={form.salesPersonId}
                onChange={handleChange}
                options={salesPersons.map((person) => ({
                  id: String(person.id),
                  name: person.name || `Person #${person.id}`,
                }))}
                required
              />,
              <FloatingInput
                label="Sales Person Name"
                name="salesPersonName"
                value={form.salesPersonName}
                onChange={handleChange}
                readOnly
              />,
              <FloatingSelect
                label="Target Type"
                name="targetType"
                value={form.targetType}
                onChange={handleChange}
                options={targetTypeOptions.map((type) => ({ id: type, name: type }))}
                includeEmptyOption={false}
                required
              />,
              <FloatingInput
                label="Target Amount"
                name="targetAmount"
                type="number"
                value={form.targetAmount}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                label="Achieved Amount"
                name="achievedAmount"
                type="number"
                value={form.achievedAmount}
                onChange={handleChange}
              />,
              <FloatingInput
                label="Target Year"
                name="targetYear"
                type="number"
                value={form.targetYear}
                onChange={handleChange}
                required
              />,
            ],
          },
          {
            label: "Schedule & Status",
            fields: [
              <FloatingInput
                label="Target Month"
                name="targetMonth"
                type="number"
                min={1}
                max={12}
                value={form.targetMonth}
                onChange={handleChange}
                required
              />,
              <FloatingDateRangePicker
                label="Target Date Range"
                startDate={selectedStartDate}
                endDate={selectedEndDate}
                onChange={([start, end]) => {
                  setForm((current) => ({
                    ...current,
                    startDate: toInputDateValue(start),
                    endDate: toInputDateValue(end),
                  }));
                }}
                minDate={rangeMinDate}
                maxDate={rangeMaxDate}
              />,
              <FloatingSelect
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={statusOptions.map((status) => ({ id: status, name: toFriendlyStatus(status) }))}
                includeEmptyOption={false}
                required
              />,
            ],
          },
          {
            label: "Remarks",
            fields: [
              <div className="md:col-span-2">
                <FloatingTextarea
                  label="Remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={3}
                />
              </div>,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteTarget}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Sales Target"
        subText={
          deleteTarget
            ? `Are you sure you want to delete target #${deleteTarget.id}?`
            : "Are you sure you want to delete this target?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default SalesTargets;

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type LocalTime = {
  hour: number;
  minute: number;
  second: number;
  nano: number;
};

type ServiceSchedule = {
  id: number;
  scheduleNo: string;
  serviceOrderId: number;
  customerId: number;
  assignedEmployeeId: number;
  scheduledDate: string;
  startTime: LocalTime | string;
  endTime: LocalTime | string;
  status: string;
  remarks: string;
};

type SalesPersonOption = {
  id: number;
  name?: string;
  code?: string;
  employeeId?: number | null;
};

type ScheduleForm = {
  serviceOrderId: string;
  customerId: string;
  assignedEmployeeId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  remarks: string;
};

const API_URL = "/v1/api/sales/service-schedules";
const PAGE_SIZE = 10;
const statusOptions = ["PENDING", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const emptyForm: ScheduleForm = {
  serviceOrderId: "",
  customerId: "",
  assignedEmployeeId: "",
  scheduledDate: new Date().toISOString().split("T")[0],
  startTime: "",
  endTime: "",
  remarks: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function formatTime(value: LocalTime | string | undefined) {
  if (!value) return "--";
  if (typeof value === "string") return value;
  return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}:${String(value.second || 0).padStart(2, "0")}`;
}

function requestTime(value: string) {
  return value ? `${value}:00` : "00:00:00";
}

function htmlTime(value: LocalTime | string | undefined) {
  const formatted = formatTime(value);
  return formatted === "--" ? "" : formatted.slice(0, 5);
}

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

const ServiceSchedules: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [employeeLookupId, setEmployeeLookupId] = useState("");
  const [statusScheduleId, setStatusScheduleId] = useState("");
  const [nextStatus, setNextStatus] = useState("PENDING");
  const [deleteSchedule, setDeleteSchedule] = useState<ServiceSchedule | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchSalesPersons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upsertSchedule = (schedule: ServiceSchedule) => {
    setSchedules((current) => {
      const exists = current.some((item) => item.id === schedule.id);
      if (exists) return current.map((item) => (item.id === schedule.id ? schedule : item));
      return [schedule, ...current];
    });
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await axios.get<ServiceSchedule[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setSchedules(data);
      if (data.length === 0) ToasterService.noData("No service schedules found");
    } catch (error) {
      ToasterService.error("Failed to load service schedules", getErrorMessage(error, "Please try again."));
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPersons = async () => {
    try {
      const res = await axios.get<SalesPersonOption[]>("/v1/api/sales/sales-persons", { headers });
      setSalesPersons(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load employees", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchByEmployee = async () => {
    if (!employeeLookupId) {
      ToasterService.error("Employee ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<ServiceSchedule[]>(`${API_URL}/employee/${employeeLookupId}`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setSchedules(data);
      data.length ? ToasterService.success("Employee schedules loaded") : ToasterService.noData("No schedules found");
    } catch (error) {
      ToasterService.error("Failed to load employee schedules", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => ({
    serviceOrderId: Number(form.serviceOrderId),
    customerId: Number(form.customerId),
    assignedEmployeeId: Number(form.assignedEmployeeId),
    scheduledDate: form.scheduledDate,
    startTime: requestTime(form.startTime),
    endTime: requestTime(form.endTime),
    remarks: form.remarks,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isPositiveNumber(form.serviceOrderId) || !isPositiveNumber(form.customerId) || !isPositiveNumber(form.assignedEmployeeId)) {
      ToasterService.error("Required fields missing", "Service order, customer, and employee are required.");
      return;
    }
    if (!form.scheduledDate || !form.startTime || !form.endTime) {
      ToasterService.error("Schedule time required", "Scheduled date, start time, and end time are required.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post<ServiceSchedule>(API_URL, buildPayload(), { headers });
      upsertSchedule(res.data);
      ToasterService.success("Service schedule created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save service schedule", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async () => {
    if (!statusScheduleId || !nextStatus) {
      ToasterService.error("Schedule ID and status are required");
      return;
    }

    try {
      const res = await axios.patch<ServiceSchedule>(`${API_URL}/${statusScheduleId}/status`, null, {
        headers,
        params: { status: nextStatus },
      });
      upsertSchedule(res.data);
      ToasterService.success("Schedule status updated");
    } catch (error) {
      ToasterService.error("Failed to update status", getErrorMessage(error, "Please try again."));
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const closeForm = () => {
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openFromSchedule = (schedule: ServiceSchedule) => {
    setForm({
      serviceOrderId: String(schedule.serviceOrderId || ""),
      customerId: String(schedule.customerId || ""),
      assignedEmployeeId: String(schedule.assignedEmployeeId || ""),
      scheduledDate: schedule.scheduledDate || new Date().toISOString().split("T")[0],
      startTime: htmlTime(schedule.startTime),
      endTime: htmlTime(schedule.endTime),
      remarks: schedule.remarks || "",
    });
    setShowFormModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteSchedule) return;

    try {
      await axios.delete(`${API_URL}/${deleteSchedule.id}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setSchedules((current) => current.filter((item) => item.id !== deleteSchedule.id));
      ToasterService.success("Service schedule deleted");
    } catch (error) {
      ToasterService.error("Failed to delete schedule", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteSchedule(null);
    }
  };

  const filteredSchedules = useMemo(() => {
    const term = searchableText(search);
    if (!term) return schedules;

    return schedules.filter((schedule) => {
      const employeeName = getEmployeeDisplayName(schedule.assignedEmployeeId);
      const haystack = [
        schedule.id,
        schedule.scheduleNo,
        schedule.serviceOrderId,
        schedule.customerId,
        schedule.assignedEmployeeId,
        employeeName,
        schedule.status,
        schedule.remarks,
        schedule.scheduledDate,
        formatTime(schedule.startTime),
        formatTime(schedule.endTime),
        `schedule ${schedule.id}`,
        `customer ${schedule.customerId}`,
        `employee ${schedule.assignedEmployeeId}`,
        `service order ${schedule.serviceOrderId}`,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [schedules, search, salesPersons]);

  const stats = useMemo(() => ({
    total: schedules.length,
    pending: schedules.filter((item) => item.status === "PENDING").length,
    inProgress: schedules.filter((item) => item.status === "IN_PROGRESS").length,
    completed: schedules.filter((item) => item.status === "COMPLETED").length,
  }), [schedules]);

  const employeeOptions = salesPersons
    .map((person) => ({
      id: String(person.employeeId || person.id),
      name: person.name || `Person #${person.id}`,
    }))
    .filter((item) => Number(item.id) > 0);

  const getEmployeeDisplayName = (employeeId: number) => {
    const person = salesPersons.find((item) => Number(item.employeeId || item.id) === Number(employeeId));
    return person?.name || `Employee #${employeeId}`;
  };

  const columns: ColumnDef<ServiceSchedule>[] = [
    {
      key: "scheduleNo",
      label: "Schedule",
      sortable: true,
      render: (schedule) => (
        <div>
          <div className="font-medium text-cyan-700">{schedule.scheduleNo || `Schedule #${schedule.id}`}</div>
          <div className="text-xs text-slate-500">Service Order: {schedule.serviceOrderId}</div>
        </div>
      ),
    },
    { key: "customerId", label: "Customer", sortable: true,},
    {
      key: "assignedEmployeeId",
      label: "Employee",
      sortable: true,
      render: (schedule) => getEmployeeDisplayName(schedule.assignedEmployeeId),
    },
    {
      key: "scheduledDate",
      label: "Date",
      sortable: true,
      render: (schedule) => schedule.scheduledDate || "--",
    },
    {
      key: "startTime",
      label: "Time",
      sortable: false,
      render: (schedule) => <div className="-ml-4 md:ml-2">
        {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)},
        </div>
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (schedule) => (
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {schedule.status || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (schedule) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openFromSchedule(schedule)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Copy to create"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusScheduleId(String(schedule.id));
              setNextStatus(schedule.status || "PENDING");
            }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-green-50 hover:text-green-600"
            title="Set status"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteSchedule(schedule)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Service Schedules" description="Manage service schedules" />
      <PageBreadcrumb pageTitle="Service Schedules" />

      <div className="w-full max-w-none px-0 py-8 ">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Service Schedule" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Schedules" value={stats.total} icon={<CalendarDaysIcon />} />
          <StatsCard label="Pending" value={stats.pending} icon={<ClockIcon />} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label="In Progress" value={stats.inProgress} icon={<UserIcon />} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label="Completed" value={stats.completed} icon={<CheckCircleIcon />} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between md:-mb-4">
          <div className="relative w-full sm:max-w-md md:mt-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search service schedules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ListingPdfExportButton
              title="Service Schedules"
              subtitle="Filtered service schedule listing"
              reportLabel="Sales Report"
              data={filteredSchedules}
              fileName="Service_Schedules"
              disabled={loading}
              metadata={(rows, rangeLabel) => [
                { label: "Total", value: rows.length },
                { label: "Range", value: rangeLabel },
                { label: "Status", value: nextStatus || "All" },
                { label: "Search", value: search || "None" },
              ]}
            />
            <FilterPopover title="Filter Schedules" buttonLabel="Filters" widthClassName="w-[20rem] sm:w-[22rem]" showFooter={false}>
            <div className="space-y-3">
              <FloatingSelect
                label="Employee"
                value={employeeLookupId}
                onChange={(e) => setEmployeeLookupId(e.target.value)}
                emptyOptionLabel=""
                options={employeeOptions}
              />
              <div className="grid grid-cols-2 gap-2">
                <FloatingInput
                  label="Status Schedule ID"
                  type="number"
                  value={statusScheduleId}
                  onChange={(e) => setStatusScheduleId(e.target.value)}
                />
                <FloatingSelect
                  label="Status"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  includeEmptyOption={false}
                  options={statusOptions.map((status) => ({ id: status, name: status }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeLookupId("");
                    setStatusScheduleId("");
                    setNextStatus("PENDING");
                    void fetchSchedules();
                  }}
                  className="h-10 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={fetchByEmployee}
                  className="h-10 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={updateStatus}
                  className="h-10 rounded-lg bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-700"
                >
                  Update
                </button>
              </div>
            </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredSchedules}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="scheduledDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDaysIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No service schedules found</p>
              <button type="button" onClick={openCreate} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                Create your first service schedule
              </button>
            </div>
          }
        />
      </div>

      {showFormModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Create Service Schedule</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Enter schedule details from the API schema</p>
                </div>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <FloatingInput label="Service Order ID" name="serviceOrderId" type="number" value={form.serviceOrderId} onChange={handleChange} required />
                  <FloatingInput label="Customer ID" name="customerId" type="number" value={form.customerId} onChange={handleChange} required />
                  <FloatingSelect
                    label="Assigned Employee"
                    name="assignedEmployeeId"
                    value={form.assignedEmployeeId}
                    onChange={handleChange}
                    emptyOptionLabel="Select employee"
                    options={employeeOptions}
                    required
                  />
                  <FloatingDatePicker label="Scheduled Date" name="scheduledDate" value={form.scheduledDate} onChange={handleChange} required />
                  <FloatingInput label="Start Time" name="startTime" type="time" value={form.startTime} onChange={handleChange} required />
                  <FloatingInput label="End Time" name="endTime" type="time" value={form.endTime} onChange={handleChange} required />
                </div>
                <FloatingTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={3} />

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button type="button" onClick={closeForm} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : "Create Service Schedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      <DynamicPopup
        isPopupOpen={!!deleteSchedule}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteSchedule(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Service Schedule"
        subText={deleteSchedule ? `Are you sure you want to delete schedule #${deleteSchedule.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteSchedule(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default ServiceSchedules;

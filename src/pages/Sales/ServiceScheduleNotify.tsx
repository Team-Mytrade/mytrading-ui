import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlayIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";

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

type ScheduleForm = {
  serviceOrderId: string;
  customerId: string;
  assignedEmployeeId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  remarks: string;
};

type UserOption = {
  id?: string | number;
  userId: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  employeeId?: number | null;
  employeeCode?: string | null;
  role?: string | null;
  userType?: string | null;
  tenantId?: string | null;
  active?: boolean;
};

const API_URL = "/v1/api/sales/service-schedule-notify";
const PAGE_SIZE = 10;

const emptyForm: ScheduleForm = {
  serviceOrderId: "",
  customerId: "",
  assignedEmployeeId: "",
  scheduledDate: "",
  startTime: "",
  endTime: "",
  remarks: "",
};

function formatTime(time?: LocalTime | string) {
  if (!time) return "--";
  if (typeof time === "string") return time.slice(0, 5);
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function formatRequestTime(value: string) {
  if (!value) return "00:00:00";
  const [hour = "00", minute = "00"] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.response?.data || fallback;
  }
  return fallback;
}

function getEmployeeName(user: UserOption) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || user.userId;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function openNativeTimePicker(event: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  if (typeof input.showPicker === "function") {
    input.showPicker();
  }
}

const ServiceScheduleNotify: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleId, setScheduleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get<UserOption[]>("/v1/api/user/getAll", { headers });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load employees", getErrorMessage(error, "Please try again."));
    }
  };

  const updateSchedule = (schedule: ServiceSchedule) => {
    setSchedules((current) => {
      const exists = current.some((item) => item.id === schedule.id);
      if (exists) {
        return current.map((item) => (item.id === schedule.id ? schedule : item));
      }
      return [schedule, ...current];
    });
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.serviceOrderId || !form.customerId || !form.scheduledDate) {
      ToasterService.error("Required fields missing", "Service order, customer, and scheduled date are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        serviceOrderId: Number(form.serviceOrderId),
        customerId: Number(form.customerId),
        assignedEmployeeId: Number(form.assignedEmployeeId || 0),
        scheduledDate: form.scheduledDate,
        startTime: formatRequestTime(form.startTime),
        endTime: formatRequestTime(form.endTime),
        remarks: form.remarks,
      };

      const res = await axios.post<ServiceSchedule>(API_URL, payload, { headers });
      updateSchedule(res.data);
      ToasterService.success("Schedule notification created successfully");
      closeCreateModal();
    } catch (error) {
      ToasterService.error("Failed to create schedule", getErrorMessage(error, "Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const runScheduleAction = async (
    action: "start" | "complete",
    id = Number(scheduleId)
  ) => {
    if (!id) {
      ToasterService.error("Schedule ID is required");
      return;
    }

    try {
      const res = await axios.put<ServiceSchedule>(`${API_URL}/${id}/${action}`, {}, { headers });
      updateSchedule(res.data);
      setScheduleId("");
      ToasterService.success(`Schedule ${action === "start" ? "started" : "completed"} successfully`);
    } catch (error) {
      ToasterService.error(`Failed to ${action} schedule`, getErrorMessage(error, "Please try again."));
    }
  };

  const assignEmployee = async (id = Number(scheduleId), employee = Number(employeeId)) => {
    if (!id || !employee) {
      ToasterService.error("Schedule ID and Employee ID are required");
      return;
    }

    try {
      const res = await axios.put<ServiceSchedule>(
        `${API_URL}/${id}/assign/${employee}`,
        {},
        { headers }
      );
      updateSchedule(res.data);
      setScheduleId("");
      setEmployeeId("");
      ToasterService.success("Employee assigned successfully");
    } catch (error) {
      ToasterService.error("Failed to assign employee", getErrorMessage(error, "Please try again."));
    }
  };

  const deleteSchedule = async (id = Number(scheduleId)) => {
    if (!id) {
      ToasterService.error("Schedule ID is required");
      return;
    }

    try {
      await axios.delete(`${API_URL}/${id}`, { headers });
      setSchedules((current) => current.filter((item) => item.id !== id));
      setScheduleId("");
      ToasterService.success("Schedule deleted successfully");
    } catch (error) {
      ToasterService.error("Failed to delete schedule", getErrorMessage(error, "Please try again."));
    }
  };

  const employeeOptions = users
    .filter((user) => user.employeeId !== undefined && user.employeeId !== null)
    .map((user) => ({
      id: String(user.employeeId),
      name: getEmployeeName(user),
    }));

  const filteredUsers = useMemo(() => {
    const term = searchableText(search);
    if (!term) return users;

    return users.filter((user) => {
      const haystack = [
        user.userId,
        user.username,
        user.email,
        user.firstName,
        user.lastName,
        getEmployeeName(user),
        user.employeeId,
        user.employeeCode,
        user.role,
        user.userType,
        user.tenantId,
        user.active ? "active true" : "inactive false",
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [users, search]);

  const stats = useMemo(
    () => ({
      users: users.length,
      employees: users.filter((item) => item.employeeId !== undefined && item.employeeId !== null).length,
      active: users.filter((item) => item.active).length,
    }),
    [users]
  );

  const userColumns: ColumnDef<UserOption>[] = [
    {
      key: "username",
      label: "User",
      sortable: true,
      render: (user) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{getEmployeeName(user)}</div>
          <div className="text-xs text-slate-500">{user.userId || "--"}</div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (user) =>
         <div className="max-w-[150px] truncate" title={user.email || ""}>
      <span className="text-sm text-slate-700">{user.email || "--"}</span>
    </div>
    },
    {
      key: "employeeId",
      label: "Employee",
      sortable: true,
      render: (user) => (
        <div className="">
          <div className="text-sm font-medium text-slate-700">{user.employeeId ?? "--"}</div>
          <div className="text-xs text-slate-500">{user.employeeCode || "--"}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (user) =>
        <div className="max-w-[150px] truncate" title={user.role || ""}>
         <span className="text-sm text-slate-700">{user.role || user.userType || "--"}</span>,
    </div>

    },
    {
      key: "tenantId",
      label: "Tenant",
      sortable: true,
      render: (user) => <span className="text-sm text-slate-700">{user.tenantId || "--"}</span>,
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (user) => (
        <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {user.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Service Schedule Notify" description="Manage service schedule notifications" />
      <PageBreadcrumb pageTitle="Service Schedule Notify" />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => setShowCreateModal(true)} label="Create Schedule" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Users" value={stats.users} icon={<CalendarDaysIcon />} />
          <StatsCard
            label="Employees"
            value={stats.employees}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<ClockIcon />}
          />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<CheckCircleIcon />}
          />
        </div>

        <div className=" flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:-my-5 ">
          <div className="relative w-full sm:max-w-md md:-mt-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
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

          <div className="flex items-center gap-2 mt-6">
            <ListingPdfExportButton
  title="Service Schedule Notify"
  subtitle="Filtered user notification listing"
  reportLabel="Sales Report"
  data={filteredUsers}
  columns={[
    {
      key: "username",
      header: "User",
      accessor: (user) => getEmployeeName(user),
    },
    { key: "userId", header: "User ID" },
    { key: "email", header: "Email" },
    { key: "employeeId", header: "Employee ID" },
    { key: "employeeCode", header: "Employee Code" },
    {
      key: "role",
      header: "Role",
      accessor: (user) => user.role || user.userType || "-",
    },
    { key: "tenantId", header: "Tenant" },
    {
      key: "active",
      header: "Status",
      accessor: (user) => (user.active ? "Active" : "Inactive"),
    },
  ]}
  fileName="Service_Schedule_Notify"
  metadata={(rows, rangeLabel) => [
    { label: "Total", value: rows.length },
    { label: "Range", value: rangeLabel },
    { label: "Search", value: search || "None" },
  ]}
/>
            <FilterPopover
              title="Schedule Actions"
              buttonLabel="Filters"
              widthClassName="w-[20rem] sm:w-[22rem]"
              showFooter={false}
            >
            <div className="space-y-3">
              <FloatingInput
                label="Schedule ID"
                name="scheduleId"
                type="number"
                value={scheduleId}
                onChange={(e) => setScheduleId(e.target.value)}
              />
              <FloatingSelect
                label="Employee"
                name="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                emptyOptionLabel=""
                options={employeeOptions}
              />
              <div className="grid grid-cols-5 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setScheduleId("");
                    setEmployeeId("");
                  }}
                  className="h-10 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => runScheduleAction("start")}
                  className="h-10 rounded-lg bg-green-600 px-3 text-sm font-medium text-white transition hover:bg-green-700"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => runScheduleAction("complete")}
                  className="h-10 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => assignEmployee()}
                  className="h-10 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white transition hover:bg-cyan-700"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => deleteSchedule()}
                  className="flex h-10 items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition hover:bg-red-700"
                  title="Delete schedule"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredUsers}
          columns={userColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="username"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDaysIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No users found</p>
              <button
                type="button"
                onClick={() => fetchUsers()}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Reload users
              </button>
            </div>
          }
        />
      </div>

      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Create Schedule Notification</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Add service schedule details and notify the assigned employee</p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="text-gray-400 transition hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <FloatingInput
                    label="Service Order ID"
                    name="serviceOrderId"
                    type="number"
                    value={form.serviceOrderId}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    label="Customer ID"
                    name="customerId"
                    type="number"
                    value={form.customerId}
                    onChange={handleChange}
                    required
                  />
                  <FloatingSelect
                    label="Assigned Employee"
                    name="assignedEmployeeId"
                    value={form.assignedEmployeeId}
                    onChange={handleChange}
                    emptyOptionLabel=""
                    options={employeeOptions}
                  />
                  <FloatingDatePicker
                    label="Scheduled Date"
                    name="scheduledDate"
                    value={form.scheduledDate}
                    onChange={handleChange}
                    required
                  />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      type="time"
                      name="startTime"
                      value={form.startTime}
                      onChange={handleChange}
                      onFocus={openNativeTimePicker}
                      onClick={openNativeTimePicker}
                      className="h-[52px] w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      type="time"
                      name="endTime"
                      value={form.endTime}
                      onChange={handleChange}
                      onFocus={openNativeTimePicker}
                      onClick={openNativeTimePicker}
                      className="h-[52px] w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>

                <FloatingTextarea
                  label="Remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={3}
                />

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {isSubmitting ? "Creating..." : "Create Schedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ServiceScheduleNotify;

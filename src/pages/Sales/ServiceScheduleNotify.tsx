import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  BellIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlayIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
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

type Notification = {
  id: number;
  serviceScheduleId: number;
  recipientUserId: number;
  title: string;
  message: string;
  isRead: boolean;
  sentAt: string;
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
  userId: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  employeeId?: number | null;
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

function getStoredNotificationUserId() {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const candidate = storedUser?.id ?? storedUser?.userId;
    return candidate != null && /^\d+$/.test(String(candidate)) ? String(candidate) : "";
  } catch {
    return "";
  }
}

const ServiceScheduleNotify: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [userId, setUserId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  useEffect(() => {
    fetchUsers();
    const storedUserId = getStoredNotificationUserId();
    if (!storedUserId) return;

    setUserId(storedUserId);
    fetchNotifications(storedUserId, { silent: true });
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

  const employeeOptions = users
    .filter((user) => user.employeeId !== undefined && user.employeeId !== null)
    .map((user) => ({
      id: String(user.employeeId),
      name: getEmployeeName(user),
    }));

  const fetchNotifications = async (
    targetUserId = userId,
    options: { silent?: boolean } = {}
  ) => {
    if (!targetUserId) {
      ToasterService.error("User ID is required");
      return;
    }

    try {
      setIsLoadingNotifications(true);
      const res = await axios.get<Notification[]>(`${API_URL}/notifications/${targetUserId}`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setNotifications(data);
      if (options.silent) return;
      if (data.length === 0) {
        ToasterService.noData("No notifications found");
      } else {
        ToasterService.success("Notifications loaded successfully");
      }
    } catch (error) {
      ToasterService.error("Failed to load notifications", getErrorMessage(error, "Please try again."));
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const filteredSchedules = useMemo(() => {
    const term = search.toLowerCase();
    return schedules.filter((schedule) =>
      [
        schedule.scheduleNo,
        schedule.status,
        schedule.remarks,
        String(schedule.id),
        String(schedule.serviceOrderId),
        String(schedule.customerId),
        String(schedule.assignedEmployeeId),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [schedules, search]);

  const stats = useMemo(
    () => ({
      schedules: schedules.length,
      active: schedules.filter((item) => item.status?.toUpperCase().includes("PROGRESS")).length,
      completed: schedules.filter((item) => item.status?.toUpperCase().includes("COMPLETED")).length,
      notifications: notifications.length,
    }),
    [schedules, notifications]
  );

  const scheduleColumns: ColumnDef<ServiceSchedule>[] = [
    {
      key: "scheduleNo",
      label: "Schedule",
      sortable: true,
      render: (schedule) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{schedule.scheduleNo || `#${schedule.id}`}</div>
          <div className="text-xs text-slate-500">ID: {schedule.id}</div>
        </div>
      ),
    },
    { key: "serviceOrderId", label: "Service Order", sortable: true },
    { key: "customerId", label: "Customer", sortable: true },
    { key: "assignedEmployeeId", label: "Employee", sortable: true },
    {
      key: "scheduledDate",
      label: "Date",
      sortable: true,
      render: (schedule) => (
        <span className="text-sm font-medium text-slate-700">{schedule.scheduledDate || "--"}</span>
      ),
    },
    {
      key: "startTime",
      label: "Time",
      sortable: false,
      render: (schedule) => (
        <span className="text-sm text-slate-700">
          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (schedule) => (
        <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
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
            onClick={() => runScheduleAction("start", schedule.id)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-green-50 hover:text-green-600"
            title="Start"
          >
            <PlayIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => runScheduleAction("complete", schedule.id)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="Complete"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setScheduleId(String(schedule.id));
              if (schedule.assignedEmployeeId) {
                setEmployeeId(String(schedule.assignedEmployeeId));
              }
            }}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-purple-50 hover:text-purple-600"
            title="Use in action panel"
          >
            <UserPlusIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const notificationColumns: ColumnDef<Notification>[] = [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (notification) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{notification.title || "Notification"}</div>
          <div className="text-xs text-slate-500">Schedule ID: {notification.serviceScheduleId}</div>
        </div>
      ),
    },
    {
      key: "message",
      label: "Message",
      sortable: true,
      render: (notification) => (
        <span className="line-clamp-2 text-sm text-slate-600">{notification.message || "--"}</span>
      ),
    },
    { key: "recipientUserId", label: "Recipient", sortable: true },
    {
      key: "isRead",
      label: "Read",
      sortable: true,
      render: (notification) => (notification.isRead ? "Yes" : "No"),
    },
    {
      key: "sentAt",
      label: "Sent At",
      sortable: true,
      render: (notification) =>
        notification.sentAt ? new Date(notification.sentAt).toLocaleString() : "--",
    },
  ];

  return (
    <>
      <PageMeta title="Service Schedule Notify" description="Manage service schedule notifications" />
      <PageBreadcrumb pageTitle="Service Schedule Notify" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => setShowCreateModal(true)} label="Create Schedule" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Schedules" value={stats.schedules} icon={<CalendarDaysIcon />} />
          <StatsCard
            label="In Progress"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<ClockIcon />}
          />
          <StatsCard
            label="Completed"
            value={stats.completed}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Notifications"
            value={stats.notifications}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<BellIcon />}
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Schedule Actions</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
              emptyOptionLabel="Select employee"
              options={employeeOptions}
            />
            <button
              type="button"
              onClick={() => runScheduleAction("start")}
              className="h-[52px] rounded-lg bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-700"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => runScheduleAction("complete")}
              className="h-[52px] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={() => assignEmployee()}
              className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition hover:bg-cyan-700"
            >
              Assign
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search schedules..."
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
        </div>

        <ReusableTable
          data={filteredSchedules}
          columns={scheduleColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="scheduledDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDaysIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No schedules loaded yet</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first schedule notification
              </button>
            </div>
          }
        />

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Notifications</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <FloatingInput
              label="User ID"
              name="userId"
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <button
              type="button"
              onClick={() => fetchNotifications()}
              className="h-[52px] rounded-lg bg-cyan-600 px-5 text-sm font-medium text-white transition hover:bg-cyan-700"
            >
              Load Notifications
            </button>
          </div>

          <ReusableTable
            data={notifications}
            columns={notificationColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="sentAt"
            defaultSortOrder="desc"
            loading={isLoadingNotifications}
          />
        </div>
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
                    emptyOptionLabel="Select employee"
                    options={employeeOptions}
                  />
                  <FloatingDatePicker
                    label="Scheduled Date"
                    name="scheduledDate"
                    value={form.scheduledDate}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    label="Start Time"
                    name="startTime"
                    type="time"
                    value={form.startTime}
                    onChange={handleChange}
                  />
                  <FloatingInput
                    label="End Time"
                    name="endTime"
                    type="time"
                    value={form.endTime}
                    onChange={handleChange}
                  />
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

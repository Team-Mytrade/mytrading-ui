import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlayIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
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
  const [actionUpdatingId, setActionUpdatingId] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<ServiceSchedule | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<ServiceSchedule | null>(null);

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

  const runScheduleAction = async (action: "start" | "complete", schedule: ServiceSchedule) => {
    try {
      setActionUpdatingId(schedule.id);
      const res = await axios.put<ServiceSchedule>(`${API_URL}/${schedule.id}/${action}`, {}, { headers });
      updateSchedule(res.data);
      ToasterService.success(`Schedule ${action === "start" ? "started" : "completed"} successfully`);
    } catch (error) {
      ToasterService.error(`Failed to ${action} schedule`, getErrorMessage(error, "Please try again."));
    } finally {
      setActionUpdatingId(null);
    }
  };

  const openAssign = (schedule: ServiceSchedule) => {
    setAssignTarget(schedule);
    setAssignEmployeeId(String(schedule.assignedEmployeeId || ""));
  };

  const closeAssign = () => {
    setAssignTarget(null);
    setAssignEmployeeId("");
  };

  const confirmAssign = async () => {
    if (!assignTarget || !assignEmployeeId) {
      ToasterService.error("Employee is required");
      return;
    }
    try {
      setActionUpdatingId(assignTarget.id);
      const res = await axios.put<ServiceSchedule>(
        `${API_URL}/${assignTarget.id}/assign/${assignEmployeeId}`,
        {},
        { headers }
      );
      updateSchedule(res.data);
      ToasterService.success("Employee assigned successfully");
      closeAssign();
    } catch (error) {
      ToasterService.error("Failed to assign employee", getErrorMessage(error, "Please try again."));
    } finally {
      setActionUpdatingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteScheduleTarget) return;
    try {
      setActionUpdatingId(deleteScheduleTarget.id);
      await axios.delete(`${API_URL}/${deleteScheduleTarget.id}`, { headers });
      setSchedules((current) => current.filter((item) => item.id !== deleteScheduleTarget.id));
      ToasterService.success("Schedule deleted successfully");
    } catch (error) {
      ToasterService.error("Failed to delete schedule", getErrorMessage(error, "Please try again."));
    } finally {
      setActionUpdatingId(null);
      setDeleteScheduleTarget(null);
    }
  };

  const employeeOptions = useMemo(
    () =>
      users
        .filter((user) => user.employeeId !== undefined && user.employeeId !== null)
        .map((user) => ({
          id: String(user.employeeId),
          name: getEmployeeName(user),
        })),
    [users]
  );

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
      render: (user) => (
        <div className="max-w-[150px] truncate" title={user.email || ""}>
          <span className="text-sm text-slate-700">{user.email || "--"}</span>
        </div>
      ),
    },
    {
      key: "employeeId",
      label: "Employee",
      sortable: true,
      render: (user) => (
        <div>
          <div className="text-sm font-medium text-slate-700">{user.employeeId ?? "--"}</div>
          <div className="text-xs text-slate-500">{user.employeeCode || "--"}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (user) => (
        <div className="max-w-[150px] truncate" title={user.role || ""}>
          <span className="text-sm text-slate-700">{user.role || user.userType || "--"}</span>
        </div>
      ),
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

  const scheduleColumns: ColumnDef<ServiceSchedule>[] = [
    {
      key: "scheduleNo",
      label: "Schedule",
      sortable: true,
      render: (schedule) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {schedule.scheduleNo || `Schedule #${schedule.id}`}
          </div>
          <div className="text-xs text-slate-500">Order ID: {schedule.serviceOrderId}</div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      render: (schedule) => <span className="text-sm text-slate-700">#{schedule.customerId}</span>,
    },
    {
      key: "assignedEmployeeId",
      label: "Assigned",
      sortable: true,
      render: (schedule) => {
        const employee = users.find((u) => Number(u.employeeId) === Number(schedule.assignedEmployeeId));
        return (
          <span className="text-sm text-slate-700">
            {employee ? getEmployeeName(employee) : schedule.assignedEmployeeId ? `Employee #${schedule.assignedEmployeeId}` : "--"}
          </span>
        );
      },
    },
    {
      key: "scheduledDate",
      label: "Scheduled",
      sortable: true,
      render: (schedule) => (
        <div>
          <div className="text-sm text-slate-700">{schedule.scheduledDate || "--"}</div>
          <div className="text-xs text-slate-500">
            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
          </div>
        </div>
      ),
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
            onClick={() => void runScheduleAction("start", schedule)}
            disabled={actionUpdatingId === schedule.id}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-green-50 hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Start"
          >
            <PlayIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void runScheduleAction("complete", schedule)}
            disabled={actionUpdatingId === schedule.id}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Complete"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openAssign(schedule)}
            disabled={actionUpdatingId === schedule.id}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Assign employee"
          >
            <UserPlusIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteScheduleTarget(schedule)}
            disabled={actionUpdatingId === schedule.id}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // Show schedules table when we have data; otherwise show users (original fallback behaviour).
  const showingSchedules = schedules.length > 0;
  const tableData = showingSchedules ? schedules : users;
  const tableColumns = (showingSchedules ? scheduleColumns : userColumns) as ColumnDef<any>[];

  return (
    <>
      <PageMeta title="Service Schedule Notify" description="Manage service schedule notifications" />
      <PageBreadcrumb
        pageTitle="Service Schedule Notify"
        actions={<AddButton onClick={() => setShowCreateModal(true)} label="Create Schedule" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <StatsCard
            label="Schedules"
            value={schedules.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<PaperAirplaneIcon />}
          />
        </div>

        <ReusableTable
          data={tableData}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey={showingSchedules ? "scheduledDate" : "username"}
          defaultSortOrder={showingSchedules ? "desc" : "asc"}
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

      <PaginatedPopup
        isOpen={showCreateModal}
        title="Create Schedule Notification"
        subtitle="Add service schedule details and notify the assigned employee"
        onClose={closeCreateModal}
        onSubmit={handleSubmit}
        submitting={isSubmitting}
        submitLabel="Create Schedule"
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Schedule Info",
            fields: [
              <FloatingInput
                key="serviceOrderId"
                label="Service Order ID"
                name="serviceOrderId"
                type="number"
                value={form.serviceOrderId}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="customerId"
                label="Customer ID"
                name="customerId"
                type="number"
                value={form.customerId}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="assignedEmployeeId"
                label="Assigned Employee"
                name="assignedEmployeeId"
                value={form.assignedEmployeeId}
                onChange={handleChange}
                emptyOptionLabel=""
                options={employeeOptions}
              />,
              <FloatingDatePicker
                key="scheduledDate"
                label="Scheduled Date"
                name="scheduledDate"
                value={form.scheduledDate}
                onChange={handleChange}
                required
              />,
            ],
          },
          {
            label: "Timing & Notes",
            fields: [
              <div key="startTime">
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
              </div>,
              <div key="endTime">
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
              </div>,
              <div key="remarks" className="md:col-span-2">
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

      {/* Assign Employee Modal */}
      <PaginatedPopup
        isOpen={!!assignTarget}
        title="Assign Employee"
        subtitle={
          assignTarget
            ? `Assign an employee to schedule ${assignTarget.scheduleNo || `#${assignTarget.id}`}`
            : ""
        }
        onClose={closeAssign}
        onSubmit={(e) => {
          e.preventDefault();
          void confirmAssign();
        }}
        submitting={actionUpdatingId === assignTarget?.id}
        submitLabel="Assign"
        maxWidthClassName="max-w-lg"
        tabs={[
          {
            label: "Assignment",
            fields: [
              <FloatingSelect
                key="assignEmployeeId"
                label="Employee"
                name="assignEmployeeId"
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                emptyOptionLabel=""
                options={employeeOptions}
                required
              />,
            ],
          },
        ]}
      />

      {/* Delete Confirmation */}
      <DynamicPopup
        isPopupOpen={!!deleteScheduleTarget}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteScheduleTarget(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Schedule"
        subText={
          deleteScheduleTarget
            ? `Are you sure you want to delete schedule ${deleteScheduleTarget.scheduleNo || `#${deleteScheduleTarget.id}`}?`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteScheduleTarget(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default ServiceScheduleNotify;
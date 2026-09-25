import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
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

type LocalTime = { hour: number; minute: number; second: number; nano: number };

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

type CustomerOption = { id: number; customerName?: string; tradeName?: string; email?: string };

type ScheduleOrderOption = {
  id?: number;
  salesOrderId?: number;
  orderId?: number;
  orderNumber?: string;
  salesOrderNumber?: string;
  customerId?: number;
  customerName?: string;
};

const API_URL = "/v1/api/sales/service-schedule-notify";
const CUSTOMERS_API = "/v1/api/crm/customers";
const SCHEDULE_ORDERS_API = "/v1/api/sales/sales-orders/schedule/orders";
const PAGE_SIZE = 10;

// 🔧 Route paths — matches your app's actual routes.
const USERS_PAGE_PATH = "/role_config";
const CUSTOMERS_PAGE_PATH = "/customer-management";

const emptyForm: ScheduleForm = {
  serviceOrderId: "",
  customerId: "",
  assignedEmployeeId: "",
  scheduledDate: "",
  startTime: "",
  endTime: "",
  remarks: "",
};

function readInputValue(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input;
  if (typeof input === "number") return String(input);
  if (input instanceof Date) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (Array.isArray(input)) {
    return readInputValue(input[1] ?? input[0]);
  }
  if (typeof input === "object" && "target" in input) {
    const target = (input as { target?: { value?: unknown } }).target;
    return readInputValue(target?.value);
  }
  return "";
}

function formatTime(time?: LocalTime | string) {
  if (!time) return "--";
  if (typeof time === "string") return time.slice(0, 5);
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function toLocalTimeObject(value: string): LocalTime {
  if (!value) return { hour: 0, minute: 0, second: 0, nano: 0 };
  const [hour = "0", minute = "0", second = "0"] = value.split(":");
  return {
    hour: Number(hour) || 0,
    minute: Number(minute) || 0,
    second: Number(second) || 0,
    nano: 0,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.response?.data || fallback;
  }
  return fallback;
}

function getEmployeeName(user: UserOption) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.userId
  );
}

function customerLabel(c: CustomerOption) {
  return c.customerName || c.tradeName || `Customer #${c.id}`;
}

function getScheduleOrderId(o: ScheduleOrderOption) {
  const numeric = Number(o.id ?? o.salesOrderId ?? o.orderId ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function getScheduleOrderLabel(o: ScheduleOrderOption) {
  const id = getScheduleOrderId(o);
  const number = o.orderNumber || o.salesOrderNumber;
  if (number) return number;
  if (o.customerName) return `Order — ${o.customerName}`;
  return `Order #${id}`;
}

function getAssignedEmployeeName(
  assignedEmployeeId: number | string | undefined | null,
  users: UserOption[]
): string {
  if (
    assignedEmployeeId === null ||
    assignedEmployeeId === undefined ||
    Number(assignedEmployeeId) <= 0
  ) {
    return "--";
  }

  const numericId = Number(assignedEmployeeId);

  const match = users.find((user) => {
    const byEmployeeId =
      user.employeeId !== null &&
      user.employeeId !== undefined &&
      Number(user.employeeId) === numericId;
    const byId = user.id !== null && user.id !== undefined && Number(user.id) === numericId;
    const byUserId =
      user.userId !== null && user.userId !== undefined && Number(user.userId) === numericId;
    return byEmployeeId || byId || byUserId;
  });

  if (match) {
    const name = getEmployeeName(match);
    if (name) return name;
  }

  return "Unassigned";
}

function findUserByAssignedId(
  assignedEmployeeId: number | string | undefined | null,
  users: UserOption[]
): UserOption | undefined {
  if (
    assignedEmployeeId === null ||
    assignedEmployeeId === undefined ||
    Number(assignedEmployeeId) <= 0
  ) {
    return undefined;
  }
  const numericId = Number(assignedEmployeeId);
  return users.find((user) => {
    const byEmployeeId =
      user.employeeId !== null &&
      user.employeeId !== undefined &&
      Number(user.employeeId) === numericId;
    const byId = user.id !== null && user.id !== undefined && Number(user.id) === numericId;
    const byUserId =
      user.userId !== null && user.userId !== undefined && Number(user.userId) === numericId;
    return byEmployeeId || byId || byUserId;
  });
}

function resolveScheduleOrderLabel(
  serviceOrderId: number | string | undefined | null,
  orders: ScheduleOrderOption[]
): string {
  if (serviceOrderId === null || serviceOrderId === undefined) return "--";
  const numeric = Number(serviceOrderId);
  if (!Number.isFinite(numeric) || numeric <= 0) return "--";
  const match = orders.find((o) => getScheduleOrderId(o) === numeric);
  if (match) return getScheduleOrderLabel(match);
  return "--";
}

function openNativeTimePicker(
  event: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>
) {
  const input = event.currentTarget;
  if (typeof input.showPicker === "function") {
    input.showPicker();
  }
}

const ServiceScheduleNotify: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = useMemo(
    () =>
      token
        ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
        : undefined,
    [token]
  );

  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [scheduleOrders, setScheduleOrders] = useState<ScheduleOrderOption[]>([]);

  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionUpdatingId, setActionUpdatingId] = useState<number | null>(null);

  const [editTarget, setEditTarget] = useState<ServiceSchedule | null>(null);
  const [editAssignedEmployeeId, setEditAssignedEmployeeId] = useState("");

  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<ServiceSchedule | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCustomers();
    fetchScheduleOrders();
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

  const fetchCustomers = async () => {
    try {
      const res = await axios.get<CustomerOption[] | { data?: CustomerOption[] }>(
        CUSTOMERS_API,
        { headers }
      );
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setCustomers(list);
    } catch (error) {
      ToasterService.error("Failed to load customers", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchScheduleOrders = async () => {
    try {
      const res = await axios.get<
        ScheduleOrderOption[] | { data?: ScheduleOrderOption[] }
      >(SCHEDULE_ORDERS_API, { headers });
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setScheduleOrders(list);
    } catch (error) {
      ToasterService.error(
        "Failed to load sales order numbers",
        getErrorMessage(error, "Please try again.")
      );
    }
  };

  const updateSchedule = (schedule: ServiceSchedule) => {
    setSchedules((current) => {
      const exists = current.some((item) => item.id === schedule.id);
      if (exists) return current.map((item) => (item.id === schedule.id ? schedule : item));
      return [schedule, ...current];
    });
  };

  const setField = <K extends keyof ScheduleForm>(name: K, value: ScheduleForm[K]) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSimpleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleServiceOrderChange = (input: unknown) => {
    const value = readInputValue(input);
    setForm((current) => {
      const next = { ...current, serviceOrderId: value };
      const picked = scheduleOrders.find((o) => String(getScheduleOrderId(o)) === value);
      if (picked?.customerId) {
        next.customerId = String(picked.customerId);
      }
      return next;
    });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.serviceOrderId || !form.customerId || !form.scheduledDate) {
      ToasterService.error(
        "Required fields missing",
        "Sales order, customer, and scheduled date are required."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        serviceOrderId: Number(form.serviceOrderId),
        customerId: Number(form.customerId),
        assignedEmployeeId: Number(form.assignedEmployeeId || 0),
        scheduledDate: form.scheduledDate,
        startTime: toLocalTimeObject(form.startTime),
        endTime: toLocalTimeObject(form.endTime),
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

  const openEdit = (schedule: ServiceSchedule) => {
    setEditTarget(schedule);
    setEditAssignedEmployeeId(String(schedule.assignedEmployeeId || ""));
  };

  const closeEdit = () => {
    if (actionUpdatingId !== null) return;
    setEditTarget(null);
    setEditAssignedEmployeeId("");
  };

  const runScheduleAction = async (action: "start" | "complete") => {
    if (!editTarget) return;
    try {
      setActionUpdatingId(editTarget.id);
      const res = await axios.put<ServiceSchedule>(
        `${API_URL}/${editTarget.id}/${action}`,
        {},
        { headers }
      );
      updateSchedule(res.data);
      setEditTarget(res.data);
      ToasterService.success(
        `Schedule ${action === "start" ? "started" : "completed"} successfully`
      );
    } catch (error) {
      ToasterService.error(
        `Failed to ${action} schedule`,
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setActionUpdatingId(null);
    }
  };

  const confirmAssign = async () => {
    if (!editTarget || !editAssignedEmployeeId) {
      ToasterService.error("Employee is required");
      return;
    }
    try {
      setActionUpdatingId(editTarget.id);
      const res = await axios.put<ServiceSchedule>(
        `${API_URL}/${editTarget.id}/assign/${editAssignedEmployeeId}`,
        {},
        { headers }
      );
      updateSchedule(res.data);
      setEditTarget(res.data);
      ToasterService.success("Employee assigned successfully");
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

  // ── Click-to-redirect handlers ─────────────────────────────────────
  const goToUser = (user: UserOption) => {
    if (!USERS_PAGE_PATH) return;
    const name = getEmployeeName(user);
    const userId = user.userId || user.id || "";
    navigate(
      `${USERS_PAGE_PATH}?tab=users&userId=${encodeURIComponent(
        String(userId)
      )}&userName=${encodeURIComponent(name)}`
    );
  };

  const goToCustomerById = (customerId: number | string | undefined | null) => {
    if (!CUSTOMERS_PAGE_PATH) return;
    if (customerId === null || customerId === undefined) return;
    const numeric = Number(customerId);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const customer = customers.find((c) => Number(c.id) === numeric);
    const name = customer ? customerLabel(customer) : `Customer #${numeric}`;
    navigate(
      `${CUSTOMERS_PAGE_PATH}?customerIds=${numeric}&customerName=${encodeURIComponent(name)}`
    );
  };

  const goToAssignedEmployee = (assignedEmployeeId: number | string | undefined | null) => {
    if (!USERS_PAGE_PATH) return;
    const user = findUserByAssignedId(assignedEmployeeId, users);
    if (user) {
      goToUser(user);
      return;
    }
    if (assignedEmployeeId === null || assignedEmployeeId === undefined) return;
    const numeric = Number(assignedEmployeeId);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    navigate(`${USERS_PAGE_PATH}?employeeId=${numeric}`);
  };

  const employeeOptions = useMemo(
    () =>
      users
        .filter(
          (user) =>
            user.employeeId !== undefined &&
            user.employeeId !== null &&
            Number(user.employeeId) > 0
        )
        .map((user) => ({
          id: String(user.employeeId),
          name: getEmployeeName(user),
        })),
    [users]
  );

  const customerOptions = useMemo(
    () =>
      customers
        .filter((c) => Number(c.id) > 0)
        .map((c) => ({ id: String(c.id), name: customerLabel(c) })),
    [customers]
  );

  const serviceOrderOptions = useMemo(
    () =>
      scheduleOrders
        .map((o) => ({
          id: String(getScheduleOrderId(o)),
          name: getScheduleOrderLabel(o),
        }))
        .filter((o) => Number(o.id) > 0),
    [scheduleOrders]
  );

  const stats = useMemo(
    () => ({
      users: users.length,
      employees: users.filter(
        (item) =>
          item.employeeId !== undefined &&
          item.employeeId !== null &&
          Number(item.employeeId) > 0
      ).length,
      active: users.filter((item) => item.active).length,
      schedules: schedules.length,
    }),
    [users, schedules]
  );

  // ── User columns ────────────────────────────────────────────────────
  const userColumns: ColumnDef<UserOption>[] = [
    {
      key: "username",
      label: "User",
      sortable: true,
      sortValueGetter: (user) => getEmployeeName(user),
      render: (user) => {
        const name = getEmployeeName(user);
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToUser(user);
            }}
            className="max-w-[220px] truncate text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        );
      },
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      sortValueGetter: (user) => user.email || "",
      render: (user) => (
        <div className="max-w-[220px] truncate" title={user.email || ""}>
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {user.email || "--"}
          </span>
        </div>
      ),
    },
    {
      key: "employeeCode",
      label: "Employee",
      sortable: true,
      sortValueGetter: (user) => user.employeeCode || "",
      render: (user) => {
        const hasEmployee =
          user.employeeId !== null &&
          user.employeeId !== undefined &&
          Number(user.employeeId) > 0;
        if (!hasEmployee) {
          return (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium italic text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Not linked
            </span>
          );
        }
        return (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {user.employeeCode || "--"}
          </span>
        );
      },
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      sortValueGetter: (user) => user.role || user.userType || "",
      render: (user) => (
        <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          {user.role || user.userType || "--"}
        </span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      sortValueGetter: (user) => (user.active ? "Active" : "Inactive"),
      render: (user) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            user.active
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {user.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  // ── Schedule columns ────────────────────────────────────────────────
  const scheduleColumns: ColumnDef<ServiceSchedule>[] = [
    {
      key: "scheduleNo",
      label: "Schedule",
      sortable: true,
      render: (schedule) => (
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {schedule.scheduleNo || `Schedule #${schedule.id}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {resolveScheduleOrderLabel(schedule.serviceOrderId, scheduleOrders)}
          </div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      sortValueGetter: (schedule) => {
        const c = customers.find((x) => Number(x.id) === Number(schedule.customerId));
        return c ? customerLabel(c) : "";
      },
      render: (schedule) => {
        const customer = customers.find((c) => Number(c.id) === Number(schedule.customerId));
        const name = customer ? customerLabel(customer) : "Unknown customer";
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToCustomerById(schedule.customerId);
            }}
            className="max-w-[220px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        );
      },
    },
    {
      key: "assignedEmployeeId",
      label: "Assigned",
      sortable: true,
      sortValueGetter: (schedule) =>
        getAssignedEmployeeName(schedule.assignedEmployeeId, users),
      render: (schedule) => {
        const name = getAssignedEmployeeName(schedule.assignedEmployeeId, users);
        const hasAssignee =
          schedule.assignedEmployeeId !== null &&
          schedule.assignedEmployeeId !== undefined &&
          Number(schedule.assignedEmployeeId) > 0;
        if (!hasAssignee) {
          return <span className="text-sm text-slate-500 dark:text-slate-400">{name}</span>;
        }
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToAssignedEmployee(schedule.assignedEmployeeId);
            }}
            className="max-w-[180px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        );
      },
    },
    {
      key: "scheduledDate",
      label: "Scheduled",
      sortable: true,
      render: (schedule) => (
        <div>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {schedule.scheduledDate || "--"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
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
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
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
            onClick={() => openEdit(schedule)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit / Actions"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteScheduleTarget(schedule)}
            disabled={actionUpdatingId === schedule.id}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const showingSchedules = schedules.length > 0;
  const tableData = showingSchedules ? schedules : users;
  const tableColumns = (showingSchedules ? scheduleColumns : userColumns) as ColumnDef<any>[];

  return (
    <>
      <PageMeta title="Service Schedule Notify" description="Manage service schedule notifications" />
      <PageBreadcrumb
        pageTitle="Service Schedule Notify"
        actions={
          <AddButton onClick={() => setShowCreateModal(true)} label="Add Notify" />
        }
      />

      <div className="w-full max-w-none space-y-6 bg-slate-50 px-0 py-8 dark:bg-slate-950">
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
            value={stats.schedules}
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
              <CalendarDaysIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">No users found</p>
              <button
                type="button"
                onClick={() => fetchUsers()}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Reload users
              </button>
            </div>
          }
        />
      </div>

      {/* ── Create Notification ─────────────────────────────────── */}
      <PaginatedPopup
        isOpen={showCreateModal}
        title="Add Notify"
        subtitle="Add service schedule details and notify the assigned employee"
        onClose={closeCreateModal}
        onSubmit={handleSubmit}
        submitting={isSubmitting}
        submitLabel="Create Notification"
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Schedule Info",
            fields: [
              <FloatingSelect
                key="serviceOrderId"
                label="Sales Order"
                name="serviceOrderId"
                value={form.serviceOrderId}
                onChange={handleServiceOrderChange}
                emptyOptionLabel=""
                options={serviceOrderOptions}
                required
              />,
              <FloatingSelect
                key="customerId"
                label="Customer"
                name="customerId"
                value={form.customerId}
                onChange={(v: any) => setField("customerId", readInputValue(v))}
                emptyOptionLabel=""
                options={customerOptions}
                required
              />,
              <FloatingSelect
                key="assignedEmployeeId"
                label="Assigned Employee"
                name="assignedEmployeeId"
                value={form.assignedEmployeeId}
                onChange={(v: any) => setField("assignedEmployeeId", readInputValue(v))}
                emptyOptionLabel=""
                options={employeeOptions}
              />,
              <FloatingDatePicker
                key="scheduledDate"
                label="Scheduled Date"
                name="scheduledDate"
                value={form.scheduledDate}
                onChange={(v: any) => setField("scheduledDate", readInputValue(v))}
                required
              />,
            ],
          },
          {
            label: "Timing & Notes",
            fields: [
              <div key="startTime">
                <label
                  htmlFor="startTime"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                  Start Time
                </label>
                <input
                  id="startTime"
                  type="time"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleSimpleInputChange}
                  onFocus={openNativeTimePicker}
                  onClick={openNativeTimePicker}
                  className="h-[52px] w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-900/40"
                />
              </div>,
              <div key="endTime">
                <label
                  htmlFor="endTime"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300"
                >
                  End Time
                </label>
                <input
                  id="endTime"
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleSimpleInputChange}
                  onFocus={openNativeTimePicker}
                  onClick={openNativeTimePicker}
                  className="h-[52px] w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-900/40"
                />
              </div>,
              <div key="remarks" className="md:col-span-2">
                <FloatingTextarea
                  label="Remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleSimpleInputChange}
                  rows={3}
                />
              </div>,
            ],
          },
        ]}
      />

      {/* ── Edit Schedule ───────────────────────────────────────────── */}
      <PaginatedPopup
        isOpen={!!editTarget}
        title="Edit Schedule"
        subtitle={
          editTarget
            ? `${editTarget.scheduleNo || `Schedule #${editTarget.id}`} · Status: ${
                editTarget.status || "N/A"
              }`
            : ""
        }
        onClose={closeEdit}
        onSubmit={(e) => {
          e.preventDefault();
          closeEdit();
        }}
        submitting={false}
        submitLabel="Close"
        maxWidthClassName="max-w-3xl"
        tabs={[
          {
            label: "Schedule Details",
            fields: [
              <div key="detailsGrid" className="md:col-span-2 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Schedule No
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {editTarget?.scheduleNo || "--"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Status
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {editTarget?.status || "N/A"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Sales Order
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {resolveScheduleOrderLabel(editTarget?.serviceOrderId, scheduleOrders)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Customer
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {(() => {
                      const c = customers.find(
                        (x) => Number(x.id) === Number(editTarget?.customerId)
                      );
                      return c ? customerLabel(c) : "Unknown customer";
                    })()}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Scheduled
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {editTarget?.scheduledDate || "--"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Time
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatTime(editTarget?.startTime)} - {formatTime(editTarget?.endTime)}
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    Assigned Employee
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {getAssignedEmployeeName(editTarget?.assignedEmployeeId, users)}
                  </div>
                </div>
              </div>,

              <div
                key="actionButtons"
                className="md:col-span-2 flex flex-wrap gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <button
                  type="button"
                  onClick={() => void runScheduleAction("start")}
                  disabled={actionUpdatingId === editTarget?.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  <PlayIcon className="h-4 w-4" />
                  Start Schedule
                </button>
                <button
                  type="button"
                  onClick={() => void runScheduleAction("complete")}
                  disabled={actionUpdatingId === editTarget?.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Complete Schedule
                </button>
              </div>,

              <div
                key="assignBlock"
                className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-center gap-2">
                  <UserPlusIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Reassign Employee
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <FloatingSelect
                      label="Employee"
                      name="editAssignedEmployeeId"
                      value={editAssignedEmployeeId}
                      onChange={(v: any) => setEditAssignedEmployeeId(readInputValue(v))}
                      emptyOptionLabel=""
                      options={employeeOptions}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void confirmAssign()}
                    disabled={actionUpdatingId === editTarget?.id || !editAssignedEmployeeId}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:hover:bg-cyan-600"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    Assign
                  </button>
                </div>
              </div>,
            ],
          },
        ]}
      />

      {/* ── Delete Confirmation ─────────────────────────────────────── */}
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
            ? `Are you sure you want to delete schedule ${
                deleteScheduleTarget.scheduleNo || `#${deleteScheduleTarget.id}`
              }?`
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

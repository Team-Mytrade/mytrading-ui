import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilSquareIcon,
  TrashIcon,
  UserIcon,
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

type SalesPersonOption = {
  id: number;
  name?: string;
  code?: string;
  employeeId?: number | null;
};

type SalesOrderOption = {
  id: number;
  orderNo?: string;
  soNumber?: string;
  orderNumber?: string;
  customerId?: number;
};

type CustomerOption = {
  id: number;
  name?: string;
  customerName?: string;
  companyName?: string;
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
const SALES_ORDERS_URL = "/v1/api/sales/sales-orders/schedule/orders";
const CUSTOMERS_URL = "/v1/api/sales/quotations/getCustomers";
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
  return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}:${String(
    value.second || 0
  ).padStart(2, "0")}`;
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

const ServiceSchedules: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;

  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<ServiceSchedule | null>(null);
  const [statusTarget, setStatusTarget] = useState<ServiceSchedule | null>(null);
  const [statusValue, setStatusValue] = useState("PENDING");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchSalesPersons();
    fetchSalesOrders();
    fetchCustomers();
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

  const fetchSalesOrders = async () => {
    try {
      const res = await axios.get<SalesOrderOption[]>(SALES_ORDERS_URL, { headers });
      setSalesOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load sales orders", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get<CustomerOption[]>(CUSTOMERS_URL, { headers });
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load customers", getErrorMessage(error, "Please try again."));
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
    assignedEmployeeId: Number(form.assignedEmployeeId) || 0,
    scheduledDate: form.scheduledDate,
    startTime: requestTime(form.startTime),
    endTime: requestTime(form.endTime),
    remarks: form.remarks,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isPositiveNumber(form.serviceOrderId) || !isPositiveNumber(form.customerId)) {
      ToasterService.error("Required fields missing", "Service order and customer are required.");
      return;
    }
    if (!form.scheduledDate || !form.startTime || !form.endTime) {
      ToasterService.error(
        "Schedule time required",
        "Scheduled date, start time, and end time are required."
      );
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

  const openStatusModal = (schedule: ServiceSchedule) => {
    setStatusTarget(schedule);
    setStatusValue(schedule.status || "PENDING");
  };

  const closeStatusModal = () => {
    setStatusTarget(null);
    setStatusValue("PENDING");
  };

  const confirmStatusUpdate = async () => {
    if (!statusTarget || !statusValue) {
      ToasterService.error("Status is required");
      return;
    }
    try {
      setStatusUpdatingId(statusTarget.id);
      const res = await axios.patch<ServiceSchedule>(
        `${API_URL}/${statusTarget.id}/status`,
        null,
        { headers, params: { status: statusValue } }
      );
      upsertSchedule(res.data);
      ToasterService.success("Schedule status updated");
      closeStatusModal();
    } catch (error) {
      ToasterService.error("Failed to update status", getErrorMessage(error, "Please try again."));
    } finally {
      setStatusUpdatingId(null);
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

  const stats = useMemo(
    () => ({
      total: schedules.length,
      pending: schedules.filter((item) => item.status === "PENDING").length,
      inProgress: schedules.filter((item) => item.status === "IN_PROGRESS").length,
      completed: schedules.filter((item) => item.status === "COMPLETED").length,
    }),
    [schedules]
  );

  const employeeOptions = useMemo(
    () =>
      salesPersons
        .map((person) => ({
          id: String(person.employeeId || person.id),
          name: person.name || `Person #${person.id}`,
        }))
        .filter((item) => Number(item.id) > 0),
    [salesPersons]
  );

  const salesOrderOptions = useMemo(
    () =>
      salesOrders
        .map((order) => ({
          id: String(order.id),
          name: order.orderNo || order.soNumber || order.orderNumber || `Order #${order.id}`,
        }))
        .filter((item) => Number(item.id) > 0),
    [salesOrders]
  );

  const customerOptions = useMemo(
    () =>
      customers
        .map((customer) => ({
          id: String(customer.id),
          name: customer.name || customer.customerName || customer.companyName || `Customer #${customer.id}`,
        }))
        .filter((item) => Number(item.id) > 0),
    [customers]
  );

  const getEmployeeDisplayName = (employeeId: number) => {
    const person = salesPersons.find((item) => Number(item.employeeId || item.id) === Number(employeeId));
    return person?.name || `Employee #${employeeId}`;
  };

  const getCustomerDisplayName = (customerId: number) => {
    const customer = customers.find((item) => Number(item.id) === Number(customerId));
    return (
      customer?.name ||
      customer?.customerName ||
      customer?.companyName ||
      `Customer #${customerId}`
    );
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
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      render: (schedule) => (
        <span className="text-sm text-slate-700">{getCustomerDisplayName(schedule.customerId)}</span>
      ),
    },
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
      render: (schedule) => (
        <div className="-ml-4 md:ml-2">
          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
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
            onClick={() => openFromSchedule(schedule)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Copy to create"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openStatusModal(schedule)}
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
      <PageBreadcrumb
        pageTitle="Service Schedules"
        actions={<AddButton onClick={openCreate} label="Add Service Schedule" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Schedules" value={stats.total} icon={<CalendarDaysIcon />} />
          <StatsCard
            label="Pending"
            value={stats.pending}
            icon={<ClockIcon />}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="In Progress"
            value={stats.inProgress}
            icon={<UserIcon />}
            gradient="from-blue-50 to-cyan-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircleIcon />}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
        </div>

        <ReusableTable
          data={schedules}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="scheduledDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDaysIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No service schedules found</p>
              <button
                type="button"
                onClick={() => fetchSchedules()}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reload all schedules
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title="Create Service Schedule"
        subtitle="Select a sales order and customer, then set the schedule"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Create Service Schedule"
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Schedule Info",
            fields: [
              <FloatingSelect
                key="serviceOrderId"
                label="Service Order"
                name="serviceOrderId"
                value={form.serviceOrderId}
                onChange={handleChange}
                options={salesOrderOptions}
                required
              />,
              <FloatingSelect
                key="customerId"
                label="Customer"
                name="customerId"
                value={form.customerId}
                onChange={handleChange}
                options={customerOptions}
                required
              />,
              <FloatingSelect
                key="assignedEmployeeId"
                label="Assigned Employee"
                name="assignedEmployeeId"
                value={form.assignedEmployeeId}
                onChange={handleChange}
                options={employeeOptions}
                emptyOptionLabel=""
              />,
              <div key="scheduledDate" className="md:col-span-2">
                <FloatingDatePicker
                  label="Scheduled Date"
                  name="scheduledDate"
                  value={form.scheduledDate}
                  onChange={handleChange}
                  required
                />
              </div>,
            ],
          },
          {
            label: "Timing & Notes",
            fields: [
              <FloatingInput
                key="startTime"
                label="Start Time"
                name="startTime"
                type="time"
                value={form.startTime}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="endTime"
                label="End Time"
                name="endTime"
                type="time"
                value={form.endTime}
                onChange={handleChange}
                required
              />,
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

      {/* Status Update Modal */}
      <PaginatedPopup
        isOpen={!!statusTarget}
        title="Update Schedule Status"
        subtitle={statusTarget ? `Schedule ${statusTarget.scheduleNo || `#${statusTarget.id}`}` : ""}
        onClose={closeStatusModal}
        onSubmit={(e) => {
          e.preventDefault();
          void confirmStatusUpdate();
        }}
        submitting={statusUpdatingId === statusTarget?.id}
        submitLabel="Update Status"
        maxWidthClassName="max-w-lg"
        tabs={[
          {
            label: "Status",
            fields: [
              <FloatingSelect
                key="statusValue"
                label="Status"
                name="statusValue"
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                includeEmptyOption={false}
                options={statusOptions.map((status) => ({ id: status, name: status }))}
                required
              />,
            ],
          },
        ]}
      />

      {/* Delete Confirmation */}
      <DynamicPopup
        isPopupOpen={!!deleteSchedule}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteSchedule(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Service Schedule"
        subText={
          deleteSchedule
            ? `Are you sure you want to delete schedule #${deleteSchedule.id}?`
            : "Are you sure?"
        }
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
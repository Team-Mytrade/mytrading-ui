import React, {
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
} from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  FlagIcon,
  UserIcon,
  BuildingOfficeIcon,
  UsersIcon,
  EnvelopeIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import "react-datepicker/dist/react-datepicker.css";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DynamicPopup from "../../components/common/Popup";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/crm/activities";
const LEADS_API = "/v1/api/crm/leads";
const CUSTOMERS_API = "/v1/api/crm/customers";
const CONTACTS_API = "/v1/api/crm/contacts";
const PAGE_SIZE = 10;

interface Lead {
  id: number;
  name: string;
}

interface Customer {
  id: number;
  name?: string;
  customerName?: string;
  contacts?: Contact[];
}

interface Contact {
  id: number;
  fullName: string;
  customerId?: number | null;
}

interface Activity {
  id: number;
  title: string;
  description?: string;
  activityType?: string;
  priority?: string;
  status?: string;
  scheduledTime?: string;
  completedTime?: string;
  assignedTo?: string;
  lead?: Lead | null;
  customer?: Customer | null;
  contact?: Contact | null;
}

type Step = "basic" | "details" | "linking";

const getCustomerLabel = (c?: Customer | null) =>
  c?.customerName || c?.name || "";

const Tasks: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [form, setForm] = useState<Partial<Activity>>({});
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  );
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedType] = useState<string>("");
  const [selectedStatus] = useState<string>("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [currentStep, setCurrentStep] = useState<Step>("basic");
  const [steps, setSteps] = useState<
    { key: Step; label: string; completed: boolean }[]
  >([
    { key: "basic", label: "Basic Info", completed: false },
    { key: "details", label: "Details", completed: false },
    { key: "linking", label: "Link Records", completed: false },
  ]);

  useEffect(() => {
    if (showFormModal || showViewModal || showDeleteConfirm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showFormModal, showViewModal, showDeleteConfirm]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredActivities = useMemo(() => {
    const term = search.toLowerCase();
    return activities.filter((a) => {
      const matchesSearch = [
        a.title,
        a.description,
        a.activityType,
        a.priority,
        a.status,
        a.assignedTo,
        a.lead?.name,
        getCustomerLabel(a.customer),
        a.contact?.fullName,
      ]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(term));
      const matchesType = selectedType
        ? a.activityType === selectedType
        : true;
      const matchesStatus = selectedStatus ? a.status === selectedStatus : true;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [search, activities, selectedType, selectedStatus]);

  const fetchAll = async () => {
    try {
      const [actRes, leadRes, custRes] = await Promise.all([
        axios.get(API_BASE),
        axios.get(LEADS_API),
        axios.get(CUSTOMERS_API),
      ]);
      const contactRes = await axios
        .get(CONTACTS_API)
        .catch(() => ({ data: [] as Contact[] }));
      const customersList = custRes.data || [];
      const customerContacts = customersList.flatMap(
        (customer: Customer) => customer.contacts || []
      );
      setActivities(actRes.data || []);
      setLeads(leadRes.data || []);
      setCustomers(customersList);
      setContacts(
        customerContacts.length ? customerContacts : contactRes.data || []
      );
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const setDateField = (
    field: "scheduledTime" | "completedTime",
    date: Date | null
  ) =>
    setForm((f) => ({
      ...f,
      [field]: date ? date.toISOString() : undefined,
    }));

  const getActivityPayload = (a: Partial<Activity>) => ({
    title: a.title,
    description: a.description,
    activityType: a.activityType?.toUpperCase(),
    priority: a.priority?.toUpperCase(),
    status: a.status?.toUpperCase(),
    scheduledTime: a.scheduledTime
      ? new Date(a.scheduledTime).toISOString()
      : undefined,
    completedTime: a.completedTime
      ? new Date(a.completedTime).toISOString()
      : undefined,
    assignedTo: a.assignedTo,
  });

  const getLinkQuery = (a: Partial<Activity>) => {
    const leadId = a.lead?.id;
    const customerId = a.customer?.id;
    const contactId = a.contact?.id;
    const params = new URLSearchParams();
    if (leadId) params.set("leadId", String(leadId));
    if (customerId) params.set("customerId", String(customerId));
    if (contactId) params.set("contactId", String(contactId));
    return params.toString() ? `?${params.toString()}` : "";
  };

  const handleSave = async () => {
    if (!form.title?.trim()) {
      ToasterService.error("Title is required");
      return;
    }
    try {
      setIsSaving(true);
      const payload = getActivityPayload(form);
      const query = getLinkQuery(form);
      if (form.id) {
        await axios.put(`${API_BASE}/${form.id}${query}`, payload);
      } else {
        await axios.post(`${API_BASE}${query}`, payload);
      }
      await fetchAll();
      ToasterService.success(
        form.id ? "Activity updated successfully!" : "Activity added successfully!"
      );
      resetForm();
    } catch (err: any) {
      console.error("Error saving activity:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to save activity"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm({});
    setCurrentStep("basic");
    setSteps((prev) => prev.map((s) => ({ ...s, completed: false })));
    setShowFormModal(false);
  };

  const handleEdit = (activity: Activity) => {
    setForm({
      ...activity,
      lead: activity.lead ?? null,
      customer: activity.customer ?? null,
      contact: activity.contact ?? null,
    });
    setCurrentStep("basic");
    setSteps((prev) => prev.map((s) => ({ ...s, completed: false })));
    setShowFormModal(true);
  };

  const confirmDelete = (id?: number) => {
    if (!id) return;
    setDeleteConfirmId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      await axios.delete(`${API_BASE}/${id}`);
      await fetchAll();
      ToasterService.success("Activity deleted successfully!");
    } catch (err: any) {
      console.error("Delete error:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to delete activity"
      );
    } finally {
      setShowDeleteConfirm(false);
      setDeleteConfirmId(null);
    }
  };

  const handleInlineStatusChange = async (activity: Activity, status: string) => {
    if (activity.status === status) return;
    const previous = activities;
    const next = { ...activity, status };
    setActivities((cur) =>
      cur.map((item) => (item.id === activity.id ? next : item))
    );
    try {
      setStatusUpdatingId(activity.id);
      await axios.put(
        `${API_BASE}/${activity.id}${getLinkQuery(next)}`,
        getActivityPayload(next)
      );
      ToasterService.success("Activity status updated successfully!");
    } catch (err) {
      console.error("Error updating activity status:", err);
      setActivities(previous);
      ToasterService.error("Failed to update activity status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const goToNextStep = () => {
    if (currentStep === "basic") {
      setCurrentStep("details");
      setSteps((prev) =>
        prev.map((s) => (s.key === "basic" ? { ...s, completed: true } : s))
      );
    } else if (currentStep === "details") {
      setCurrentStep("linking");
      setSteps((prev) =>
        prev.map((s) => (s.key === "details" ? { ...s, completed: true } : s))
      );
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === "details") setCurrentStep("basic");
    else if (currentStep === "linking") setCurrentStep("details");
  };

  const isStepValid = () =>
    currentStep === "basic" ? !!form.title : true;

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case "HIGH":
        return <ExclamationCircleIcon className="h-4 w-4 text-red-500" />;
      case "MEDIUM":
        return <FlagIcon className="h-4 w-4 text-yellow-500" />;
      case "LOW":
        return <FlagIcon className="h-4 w-4 text-green-500" />;
      default:
        return <FlagIcon className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadgeColor = (status?: string) =>
    status === "COMPLETED"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "PENDING"
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-gray-100 text-gray-800 border-gray-200";

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case "CALL":
        return <PhoneIcon className="h-4 w-4 text-blue-500" />;
      case "MEETING":
        return <UsersIcon className="h-4 w-4 text-purple-500" />;
      case "EMAIL":
        return <EnvelopeIcon className="h-4 w-4 text-green-500" />;
      default:
        return <ChatBubbleLeftIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredContacts = useMemo(() => {
    if (!form.customer) return contacts;
    return contacts.filter((ct) => ct.customerId === form.customer!.id);
  }, [contacts, form.customer]);

  const tableColumns: ColumnDef<Activity>[] = [
    {
      key: "title",
      label: "Activity",
      sortable: true,
      render: (activity) => (
        <div className="flex items-start">
          <div className="flex-shrink-0 mt-0.5">
            {getPriorityIcon(activity.priority)}
          </div>
          <div className="ml-2 overflow-hidden">
            <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
              {activity.title}
            </div>
            {activity.description && (
              <div className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">
                {activity.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "activityType",
      label: "Type",
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          {getTypeIcon(a.activityType)}
          <span>{a.activityType || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (a) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={a.status || "PENDING"}
            onChange={(e) => handleInlineStatusChange(a, e.target.value)}
            disabled={statusUpdatingId === a.id}
            className={`w-[112px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${getStatusBadgeColor(
              a.status
            )} ${
              statusUpdatingId === a.id
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer"
            }`}
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      ),
    },
    {
      key: "scheduledTime",
      label: "Scheduled",
      sortable: true,
      render: (a) => (
        <div className="flex items-center text-xs text-gray-600">
          <CalendarIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          {a.scheduledTime
            ? new Date(a.scheduledTime).toLocaleDateString("en-US", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })
            : "-"}
        </div>
      ),
    },
    {
      key: "assignedTo",
      label: "Assigned To",
      sortable: true,
      render: (a) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <UserIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{a.assignedTo || "Unassigned"}</span>
        </div>
      ),
    },
    {
      key: "linkedTo",
      label: "Linked To",
      sortable: false,
      render: (a) => (
        <div className="space-y-1">
          {a.lead && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <UsersIcon className="h-3 w-3 text-gray-400" />
              <span className="truncate">Lead: {a.lead.name}</span>
            </div>
          )}
          {a.customer && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <BuildingOfficeIcon className="h-3 w-3 text-gray-400" />
              <span className="truncate">
                Customer: {getCustomerLabel(a.customer)}
              </span>
            </div>
          )}
          {a.contact && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <UserIcon className="h-3 w-3 text-gray-400" />
              <span className="truncate">Contact: {a.contact.fullName}</span>
            </div>
          )}
          {!a.lead && !a.customer && !a.contact && (
            <span className="text-xs text-gray-400">Not linked</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (a) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleEdit(a)}
            className="rounded-lg p-2 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => confirmDelete(a.id)}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
      <PageMeta title="Activities" description="Manage your activities" />
      <PageBreadcrumb pageTitle="Activities" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">
        <div className="mb-6 mx-4 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton
            onClick={() => {
              setForm({});
              setCurrentStep("basic");
              setSteps((prev) =>
                prev.map((s) => ({ ...s, completed: false }))
              );
              setShowFormModal(true);
            }}
            label="New Activity"
          />
        </div>

        <div className="py-4 px-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-[17px]">
            <StatsCard
              label="Total Activities"
              value={activities.length}
              gradient="from-cyan-50 to-blue-50"
              borderColor="border-cyan-100"
              labelColor="text-cyan-600"
            />
            <StatsCard
              label="Pending"
              value={activities.filter((a) => a.status === "PENDING").length}
              gradient="from-green-50 to-emerald-50"
              borderColor="border-green-100"
              labelColor="text-green-600"
            />
            <StatsCard
              label="Completed"
              value={
                activities.filter((a) => a.status === "COMPLETED").length
              }
              gradient="from-purple-50 to-pink-50"
              borderColor="border-purple-100"
              labelColor="text-purple-600"
            />
            <StatsCard
              label="High Priority"
              value={
                activities.filter((a) => a.priority === "HIGH").length
              }
              gradient="from-orange-50 to-yellow-50"
              borderColor="border-orange-100"
              labelColor="text-orange-600"
            />
          </div>

          <ReusableTable
            data={filteredActivities}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="title"
            defaultSortOrder="asc"
           loading={false}
           enableRowDetails={true}
           rowDetailsTitle={(row: any) =>
             row.title || row.taskName || row.subject || `Task #${row.id}`
             }
             rowDetailsSubtitle="Task details"
              hiddenDetailKeys={[
    "id",
    "tenantId",
    // "createdBy",
    // "updatedBy",
    // "deletedBy",
    // "createdAt",
    // "updatedAt",
    // "deletedAt",
  ]}


            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <CalendarIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">
                  No activities found
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForm({});
                    setShowFormModal(true);
                  }}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first activity
                </button>
              </div>
            }
          />
        </div>

        {/* View Activity Modal */}
        {showViewModal && selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Activity Details
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    View complete information about this activity
                  </p>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(selectedActivity.priority)}
                    <span className="text-sm font-medium text-gray-700">
                      {selectedActivity.priority || "No Priority"}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                      selectedActivity.status
                    )}`}
                  >
                    {selectedActivity.status === "COMPLETED" ? (
                      <CheckCircleIcon className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ClockIcon className="h-3.5 w-3.5 mr-1" />
                    )}
                    {selectedActivity.status || "PENDING"}
                  </span>
                </div>

                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedActivity.title}
                  </h2>
                </div>

                {selectedActivity.description && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedActivity.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Activity Type
                      </p>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(selectedActivity.activityType)}
                        <span className="text-sm text-gray-900">
                          {selectedActivity.activityType || "Not specified"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Assigned To
                      </p>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {selectedActivity.assignedTo || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Scheduled Time
                      </p>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDate(selectedActivity.scheduledTime)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Completed Time
                      </p>
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDate(selectedActivity.completedTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {(selectedActivity.lead ||
                  selectedActivity.customer ||
                  selectedActivity.contact) && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-500 mb-3">
                      Linked Records
                    </p>
                    <div className="space-y-2">
                      {selectedActivity.lead && (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                          <UsersIcon className="h-4 w-4 text-blue-600" />
                          <div>
                            <p className="text-xs font-medium text-blue-900">
                              Lead
                            </p>
                            <p className="text-sm text-blue-800">
                              {selectedActivity.lead.name}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedActivity.customer && (
                        <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                          <BuildingOfficeIcon className="h-4 w-4 text-purple-600" />
                          <div>
                            <p className="text-xs font-medium text-purple-900">
                              Customer
                            </p>
                            <p className="text-sm text-purple-800">
                              {getCustomerLabel(selectedActivity.customer)}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedActivity.contact && (
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                          <UserIcon className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-xs font-medium text-green-900">
                              Contact
                            </p>
                            <p className="text-sm text-green-800">
                              {selectedActivity.contact.fullName}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 bg-white flex justify-end p-5 border-t border-gray-100">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal with Stepper */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {form.id ? "Edit Activity" : "Add New Activity"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {form.id
                      ? "Update activity details"
                      : "Create a new task or activity"}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  disabled={isSaving}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Stepper */}
              <div className="px-5 pt-5">
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => (
                    <React.Fragment key={step.key}>
                      <div className="flex items-center">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
                            currentStep === step.key
                              ? "bg-cyan-600 text-white"
                              : step.completed
                              ? "bg-green-500 text-white"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {step.completed ? (
                            <CheckCircleIcon className="h-4 w-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span
                          className={`ml-2 text-xs font-medium ${
                            currentStep === step.key
                              ? "text-cyan-600"
                              : "text-gray-500"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-4 ${
                            step.completed ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="p-5">
                {currentStep === "basic" && (
                  <div className="space-y-4 pt-2">
                    <FloatingInput
                      label="Title"
                      name="title"
                      value={form.title || ""}
                      onChange={handleChange}
                      required
                    />
                    <FloatingTextarea
                      label="Description"
                      name="description"
                      value={form.description || ""}
                      onChange={handleChange}
                      rows={4}
                    />
                    <FloatingInput
                      label="Assigned To"
                      name="assignedTo"
                      value={form.assignedTo || ""}
                      onChange={handleChange}
                    />
                  </div>
                )}

                {currentStep === "details" && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingSelect
                        label="Activity Type"
                        name="activityType"
                        value={form.activityType || ""}
                        onChange={handleChange}
                        options={[
                          { id: "CALL", name: "Call" },
                          { id: "MEETING", name: "Meeting" },
                          { id: "EMAIL", name: "Email" },
                          { id: "OTHER", name: "Other" },
                        ]}
                      />
                      <FloatingSelect
                        label="Priority"
                        name="priority"
                        value={form.priority || ""}
                        onChange={handleChange}
                        options={[
                          { id: "LOW", name: "Low" },
                          { id: "MEDIUM", name: "Medium" },
                          { id: "HIGH", name: "High" },
                        ]}
                      />
                    </div>
                    <FloatingSelect
                      label="Status"
                      name="status"
                      value={form.status || ""}
                      onChange={handleChange}
                      options={[
                        { id: "PENDING", name: "Pending" },
                        { id: "COMPLETED", name: "Completed" },
                      ]}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <FloatingInput
                        type="datetime-local"
                        label="Scheduled Time"
                        name="scheduledTime"
                        value={
                          form.scheduledTime
                            ? new Date(form.scheduledTime)
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          setDateField(
                            "scheduledTime",
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                      <FloatingInput
                        type="datetime-local"
                        label="Completed Time"
                        name="completedTime"
                        value={
                          form.completedTime
                            ? new Date(form.completedTime)
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          setDateField(
                            "completedTime",
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {currentStep === "linking" && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FloatingSelect
                        label="Lead"
                        name="lead"
                        value={form.lead?.id ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            lead: e.target.value
                              ? leads.find(
                                  (l) => l.id === Number(e.target.value)
                                ) || null
                              : null,
                          }))
                        }
                        options={leads.map((l) => ({
                          id: l.id,
                          name: l.name,
                        }))}
                      />
                      <FloatingSelect
                        label="Customer"
                        name="customer"
                        value={form.customer?.id ?? ""}
                        onChange={(e) => {
                          const cust = e.target.value
                            ? customers.find(
                                (c) => c.id === Number(e.target.value)
                              ) || null
                            : null;
                          setForm((f) => ({
                            ...f,
                            customer: cust,
                            // Clear contact if it doesn't belong to the new customer
                            contact:
                              f.contact && cust && f.contact.customerId !== cust.id
                                ? null
                                : f.contact,
                          }));
                        }}
                        options={customers.map((c) => ({
                          id: c.id,
                          name: getCustomerLabel(c),
                        }))}
                      />
                      <FloatingSelect
                        label="Contact"
                        name="contact"
                        value={form.contact?.id ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            contact: e.target.value
                              ? contacts.find(
                                  (ct) => ct.id === Number(e.target.value)
                                ) || null
                              : null,
                          }))
                        }
                        options={filteredContacts.map((ct) => ({
                          id: ct.id,
                          name: ct.fullName,
                        }))}
                      />
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <span className="font-medium">Note:</span> Link this
                        activity to a lead, customer, or contact. If a customer
                        is selected, the contact list is filtered to that
                        customer.
                      </p>
                    </div>
                  </div>
                )}

                <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t border-gray-100 flex justify-between">
                  <button
                    type="button"
                    onClick={goToPreviousStep}
                    disabled={currentStep === "basic" || isSaving}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                      currentStep === "basic" || isSaving
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <ChevronLeftIcon className="h-4 w-4" /> Previous
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={isSaving}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    {currentStep !== "linking" ? (
                      <button
                        type="button"
                        onClick={goToNextStep}
                        disabled={!isStepValid() || isSaving}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                          isStepValid() && !isSaving
                            ? "bg-cyan-600 text-white hover:bg-cyan-700"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        Next <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 shadow-sm disabled:opacity-60"
                      >
                        {isSaving
                          ? "Saving..."
                          : form.id
                          ? "Update Activity"
                          : "Add Activity"}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <DynamicPopup
        isPopupOpen={showDeleteConfirm}
        setIsPopupOpen={setShowDeleteConfirm}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Activity"
        subText={
          deleteConfirmId
            ? `Are you sure you want to delete "${
                activities.find((a) => a.id === deleteConfirmId)?.title ||
                "this activity"
              }"? This action cannot be undone.`
            : "Are you sure you want to delete this activity?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => handleDelete(deleteConfirmId ?? undefined)}
        onCancel={() => setDeleteConfirmId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default Tasks;
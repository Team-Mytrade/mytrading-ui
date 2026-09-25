import React, {
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  XMarkIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import DynamicPopup from "../../components/common/Popup";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingDatePicker,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
interface CommunicationEntry {
  id: number;
  type: "EMAIL" | "CALL" | "MEETING" | "OTHER";
  subject: string;
  notes: string;
  communicationTime: string;
  contact?: ContactPerson | null;
  customer?: Customer | null;
  lead?: Lead | null;
}

interface ContactPerson {
  id: number;
  fullName: string;
  customerId?: number;
}

interface Customer {
  id: number;
  name?: string;
  customerName?: string;
  contacts?: ContactPerson[];
}

interface Lead {
  id: number;
  name: string;
}

const API_BASE = "/v1/api/crm";
const COMMUNICATIONS_API = "/communications";
const CONTACTS_API = "/contacts";
const CUSTOMERS_API = "/customers";
const LEADS_API = "/leads";
const PAGE_SIZE = 10;

const safeText = (v?: string | null) => v?.trim() || "";
const getCustomerLabel = (c?: Customer | null) =>
  c?.customerName || c?.name || "";

const Interactions: React.FC = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [form, setForm] = useState<Record<string, string | number>>({
    contactId: "",
    customerId: "",
    leadId: "",
    type: "",
    subject: "",
    communicationTime: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [search] = useState("");
  const [selectedType] = useState<string>("");
  const [selectedEntry, setSelectedEntry] =
    useState<CommunicationEntry | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  useEffect(() => {
    if (showFormModal || showNotesModal || showDeletePopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showFormModal, showNotesModal, showDeletePopup]);

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEntries = useMemo(() => {
    const term = search.toLowerCase();
    return entries.filter((entry) => {
      const customer = customers.find((c) => c.id === entry.customer?.id);
      const lead = leads.find((l) => l.id === entry.lead?.id);
      const matchesSearch = [
        entry.subject,
        entry.notes,
        entry.type,
        entry.contact?.fullName,
        getCustomerLabel(customer),
        lead?.name,
      ]
        .filter(Boolean)
        .some((t) => String(t ?? "").toLowerCase().includes(term));
      const matchesType = selectedType ? entry.type === selectedType : true;
      return matchesSearch && matchesType;
    });
  }, [entries, search, selectedType, contacts, customers, leads]);

  const fetchAllData = async () => {
    try {
      const [comm, cust, lead] = await Promise.all([
        axios.get(`${API_BASE}${COMMUNICATIONS_API}`),
        axios.get(`${API_BASE}${CUSTOMERS_API}`),
        axios.get(`${API_BASE}${LEADS_API}`),
      ]);
      // /contacts may 404 — fallback to contacts nested in customers
      const cont = await axios
        .get(`${API_BASE}${CONTACTS_API}`)
        .catch(() => ({ data: [] as ContactPerson[] }));

      const communicationData = Array.isArray(comm.data) ? comm.data : [];
      const customerData = Array.isArray(cust.data) ? cust.data : [];
      const leadData = Array.isArray(lead.data) ? lead.data : [];
      const contactData = Array.isArray(cont.data) ? cont.data : [];

      setEntries(communicationData);
      const customerContacts = customerData.flatMap(
        (customer: Customer) => customer.contacts || []
      );
      setContacts(customerContacts.length ? customerContacts : contactData);
      setCustomers(customerData);
      setLeads(leadData);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm({
      contactId: "",
      customerId: "",
      leadId: "",
      type: "",
      subject: "",
      communicationTime: "",
      notes: "",
    });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { leadId, customerId, contactId, type, subject, communicationTime, notes } =
      form;

    // Relaxed validation: require lead OR customer. Contact is optional.
    if (!leadId && !customerId) {
      ToasterService.warning(
        "Please select a Lead or a Customer before submitting"
      );
      return;
    }
    if (!type || !subject || !communicationTime) {
      ToasterService.warning("Please fill in type, subject, and date");
      return;
    }

    try {
      setIsSaving(true);
      const payload: Record<string, unknown> = {
        type: (type as string).toUpperCase(),
        subject,
        notes,
        communicationTime: new Date(communicationTime).toISOString(),
      };
      if (leadId) payload.lead = { id: Number(leadId) };
      if (customerId) payload.customer = { id: Number(customerId) };
      if (contactId) payload.contact = { id: Number(contactId) };

      if (editingId !== null) {
        await axios.put(
          `${API_BASE}${COMMUNICATIONS_API}/${editingId}`,
          payload
        );
        ToasterService.success("Communication updated successfully!");
      } else {
        await axios.post(`${API_BASE}${COMMUNICATIONS_API}`, payload);
        ToasterService.success("Communication added successfully!");
      }
      await fetchAllData();
      resetForm();
    } catch (err: any) {
      console.error("Error saving communication:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to save communication"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (entry: CommunicationEntry) => {
    setForm({
      contactId: entry.contact?.id ?? "",
      customerId: entry.customer?.id ?? "",
      leadId: entry.lead?.id ?? "",
      type: entry.type,
      subject: entry.subject,
      communicationTime: entry.communicationTime.split("T")[0],
      notes: entry.notes || "",
    });
    setEditingId(entry.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}${COMMUNICATIONS_API}/${id}`);
      await fetchAllData();
      ToasterService.success("Communication deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting:", err);
      ToasterService.error(
        err.response?.data?.message || "Failed to delete communication"
      );
    } finally {
      setDeleteId(null);
      setShowDeletePopup(false);
    }
  };

  const openNotesModal = async (entry: CommunicationEntry) => {
    try {
      const res = await axios.get<CommunicationEntry>(
        `${API_BASE}${COMMUNICATIONS_API}/${entry.id}`
      );
      setSelectedEntry(res.data);
    } catch {
      setSelectedEntry(entry);
    }
    setShowNotesModal(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <EnvelopeIcon className="h-4 w-4 text-blue-500" />;
      case "CALL":
        return <PhoneIcon className="h-4 w-4 text-green-500" />;
      case "MEETING":
        return <UsersIcon className="h-4 w-4 text-purple-500" />;
      default:
        return <ChatBubbleLeftIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "EMAIL":
        return "bg-blue-100 text-blue-800";
      case "CALL":
        return "bg-green-100 text-green-800";
      case "MEETING":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getContactName = (entry: CommunicationEntry) =>
    safeText(entry.contact?.fullName) ||
    contacts.find((c) => c.id === entry.contact?.id)?.fullName ||
    "N/A";

  const getCustomerName = (entry: CommunicationEntry) =>
    getCustomerLabel(entry.customer) ||
    getCustomerLabel(customers.find((c) => c.id === entry.customer?.id)) ||
    "N/A";

  const getLeadName = (entry: CommunicationEntry) =>
    safeText(entry.lead?.name) ||
    leads.find((l) => l.id === entry.lead?.id)?.name ||
    "N/A";

  const tableColumns: ColumnDef<CommunicationEntry>[] = [
    {
      key: "communicationTime",
      label: "Date & Time",
      sortable: true,
      render: (entry) => (
        <div
          className="flex max-w-[170px] items-center text-xs text-gray-600 truncate"
          title={formatDate(entry.communicationTime)}
        >
          <CalendarIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate">
            {formatDate(entry.communicationTime)}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (entry) => (
        <div className="flex items-center gap-1.5">
          {getTypeIcon(entry.type)}
          <span
            className={`inline-flex max-w-[100px] items-center px-2 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(
              entry.type
            )}`}
          >
            {entry.type}
          </span>
        </div>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      sortable: true,
      render: (entry) => (
        <>
          <div
            className="text-sm font-medium text-gray-900"
            title={entry.subject}
          >
            {entry.subject}
          </div>
          {entry.notes && (
            <div
              className="text-xs text-gray-500 truncate mt-0.5 max-w-[220px]"
              title={entry.notes}
            >
              {entry.notes}
            </div>
          )}
        </>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      sortable: true,
      render: (entry) => (
        <div className="flex items-center text-xs text-gray-600">
          <UserIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate max-w-[150px]">
            {getContactName(entry)}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      sortable: true,
      render: (entry) => {
        const customerName = getCustomerName(entry);
        const customerId = entry.customer?.id;
        return <div className="flex items-center text-xs text-gray-600">
          <BuildingOfficeIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          {customerId && customerName !== "N/A" ? <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/customer-management?customerIds=${customerId}&customerName=${encodeURIComponent(customerName)}`); }} className="max-w-[150px] truncate text-left text-cyan-700 hover:text-cyan-800 hover:underline" title={`View ${customerName}`}>
            {customerName}
          </button> : <span className="truncate max-w-[150px]">{customerName}</span>}
        </div>;
      },
    },
    {
      key: "lead",
      label: "Lead",
      sortable: true,
      render: (entry) => {
        const leadName = getLeadName(entry);
        const leadId = entry.lead?.id;
        return <div className="flex items-center text-xs text-gray-600">
          <UsersIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          {leadId && leadName !== "N/A" ? <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/leads?leadId=${leadId}&leadName=${encodeURIComponent(leadName)}`); }} className="max-w-[150px] truncate text-left text-cyan-700 hover:text-cyan-800 hover:underline" title={`View ${leadName}`}>
            {leadName}
          </button> : <span className="truncate max-w-[150px]">{leadName}</span>}
        </div>;
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (entry) => (
        <div
          className="max-w-[120px] flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleEdit(entry)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openNotesModal(entry)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            title="View Notes"
          >
            <DocumentTextIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteId(entry.id);
              setShowDeletePopup(true);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
      <PageMeta
        title="Communication History"
        description="Manage your communication history"
      />
      <PageBreadcrumb pageTitle="Communication History" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">
        <div className="mb-6 mx-4 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton
            onClick={() => {
              setEditingId(null);
              setForm({
                contactId: "",
                customerId: "",
                leadId: "",
                type: "",
                subject: "",
                communicationTime: new Date().toISOString().split("T")[0],
                notes: "",
              });
              setShowFormModal(true);
            }}
            label="New Communication"
          />
        </div>

        <div className="py-4 px-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-[17px]">
            <StatsCard
              label="Total Communications"
              value={entries.length}
              gradient="from-cyan-50 to-blue-50"
              borderColor="border-cyan-100"
              labelColor="text-cyan-600"
            />
            <StatsCard
              label="Emails"
              value={entries.filter((e) => e.type === "EMAIL").length}
              gradient="from-green-50 to-emerald-50"
              borderColor="border-green-100"
              labelColor="text-green-600"
            />
            <StatsCard
              label="Calls"
              value={entries.filter((e) => e.type === "CALL").length}
              gradient="from-purple-50 to-pink-50"
              borderColor="border-purple-100"
              labelColor="text-purple-600"
            />
            <StatsCard
              label="Meetings"
              value={entries.filter((e) => e.type === "MEETING").length}
              gradient="from-orange-50 to-yellow-50"
              borderColor="border-orange-100"
              labelColor="text-orange-600"
            />
          </div>

          <ReusableTable<CommunicationEntry>
            data={filteredEntries}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="communicationTime"
            defaultSortOrder="desc"
             enableRowDetails={true}
            rowDetailsTitle={(row) => row.subject || `Communication #${row.id}`}
             rowDetailsSubtitle="Communication details"
             hiddenDetailKeys={["id", "tenantId",]}

            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <ChatBubbleLeftIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">
                  No communications found
                </p>
                <button
                  type="button"
                  onClick={() => setShowFormModal(true)}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first communication
                </button>
              </div>
            }
          />
        </div>

        <PaginatedPopup
  isOpen={showFormModal}
  title={editingId ? "Edit Communication" : "Add New Communication"}
  subtitle={
    editingId
      ? "Update communication details"
      : "Record a new communication with a contact"
  }
  onClose={resetForm}
  onSubmit={handleSubmit}
  submitLabel={editingId ? "Update Communication" : "Add Communication"}
  submitting={isSaving}
  maxWidthClassName="max-w-3xl"
  tabs={[
    {
      label: "Recipients",
      fields: [
        <FloatingSelect
          key="leadId"
          label="Lead (or Customer below)"
          name="leadId"
          value={form.leadId}
          onChange={handleChange}
          options={leads.map((l) => ({ id: l.id, name: l.name }))}
        />,
        <FloatingSelect
          key="customerId"
          label="Customer (or Lead above)"
          name="customerId"
          value={form.customerId}
          onChange={handleChange}
          options={customers.map((c) => ({
            id: c.id,
            name: getCustomerLabel(c),
          }))}
        />,
        <div key="contact" className="md:col-span-2">
          <FloatingSelect
            label="Contact (optional)"
            name="contactId"
            value={form.contactId}
            onChange={handleChange}
            options={contacts.map((c) => ({
              id: c.id,
              name: c.fullName,
            }))}
          />
        </div>,
      ],
    },
    {
      label: "Details",
      fields: [
        <FloatingSelect
          key="type"
          label="Type"
          name="type"
          value={form.type}
          onChange={handleChange}
          options={[
            { id: "EMAIL", name: "Email" },
            { id: "CALL", name: "Call" },
            { id: "MEETING", name: "Meeting" },
            { id: "OTHER", name: "Other" },
          ]}
          required
        />,
        <FloatingDatePicker
          key="communicationTime"
          label="Date & Time"
          name="communicationTime"
          value={
            form.communicationTime
              ? new Date(form.communicationTime).toISOString().split("T")[0]
              : ""
          }
          onChange={(e) =>
            setForm({
              ...form,
              communicationTime: e.target.value,
            })
          }
          required
        />,
        <div key="subject" className="md:col-span-2">
          <FloatingInput
            label="Subject"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            required
          />
        </div>,
        <div key="notes" className="md:col-span-2">
          <FloatingTextarea
            label="Notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={4}
          />
        </div>,
      ],
    },
  ]}
/>

        {/* Notes View Modal */}
        {showNotesModal && selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  Communication Notes
                </h3>
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(
                      selectedEntry.type
                    )}`}
                  >
                    {getTypeIcon(selectedEntry.type)} {selectedEntry.type}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />{" "}
                    {formatDate(selectedEntry.communicationTime)}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">
                  {selectedEntry.subject}
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedEntry.notes ||
                      "No notes available for this communication."}
                  </p>
                </div>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5" />
                    <span>Contact: {getContactName(selectedEntry)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="h-3.5 w-3.5" />
                    <span>Customer: {getCustomerName(selectedEntry)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-3.5 w-3.5" />
                    <span>Lead: {getLeadName(selectedEntry)}</span>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 bg-white flex justify-end p-5 border-t border-gray-100">
                <button
                  onClick={() => setShowNotesModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Communication"
        subText={
          deleteId
            ? `Are you sure you want to delete "${
                entries.find((e) => e.id === deleteId)?.subject ||
                "this communication"
              }"? This action cannot be undone.`
            : "Are you sure you want to delete this communication?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => deleteId !== null && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default Interactions;

import React, { useEffect, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";
import DynamicPopup from "../../components/common/Popup";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import { FloatingInput, FloatingSelect1 as FloatingSelect, FloatingDatePicker, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

interface CommunicationEntry {
  id: number;
  type: "EMAIL" | "CALL" | "MEETING" | "OTHER";
  subject: string;
  notes: string;
  communicationTime: string;
  contact: { id: number };
  customer: { id: number };
  lead: { id: number };
}

interface ContactPerson {
  id: number;
  fullName: string;
  email?: string;
  phone?: string;
}

interface Customer {
  id: number;
  name: string;
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

const CommunicationHistory: React.FC = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<CommunicationEntry[]>([]);
  const [form, setForm] = useState<Record<string, string | number>>({
    contactId: "", customerId: "", leadId: "", type: "", subject: "", communicationTime: "", notes: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CommunicationEntry | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  useEffect(() => {
    if (showFormModal || showNotesModal || showDeletePopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [showFormModal, showNotesModal, showDeletePopup]);

  useEffect(() => { fetchAllData(); }, []);

  useEffect(() => {
    const term = search.toLowerCase();
    const result = entries.filter((entry) => {
      const contact = contacts.find((c) => c.id === entry.contact.id);
      const customer = customers.find((c) => c.id === entry.customer.id);
      const lead = leads.find((l) => l.id === entry.lead.id);
      const matchesSearch = [entry.subject, entry.notes, entry.type, contact?.fullName, customer?.name, lead?.name]
        .filter(Boolean).some((text) => text?.toLowerCase().includes(term));
      const matchesType = selectedType ? entry.type === selectedType : true;
      return matchesSearch && matchesType;
    });
    setFilteredEntries(result);
  }, [search, entries, selectedType, contacts, customers, leads]);

  const fetchAllData = async () => {
    try {
      const [comm, cont, cust, lead] = await Promise.all([
        axios.get(`${API_BASE}${COMMUNICATIONS_API}`),
        axios.get(`${API_BASE}${CONTACTS_API}`),
        axios.get(`${API_BASE}${CUSTOMERS_API}`),
        axios.get(`${API_BASE}${LEADS_API}`),
      ]);
      setEntries(comm.data);
      setFilteredEntries(comm.data);
      setContacts(cont.data);
      setCustomers(cust.data);
      setLeads(lead.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { leadId, customerId, contactId, type, subject, communicationTime, notes } = form;
      if (!leadId || !customerId || !contactId) {
        ToasterService.warning("Please select Lead, Customer, and Contact before submitting");
        return;
      }
      const payload = {
        type: (type as string)?.toUpperCase(), subject, notes,
        communicationTime: new Date(communicationTime).toISOString(),
        lead: { id: leadId }, customer: { id: customerId }, contact: { id: contactId },
      };
      if (editingId !== null) {
        await axios.put(`${API_BASE}${COMMUNICATIONS_API}/${editingId}`, payload);
        ToasterService.success("Communication updated successfully!");
      } else {
        await axios.post(`${API_BASE}${COMMUNICATIONS_API}`, payload);
        ToasterService.success("Communication added successfully!");
      }
      await fetchAllData();
      resetForm();
    } catch (err) {
      console.error("Error saving communication:", err);
      ToasterService.error("Failed to save communication");
    }
  };

  const resetForm = () => {
    setForm({ contactId: "", customerId: "", leadId: "", type: "", subject: "", communicationTime: "", notes: "" });
    setEditingId(null);
    setShowFormModal(false);
  };

  const handleEdit = (entry: CommunicationEntry) => {
    setForm({
      contactId: entry.contact.id, customerId: entry.customer.id, leadId: entry.lead.id,
      type: entry.type, subject: entry.subject, communicationTime: entry.communicationTime.split('T')[0], notes: entry.notes,
    });
    setEditingId(entry.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}${COMMUNICATIONS_API}/${id}`);
      fetchAllData();
      ToasterService.success("Communication deleted successfully!");
      setDeleteId(null);
      setShowDeletePopup(false);
    } catch (err) {
      console.error("Error deleting:", err);
      ToasterService.error("Failed to delete communication");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EMAIL": return <EnvelopeIcon className="h-4 w-4 text-blue-500" />;
      case "CALL": return <PhoneIcon className="h-4 w-4 text-green-500" />;
      case "MEETING": return <UsersIcon className="h-4 w-4 text-purple-500" />;
      default: return <ChatBubbleLeftIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "EMAIL": return "bg-blue-100 text-blue-800";
      case "CALL": return "bg-green-100 text-green-800";
      case "MEETING": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const tableColumns: ColumnDef<CommunicationEntry>[] = [
    {
      key: "communicationTime",
      label: "Date & Time",
      sortable: true,
      render: (entry) => (
        <div className="flex items-center text-xs text-gray-600 truncate max-w-[80px]" title={formatDate(entry.communicationTime)}>
          <CalendarIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate">{formatDate(entry.communicationTime)}</span>
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
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getTypeBadgeColor(entry.type)}`}>
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
          <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]" title={entry.subject}>{entry.subject}</div>
          {entry.notes && <div className="text-xs text-gray-500 truncate max-w-[120px] mt-0.5" title={entry.notes}>{entry.notes}</div>}
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
          <span className="truncate max-w-[100px]">{getContactName(entry)}</span>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      sortable: true,
      render: (entry) => (
        <div className="flex items-center text-xs text-gray-600">
          <BuildingOfficeIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate max-w-[100px]">{getCustomerName(entry)}</span>
        </div>
      ),
    },
    {
      key: "lead",
      label: "Lead",
      sortable: true,
      render: (entry) => (
        <div className="flex items-center text-xs text-gray-600">
          <UsersIcon className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate max-w-[100px]">{getLeadName(entry)}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-center",
      className: "text-center",
      render: (entry) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => handleEdit(entry)}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="Edit">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setSelectedEntry(entry); setShowNotesModal(true); }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="View Notes">
            <DocumentTextIcon className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => { setDeleteId(entry.id); setShowDeletePopup(true); }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const getContactName = (entry: CommunicationEntry) => contacts.find((c) => c.id === entry.contact.id)?.fullName || "N/A";
  const getCustomerName = (entry: CommunicationEntry) => customers.find((c) => c.id === entry.customer.id)?.name || "N/A";
  const getLeadName = (entry: CommunicationEntry) => leads.find((l) => l.id === entry.lead.id)?.name || "N/A";

  return (
    <>
      <PageMeta title="Communication History" description="Manage your communication history" />
      <div className="max-w-7xl mx-auto px-6 pb-6 pt-0 space-y-6">
        <div className="mb-2 flex items-center justify-between pt-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-1.5 text-gray-800 shadow-sm transition-all hover:-translate-x-0.5 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-cyan-800 dark:hover:bg-gray-800 dark:hover:text-cyan-300"
              aria-label="Go back"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 className="text-[20px] font-semibold text-cyan-600 dark:text-white/90">
              Communication History
            </h2>
          </div>
          <nav className="max-w-full overflow-x-auto">
            <ol className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
              <li>
                <Link className="inline-flex items-center gap-1.5 transition-colors hover:text-cyan-600 dark:hover:text-cyan-400" to="/">Home</Link>
              </li>
              <li className="text-gray-500 dark:text-gray-400">{">"}</li>
              <li>
                <Link className="inline-flex items-center gap-1.5 transition-colors hover:text-cyan-600 dark:hover:text-cyan-400" to="/crm_dashboard">CRM</Link>
              </li>
              <li className="text-gray-500 dark:text-gray-400">{">"}</li>
              <li className="text-cyan-600 dark:text-white/90">Interactions</li>
            </ol>
          </nav>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by subject, notes, contact, customer or lead..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AddButton
              onClick={() => {
                setEditingId(null);
                setForm({ contactId: "", customerId: "", leadId: "", type: "", subject: "", communicationTime: new Date().toISOString().split('T')[0], notes: "" });
                setShowFormModal(true);
              }}
              label="New Communication"
              className="!mb-0"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border flex items-center justify-center transition-colors h-[40px] w-[40px] ${showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"}`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <FloatingSelect
                  label="Communication Type"
                  name="type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  options={[
                    { id: "", name: "All Types" },
                    { id: "EMAIL", name: "Email" },
                    { id: "CALL", name: "Call" },
                    { id: "MEETING", name: "Meeting" },
                    { id: "OTHER", name: "Other" }
                  ]}
                />
              </div>
              {selectedType && (
                <button onClick={() => setSelectedType("")} className="self-end mb-1 text-sm text-red-600 hover:text-red-800">
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<CommunicationEntry>
          data={filteredEntries}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="communicationTime"
          defaultSortOrder="desc"
          onRowClick={(entry) => { setSelectedEntry(entry); setShowNotesModal(true); }}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ChatBubbleLeftIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No communications found</p>
              {search || selectedType ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button type="button" onClick={() => setShowFormModal(true)}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                  Add your first communication
                </button>
              )}
            </div>
          }
        />

        {/* Add/Edit Modal */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-auto overflow-y-auto max-h-[90vh]">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{editingId ? "Edit Communication" : "Add New Communication"}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{editingId ? "Update communication details" : "Record a new communication with a contact"}</p>
                </div>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <FloatingSelect
                    label="Contact"
                    name="contactId"
                    value={form.contactId}
                    onChange={handleChange}
                    options={contacts.map(c => ({ id: c.id, name: c.fullName }))}
                    required
                  />
                  <FloatingSelect
                    label="Customer"
                    name="customerId"
                    value={form.customerId}
                    onChange={handleChange}
                    options={customers.map(c => ({ id: c.id, name: c.name }))}
                    required
                  />
                  <FloatingSelect
                    label="Lead"
                    name="leadId"
                    value={form.leadId}
                    onChange={handleChange}
                    options={leads.map(l => ({ id: l.id, name: l.name }))}
                    required
                  />
                  <FloatingSelect
                    label="Type"
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    options={[
                      { id: "EMAIL", name: "Email" },
                      { id: "CALL", name: "Call" },
                      { id: "MEETING", name: "Meeting" },
                      { id: "OTHER", name: "Other" }
                    ]}
                    required
                  />
                  <div className="col-span-2">
                    <FloatingInput
                      label="Subject"
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <FloatingDatePicker
                      label="Date & Time"
                      name="communicationTime"
                      value={form.communicationTime ? new Date(form.communicationTime).toISOString().split('T')[0] : ""}
                      onChange={(e) => setForm({ ...form, communicationTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <FloatingTextarea
                      label="Notes"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      rows={4}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
                  <button type="button" onClick={resetForm}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm">
                    {editingId ? "Update Communication" : "Add Communication"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notes View Modal */}
        {showNotesModal && selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto overflow-y-auto max-h-[90vh]">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Communication Notes</h3>
                <button onClick={() => setShowNotesModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(selectedEntry.type)}`}>
                    {getTypeIcon(selectedEntry.type)} {selectedEntry.type}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" /> {formatDate(selectedEntry.communicationTime)}
                  </span>
                </div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">{selectedEntry.subject}</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEntry.notes || "No notes available for this communication."}</p>
                </div>
                <div className="mt-4 space-y-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2"><UserIcon className="h-3.5 w-3.5" /><span>Contact: {contacts.find(c => c.id === selectedEntry.contact.id)?.fullName || 'N/A'}</span></div>
                  <div className="flex items-center gap-2"><BuildingOfficeIcon className="h-3.5 w-3.5" /><span>Customer: {customers.find(c => c.id === selectedEntry.customer.id)?.name || 'N/A'}</span></div>
                  <div className="flex items-center gap-2"><UsersIcon className="h-3.5 w-3.5" /><span>Lead: {leads.find(l => l.id === selectedEntry.lead.id)?.name || 'N/A'}</span></div>
                </div>
              </div>
              <div className="sticky bottom-0 bg-white flex justify-end p-5 border-t border-gray-100">
                <button onClick={() => setShowNotesModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Close</button>
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
        subText={deleteId ? `Are you sure you want to delete "${entries.find((e) => e.id === deleteId)?.subject || "this communication"}"? This action cannot be undone.` : "Are you sure you want to delete this communication?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); }}
        onCancel={() => setDeleteId(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
        tr { animation: fade-in 0.25s ease-out; cursor: pointer; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
};

export default CommunicationHistory;

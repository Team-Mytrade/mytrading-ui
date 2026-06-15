import React, { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  UserCircleIcon,
  XMarkIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface Address { street: string; city: string; state: string; postalCode: string; country: string; }
interface Customer { id: number; companyName: string; industry: string; email: string; phone: string; website: string; status: string; address: Address; name: string; }
interface Contact { id: number; fullName: string; email: string; phone: string; designation?: string; role?: string; customer?: Customer | null; }

const BASE_API_URL = "/v1/api/sales";
const CUSTOMERS_API_URL = `${BASE_API_URL}/customers`;

const roleColors: Record<string, { bg: string; text: string; label: string }> = {
  DECISION_MAKER: { bg: "bg-purple-100", text: "text-purple-800", label: "Decision Maker" },
  INFLUENCER: { bg: "bg-blue-100", text: "text-blue-800", label: "Influencer" },
  END_USER: { bg: "bg-green-100", text: "text-green-800", label: "End User" },
  TECHNICAL: { bg: "bg-orange-100", text: "text-orange-800", label: "Technical" },
  OTHER: { bg: "bg-gray-100", text: "text-gray-800", label: "Other" },
};

const ROLE_OPTIONS = ["DECISION_MAKER", "INFLUENCER", "END_USER", "TECHNICAL", "OTHER"];

const RoleSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <select value={value} onChange={e => onChange(e.target.value)} required
    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent">
    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleColors[r]?.label || r}</option>)}
  </select>
);

const SalesContactPersonDetails: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = { Authorization: `Bearer ${token}` };

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({ fullName: "", email: "", phone: "", designation: "", role: "DECISION_MAKER", customerId: "" });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  useEffect(() => { fetchCustomers(); }, []);
  useEffect(() => { if (customers.length > 0) fetchAllContacts(); }, [customers]);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get<Customer[]>(CUSTOMERS_API_URL, { headers });
      setCustomers(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAllContacts = async () => {
    setLoading(true);
    try {
      const arrays = await Promise.all(
        customers.map(c =>
          axios.get<Contact[]>(`${CUSTOMERS_API_URL}/${c.id}/contact-persons`, { headers })
            .then(r => r.data).catch(() => [])
        )
      );
      setContacts(arrays.flat());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };


  const promptDelete = (contact: Contact) => { setDeletingContact(contact); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingContact) return;
    if (!deletingContact.customer?.id) { alert("Cannot delete: No customer associated"); return; }
    try {
      await axios.delete(`${CUSTOMERS_API_URL}/${deletingContact.customer.id}/contact-persons/${deletingContact.id}`, { headers });
      fetchAllContacts();
    } catch { alert("Failed to delete contact"); }
    finally { setDeletingContact(null); }
  };

  const handleAddContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!newContact.customerId) { alert("Please select a customer"); return; }
    try {
      const payload = { fullName: newContact.fullName, email: newContact.email, phone: newContact.phone, designation: newContact.designation, role: newContact.role, customer: { id: Number(newContact.customerId) } };
      const res = await axios.post(`${CUSTOMERS_API_URL}/${newContact.customerId}/contact-persons`, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        setShowAddModal(false);
        setNewContact({ fullName: "", email: "", phone: "", designation: "", role: "DECISION_MAKER", customerId: "" });
        fetchAllContacts();
      }
    } catch (err: any) { alert(err.response?.data?.message || "Failed to add contact."); }
  };

  const handleEditContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!editContact?.customer?.id) { alert("Cannot update: No customer associated"); return; }
    try {
      const payload = { fullName: editContact.fullName, email: editContact.email, phone: editContact.phone, designation: editContact.designation || "", role: editContact.role || "DECISION_MAKER", customer: { id: editContact.customer.id } };
      const res = await axios.put(`${CUSTOMERS_API_URL}/${editContact.customer.id}/contact-persons/${editContact.id}`, payload, { headers });
      if (res.status === 200) { setShowEditModal(false); setEditContact(null); fetchAllContacts(); }
    } catch (err: any) { alert(err.response?.data?.message || "Failed to update contact."); }
  };

  const handleAssignCustomer = async () => {
    if (!activeContactId || !selectedCustomerId) { alert("Please select a customer"); return; }
    const contact = contacts.find(c => c.id === activeContactId);
    if (!contact) return;
    try {
      const payload = { fullName: contact.fullName, email: contact.email, phone: contact.phone, designation: contact.designation || "", role: contact.role || "DECISION_MAKER", customer: { id: Number(selectedCustomerId) } };
      if (contact.customer?.id) {
        await axios.put(`${CUSTOMERS_API_URL}/${selectedCustomerId}/contact-persons/${contact.id}`, payload, { headers });
      } else {
        await axios.post(`${CUSTOMERS_API_URL}/${selectedCustomerId}/contact-persons`, payload, { headers });
      }
      setShowAssignModal(false); setActiveContactId(null); setSelectedCustomerId("");
      fetchAllContacts();
    } catch (err: any) { alert(err.response?.data?.message || "Failed to assign customer."); }
  };


  const stats = {
    total: contacts.length,
    decisionMakers: contacts.filter(c => c.role === "DECISION_MAKER").length,
    withCustomer: contacts.filter(c => !!c.customer).length,
    roles: new Set(contacts.map(c => c.role).filter(Boolean)).size,
  };


  const columns: ColumnDef<Contact>[] = [
    {
      key: "fullName", label: "Contact Person", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 px-2 bg-cyan-100 rounded-full flex items-center justify-center shrink-0">
            <UserCircleIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-medium text-gray-900 leading-tight">{row.fullName}</span>
        </div>
      ),
    },
    {
      key: "email", label: "Email", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm">
          <EnvelopeIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <a href={`mailto:${row.email}`} className="hover:text-cyan-600" onClick={e => e.stopPropagation()}>{row.email}</a>
        </div>
      ),
    },
    {
      key: "phone", label: "Phone", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-900">
          <PhoneIcon className="h-3.5 w-3.5 text-gray-400" />{String(v)}
        </div>
      ),
    },
    {
      key: "designation", label: "Designation", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-900">{String(v || "—")}</span>,
    },
    {
      key: "role", label: "Role", sortable: true,
      render: (row) => row.role ? (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[row.role]?.bg || "bg-gray-100"} ${roleColors[row.role]?.text || "text-gray-800"}`}>
          {roleColors[row.role]?.label || row.role}
        </span>
      ) : <span className="text-gray-400 text-sm">—</span>,
    },
    {
      key: "customer", label: "Customer",
      render: (row) => row.customer ? (
        <div className="flex items-center gap-1.5 text-sm text-gray-900">
          <BuildingOfficeIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <button onClick={e => { e.stopPropagation(); navigate(`/customer-management/${row.customer?.id}`); }}
            className="hover:text-cyan-600">
            {row.customer.name || row.customer.companyName}
          </button>
        </div>
      ) : <span className="text-sm text-gray-400">No customer</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setEditContact(row); setShowEditModal(true); }} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(row)} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];


  return (
    <>
      <PageMeta title="Contact Persons" description="Manage your contact persons" />
      <PageBreadcrumb
        pageTitle="Contact Persons"
        showAddButton
        addButtonLabel="Add Contact Person"
        onAddClick={() => setShowAddModal(true)}
      />

      <div className="mx-auto px-3 sm:px-4 lg:px-4 py-4 space-y-2.5 overflow-x-hidden overflow-y-hidden">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <StatsCard label="Total Contacts" value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Decision Makers" value={stats.decisionMakers} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label="With Customer" value={stats.withCustomer} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Unique Roles" value={stats.roles} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
        </div>

        {/* Table */}
        <ReusableTable<Contact>
          data={contacts}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by name, email, phone, or designation..."
          searchFields={["fullName", "email", "phone", "designation"]}
          pageSize={10}
          defaultSortKey="fullName"
          toolbar={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <select defaultValue="" onChange={e => { }}
                className="px-2.5 h-10 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
                <option value="">All Roles</option>
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{roleColors[r]?.label}</option>)}
              </select>
              <select defaultValue="" onChange={e => { }}
                className="px-2.5 h-10 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name || c.companyName}</option>)}
              </select>
            </div>
          }
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-14 w-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <UserGroupIcon className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1.5">No contact persons found</p>
              <button onClick={() => setShowAddModal(true)} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first contact →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Contact"
        subText={`Are you sure you want to delete ${deletingContact?.fullName}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-y-hidden">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[82vh] overflow-hidden">
            <div className="flex justify-between items-center p-3.5 border-b">
              <h3 className="text-base font-semibold text-gray-900">Add Contact Person</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-500 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleAddContact} className="p-3 max-h-[calc(82vh-56px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[
                  { label: "Full Name", key: "fullName", type: "text", placeholder: "Enter full name", required: true },
                  { label: "Email", key: "email", type: "email", placeholder: "Enter email", required: true },
                  { label: "Phone", key: "phone", type: "text", placeholder: "Enter phone", required: true },
                  { label: "Designation", key: "designation", type: "text", placeholder: "Enter designation", required: false },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(newContact as any)[f.key]} required={f.required}
                      onChange={e => setNewContact({ ...newContact, [f.key]: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
                  <RoleSelect value={newContact.role} onChange={v => setNewContact({ ...newContact, role: v })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer <span className="text-red-500">*</span></label>
                  <select value={newContact.customerId} onChange={e => setNewContact({ ...newContact, customerId: e.target.value })} required
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent">
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name || c.companyName}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="px-3.5 py-2 bg-cyan-600 text-sm text-white rounded-lg hover:bg-cyan-700 transition-colors">Add Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editContact && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-y-hidden">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl max-h-[82vh] overflow-hidden">
            <div className="flex justify-between items-center p-3.5 border-b">
              <h3 className="text-base font-semibold text-gray-900">Edit Contact</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-500 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleEditContact} className="p-3 max-h-[calc(82vh-56px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {[
                  { label: "Full Name", field: "fullName", type: "text", required: true },
                  { label: "Email", field: "email", type: "email", required: true },
                  { label: "Phone", field: "phone", type: "text", required: true },
                  { label: "Designation", field: "designation", type: "text", required: false },
                ].map(f => (
                  <div key={f.field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                    <input type={f.type} value={(editContact as any)[f.field] || ""} required={f.required}
                      onChange={e => setEditContact({ ...editContact, [f.field]: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role <span className="text-red-500">*</span></label>
                  <RoleSelect value={editContact.role || "DECISION_MAKER"} onChange={v => setEditContact({ ...editContact, role: v })} />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="px-3.5 py-2 bg-cyan-600 text-sm text-white rounded-lg hover:bg-cyan-700 transition-colors">Update Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Customer Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 overflow-y-hidden">
          <div className="bg-white rounded-xl w-full max-w-xs mx-4 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-3.5 border-b">
              <h3 className="text-base font-semibold text-gray-900">Assign to Customer</h3>
              <button onClick={() => { setShowAssignModal(false); setSelectedCustomerId(""); }} className="text-gray-400 hover:text-gray-500 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <div className="p-3.5">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer <span className="text-red-500">*</span></label>
                <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500">
                  <option value="">Choose a customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name || c.companyName}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setShowAssignModal(false); setSelectedCustomerId(""); }}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleAssignCustomer} disabled={!selectedCustomerId}
                  className="px-3.5 py-2 bg-cyan-600 text-sm text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Assign</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SalesContactPersonDetails;

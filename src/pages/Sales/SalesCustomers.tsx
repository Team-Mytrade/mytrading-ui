import React, { useEffect, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import {
  TrashIcon,
  PencilSquareIcon,
  // EyeIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon,
  BriefcaseIcon,
  MapPinIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface Segment { id: number; name: string; }
enum CustomType { INDIVIDUAL = "INDIVIDUAL", COMPANY = "COMPANY" }
interface Address { street: string; city: string; state: string; postalCode: string; country: string; }
interface Customer {
  id?: number; name: string; customerCode?: string; industry: string; website: string;
  customerType: CustomType; email: string; phone: string; registrationDate?: string;
  status: string; active: string; segments?: Segment[]; address: Address;
  remarks?: string; creditLimit?: number; outstandingBalance?: number;
}

const API_URL = "/v1/api/sales/customers";

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactElement }> = {
  ACTIVE:   { bg: "bg-green-100", text: "text-green-800", icon: <CheckCircleIcon className="h-3 w-3 mr-1" /> },
  INACTIVE: { bg: "bg-gray-100",  text: "text-gray-800",  icon: <XCircleIcon     className="h-3 w-3 mr-1" /> },
};


const SalesCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { id: requestFromId } = useParams<{ id: string }>();
  const location  = useLocation();
  const requestFrom = location.state?.from;

  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [loading, setLoading]             = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [contacts, setContacts]           = useState<any[]>([]);
  const [segmentsList, setSegmentsList]   = useState<any[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [selectedCustomer, setSelectedCustomer]   = useState<Customer | null>(null);
  const [showCommModal, setShowCommModal]         = useState(false);
  const [showSegmentModal, setShowSegmentModal]   = useState(false);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  const [form, setForm] = useState({ contactId: "", notes: "" });

  const [customerForm, setCustomerForm] = useState<any>({
    name: "", industry: "", website: "", email: "", phone: "",
    customerCode: "", registrationDate: "", status: "ACTIVE", active: "ACTIVE",
    customerType: CustomType.INDIVIDUAL,
    address: { street: "", city: "", state: "", postalCode: "", country: "" },
    remarks: "", creditLimit: 0, outstandingBalance: 0,
  });

  useEffect(() => { fetchCustomers(); }, [requestFromId]);
  useEffect(() => { if (showSegmentModal) fetchSegments(); }, [showSegmentModal]);
  useEffect(() => { if (showCommModal) fetchContacts(); }, [showCommModal]);


  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Customer[]>(API_URL);
      let data = res.data;
      if (requestFromId && requestFrom === "segments") {
        data = data.filter(c => c.segments?.some(s => s.id === Number(requestFromId)));
      }
      setCustomers(data);
    } catch { ToasterService.error("Failed to load customers"); }
    finally { setLoading(false); }
  };

  const fetchSegments = async () => {
    try {
      const res = await axios.get("/v1/api/crm/segments");
      setSegmentsList(Array.isArray(res.data) ? res.data : []);
    } catch { setSegmentsList([]); }
  };

  const fetchContacts = async () => {
    try {
      const res = await axios.get("/v1/api/crm/contacts");
      setContacts(res.data);
    } catch { ToasterService.error("Failed to load contacts"); }
  };


  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setCustomerForm((p: any) => ({ ...p, address: { ...p.address, [key]: value } }));
    } else {
      setCustomerForm((p: any) => ({ ...p, [name]: value }));
    }
  };

  const handleSubmitCustomer = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      name: customerForm.name, email: customerForm.email, phone: customerForm.phone,
      customerType: customerForm.customerType, status: customerForm.status, active: customerForm.active,
      website: customerForm.website, industry: customerForm.industry,
      registrationDate: new Date().toISOString(),
      address: customerForm.address,
      remarks: customerForm.remarks || "",
      creditLimit: parseFloat(customerForm.creditLimit) || 0,
      outstandingBalance: parseFloat(customerForm.outstandingBalance) || 0,
      segments: requestFromId ? [{ id: Number(requestFromId) }] : [],
    };
    try {
      if (isEditingCustomer && customerForm.id) {
        await axios.put(`${API_URL}/${customerForm.id}`, payload);
        ToasterService.success("Customer updated successfully!");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Customer added successfully!");
      }
      setShowCustomerModal(false);
      fetchCustomers();
    } catch { ToasterService.error("Failed to save customer!"); }
  };

  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setIsEditingCustomer(true);
      setCustomerForm({ ...customer, address: customer.address || { street: "", city: "", state: "", postalCode: "", country: "" } });
    } else {
      setIsEditingCustomer(false);
      setCustomerForm({ name: "", industry: "", website: "", email: "", phone: "", address: { street: "", city: "", state: "", postalCode: "", country: "" }, status: "ACTIVE", active: "ACTIVE", remarks: "", customerType: CustomType.INDIVIDUAL, creditLimit: 0, outstandingBalance: 0 });
    }
    setShowCustomerModal(true);
  };

  const promptDelete = (customer: Customer) => { setSelectedCustomer(customer); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!selectedCustomer?.id) return;
    try {
      await axios.delete(`${API_URL}/${selectedCustomer.id}`);
      ToasterService.success("Customer deleted successfully!");
      fetchCustomers();
    } catch { ToasterService.error("Failed to delete customer!"); }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmitComm = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const payload = { type: "Other", communicationTime: new Date().toISOString(), notes: form.notes, contact: { id: Number(form.contactId) }, customer: { id: selectedCustomer.id }, lead: { id: 0 } };
    try {
      await axios.post("/v1/api/crm/communications", payload);
      ToasterService.success("Communication added successfully!");
      setShowCommModal(false);
      setForm({ contactId: "", notes: "" });
    } catch { ToasterService.error("Failed to add communication!"); }
  };


  const stats = {
    total:    customers.length,
    active:   customers.filter(c => c.status === "ACTIVE").length,
    inactive: customers.filter(c => c.status === "INACTIVE").length,
    company:  customers.filter(c => c.customerType === CustomType.COMPANY).length,
  };


  const columns: ColumnDef<Customer>[] = [
    {
      key: "name", label: "Company", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-cyan-100 rounded-lg flex items-center justify-center shrink-0">
            <BuildingOfficeIcon className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <a href={row.website} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-cyan-600 hover:underline" onClick={e => e.stopPropagation()}>
              {row.name ?? "—"}
            </a>
            {row.customerCode && <div className="text-xs text-gray-500">Code: {row.customerCode}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "industry", label: "Industry", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-900">
          <BriefcaseIcon className="h-4 w-4 text-gray-400" />{String(v)}
        </div>
      ),
    },
    {
      key: "email", label: "Email", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-900">
          <EnvelopeIcon className="h-4 w-4 text-gray-400" />
          <a href={`mailto:${row.email}`} className="hover:text-cyan-600" onClick={e => e.stopPropagation()}>{row.email}</a>
        </div>
      ),
    },
    {
      key: "phone", label: "Phone", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-900">
          <PhoneIcon className="h-4 w-4 text-gray-400" />{String(v)}
        </div>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[row.status]?.bg || "bg-gray-100"} ${statusColors[row.status]?.text || "text-gray-800"}`}>
          {statusColors[row.status]?.icon}{row.status}
        </span>
      ),
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/crm-view/customers/${row.id}`, { state: { from: "customers" } })} title="View"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            {/* <EyeIcon className="h-4 w-4" /> */}
          </button>
          <button onClick={() => openCustomerModal(row)} title="Edit"
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
      <PageMeta title="Customers" description="Manage your Customers" />
      <PageBreadcrumb pageTitle="Customers" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          <AddButton label="Add Customer" onClick={() => openCustomerModal()} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Customers" value={stats.total}    gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Active"          value={stats.active}   gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Inactive"        value={stats.inactive} gradient="from-gray-50 to-slate-50"    borderColor="border-gray-200"   labelColor="text-gray-600" />
          <StatsCard label="Companies"       value={stats.company}  gradient="from-purple-50 to-pink-50"   borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        {/* Table */}
        <ReusableTable<Customer>
          data={customers}
          columns={columns}
          loading={loading}
          onRowClick={(row) => navigate(`/crm-view/customers/${row.id}`, { state: { from: "customers" } })}
          searchable
          searchPlaceholder="Search by name, industry, email, or phone..."
          searchFields={["name", "industry", "email", "phone"]}
          pageSize={10}
          defaultSortKey="name"
          toolbar={
            <div className="flex gap-2">
              <select onChange={e => {}} defaultValue=""
                className="px-3 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select onChange={e => {}} defaultValue=""
                className="px-3 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
                <option value="">All Types</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="COMPANY">Company</option>
              </select>
            </div>
          }
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No customers found</p>
              <button onClick={() => openCustomerModal()} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first customer →
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
        innerText="Delete Customer"
        subText={`Are you sure you want to delete ${selectedCustomer?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-5xl mx-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">
                {isEditingCustomer ? "Edit Customer" : "Add New Customer"}
              </h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-500 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmitCustomer} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left */}
                <div className="space-y-4">
                  {[
                    { label: "Company Name", name: "name", type: "text", placeholder: "Enter company name", required: true },
                    { label: "Industry", name: "industry", type: "text", placeholder: "Healthcare, IT...", required: true },
                    { label: "Website", name: "website", type: "url", placeholder: "www.company.com", required: true },
                    { label: "Email", name: "email", type: "email", placeholder: "contact@company.com", required: true },
                    { label: "Phone", name: "phone", type: "tel", placeholder: "+1-555-123-4567", required: true },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                      <input type={f.type} name={f.name} value={customerForm[f.name] || ""} onChange={handleCustomerChange}
                        placeholder={f.placeholder} required={f.required}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customer Type <span className="text-red-500">*</span></label>
                    <select name="customerType" value={customerForm.customerType || "INDIVIDUAL"} onChange={handleCustomerChange} required
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500">
                      <option value="INDIVIDUAL">Individual</option>
                      <option value="COMPANY">Company</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status <span className="text-red-500">*</span></label>
                    <select name="status" value={customerForm.status || "ACTIVE"} onChange={handleCustomerChange} required
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500">
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>
                {/* Right */}
                <div className="space-y-4">
                  <div className="bg-cyan-50 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-cyan-800 mb-3 flex items-center gap-2">
                      <MapPinIcon className="h-4 w-4" />Address Information
                    </h4>
                    <div className="space-y-3">
                      {[
                        { label: "Street", name: "address.street", placeholder: "123 Maple Street" },
                        { label: "City",   name: "address.city",   placeholder: "Springfield" },
                        { label: "State",  name: "address.state",  placeholder: "Illinois" },
                        { label: "Postal Code", name: "address.postalCode", placeholder: "62704" },
                        { label: "Country", name: "address.country", placeholder: "USA" },
                      ].map(f => (
                        <div key={f.name}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} <span className="text-red-500">*</span></label>
                          <input name={f.name} value={f.name.startsWith("address.") ? customerForm.address?.[f.name.split(".")[1]] || "" : customerForm[f.name] || ""}
                            onChange={handleCustomerChange} placeholder={f.placeholder} required
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <CurrencyDollarIcon className="h-4 w-4" />Credit Limit
                      </label>
                      <input type="number" step="0.01" name="creditLimit" value={customerForm.creditLimit || 0} onChange={handleCustomerChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" placeholder="10000.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Outstanding Balance</label>
                      <input type="number" step="0.01" name="outstandingBalance" value={customerForm.outstandingBalance || 0} onChange={handleCustomerChange}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" placeholder="1250.75" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <DocumentTextIcon className="h-4 w-4" />Remarks
                    </label>
                    <textarea name="remarks" value={customerForm.remarks || ""} onChange={handleCustomerChange} rows={3} placeholder="Additional notes..."
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors">
                  {isEditingCustomer ? "Update Customer" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Communication Modal */}
      {showCommModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Add Communication</h3>
              <button onClick={() => setShowCommModal(false)} className="text-gray-400 hover:text-gray-500 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleSubmitComm} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">For <span className="font-semibold text-cyan-600">{selectedCustomer.name}</span></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact <span className="text-red-500">*</span></label>
                <select name="contactId" value={form.contactId} onChange={handleChange} required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500">
                  <option value="">Select Contact</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes <span className="text-red-500">*</span></label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} required placeholder="Enter communication details..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCommModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors">Save Communication</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Segment Modal */}
      {showSegmentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-900">Assign to Segment</h3>
              <button onClick={() => setShowSegmentModal(false)} className="text-gray-400 hover:text-gray-500 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedSegmentId) { ToasterService.warning("Please select a segment!"); return; }
              try {
                await axios.post(`/v1/api/crm/segments/${selectedSegmentId}/assign/${selectedCustomer.id}`);
                ToasterService.success("Segment assigned successfully!");
                setShowSegmentModal(false);
                fetchCustomers();
              } catch { ToasterService.error("Failed to assign segment!"); }
            }} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">For <span className="font-semibold text-cyan-600">{selectedCustomer.name}</span></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Segment <span className="text-red-500">*</span></label>
                <select value={selectedSegmentId} onChange={e => setSelectedSegmentId(e.target.value)} required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500">
                  <option value="">Choose a segment...</option>
                  {segmentsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowSegmentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors">Assign Segment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SalesCustomer;
import React, { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  UserPlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useLocation, Link } from "react-router-dom";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

const ADD_DRAFT_STORAGE_KEY = "contactPerson:addDraft";
const EDIT_DRAFT_STORAGE_KEY = "contactPerson:editDraft";

type ContactDraft = {
  modalOpen: boolean;
  data: {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    customerId: string;
  };
};

type EditContactDraft = {
  modalOpen: boolean;
  data: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    customerId: string;
  };
};

interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
enum Role {
  DECISION_MAKER = "DECISION_MAKER",
  INFLUENCER = "INFLUENCER",
}

interface Customer {
  id: number;
  companyName?: string;
  customerName?: string;
  tradeName?: string;
  industry?: string;
  email: string;
  phone: string;
  website: string;
  status: string;
  address?: Address;
  name?: string;
  contacts?: Contact[];
}

interface Contact {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  designation?: string;
  role?: string;
  customer?: Customer | null;
}

const API_URL = "/v1/api/crm/contacts";
const CUSTOMER_API_URL = "/v1/api/crm/customers";
const PAGE_SIZE = 10;

const safeText = (value?: string | null) => value?.trim() || "";

const getCustomerDisplayName = (customer?: Customer | null) =>
  customer?.customerName || customer?.companyName || customer?.name || customer?.tradeName || "Unnamed Customer";

const mapContactsFromCustomers = (customerList: Customer[]): Contact[] =>
  customerList.flatMap((customer) =>
    (customer.contacts ?? []).map((contact) => ({
      ...contact,
      fullName: safeText(contact.fullName) || "Unnamed Contact",
      email: safeText(contact.email),
      phone: safeText(contact.phone),
      customer,
    }))
  );

const KeyContacts: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [showDeletePopup, setShowDeletePopup] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeContactId, setActiveContactIdState] = useState<number | null>(null);

  // Add Contact Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "",
    customerId: "",
  });

  // Edit Contact Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const location = useLocation();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showAssignModal || showDeletePopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAddModal, showEditModal, showAssignModal, showDeletePopup]);

  useEffect(() => {
    fetchCustomers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const savedAddDraft = localStorage.getItem(ADD_DRAFT_STORAGE_KEY);
    if (savedAddDraft) {
      try {
        const parsedDraft: ContactDraft = JSON.parse(savedAddDraft);
        setNewContact(parsedDraft.data);
        if (parsedDraft.modalOpen) {
          setShowAddModal(true);
        }
      } catch (error) {
        console.error("Error restoring add contact draft", error);
      }
    }
  }, []);

  // Handle deep-linked edit modal
  useEffect(() => {
    if (contacts.length > 0) {
      const savedEditDraft = localStorage.getItem(EDIT_DRAFT_STORAGE_KEY);
      if (savedEditDraft) {
        try {
          const parsedDraft: EditContactDraft = JSON.parse(savedEditDraft);
          const matchedContact = contacts.find((contact) => contact.id === parsedDraft.data.id);

          setEditContact({
            ...(matchedContact || { id: parsedDraft.data.id, designation: "", customer: null }),
            fullName: parsedDraft.data.fullName,
            email: parsedDraft.data.email,
            phone: parsedDraft.data.phone,
            role: parsedDraft.data.role,
            customer: parsedDraft.data.customerId
              ? ({
                  ...(matchedContact?.customer || {}),
                  id: Number(parsedDraft.data.customerId),
                } as Customer)
              : null,
          });

          if (parsedDraft.modalOpen) {
            setShowEditModal(true);
          }
          return;
        } catch (error) {
          console.error("Error restoring edit contact draft", error);
        }
      }

      const searchParams = new URLSearchParams(location.search);
      const editId = searchParams.get("editId");
      if (editId) {
        const contactToEdit = contacts.find((c) => c.id === Number(editId));
        if (contactToEdit) {
          setEditContact(contactToEdit);
          setShowEditModal(true);
        }
      }
    }
  }, [contacts, location.search]);

  useEffect(() => {
    if (showAssignModal || showAddModal || showEditModal) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAssignModal, showAddModal, showEditModal]);

  useEffect(() => {
    localStorage.setItem(
      ADD_DRAFT_STORAGE_KEY,
      JSON.stringify({
        modalOpen: showAddModal,
        data: newContact,
      } satisfies ContactDraft)
    );
  }, [newContact, showAddModal]);

  useEffect(() => {
    if (!editContact) {
      localStorage.removeItem(EDIT_DRAFT_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      EDIT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        modalOpen: showEditModal,
        data: {
          id: editContact.id,
          fullName: editContact.fullName,
          email: editContact.email,
          phone: editContact.phone,
          role: editContact.role || "",
          customerId: editContact.customer?.id ? String(editContact.customer.id) : "",
        },
      } satisfies EditContactDraft)
    );
  }, [editContact, showEditModal]);

  const fetchContacts = async () => {
    try {
      const res = await axios.get<Contact[]>(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contactData = Array.isArray(res.data) ? res.data : [];
      setContacts(
        contactData.map((contact) => ({
          ...contact,
          fullName: safeText(contact.fullName) || "Unnamed Contact",
          email: safeText(contact.email),
          phone: safeText(contact.phone),
        }))
      );
    } catch (err) {
      console.error("Error fetching contacts", err);
    }
  };

  const fetchCustomers = async (showFeedback = false) => {
    setLoading(true);
    try {
      const res = await axios.get<Customer[]>(CUSTOMER_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const customerData = Array.isArray(res.data) ? res.data : [];
      setCustomers(customerData);
      const mappedContacts = mapContactsFromCustomers(customerData);
      setContacts(mappedContacts);

      if (showFeedback && mappedContacts.length === 0) {
        ToasterService.noData(
          "No contact data found",
          "The API responded successfully, but there are no contact persons to display yet."
        );
      }
    } catch (err) {
      console.error("Error fetching customers", err);
      if (showFeedback) {
        ToasterService.error("Failed to load contact data");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const found = contacts.find((c) => c.id === id) || null;
    setContactToDelete(found);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    try {
      await axios.delete(`${API_URL}/${contactToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowDeletePopup(false);
      setContactToDelete(null);
      fetchCustomers();
      ToasterService.success("Contact deleted successfully!");
    } catch (err) {
      console.error("Error deleting contact", err);
      ToasterService.error("Failed to delete contact");
    }
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch = [c.fullName, c.email, c.phone]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(search.toLowerCase()));

    let matchesFilter = true;
    if (activeFilter === "DECISION_MAKER") {
      matchesFilter = c.role === Role.DECISION_MAKER;
    } else if (activeFilter === "INFLUENCER") {
      matchesFilter = c.role === Role.INFLUENCER;
    } else if (activeFilter === "WITH_CUSTOMER") {
      matchesFilter = !!c.customer;
    }

    return matchesSearch && matchesFilter;
  });

  // Add Contact Submit
  const handleAddContact = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        fullName: newContact.fullName,
        email: newContact.email,
        phone: newContact.phone,
        role: newContact.role,
        customer: newContact.customerId
          ? { id: Number(newContact.customerId) }
          : null,
      };

      const res = await axios.post(
        `${API_URL}/customer/${newContact.customerId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 200 || res.status === 201) {
        ToasterService.success("Contact added successfully!");
        setShowAddModal(false);
        setNewContact({
          fullName: "",
          email: "",
          phone: "",
          role: "",
          customerId: "",
        });
        localStorage.removeItem(ADD_DRAFT_STORAGE_KEY);
        fetchCustomers();
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      console.error("Error adding contact:", err);
      ToasterService.error(err.response?.data?.message || "Failed to add contact.");
    }
  };

  // Handle Edit Contact
  const handleEditContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!editContact) return;

    try {
      const payload = {
        fullName: editContact.fullName,
        email: editContact.email,
        phone: editContact.phone,
        role: editContact.role,
        customer: editContact.customer?.id
          ? { id: editContact.customer.id }
          : null,
      };

      const res = await axios.put(`${API_URL}/${editContact.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 200) {
        ToasterService.success("Contact updated successfully!");
        setShowEditModal(false);
        setEditContact(null);
        localStorage.removeItem(EDIT_DRAFT_STORAGE_KEY);
        fetchCustomers();
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      console.error("Error updating contact:", err);
      ToasterService.error(err.response?.data?.message || "Failed to update contact.");
    }
  };

  // Handle Assign Customer
  const handleAssignCustomer = async (contactId: number, customerId: number) => {
    try {
      await axios.post(
        `/v1/api/crm/contacts/${contactId}/assign/${customerId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      ToasterService.success("Customer assigned successfully!");
      setShowAssignModal(false);
      fetchCustomers();
    } catch (err) {
      console.error("Error assigning customer:", err);
      ToasterService.error("Failed to assign customer");
    }
  };

  function setActiveContactId(id: number) {
    setActiveContactIdState(id);
  }

  // Handle row click navigation (for viewing contact details)
  const handleRowClick = (contact: Contact) => {
    navigate(`/crm-view/contacts/${contact.id}`, { state: { from: "contacts" } });
  };

  // Stats
  const totalContacts = contacts.length;
  const withCustomers = contacts.filter((c) => c.customer).length;
  const decisionMakers = contacts.filter((c) => c.role === Role.DECISION_MAKER).length;
  const influencers = contacts.filter((c) => c.role === Role.INFLUENCER).length;

  const tableColumns: ColumnDef<Contact>[] = [
    {
      key: "fullName",
      label: "Contact Name",
      sortable: true,
      headerClassName: "w-[23%] text-left",
      className: "w-[23%]",
      render: (contact) => (
        <div className="flex min-w-0 items-center">
          <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100">
            <span className="text-sm font-medium text-cyan-700">
              {contact.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="max-w-[120px] truncate text-sm font-medium text-gray-900 sm:max-w-[150px]" title={contact.fullName}>
              {contact.fullName}
            </div>
            {contact.designation && (
              <div className="mt-0.5 max-w-[120px] truncate text-xs text-gray-500 sm:max-w-[150px]" title={contact.designation}>
                {contact.designation}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      headerClassName: "w-[21%] text-left",
      className: "w-[21%]",
      render: (contact) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm text-gray-600">
            <EnvelopeIcon className="h-3 w-3 mr-1 text-gray-400 shrink-0" />
            <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()} className="max-w-[120px] truncate hover:text-cyan-600 sm:max-w-[150px]" title={contact.email}>
              {contact.email || "-"}
            </a>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (contact) => (
        <div className="flex min-w-0 items-center text-sm text-gray-600">
          <PhoneIcon className="h-3 w-3 mr-1 shrink-0 text-gray-400" />
          <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()} className="max-w-[105px] truncate hover:text-gray-900" title={contact.phone}>
            {contact.phone || "—"}
          </a>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      headerClassName: "w-[16%]",
      className: "w-[16%]",
      render: (contact) =>
        contact.role ? (
          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap rounded-full border ${contact.role === Role.DECISION_MAKER ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
            {contact.role.replace("_", " ")}
          </span>
      ) : (
  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-gray-200 bg-gray-50 text-gray-500">
    No role
  </span>
)
    },
    {
      key: "customer",
      label: "Company",
      headerClassName: "w-[15%]",
      className: "w-[15%]",
      render: (contact) =>
        contact.customer ? (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-gray-700">
            <BuildingOfficeIcon className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="max-w-[90px] truncate" title={getCustomerDisplayName(contact.customer)}>
              {getCustomerDisplayName(contact.customer)}
            </span>
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">No company</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "w-[10%] !text-right pr-3",
      className: "w-[10%] text-right",
      render: (contact) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setEditContact(contact);
              setShowEditModal(true);
            }}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            title="Edit Contact"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>

          {!contact.customer ? (
            <button
              type="button"
              onClick={() => {
                setActiveContactId(contact.id);
                setShowAssignModal(true);
              }}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="Add Customer"
            >
              <UserPlusIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/customer-management/${contact.customer?.id}`)}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title="View Customer"
            >
              <UsersIcon className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDelete(contact.id)}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete Contact"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Contact Persons" description="Manage your contact persons" />
      <PageBreadcrumb pageTitle="Contact Persons" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => setShowAddModal(true)} label="Add Contact Person" />
        </div>
        <div className=" grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Contacts"
            value={totalContacts}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="With Customers"
            value={withCustomers}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Decision Makers"
            value={decisionMakers}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Influencers"
            value={influencers}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        {/* Toolbar */}
        <div className=" flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="mb-1 w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="-mb-1 my-2 flex w-full items-center justify-end gap-3 sm:w-auto">
            <FilterPopover
              title="Filter Contacts"
              buttonLabel="Filters"
              label="Filter by Role"
              value={activeFilter}
              options={[
                { label: "All Contacts", value: "ALL" },
                { label: "Linked to Customer", value: "WITH_CUSTOMER" },
                { label: "Decision Makers", value: "DECISION_MAKER" },
                { label: "Influencers", value: "INFLUENCER" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-visible shadow-sm">
            <ReusableTable<Contact>
              data={filtered}
              columns={tableColumns}
              searchable={false}
              loading={loading}
              pageSize={PAGE_SIZE}
              defaultSortKey="fullName"
              defaultSortOrder="asc"
              onRowClick={handleRowClick}
              emptyState={
                <div className="flex flex-col items-center justify-center">
                  <UserGroupIcon className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-500 text-sm mb-2">No contacts found</p>
                  {search || activeFilter !== "ALL" ? (
                    <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="mt-2 text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                    >
                      Add your first contact
                    </button>
                  )}
                </div>
              }
            />
        </div>

        {/* Add Contact Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-y-auto max-h-[90vh]">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Add Contact Person
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Add a new contact to your network
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleAddContact} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="col-span-1 sm:col-span-1">
                    <FloatingInput
                      label="Full Name"
                      name="fullName"
                      value={newContact.fullName}
                      onChange={(e) => setNewContact({ ...newContact, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1">
                    <FloatingInput
                      label="Email"
                      name="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1">
                    <FloatingInput
                      label="Phone"
                      name="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1">
                    <FloatingSelect
                      label="Role"
                      name="role"
                      value={newContact.role}
                      onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                      options={Object.values(Role).map(r => ({ id: r, name: r.replace("_", " ") }))}
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <FloatingSelect
                      label="Company (Optional)"
                      name="customerId"
                      value={newContact.customerId}
                      onChange={(e) => setNewContact({ ...newContact, customerId: e.target.value })}
                      options={customers.map(cust => ({ id: cust.id, name: getCustomerDisplayName(cust) }))}
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 mt-4 flex flex-col justify-end gap-3 border-t border-gray-100 bg-white pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Add Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Contact Modal */}
        {showEditModal && editContact && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-auto overflow-y-auto max-h-[90vh]">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Edit Contact
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Update contact information
                  </p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleEditContact} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="col-span-1 sm:col-span-1">
                    <FloatingInput
                      label="Full Name"
                      name="fullName"
                      value={editContact.fullName}
                      onChange={(e) => setEditContact({ ...editContact, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1">
                    <FloatingInput
                      label="Email"
                      name="email"
                      value={editContact.email}
                      onChange={(e) => setEditContact({ ...editContact, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1">
                    <FloatingInput
                      label="Phone"
                      name="phone"
                      value={editContact.phone}
                      onChange={(e) => setEditContact({ ...editContact, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-1">
                    <FloatingSelect
                      label="Role"
                      name="role"
                      value={editContact.role || ""}
                      onChange={(e) => setEditContact({ ...editContact, role: e.target.value })}
                      options={Object.values(Role).map(r => ({ id: r, name: r.replace("_", " ") }))}
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2">
                    <FloatingSelect
                      label="Company"
                      name="customerId"
                      value={editContact.customer?.id || ""}
                      onChange={(e) =>
                        setEditContact({
                          ...editContact,
                          customer: e.target.value ? { id: Number(e.target.value) } as Customer : null,
                        })
                      }
                      options={customers.map(cust => ({ id: cust.id, name: getCustomerDisplayName(cust) }))}
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 mt-4 flex flex-col justify-end gap-3 border-t border-gray-100 bg-white pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Update Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Customer Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Assign Customer
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Link a customer to this contact
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-600 mb-6">
                  Select a customer from the list to assign to this contact.
                </p>

                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl mb-4">
                  {customers.length > 0 ? (
                    customers.map((cust) => (
                      <button
                        key={cust.id}
                        onClick={() => {
                          if (activeContactId) {
                            handleAssignCustomer(activeContactId, cust.id);
                          }
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 border-gray-100 transition-colors flex items-center gap-3"
                      >
                        <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <BuildingOfficeIcon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{getCustomerDisplayName(cust)}</p>
                          <p className="text-xs text-gray-500">{cust.industry}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-500">No customers available</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Contact?"
          subText={
            contactToDelete
              ? `Are you sure you want to delete ${contactToDelete.fullName}? This action cannot be undone.`
              : "Are you sure you want to delete this contact?"
          }
          confirmLabel="Delete Contact"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setContactToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default KeyContacts;

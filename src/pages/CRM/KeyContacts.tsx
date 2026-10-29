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
import PaginatedPopup from "../../components/common/unpopup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { CONTACT_ROLE_OPTIONS, apiError } from "./crmShared";
import { usePermissions } from "../../access/usePermissions";

import { t } from "../../i18n/i18n";
const roleLabel = (role?: string) => t(String(CONTACT_ROLE_OPTIONS.find((o) => o.id === role)?.name ?? role ?? ""));

const ADD_DRAFT_STORAGE_KEY = "contactPerson:addDraft";
const EDIT_DRAFT_STORAGE_KEY = "contactPerson:editDraft";

type ContactDraft = {
  modalOpen: boolean;
  data: {
    fullName: string;
    email: string;
    phone: string;
    designation?: string;
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
  BUYER = "BUYER",
  USER = "USER",
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
const CUSTOMER_API_URL = "/v1/api/common/customers";
const PAGE_SIZE = 10;


const safeText = (value?: string | null) => value?.trim() || "";

const getCustomerDisplayName = (customer?: Customer | null) =>
  customer?.customerName || customer?.companyName || customer?.name || customer?.tradeName || "Unnamed Customer";

const KeyContacts: React.FC = () => {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = usePermissions();
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
    designation: "",
    role: "",
    customerId: "",
  });

  // Edit Contact Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const location = useLocation();
  // Opened from a customer's page: only that customer's contacts
  const scopedCustomerId = Number(new URLSearchParams(location.search).get("customerId")) || null;

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
        setNewContact({ ...parsedDraft.data, designation: parsedDraft.data.designation ?? "" });
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
          // Open once: otherwise the form reopens every time the list reloads (e.g. after saving)
          searchParams.delete("editId");
          navigate({ search: searchParams.toString() }, { replace: true });
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
      // Customers come from the common service without contacts; CRM lists the contacts with their company
      const contactRes = await axios.get<Contact[]>(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mappedContacts = (Array.isArray(contactRes.data) ? contactRes.data : []).map((contact) => ({
        ...contact,
        fullName: safeText(contact.fullName) || "Unnamed Contact",
        email: safeText(contact.email),
        phone: safeText(contact.phone),
      }));
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
      ToasterService.error(apiError(err, "Failed to delete contact"));
      setShowDeletePopup(false);
      setContactToDelete(null);
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
    const matchesScope = !scopedCustomerId || c.customer?.id === scopedCustomerId;

    return matchesSearch && matchesFilter && matchesScope;
  });
  const scopedCustomer = scopedCustomerId ? customers.find((c) => c.id === scopedCustomerId) : undefined;

  // Add Contact Submit
const handleAddContact = async (e: FormEvent) => {
  e.preventDefault();
   if (!newContact.fullName.trim()) {
    ToasterService.error("Full name is required");
    return;
  }
  // A contact always belongs to a company
  if (!newContact.customerId) {
    ToasterService.error("Choose the company this contact works for");
    return;
  }
  try {
     setIsSaving(true);
     const payload = {
      fullName: newContact.fullName,
      email: newContact.email,
      phone: newContact.phone,
      designation: newContact.designation || null,
      role: newContact.role || null,
    };

    const res = await axios.post(`${API_URL}/customer/${newContact.customerId}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 200 || res.status === 201) {
      ToasterService.success("Contact added successfully!");
      setShowAddModal(false);
      setNewContact({
        fullName: "",
        email: "",
        phone: "",
        designation: "",
        role: "",
        customerId: "",
      });
      localStorage.removeItem(ADD_DRAFT_STORAGE_KEY);
      fetchCustomers();
    }
  } catch (error) {
    console.error("Error adding contact:", error);
    ToasterService.error(apiError(error, "Failed to add contact."));
  }
   finally {
    setIsSaving(false);
  }
};

 // Handle Edit Contact
// Handle Edit Contact
const handleEditContact = async (e: FormEvent) => {
  e.preventDefault();
  if (!editContact) return;

  const original = contacts.find((c) => c.id === editContact.id);
  const originalCustomerId = original?.customer?.id ?? null;
  const newCustomerId = editContact.customer?.id ?? null;
  const companyChanged = newCustomerId !== originalCustomerId;

  try {
    setIsSaving(true);
    if (companyChanged && newCustomerId) {
      try {
        await axios.post(
          `/v1/api/crm/contacts/${editContact.id}/assign/${newCustomerId}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (assignError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = assignError as any;
        console.error("ASSIGN STEP FAILED:", {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
        });
        ToasterService.error(
          err.response?.data?.message ||
            `Failed to assign company (HTTP ${err.response?.status ?? "?"})`
        );
        return; // stop — don't bother with the PUT if assign failed
      }
       finally {
    setIsSaving(false);    
  }
    };

    // Step 2: scalar fields (the service replaces all of them, so send the designation too)
    const payload = {
      fullName: editContact.fullName,
      email: editContact.email,
      phone: editContact.phone,
      designation: editContact.designation || null,
      role: editContact.role || null,
    };

    try {
      await axios.put(`${API_URL}/${editContact.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (putError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = putError as any;
      console.error("PUT STEP FAILED:", {
        status: err.response?.status,
        data: err.response?.data,
        url: err.config?.url,
      });
      ToasterService.error(
        err.response?.data?.message ||
          `Failed to update contact (HTTP ${err.response?.status ?? "?"})`
      );
      return;
    }

    ToasterService.success("Contact updated successfully!");
    setShowEditModal(false);
    setEditContact(null);
    localStorage.removeItem(EDIT_DRAFT_STORAGE_KEY);
    fetchCustomers();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    console.error("Unexpected error updating contact:", err);
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
      ToasterService.error(apiError(err, "Failed to assign customer"));
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
            {roleLabel(contact.role)}
          </span>
      ) : (
  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border border-gray-200 bg-gray-50 text-gray-500">
    {t("No role")}
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
          <span className="text-xs text-gray-400 italic">{t("No company")}</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "w-[10%] !text-right pr-3",
      className: "w-[10%] text-right",
      render: (contact) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canUpdate && (
            <button
              type="button"
              onClick={() => {
                setEditContact(contact);
                setShowEditModal(true);
              }}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
              title={t("Edit Contact")}
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}

          {!contact.customer ? (
            canCreate && <button
              type="button"
              onClick={() => {
                setActiveContactId(contact.id);
                setShowAssignModal(true);
              }}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title={t("Add Customer")}
            >
              <UserPlusIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/crm-view/customers/${contact.customer?.id}`, { state: { from: "contacts" } })}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
              title={t("View Customer")}
            >
              <UsersIcon className="h-4 w-4" />
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => handleDelete(contact.id)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title={t("Delete Contact")}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Contact Persons")} description="Manage your contact persons" />
      <PageBreadcrumb
        pageTitle="Contact Persons"
        actions={
          <AddButton
            onClick={() => {
              // From a customer's page, the new contact is for that customer
              if (scopedCustomerId) setNewContact((c) => ({ ...c, customerId: String(scopedCustomerId) }));
              setShowAddModal(true);
            }}
            label={t("Add Contact Person")}
          />
        }
      />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-4">
        {scopedCustomerId && (
          <div className="mb-4 mx-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <span>{t("Showing contacts of")} <strong>{getCustomerDisplayName(scopedCustomer)}</strong></span>
            <button type="button" onClick={() => navigate("/contactPerson")} className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline">
              {t("View all contacts")}
            </button>
          </div>
        )}
        <div className="py-4 px-3">
        <div className=" grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-[17px]">
          <StatsCard
            label={t("Total Contacts")}
            value={totalContacts}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label={t("With Customers")}
            value={withCustomers}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label={t("Decision Makers")}
            value={decisionMakers}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label={t("Influencers")}
            value={influencers}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
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
              enableRowDetails={true}
               rowDetailsTitle={(row: any) =>
               row.fullName || row.name || `Contact #${row.id}`
                 }
             rowDetailsSubtitle={t("Contact details")}
             hiddenDetailKeys={[
               "id",
               "tenantId",
              "createdBy",
                       "updatedBy",
                     "deletedBy",
                     "createdAt",
                    "updatedAt",
                    "deletedAt",
  ]}
              // onRowClick={handleRowClick}
              emptyState={
                <div className="flex flex-col items-center justify-center">
                  <UserGroupIcon className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-500 text-sm mb-2">{t("No contacts found")}</p>
                  {search || activeFilter !== "ALL" ? (
                    <p className="text-gray-400 text-xs">{t("Try adjusting your search or filters")}</p>
                  ) : canCreate && (
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="mt-2 text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                    >
                      {t("Add your first contact")}
                    </button>
                  )}
                </div>
              }
            />
        </div>
        </div>
     {/* Add / Edit Contact (PaginatedPopup) */}
<PaginatedPopup
  isOpen={showAddModal || (showEditModal && !!editContact)}
  title={t(showEditModal ? "Edit Contact" : "Add Contact Person")}
  subtitle={t(
    showEditModal
      ? "Update contact information"
      : "Add a new contact to your network"
  )}
  onClose={() => {
    if (showEditModal) {
      setShowEditModal(false);
      setEditContact(null);
    } else {
      setShowAddModal(false);
    }
  }}
  onSubmit={showEditModal ? handleEditContact : handleAddContact}
  submitLabel={t(showEditModal ? "Update Contact" : "Add Contact")}
  submitting={isSaving}
  fields={
    showEditModal && editContact
      ? [
          // ---- EDIT FIELDS ----
          <FloatingInput
            key="fullName"
            label={t("Full Name")}
            name="fullName"
            value={editContact.fullName}
            onChange={(e) =>
              setEditContact({ ...editContact, fullName: e.target.value })
            }
            required
          />,
          <FloatingInput
            key="email"
            label={t("Email")}
            name="email"
            value={editContact.email}
            onChange={(e) =>
              setEditContact({ ...editContact, email: e.target.value })
            }
            required
          />,
          <FloatingInput
            key="phone"
            label={t("Phone")}
            name="phone"
            value={editContact.phone}
            onChange={(e) =>
              setEditContact({ ...editContact, phone: e.target.value })
            }
            required
          />,
          <FloatingInput
            key="designation"
            label={t("Designation")}
            name="designation"
            value={editContact.designation || ""}
            onChange={(e) =>
              setEditContact({ ...editContact, designation: e.target.value })
            }
          />,
          <FloatingSelect
            key="role"
            label={t("Role")}
            name="role"
            value={editContact.role || ""}
            onChange={(e) =>
              setEditContact({ ...editContact, role: e.target.value })
            }
            options={CONTACT_ROLE_OPTIONS}
          />,
          <div key="customer" className="md:col-span-2">
            <FloatingSelect
              label={t("Company")}
              name="customerId"
              value={editContact.customer?.id || ""}
              onChange={(e) => {
                if (!e.target.value) return;
                setEditContact({
                  ...editContact,
                  customer: { id: Number(e.target.value) } as Customer,
                });
              }}
              options={customers.map((cust) => ({
                id: cust.id,
                name: getCustomerDisplayName(cust),
              }))}
            />
          </div>,
        ]
      : [
          // ---- ADD FIELDS ----
          <FloatingInput
            key="fullName"
            label={t("Full Name")}
            name="fullName"
            value={newContact.fullName}
            onChange={(e) =>
              setNewContact({ ...newContact, fullName: e.target.value })
            }
            required
          />,
          <FloatingInput
            key="email"
            label={t("Email")}
            name="email"
            value={newContact.email}
            onChange={(e) =>
              setNewContact({ ...newContact, email: e.target.value })
            }
            required
          />,
          <FloatingInput
            key="phone"
            label={t("Phone")}
            name="phone"
            value={newContact.phone}
            onChange={(e) =>
              setNewContact({ ...newContact, phone: e.target.value })
            }
            required
          />,
          <FloatingInput
            key="designation"
            label={t("Designation")}
            name="designation"
            value={newContact.designation}
            onChange={(e) =>
              setNewContact({ ...newContact, designation: e.target.value })
            }
          />,
          <FloatingSelect
            key="role"
            label={t("Role")}
            name="role"
            value={newContact.role}
            onChange={(e) =>
              setNewContact({ ...newContact, role: e.target.value })
            }
            options={CONTACT_ROLE_OPTIONS}
          />,
          <div key="customerId" className="md:col-span-2">
            <FloatingSelect
              label={t("Company")}
              required
              name="customerId"
              value={newContact.customerId}
              onChange={(e) =>
                setNewContact({ ...newContact, customerId: e.target.value })
              }
              options={customers.map((cust) => ({
                id: cust.id,
                name: getCustomerDisplayName(cust),
              }))}
            />
          </div>,
        ]
  }
/>

        {/* Assign Customer Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {t("Assign Customer")}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {t("Link a customer to this contact")}
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
                  {t("Select a customer from the list to assign to this contact.")}
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
                      <p className="text-sm text-gray-500">{t("No customers available")}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    {t("Close")}
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
          innerText={t("Delete Contact?")}
          subText={
            contactToDelete
              ? `Are you sure you want to delete ${contactToDelete.fullName}? This action cannot be undone.`
              : "Are you sure you want to delete this contact?"
          }
          confirmLabel={t("Delete Contact")}
          cancelLabel={t("Cancel")}
          onConfirm={confirmDelete}
          onCancel={() => setContactToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default KeyContacts;

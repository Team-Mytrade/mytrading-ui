import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { UserEmployee, Role, Domain } from "./RoleConfigTypes";
import { StatusBadge, Toggle } from "./RoleConfigShared";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const EMPLOYEE_API_BASE = "/v1/api/user";
const ROLE_API_BASE = "/v1/api/user/roles";
const DOMAIN_API_BASE = "/v1/api/user/domains";
const DEPARTMENT_API_BASE = "/v1/api/user/departments";
const TENANT_API_BASE = "/v1/api/user/tenants";

// Types for dropdown data
interface Tenant {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantCode?: string;
}

interface Department {
  id: number;
  departmentName: string;
  departmentCode: string;
  domainId?: number;
}

const UserEmployeeTab: React.FC = () => {
  const { user } = useContext(AuthContext);
  const tenantId = user?.tenantId;

  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  const [showPassword, setShowPassword] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredDomains, setFilteredDomains] = useState<Domain[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);

  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem("accessToken");

  const getHeaders = () => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const ensureToken = () => !!getToken();

  const fetchTenants = async () => {
    if (!ensureToken()) return;
    setLoadingTenants(true);

    try {
      const response = await fetch(TENANT_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        console.error("Fetch tenants error");
        setTenants([]);
        return;
      }

      const data = await response.json();
      const tenantsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setTenants(tenantsList);

      if (tenantId && tenantsList.length > 0) {
        const userTenant = tenantsList.find((t: any) => t.tenantId === tenantId);
        if (userTenant && !form.tenantId) {
          handleTenantChange(userTenant.tenantId);
        }
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
      setTenants([]);
    } finally {
      setLoadingTenants(false);
    }
  };

  const fetchDomains = async () => {
    if (!ensureToken()) return;
    setLoadingDomains(true);

    try {
      const response = await fetch(DOMAIN_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        console.error("Fetch domains error");
        setDomains([]);
        return;
      }

      const data = await response.json();
      const domainsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setDomains(domainsList);
    } catch (error) {
      console.error("Error fetching domains:", error);
      setDomains([]);
    } finally {
      setLoadingDomains(false);
    }
  };

  const fetchDepartments = async () => {
    if (!ensureToken()) return;
    setLoadingDepartments(true);

    try {
      const response = await fetch(DEPARTMENT_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        console.error("Fetch departments error");
        setDepartments([]);
        return;
      }

      const data = await response.json();
      const departmentsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setDepartments(departmentsList);
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleTenantChange = (selectedTenantId: string) => {
    const selectedTenant = tenants.find(t => t.tenantId === selectedTenantId);
    setForm({
      ...form,
      tenantId: selectedTenantId,
      tenantCode: selectedTenant?.tenantCode || selectedTenant?.tenantId,
      domainId: "",
      departmentId: ""
    });

    const filtered = domains.filter(domain =>
      (domain as any).tenantId === selectedTenantId || !(domain as any).tenantId
    );
    setFilteredDomains(filtered);
    setFilteredDepartments([]);
  };

  const handleDomainChange = (selectedDomainId: number) => {
    setForm({
      ...form,
      domainId: selectedDomainId,
      departmentId: ""
    });

    const filtered = departments.filter(dept => dept.domainId === selectedDomainId);
    setFilteredDepartments(filtered);
  };

  const handleDepartmentChange = (selectedDepartmentId: number) => {
    setForm({ ...form, departmentId: selectedDepartmentId });
  };

  const fetchData = async () => {
    if (!ensureToken()) return;
    setLoading(true);

    try {
      const response = await fetch(`${EMPLOYEE_API_BASE}/getAll`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) {
        console.error("Fetch users error");
        setUsers([]);
        return;
      }

      const data = await response.json();
      const usersList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTenants();
    fetchDomains();
    fetchDepartments();
  }, [tenantId]);

  const buildPayload = () => {
    const payload: any = {
      username: form.username,
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      tenantId: form.tenantId,
      active: form.active !== false,
      userType: form.userType || "USER",
      userDetails: {
        phoneNumber: form.phoneNumber || "",
        country: form.country || "",
        city: form.city || "",
        address: form.address || "",
        postalCode: form.postalCode || "",
        aboutMe: form.aboutMe || "",
      },
      employee: {
        firstName: form.firstName,
        lastName: form.lastName,
        officialEmail: form.officialEmail || form.email,
        designation: form.designation || "",
        taxId: form.taxId || "",
        panNo: form.panNo || "",
      },
      department: form.departmentId ? { id: Number(form.departmentId) } : null,
      domain: form.domainId ? { id: Number(form.domainId) } : null,
      roleNames: parseRoles(String(form.roleNames ?? ""))
    };

    if (!editingId && form.password) {
      payload.password = form.password;
    } else if (editingId && form.password && form.password.trim() !== "") {
      payload.password = form.password;
    }

    return payload;
  };

  const parseRoles = (value: string): string[] =>
    value.split(",").map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (currentStep < totalSteps) {
      handleNextStep();
      return;
    }

    if (!form.username || !form.email || !form.firstName || !form.lastName) {
      ToasterService.error("Username, email, first name and last name are required");
      return;
    }
    if (!form.tenantId) {
      ToasterService.error("Please select a tenant");
      return;
    }
    if (!form.domainId) {
      ToasterService.error("Please select a domain");
      return;
    }
    if (!form.departmentId) {
      ToasterService.error("Please select a department");
      return;
    }
    if (!editingId && !form.password) {
      ToasterService.error("Password is required for new users");
      return;
    }

    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `${EMPLOYEE_API_BASE}/${editingId}` : EMPLOYEE_API_BASE;
      const method = isEdit ? "PUT" : "POST";
      const payload = buildPayload();

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      ToasterService.success(isEdit ? "User updated successfully!" : "User created successfully!");
      fetchData();
      closeFormModal();
      setForm({});
      setEditingId(null);
      setShowPassword(false);
    } catch (error) {
      console.error("Error:", error);
      ToasterService.error("Failed to save");
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const response = await fetch(`${EMPLOYEE_API_BASE}/${userId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        ToasterService.error("Failed to delete");
        return;
      }

      ToasterService.success("User deleted successfully!");
      fetchData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const handleEdit = (item: any) => {
    setForm({
      username: item.username,
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      tenantId: item.tenantId ?? tenantId ?? "",
      active: item.active ?? true,
      userType: item.userType || "USER",
      roleNames: item.roles?.map((r: any) => r.role?.roleName).filter(Boolean).join(", ") || "",
      password: "",
    });
    setEditingId(item.userId);
    setCurrentStep(1);
    setShowFormModal(true);
    setShowPassword(false);

    if (item.tenantId) {
      handleTenantChange(item.tenantId);
    }
  };

  const getBlankRow = () => ({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
    tenantId: "",
    active: true,
    userType: "USER",
    phoneNumber: "",
    country: "",
    city: "",
    address: "",
    postalCode: "",
    aboutMe: "",
    officialEmail: "",
    designation: "",
    taxId: "",
    panNo: "",
    departmentId: "",
    domainId: "",
    roleNames: "",
  });

  const totalSteps = 6;
  const closeFormModal = () => {
    setShowFormModal(false);
    setCurrentStep(1);
    setShowPassword(false);
  };

  const validateStep = (step: number) => {
    const isEdit = editingId !== null;
    if (step === 1 && (!form.username || !form.email || (!isEdit && !form.password))) {
      ToasterService.error(isEdit ? "Username and email are required" : "Username, password and email are required");
      return false;
    }
    if (step === 2 && (!form.firstName || !form.lastName || !form.userType)) {
      ToasterService.error("First name, last name and user type are required");
      return false;
    }
    if (step === 5) {
      if (!form.tenantId) {
        ToasterService.error("Please select a tenant");
        return false;
      }
      if (!form.domainId) {
        ToasterService.error("Please select a domain");
        return false;
      }
      if (!form.departmentId) {
        ToasterService.error("Please select a department");
        return false;
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((step) => Math.min(totalSteps, step + 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep((step) => Math.max(1, step - 1));
  };

  // Simplified columns - only showing important info
  const columns: ColumnDef<any>[] = [
    {
      key: "username",
      label: "Username",
      sortable: true,
      render: (row: any) => (
        <span className="text-sm font-medium text-gray-900">{row.username}</span>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (row: any) => (
        <span className="text-sm text-gray-600">{row.email}</span>
      ),
    },
    {
      key: "firstName",
      label: "Name",
      sortable: true,
      render: (row: any) => (
        <span className="text-sm text-gray-700">{row.firstName} {row.lastName}</span>
      ),
    },
    {
      key: "userType",
      label: "Type",
      sortable: true,
      render: (row: any) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {row.userType}
        </span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (row: any) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(row.userId)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredData = users.filter((user: any) => {
    const searchLower = search.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower)
    );
  });


  const stepNames = ["Account Info", "Personal Info", "Address", "Additional Info", "Organization", "Roles"];

  const formFields = [
    { key: "username", label: "Username", type: "text", mono: true, required: true, step: 1 },
    { key: "password", label: "Password", type: "password", required: true, step: 1, hasToggle: true },
    { key: "email", label: "Email", type: "email", required: true, step: 1 },
    { key: "firstName", label: "First Name", type: "text", required: true, step: 2 },
    { key: "lastName", label: "Last Name", type: "text", required: true, step: 2 },
    { key: "userType", label: "User Type", type: "select", options: ["SUPER_ADMIN", "ADMIN", "USER"], required: true, step: 2 },
    { key: "phoneNumber", label: "Phone", type: "text", step: 2 },
    { key: "country", label: "Country", type: "text", step: 3 },
    { key: "city", label: "City", type: "text", step: 3 },
    { key: "address", label: "Address", type: "text", step: 3 },
    { key: "postalCode", label: "Postal Code", type: "text", step: 3 },
    { key: "aboutMe", label: "About Me", type: "text", step: 4 },
    { key: "officialEmail", label: "Official Email", type: "email", step: 4 },
    { key: "taxId", label: "Tax ID", type: "text", mono: true, step: 4 },
    { key: "panNo", label: "PAN No", type: "text", mono: true, step: 4 },
    { key: "designation", label: "Designation", type: "text", step: 5 },
  ];

  const renderFormField = (field: any) => {
    if (field.type === "toggle") {
      return (
        <div className="flex items-center gap-3">
          <Toggle value={!!form[field.key]} onChange={(v) => setForm({ ...form, [field.key]: v })} />
          <span className="text-sm text-gray-500">{form[field.key] ? "Active" : "Inactive"}</span>
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <select
          value={form[field.key] || ""}
          onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          required={field.required}
        >
          <option value="">Select {field.label}</option>
          {field.options?.map((opt: any) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.type === "password" && field.hasToggle) {
      return (
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={form[field.key] || ""}
            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 ${field.mono ? "font-mono bg-gray-50" : ""}`}
            required={field.key === "password" && editingId !== null ? false : field.required}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      );
    }

    return (
      <input
        type={field.type}
        value={form[field.key] ?? ""}
        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
        className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 ${field.mono ? "font-mono bg-gray-50" : ""}`}
        required={field.required}
        placeholder={`Enter ${field.label.toLowerCase()}`}
      />
    );
  };

  const getField = (key: string) => formFields.find((field) => field.key === key);

  const renderCurrentStep = () => {
    const renderFieldByKeys = (keys: string[]) =>
      keys.map((key) => {
        const field = getField(key);
        if (!field) return null;

        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderFormField(field)}
          </div>
        );
      });

    if (currentStep === 1) {
      return <div className="grid grid-cols-2 gap-4">{renderFieldByKeys(["username", "password", "email"])}</div>;
    }
    if (currentStep === 2) {
      return <div className="grid grid-cols-2 gap-4">{renderFieldByKeys(["firstName", "lastName", "userType", "phoneNumber"])}</div>;
    }
    if (currentStep === 3) {
      return <div className="grid grid-cols-2 gap-4">{renderFieldByKeys(["country", "city", "address", "postalCode"])}</div>;
    }
    if (currentStep === 4) {
      return <div className="grid grid-cols-2 gap-4">{renderFieldByKeys(["aboutMe", "officialEmail", "taxId", "panNo"])}</div>;
    }
    if (currentStep === 5) {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant <span className="text-red-500">*</span></label>
            <select
              value={form.tenantId || ""}
              onChange={(e) => handleTenantChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              disabled={loadingTenants}
            >
              <option value="">{loadingTenants ? "Loading..." : "Select Tenant"}</option>
              {tenants.map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>{tenant.tenantName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain <span className="text-red-500">*</span></label>
            <select
              value={form.domainId || ""}
              onChange={(e) => handleDomainChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              disabled={!form.tenantId || loadingDomains}
            >
              <option value="">{!form.tenantId ? "Select tenant first" : loadingDomains ? "Loading..." : "Select Domain"}</option>
              {filteredDomains.map((domain) => (
                <option key={domain.id} value={domain.id}>{(domain as any).domainName || (domain as any).domainCode}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
            <select
              value={form.departmentId || ""}
              onChange={(e) => handleDepartmentChange(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              disabled={!form.domainId || loadingDepartments}
            >
              <option value="">{!form.domainId ? "Select domain first" : loadingDepartments ? "Loading..." : "Select Department"}</option>
              {filteredDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.departmentName}</option>
              ))}
            </select>
          </div>

          {renderFieldByKeys(["designation"])}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Active</label>
          <Toggle value={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>
          <input
            type="text"
            value={form.roleNames || ""}
            onChange={(e) => setForm({ ...form, roleNames: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            placeholder="Comma-separated role names"
          />
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setForm(getBlankRow());
            setEditingId(null);
            setCurrentStep(1);
            setShowFormModal(true);
            setShowPassword(false);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add User
        </button>
      </div>


      {/* Table */}
      <ReusableTable<any>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={10}
        defaultSortKey="username"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No users found</p>
            {!search && (
              <button
                onClick={() => {
                  setForm(getBlankRow());
                  setEditingId(null);
                  setCurrentStep(1);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first user →
              </button>
            )}
          </div>
        }
      />

      {/* Form Modal - Same as before but with updated styling */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editingId ? "Edit" : "New"} User</h3>
                <p className="text-xs text-gray-500 mt-0.5">{editingId ? "Update user details" : "Create a new user"}</p>
              </div>
              <button onClick={closeFormModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pt-3 border-b">
              <div className="flex gap-1">
                {stepNames.map((stepName, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => index + 1 <= currentStep && setCurrentStep(index + 1)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${index + 1 === currentStep
                      ? "bg-cyan-50 text-cyan-600"
                      : index + 1 < currentStep
                        ? "text-green-600 hover:text-green-700"
                        : "text-gray-400"
                      }`}
                  >
                    {index + 1 < currentStep ? "✓ " : ""}{stepName}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1">
              {renderCurrentStep()}
            </form>

            <div className="flex justify-between gap-3 p-5 pt-3 border-t">
              <button
                type="button"
                onClick={handlePreviousStep}
                disabled={currentStep === 1}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${currentStep === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                Previous
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={closeFormModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                {currentStep < totalSteps ? (
                  <button type="button" onClick={handleNextStep} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Next</button>
                ) : (
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">{editingId ? "Update" : "Create"}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <TrashIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete User?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserEmployeeTab;
import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  UserGroupIcon,
  UserIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type SalesPerson = {
  id: number;
  name: string;
  code: string;
  email: string;
  region: string;
  active: boolean;
  userId: string | number | null;
  employeeId: number | null;
};

type SalesPersonForm = {
  name: string;
  code: string;
  email: string;
  region: string;
  active: string;
  userId: string;
  employeeId: string;
};

type UserOption = {
  userId: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  employeeId?: number | null;
  department?: string | null;
};

const API_URL = "/v1/api/sales/sales-persons";
const PAGE_SIZE = 10;

const emptyForm: SalesPersonForm = {
  name: "",
  code: "",
  email: "",
  region: "",
  active: "true",
  userId: "",
  employeeId: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

const SalesPersons: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState<SalesPersonForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");

  useEffect(() => {
    fetchSalesPersons();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSalesPersons = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SalesPerson[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setSalesPersons(data);
      if (data.length === 0) ToasterService.noData("No sales persons found");
    } catch (error) {
      ToasterService.error("Failed to load sales persons", getErrorMessage(error, "Please try again."));
      setSalesPersons([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get<UserOption[]>("/v1/api/user/getAll", { headers });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load users", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Sales person ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<SalesPerson>(`${API_URL}/${lookupId}`, { headers });
      setSalesPersons([res.data]);
      ToasterService.success("Sales person loaded");
    } catch (error) {
      ToasterService.error("Failed to load sales person", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "userId") {
        const user = users.find((item) => item.userId === value);
        const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
        next.name = fullName || user?.username || next.name;
        next.email = user?.email || next.email;
        next.employeeId = user?.employeeId ? String(user.employeeId) : "";
        next.active = String(user?.active ?? true);
        next.region = user?.department || next.region;
      }
      if (name === "employeeId") {
        const user = users.find((item) => String(item.employeeId || "") === value);
        const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
        next.userId = user?.userId || next.userId;
        next.name = fullName || user?.username || next.name;
        next.email = user?.email || next.email;
        next.active = String(user?.active ?? true);
        next.region = user?.department || next.region;
      }
      return next;
    });
  };

  const buildPayload = () => {
    const userId = form.userId.trim();
    const employeeId = toNullableNumber(form.employeeId);

    return {
      id: editingId || 0,
      name: form.name.trim(),
      code: form.code.trim(),
      email: form.email.trim(),
      region: form.region.trim(),
      active: form.active === "true",
      userId,
      employeeId,
      userID: userId,
      employeeID: employeeId,
      user: userId ? { id: userId } : null,
      employee: employeeId ? { id: employeeId } : null,
    };
  };

  const mergeSubmittedIds = (person: SalesPerson, payload: ReturnType<typeof buildPayload>): SalesPerson => ({
    ...person,
    userId: person.userId ?? payload.userId,
    employeeId: person.employeeId ?? payload.employeeId,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.code.trim()) {
      ToasterService.error("Required fields missing", "Name and code are required.");
      return;
    }
    if (form.employeeId.trim() && toNullableNumber(form.employeeId) === null) {
      ToasterService.error("Invalid employee ID", "Employee ID must be a number.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const res = editingId
        ? await axios.put<SalesPerson>(`${API_URL}/${editingId}`, payload, { headers })
        : await axios.post<SalesPerson>(API_URL, payload, { headers });
      const savedPerson = mergeSubmittedIds(res.data, payload);

      setSalesPersons((current) => {
        const exists = current.some((item) => item.id === savedPerson.id);
        if (exists) return current.map((item) => (item.id === savedPerson.id ? savedPerson : item));
        return [savedPerson, ...current];
      });
      ToasterService.success(editingId ? "Sales person updated" : "Sales person created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save sales person", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (person: SalesPerson) => {
    setEditingId(person.id);
    setForm({
      name: person.name || "",
      code: person.code || "",
      email: person.email || "",
      region: person.region || "",
      active: String(person.active ?? true),
      userId: person.userId === null || person.userId === undefined ? "" : String(person.userId),
      employeeId: String(person.employeeId || ""),
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const filteredSalesPersons = useMemo(() => {
    const term = searchableText(search);
    if (!term) return salesPersons;

    return salesPersons.filter((person) => {
      const haystack = [
        person.name,
        person.code,
        person.email,
        person.region,
        person.userId,
        person.employeeId,
        person.id,
        person.active ? "active" : "inactive",
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [salesPersons, search]);

  const stats = useMemo(
    () => ({
      total: salesPersons.length,
      active: salesPersons.filter((person) => person.active).length,
      inactive: salesPersons.filter((person) => !person.active).length,
      regions: new Set(salesPersons.map((person) => person.region).filter(Boolean)).size,
    }),
    [salesPersons]
  );

  const columns: ColumnDef<SalesPerson>[] = [
    {
      key: "name",
      label: "Sales Person",
      sortable: true,
      render: (person) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
            <UserIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{person.name || "Unnamed"}</div>
            <div className="text-xs text-slate-500">{person.code || `ID: ${person.id}`}</div>
          </div>
        </div>
      ),
    },
    { key: "email", label: "Email", sortable: true },
    { key: "region", label: "Region", sortable: true },
    { key: "userId", label: "User ID", sortable: true },
    { key: "employeeId", label: "Employee ID", sortable: true },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (person) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            person.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {person.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (person) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(person)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Sales Persons" description="Manage sales persons" />
      <PageBreadcrumb pageTitle="Sales Persons" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Sales Person" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Sales Persons" value={stats.total} icon={<UserGroupIcon />} />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Inactive"
            value={stats.inactive}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<XCircleIcon />}
          />
          <StatsCard
            label="Regions"
            value={stats.regions}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<UserIcon />}
          />
        </div>

        <div className="relative w-full sm:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search sales persons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <ReusableTable
          data={filteredSalesPersons}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <UserGroupIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No sales persons found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first sales person
              </button>
            </div>
          }
        />
      </div>

      {showFormModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingId ? "Edit Sales Person" : "Create Sales Person"}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">Enter sales person details from the API schema</p>
                </div>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <FloatingSelect
                    label="User"
                    name="userId"
                    value={form.userId}
                    onChange={handleChange}
                    options={users.map((user) => ({
                      id: user.userId,
                      name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || user.userId,
                    }))}
                  />
                  <FloatingInput
                    label="Name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    label="Code"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                  />
                  <FloatingInput
                    label="Region"
                    name="region"
                    value={form.region}
                    onChange={handleChange}
                  />
                  <FloatingInput
                    label="Employee ID"
                    name="employeeId"
                    value={form.employeeId}
                    onChange={handleChange}
                    readOnly
                  />
                  <FloatingSelect
                    label="Status"
                    name="active"
                    value={form.active}
                    onChange={handleChange}
                    includeEmptyOption={false}
                    options={[
                      { id: "true", name: "Active" },
                      { id: "false", name: "Inactive" },
                    ]}
                  />
                </div>

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Sales Person" : "Create Sales Person"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default SalesPersons;

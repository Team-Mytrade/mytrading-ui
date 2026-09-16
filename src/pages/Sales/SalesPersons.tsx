import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import PaginatedPopup from "../../components/common/unpopup";
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
  employeeCode?: string | null;
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

function normalizeText(value: unknown) {
  return searchableText(value).replace(/\s+/g, " ");
}

function getUserSalesCode(user?: UserOption) {
  if (!user) return "";
  return user.employeeCode || (user.employeeId ? String(user.employeeId) : "") || user.userId || "";
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
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
        // Name always mirrors the linked user once one is selected — see the
        // disabled state on the Name field below. Clearing the User selection
        // (value === "") leaves the last-known name in place so it can be
        // edited freely as a standalone sales person.
        if (value) {
          next.name = fullName || user?.username || next.name;
        }
        next.code = getUserSalesCode(user) || next.code;
        next.email = user?.email || next.email;
        next.employeeId = user?.employeeId ? String(user.employeeId) : "";
        next.active = String(user?.active ?? true);
        // Region is a sales-territory assignment, not a location or org
        // attribute — it's intentionally left as a manual field and is never
        // auto-filled from the linked User's department/city/etc.
      }
      if (name === "employeeId") {
        const user = users.find((item) => String(item.employeeId || "") === value);
        const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
        next.userId = user?.userId || next.userId;
        next.name = fullName || user?.username || next.name;
        next.code = getUserSalesCode(user) || next.code;
        next.email = user?.email || next.email;
        next.active = String(user?.active ?? true);
        // Region is intentionally left manual — see note above.
      }
      return next;
    });
  };

  const buildPayload = () => {
    const userId = form.userId.trim();
    const employeeId = toNullableNumber(form.employeeId);
    const selectedUser = users.find(
      (user) =>
        (userId && user.userId === userId) ||
        (employeeId !== null && user.employeeId === employeeId)
    );
    const code = form.code.trim() || getUserSalesCode(selectedUser) || userId;

    return {
      id: editingId || 0,
      name: form.name.trim(),
      code,
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

    if (!form.name.trim()) {
      ToasterService.error("Required fields missing", "Name is required.");
      return;
    }
    if (form.employeeId.trim() && toNullableNumber(form.employeeId) === null) {
      ToasterService.error("Invalid employee ID", "Employee ID must be a number.");
      return;
    }

    const normalizedEmail = searchableText(form.email);
    const normalizedUserId = form.userId.trim();
    const duplicate = salesPersons.find((person) => {
      if (person.id === editingId) return false;
      const sameUser = normalizedUserId && getResolvedUserId(person) === normalizedUserId;
      const sameEmail = normalizedEmail && searchableText(person.email) === normalizedEmail;
      return sameUser || sameEmail;
    });
    if (duplicate) {
      const reason =
        normalizedUserId && getResolvedUserId(duplicate) === normalizedUserId
          ? "that User is already linked to"
          : "that email is already used by";
      ToasterService.error(
        "Duplicate sales person",
        `${reason} "${duplicate.name || `sales person #${duplicate.id}`}". Choose a different user/email or edit the existing record.`
      );
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

  const getMatchedUser = (person: SalesPerson) => {
    if (person.userId || person.employeeId) {
      return users.find(
        (user) =>
          (person.userId && user.userId === String(person.userId)) ||
          (person.employeeId !== null && user.employeeId === person.employeeId)
      );
    }

    const normalizedName = normalizeText(person.name);
    const normalizedEmail = searchableText(person.email);
    const normalizedCode = searchableText(person.code);

    return users.find((user) => {
      const userName = normalizeText(
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || ""
      );
      const userEmail = searchableText(user.email);
      const userCode = searchableText(user.employeeCode);

      return (
        (normalizedEmail && userEmail === normalizedEmail) ||
        (normalizedCode && userCode === normalizedCode) ||
        (normalizedName && userName === normalizedName)
      );
    });
  };

  const getResolvedUserId = (person: SalesPerson) => {
    if (person.userId !== null && person.userId !== undefined && String(person.userId).trim()) {
      return String(person.userId);
    }
    return getMatchedUser(person)?.userId || "";
  };

  const getResolvedEmployeeId = (person: SalesPerson) => {
    if (person.employeeId !== null && person.employeeId !== undefined) {
      return String(person.employeeId);
    }
    const matchedEmployeeId = getMatchedUser(person)?.employeeId;
    return matchedEmployeeId !== null && matchedEmployeeId !== undefined ? String(matchedEmployeeId) : "";
  };

  const buildPayloadFromPerson = (person: SalesPerson, active = person.active) => {
    const userId = getResolvedUserId(person).trim();
    const employeeId = toNullableNumber(getResolvedEmployeeId(person));

    return {
      id: person.id,
      name: person.name.trim(),
      code: person.code.trim(),
      email: person.email.trim(),
      region: person.region.trim(),
      active,
      userId,
      employeeId,
      userID: userId,
      employeeID: employeeId,
      user: userId ? { id: userId } : null,
      employee: employeeId ? { id: employeeId } : null,
    };
  };

  const handleInlineStatusChange = async (person: SalesPerson, nextValue: string) => {
    const nextActive = nextValue === "true";
    if (person.active === nextActive) return;

    if (!person.name.trim()) {
      ToasterService.error("Missing sales person name", "Unable to update this row.");
      return;
    }

    if (!person.code.trim()) {
      ToasterService.error("Missing sales code", "Unable to update status without a valid code.");
      return;
    }

    try {
      setStatusUpdatingId(person.id);
      const payload = buildPayloadFromPerson(person, nextActive);
      const res = await axios.put<SalesPerson>(`${API_URL}/${person.id}`, payload, { headers });
      const savedPerson = mergeSubmittedIds(res.data, payload);

      setSalesPersons((current) =>
        current.map((item) => (item.id === savedPerson.id ? savedPerson : item))
      );
      ToasterService.success("Sales person status updated");
    } catch (error) {
      ToasterService.error("Failed to update status", getErrorMessage(error, "Please try again."));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Note: there is no DELETE endpoint for sales persons in the API — the
  // "Delete" action has been removed. Use the Active/Inactive status toggle
  // instead, since past Sales Orders still reference salesPersonId and a
  // hard delete would orphan that history anyway.

  const filteredSalesPersons = useMemo(() => {
    const term = searchableText(search);

    return salesPersons.filter((person) => {
      const matchesStatus =
        statusFilter === ""
          ? true
          : statusFilter === "active"
            ? person.active
            : !person.active;
      const haystack = [
        person.name,
        person.code,
        person.email,
        person.region,
        getResolvedUserId(person),
        getResolvedEmployeeId(person),
        person.id,
        person.active ? "active" : "inactive",
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      const matchesSearch = !term || haystack.includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [salesPersons, search, statusFilter]);

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
    { key: "email", label: "Email", sortable: true},
    { key: "region", label: "Region", sortable: true,},
    {
      key: "userId",
      label: "User ID",
      sortable: true,
      sortValueGetter: (person) => getResolvedUserId(person),
      render: (person) => getResolvedUserId(person) || "--",
    },
    {
      key: "employeeId",
      label: "Employee ID",
      sortable: true,
      sortValueGetter: (person) => getResolvedEmployeeId(person),
      render: (person) => getResolvedEmployeeId(person) || "--",
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (person) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={String(person.active)}
            onChange={(e) => handleInlineStatusChange(person, e.target.value)}
            disabled={statusUpdatingId === person.id}
            className={`w-[84px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${
              person.active
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            } ${statusUpdatingId === person.id ? "cursor-not-allowed opacity-70" : ""}`}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (person) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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

      <div className="w-full max-w-none px-0 py-8 space-y-">
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

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:-mb-5">
          <div className="relative w-full sm:max-w-md md:-mt-8 mt-1">
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

          <div className="flex items-center gap-2">
            <ListingPdfExportButton<SalesPerson>
              title="Sales Persons"
              subtitle="Filtered sales person listing"
              reportLabel="Sales Report"
              data={filteredSalesPersons}
              fileName="Sales_Persons"
              disabled={loading}
              metadata={(rows, rangeLabel) => [
                { label: "Total", value: rows.length },
                { label: "Range", value: rangeLabel },
                { label: "Status", value: statusFilter || "All" },
                { label: "Search", value: search || "None" },
              ]}
              columns={[
                { header: "Sales Person", accessor: (person) => person.name || "Unnamed" },
                { header: "Code", accessor: (person) => person.code || `ID: ${person.id}` },
                { header: "Email", key: "email" },
                { header: "Region", key: "region" },
                { header: "User ID", accessor: (person) => getResolvedUserId(person) || "-" },
                { header: "Employee ID", accessor: (person) => getResolvedEmployeeId(person) || "-" },
                { header: "Status", accessor: (person) => (person.active ? "Active" : "Inactive") },
              ]}
            />
            <FilterPopover
              title="Filter Sales Persons"
              buttonLabel="Filters"
              label="Status"
              value={statusFilter}
              options={[
                { label: "All Statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ]}
              onChange={setStatusFilter}
              onReset={() => setStatusFilter("")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredSalesPersons}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
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

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Sales Person" : "Create Sales Person"}
        subtitle="Enter sales person details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Sales Person" : "Create Sales Person"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Basic Info",
            fields: [
              <FloatingSelect
                label="User"
                name="userId"
                value={form.userId}
                onChange={handleChange}
                options={users.map((user) => ({
                  id: user.userId,
                  name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || user.userId,
                }))}
              />,
              <FloatingInput
                label="Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                disabled={!!form.userId}
                required
              />,
              <FloatingInput
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />,
              <FloatingInput
                label="Region"
                name="region"
                value={form.region}
                onChange={handleChange}
              />,
            ],
          },
          ...(editingId
            ? [{
                label: "Status",
                fields: [
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
                  />,
                ],
              }]
            : []),
        ]}
      />
    </>
  );
};

export default SalesPersons;

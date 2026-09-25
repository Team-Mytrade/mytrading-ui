import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircleIcon,
  PencilSquareIcon,
  UserGroupIcon,
  UserIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
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

const REGION_OPTIONS = [
  { id: "North", name: "North" },
  { id: "South", name: "South" },
  { id: "East", name: "East" },
  { id: "West", name: "West" },
  { id: "Central", name: "Central" },
];

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

function getUserFullName(user?: UserOption) {
  if (!user) return "";
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || "";
}

const SalesPersons: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedSalesPersonId = Number(searchParams.get("salesPersonId")) || null;
  const scopedSalesPersonName = searchParams.get("salesPersonName") || "Selected sales person";
  const isSalesPersonScoped = searchParams.has("salesPersonId");
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "userId") {
        const user = users.find((item) => item.userId === value);
        if (value) {
          next.name = getUserFullName(user) || next.name;
        }
        next.code = getUserSalesCode(user) || next.code;
        next.email = user?.email || next.email;
        next.employeeId = user?.employeeId ? String(user.employeeId) : "";
        next.active = String(user?.active ?? true);
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

    if (!form.userId.trim()) {
      ToasterService.error("Required fields missing", "Please select a user.");
      return;
    }
    if (!form.name.trim()) {
      ToasterService.error("Missing name", "The selected user has no name on file.");
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
        `${reason} "${duplicate.name || `sales person #${duplicate.id}`}". Choose a different user or edit the existing record.`
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
      userId: getResolvedUserId(person),
      employeeId: getResolvedEmployeeId(person),
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
      const userName = normalizeText(getUserFullName(user));
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

  const getEmployeeDisplayName = (person: SalesPerson) => {
    const user = getMatchedUser(person);
    return getUserFullName(user);
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

  const displayedSalesPersons = useMemo(
    () => isSalesPersonScoped ? salesPersons.filter((person) => person.id === scopedSalesPersonId) : salesPersons,
    [salesPersons, isSalesPersonScoped, scopedSalesPersonId]
  );

  const stats = useMemo(
    () => ({
      total: displayedSalesPersons.length,
      active: displayedSalesPersons.filter((person) => person.active).length,
      inactive: displayedSalesPersons.filter((person) => !person.active).length,
    }),
    [displayedSalesPersons]
  );

  const columns: ColumnDef<SalesPerson>[] = [
    {
      key: "name",
      label: "Sales Person",
      sortable: true,
      render: (person) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40">
            <UserIcon className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{person.name || "Unnamed"}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{person.code || `ID: ${person.id}`}</div>
          </div>
        </div>
      ),
    },
    { key: "email", label: "Email", sortable: true },
    { key: "region", label: "Region", sortable: true },
    {
      key: "employeeName",
      label: "Employee Name",
      sortable: true,
      sortValueGetter: (person) => getEmployeeDisplayName(person),
      render: (person) => getEmployeeDisplayName(person) || "--",
      excludeFromDetails: true,
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      detailFormatter: (person) => (person.active ? "Active" : "Inactive"),
      render: (person) => (
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={String(person.active)}
            onChange={(e) => handleInlineStatusChange(person, e.target.value)}
            disabled={statusUpdatingId === person.id}
            className={`w-[84px] rounded-lg border px-2 py-1.5 text-xs font-semibold outline-none transition ${
              person.active
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(person)}
            className="rounded-lg p-2 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
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
      <PageBreadcrumb
        pageTitle="Sales Persons"
        actions={<AddButton onClick={openCreate} label="Add Sales Person" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        {isSalesPersonScoped && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
            <span>Showing sales person: <strong>{scopedSalesPersonName}</strong></span>
            <button
              type="button"
              onClick={() => navigate("/sales-persons")}
              className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              View all sales persons
            </button>
          </div>
        )}
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        </div>

        <ReusableTable
          data={displayedSalesPersons}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          hiddenDetailKeys={["id"]}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <UserGroupIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">No sales persons found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
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
        subtitle="Select the user and region for this sales person"
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
                  name: getUserFullName(user) || user.userId,
                }))}
                required
              />,
              <FloatingSelect
                label="Region"
                name="region"
                value={form.region}
                onChange={handleChange}
                options={REGION_OPTIONS}
              />,
            ],
          },
        ]}
      />
    </>
  );
};

export default SalesPersons;
import PurchaseResourcePage, {
  PurchaseRecord,
  PurchaseResourceConfig,
  toNumberOrZero,
} from "./PurchaseResourcePage";

const PURCHASE = "/v1/api/purchase";
const USER_DEPARTMENTS = "/v1/api/user/departments";
const USERS = "/v1/api/user/getAll";

const dateOnly = (value: any) => (value ? String(value).slice(0, 10) : "");

const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getSessionMeta = () => {
  const storedUser = getStoredUser();
  return {
    userId: storedUser?.userId || storedUser?.id || "system",
    tenantId: storedUser?.tenantId || "TENANT_1",
  };
};

const toUserActiveStatus = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";
  return "ACTIVE";
};

const toRequesterRole = (value: unknown) => {
  const role = String(value || "").toUpperCase();
  if (role === "ADMIN" || role === "USER") return role;
  if (role.includes("ADMIN")) return "ADMIN";
  return "USER";
};

const emptyUserDetails = {
  phoneNumber: "",
  country: "",
  city: "",
  address: "",
  postalCode: "",
  designation: "",
  aboutMe: "",
  imageName: "",
  imageType: "",
};

const statusBadge = (value: string) => {
  const status = String(value || "--");
  const tone =
    status === "APPROVED" || status === "RECEIVED" || status === "ACTIVE"
      ? "bg-green-50 text-green-700"
      : status === "REJECTED" || status === "CANCELLED"
        ? "bg-red-50 text-red-700"
        : status === "DRAFT" || status === "PENDING"
          ? "bg-amber-50 text-amber-700"
          : "bg-gray-100 text-gray-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
};

const purchaseRequisitionConfig: PurchaseResourceConfig = {
  title: "Purchase Requisitions",
  description: "Create requisitions and track department, requester, status, and required-by dates.",
  endpoint: `${PURCHASE}/purchase-requisitions`,
  columns: [
    { key: "id", label: "ID" },
    { key: "notes", label: "Notes" },
    { key: "requiredByDate", label: "Required By" },
    { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
    { key: "departmentId", label: "Department" },
    {
      key: "requester",
      label: "Requester",
      render: (row) => row.requester?.fullName || row.requester?.username || row.requester?.userId || "--",
    },
  ],
  fields: [
    { name: "notes", label: "Notes", type: "textarea", required: true, gridClassName: "md:col-span-2" },
    { name: "requiredByDate", label: "Required By Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
    { name: "status", label: "Status", type: "select", defaultValue: "DRAFT", options: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"].map((item) => ({ value: item, label: item })) },
    {
      name: "departmentId",
      label: "Department",
      type: "select",
      required: true,
      optionsEndpoint: USER_DEPARTMENTS,
      optionLabel: (row) => [row.name, row.departmentCode ? `(${row.departmentCode})` : ""].filter(Boolean).join(" "),
    },
    {
      name: "requesterId",
      label: "Requester",
      type: "select",
      required: true,
      optionsEndpoint: USERS,
      optionLabel: (row) => row.username || row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.userId,
      optionValue: "userId",
    },
  ],
  searchFields: ["id", "notes", "status", "departmentId", "requester.username", "requester.fullName", "requester.userId"],
  normalizeForm: (row) => ({
    notes: row.notes || "",
    requiredByDate: dateOnly(row.requiredByDate),
    status: row.status || "DRAFT",
    departmentId: row.departmentId ?? "",
    requesterId: row.requester?.userId || row.requesterId || "",
  }),
  buildPayload: (form, editingRow, context) => {
    const now = new Date().toISOString();
    const session = getSessionMeta();
    const requesterOption = context.options.requesterId?.find(
      (option) => String(option.value) === String(form.requesterId)
    );
    const requester = requesterOption?.raw;

    return {
      id: Number(editingRow?.id ?? 0),
      createdDate: editingRow?.createdDate || now,
      updatedDate: now,
      createdBy: editingRow?.createdBy || session.userId,
      tenantId: editingRow?.tenantId || session.tenantId,
      notes: form.notes,
      requiredByDate: form.requiredByDate,
      status: form.status || "DRAFT",
      departmentId: toNumberOrZero(form.departmentId),
      requester: requester
        ? {
            userId: requester.userId || "",
            email: requester.email || "",
            role: toRequesterRole(requester.role),
            active: toUserActiveStatus(requester.active),
            fullName:
              requester.fullName ||
              requester.username ||
              [requester.firstName, requester.lastName].filter(Boolean).join(" ").trim(),
            userDetails: {
              ...emptyUserDetails,
              ...(requester.userDetails || {}),
            },
            requisitions: requester.requisitions || [],
            createdDate: requester.createdDate || now,
            updatedDate: requester.updatedDate || now,
            createdBy: requester.createdBy || requester.userId || "system",
            tenantId: requester.tenantId || session.tenantId,
          }
        : null,
    };
  },
};

export default function PurchaseRequisitions() {
  return <PurchaseResourcePage config={purchaseRequisitionConfig} />;
}

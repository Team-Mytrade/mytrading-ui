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

const createFallbackRequester = (session: { userId: string; tenantId: string }, now: string) => ({
  userId: session.userId,
  email: "",
  role: "USER",
  active: "ACTIVE",
  fullName: session.userId,
  userDetails: { ...emptyUserDetails },
  requisitions: [],
  createdDate: now,
  updatedDate: now,
  createdBy: session.userId,
  tenantId: session.tenantId,
});

const purchaseRequisitionConfig: PurchaseResourceConfig = {
  title: "Purchase Requisitions",
  description: "Create requisitions and track department, requester, status, and required-by dates.",
  endpoint: `${PURCHASE}/purchase-requisitions`,
  getByIdEndpoint: (row) => `${PURCHASE}/purchase-requisitions/${row.id}`,
  inlineSelectFields: [
    {
      name: "status",
      options: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"].map((item) => ({
        value: item,
        label: item.charAt(0) + item.slice(1).toLowerCase(),
      })),
      widthClassName: "w-[136px]",
    },
  ],
  columns: [
    { key: "id", label: "ID" },
    { key: "notes", label: "Notes" },
    { key: "requiredByDate", label: "Required By" },
    { key: "status", label: "Status" },
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
    const requester = requesterOption?.raw || editingRow?.requester;
    const requesterPayload = requester
      ? {
          userId: requester.userId || "",
          email: requester.email || "",
          role: toRequesterRole(requester.role),
          active: toUserActiveStatus(requester.active),
          fullName:
            requester.fullName ||
            requester.username ||
            [requester.firstName, requester.lastName].filter(Boolean).join(" ").trim() ||
            requester.userId ||
            "",
          userDetails: {
            ...emptyUserDetails,
            ...(requester.userDetails || {}),
          },
          requisitions: Array.isArray(requester.requisitions) ? requester.requisitions : [],
          createdDate: requester.createdDate || now,
          updatedDate: requester.updatedDate || now,
          createdBy: requester.createdBy || requester.userId || session.userId,
          tenantId: requester.tenantId || session.tenantId,
        }
      : createFallbackRequester(session, now);

    return {
      id: Number(editingRow?.id ?? 0),
      createdDate: editingRow?.createdDate || now,
      updatedDate: now,
      createdBy: editingRow?.createdBy || session.userId,
      tenantId: editingRow?.tenantId || session.tenantId,
      notes: String(form.notes || "").trim(),
      requiredByDate: form.requiredByDate,
      status: form.status || "DRAFT",
      departmentId: toNumberOrZero(form.departmentId),
      requester: requesterPayload,
      items: Array.isArray(editingRow?.items) ? editingRow.items : [],
    };
  },
};

export default function PurchaseRequisitions() {
  return <PurchaseResourcePage config={purchaseRequisitionConfig} />;
}

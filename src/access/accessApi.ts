// Calls to user-service access/platform APIs (see my-trading/docs/RBAC.md).
import axios from "axios";
import { AppModule } from "./access";

export interface TenantAdmin {
  userId: string;
  fullName: string;
  email: string;
  active: boolean;
  invitePending: boolean;
}

// SUSPENDED and INACTIVE companies' users can't sign in; SUSPENDED is meant to be temporary
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export interface TenantAccess {
  tenantId: string;
  tenantName: string;
  // True only when the status is ACTIVE
  active: boolean;
  status?: TenantStatus;
  statusReason?: string | null;
  statusChangedAt?: string | null;
  modules: AppModule[];
  admins: TenantAdmin[];
  userCount: number;
}

export interface RoleAccess {
  id: number;
  roleCode: string;
  roleName: string;
  systemRole: boolean;
  permissions: string[];
  grantable: boolean;
  // Users who have the role (when the server sends it)
  userCount?: number;
}

export interface ManagedUser {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  invitePending: boolean;
  employeeId?: number | null;
  employeeCode?: string | null;
  designation?: string | null;
  roles: { id: number; roleName: string; systemRole: boolean }[];
  // False when the user holds permissions beyond the signed-in user's authority (no edit/invite/deactivate)
  manageable: boolean;
}

export interface UserForm {
  username?: string;
  email: string;
  firstName: string;
  lastName: string;
  designation?: string;
  roleIds?: number[];
}

export interface TenantProvisionRequest {
  tenantName: string;
  modules: AppModule[];
  /** A plan from the catalogue; its modules replace the ones above. */
  planId?: number;
  admin: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    // Left out, the admin is emailed a link to set their own password
    password?: string;
  };
}

const request = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message =
      data?.error || data?.message || (data && typeof data === "object" ? Object.values(data)[0] : null);
    throw new Error(typeof message === "string" ? message : `Request failed (${response.status})`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
};

export const platformApi = {
  tenants: () => request<TenantAccess[]>("/v1/api/user/platform/tenants"),
  provision: (body: TenantProvisionRequest) =>
    request<{ tenant: TenantAccess; inviteSent: boolean }>("/v1/api/user/platform/tenants", { method: "POST", body: JSON.stringify(body) }),
  rename: (tenantId: string, tenantName: string) =>
    request<TenantAccess>(`/v1/api/user/platform/tenants/${encodeURIComponent(tenantId)}`, {
      method: "PUT",
      body: JSON.stringify({ tenantName }),
    }),
  inviteAdmin: (tenantId: string, userId: string) =>
    request<{ inviteSent: boolean }>(
      `/v1/api/user/platform/tenants/${encodeURIComponent(tenantId)}/admins/${encodeURIComponent(userId)}/invite`,
      { method: "POST" },
    ),
  setModules: (tenantId: string, modules: AppModule[]) =>
    request<TenantAccess>(`/v1/api/user/platform/tenants/${encodeURIComponent(tenantId)}/modules`, {
      method: "PUT",
      body: JSON.stringify(modules),
    }),
  // The reason is required for SUSPENDED and INACTIVE
  setStatus: (tenantId: string, status: TenantStatus, reason: string) =>
    request<TenantAccess>(`/v1/api/user/platform/tenants/${encodeURIComponent(tenantId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, reason }),
    }),
};

export const tenantStatusOf = (t: Pick<TenantAccess, "active" | "status">): TenantStatus =>
  t.status ?? (t.active ? "ACTIVE" : "INACTIVE");

// Users and custom roles of the current company (axios, so expired tokens are refreshed)
const ACCESS = "/v1/api/user/access";
export const userAdminApi = {
  users: () => axios.get<ManagedUser[]>(`${ACCESS}/users`).then((r) => r.data),
  create: (form: UserForm) =>
    axios.post<{ user: ManagedUser; inviteSent: boolean }>(`${ACCESS}/users`, form).then((r) => r.data),
  update: (userId: string, form: UserForm) =>
    axios.put<ManagedUser>(`${ACCESS}/users/${encodeURIComponent(userId)}`, form).then((r) => r.data),
  invite: (userId: string) =>
    axios.post<{ inviteSent: boolean }>(`${ACCESS}/users/${encodeURIComponent(userId)}/invite`).then((r) => r.data),
  // Takes the user's authenticator app off (lost phone); they set it up again if the company requires it
  resetMfa: (userId: string) => axios.delete(`${ACCESS}/users/${encodeURIComponent(userId)}/mfa`),
  /** Links the login to an employee record (null removes the link); self-service follows at the next sign-in. */
  linkEmployee: (userId: string, employeeId: number | null, employeeCode: string | null) =>
    axios.put<ManagedUser>(`${ACCESS}/users/${encodeURIComponent(userId)}/employee`, { employeeId, employeeCode }).then((r) => r.data),
  setActive: (userId: string, active: boolean) =>
    axios.get(`/v1/api/user/${encodeURIComponent(userId)}/${active ? "activate" : "deactivate"}`),
  assignRoles: (userId: string, roleIds: number[]) =>
    axios.put<string[]>(`${ACCESS}/users/${encodeURIComponent(userId)}/roles`, roleIds).then((r) => r.data),
  roles: () => axios.get<RoleAccess[]>(`${ACCESS}/roles`).then((r) => r.data),
  modules: () => axios.get<AppModule[]>(`${ACCESS}/modules`).then((r) => r.data),
  grantable: () => axios.get<string[]>(`${ACCESS}/grantable`).then((r) => r.data),
  createRole: (roleName: string, permissions: string[]) =>
    axios.post<RoleAccess>(`${ACCESS}/roles`, { roleName, permissions }).then((r) => r.data),
  updateRole: (roleId: number, roleName: string, permissions: string[]) =>
    axios.put<RoleAccess>(`${ACCESS}/roles/${roleId}`, { roleName, permissions }).then((r) => r.data),
  deleteRole: (roleId: number) => axios.delete(`${ACCESS}/roles/${roleId}`),
};

/** The server's message for a failed call. */
export const errorText = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;

export const accessApi = {
  roles: () => request<RoleAccess[]>("/v1/api/user/access/roles"),
  userRoles: (userId: string) =>
    request<number[]>(`/v1/api/user/access/users/${encodeURIComponent(userId)}/roles`),
  assignRoles: (userId: string, roleIds: number[]) =>
    request<string[]>(`/v1/api/user/access/users/${encodeURIComponent(userId)}/roles`, {
      method: "PUT",
      body: JSON.stringify(roleIds),
    }),
};

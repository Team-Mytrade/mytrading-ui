// Calls to user-service access/platform APIs (see my-trading/docs/RBAC.md).
import { AppModule } from "./access";

export interface TenantAccess {
  tenantId: string;
  tenantName: string;
  active: boolean;
  modules: AppModule[];
}

export interface RoleAccess {
  id: number;
  roleCode: string;
  roleName: string;
  systemRole: boolean;
  permissions: string[];
  grantable: boolean;
}

export interface TenantProvisionRequest {
  tenantName: string;
  modules: AppModule[];
  admin: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
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
    request<TenantAccess>("/v1/api/user/platform/tenants", { method: "POST", body: JSON.stringify(body) }),
  setModules: (tenantId: string, modules: AppModule[]) =>
    request<TenantAccess>(`/v1/api/user/platform/tenants/${encodeURIComponent(tenantId)}/modules`, {
      method: "PUT",
      body: JSON.stringify(modules),
    }),
  setActive: (tenantId: string, active: boolean) =>
    request<TenantAccess>(
      `/v1/api/user/platform/tenants/${encodeURIComponent(tenantId)}/status?active=${active}`,
      { method: "PUT" },
    ),
};

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

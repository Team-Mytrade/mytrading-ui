export interface Tenant {
  id: number;
  tenantId: string;
  tenantName: string;
  active: boolean;
}

export interface Domain {
  id: number;
  domainCode: string;
  domainName: string;
  description: string;
  active: boolean;
  tenantId: string;
}

export interface Department {
  id: number;
  departmentCode: string;
  name: string;
  description: string;
  domainId: number;
  tenantId: string;
  active: boolean;
}

export interface Role {
  id: number;
  roleCode: string;
  roleName: string;
  departmentId: number;
  tenantId: string;
}

export interface Permission {
  id: number;
  permissionCode: string;
  permissionName: string;
  tenantId: string;

  domainId: number;
  domainName: string;

  // Optional but powerful for scaling
  domain?: {
    id: number;
    domainCode?: string;
    domainName: string;
    tenantId?: string;
    active?: boolean;
  };
}
export interface RolePermission {
  id: number;
  roleId: number;
  permissionId: number;
  active: boolean;
  validFrom: string;
  validTo: string;
  roleName: string;
  permissionName: string;
  permissionCode: string;
}

export interface UserEmployee {
  id: number;
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  active: boolean;
  userType: "SUPER_ADMIN" | "ADMIN" | "USER";
  phoneNumber: string;
  country: string;
  city: string;
  address: string;
  postalCode: string;
  aboutMe: string;
  employeeCode: string;
  officialEmail: string;
  designation: string;
  departmentId: number;
  domainId: number;
  roleNames: string;
}

export const API_BASE = "/v1/api/crm";
export const PAGE_SIZE = 10;

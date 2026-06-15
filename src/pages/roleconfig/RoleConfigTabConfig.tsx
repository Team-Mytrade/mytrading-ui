import React from "react";
import {
  BuildingOfficeIcon,
  GlobeAltIcon,
  BuildingLibraryIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  LinkIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

export type PageType =
  | "Tenant"
  | "Domain"
  | "Department"
  | "Role"
  | "Permission"
  | "RolePermission"
  | "UserEmployee";

export const PAGE_ICONS: Record<PageType, React.ReactElement> = {
  Tenant: <BuildingOfficeIcon className="h-5 w-5" />,
  Domain: <GlobeAltIcon className="h-5 w-5" />,
  Department: <BuildingLibraryIcon className="h-5 w-5" />,
  Role: <ShieldCheckIcon className="h-5 w-5" />,
  Permission: <LockClosedIcon className="h-5 w-5" />,
  RolePermission: <LinkIcon className="h-5 w-5" />,
  UserEmployee: <UserIcon className="h-5 w-5" />,
};

export const PAGE_LABELS: Record<PageType, string> = {
  Tenant: "Tenants",
  Domain: "Domains",
  Department: "Departments",
  Role: "Roles",
  Permission: "Permissions",
  RolePermission: "Role Permissions",
  UserEmployee: "Users",
};

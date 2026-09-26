import React, { useState, useContext } from "react";
import { useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { PageType, PAGE_ICONS, PAGE_LABELS } from "./RoleConfigTabConfig";
import { AuthContext } from "../../context/AuthContext";

import TenantTab from "./TenantTab";
import DomainTab from "./DomainTab";
import DepartmentTab from "./DepartmentTab";
import RoleTab from "./RoleTab";
import PermissionTab from "./PermissionTab";
import RolePermissionTab from "./RolePermissionTab";
import UserEmployeeTab from "./UserEmployeeTab";
import "./Mainrole.css";

const RoleConfig: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const isAdmin = (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || user?.roles?.includes("SUPER_ADMIN") || user?.roles?.includes("ADMIN")) && user?.userType !== "USER" && user?.userType !== "EMPLOYEE";

  const [activePage, setActivePage] = useState<PageType>(
    searchParams.get("tab") === "users" ? "UserEmployee" : "Tenant"
  );
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string | null>(null);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<number | null>(null);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<number | null>(null);
  const [selectedPermissionFilter, setSelectedPermissionFilter] = useState<number | null>(null);
  const pages = Object.keys(PAGE_LABELS) as PageType[];

  if (!isAdmin) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 shadow-sm">
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-xs text-gray-500 mt-2">You do not have the required administrator privileges to access configurations.</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activePage) {
      case "Tenant":
        return (
          <TenantTab
            onViewDomains={(tenantId) => {
              setSelectedTenantFilter(tenantId);
              setActivePage("Domain");
            }}
          />
        );
      case "Domain":
        return (
          <DomainTab
            selectedTenantFilter={selectedTenantFilter}
            onClearTenantFilter={() => setSelectedTenantFilter(null)}
            onViewDepartments={(domainId) => {
              setSelectedDomainFilter(domainId);
              setActivePage("Department");
            }}
          />
        );
      case "Department":
        return (
          <DepartmentTab
            selectedDomainFilter={selectedDomainFilter}
            onClearDomainFilter={() => setSelectedDomainFilter(null)}
            onViewRoles={(departmentId) => {
              setSelectedDepartmentFilter(departmentId);
              setActivePage("Role");
            }}
          />
        );
      case "Role":
        return (
          <RoleTab
            selectedDepartmentFilter={selectedDepartmentFilter}
            onClearDepartmentFilter={() => setSelectedDepartmentFilter(null)}
          />
        );
      case "Permission":
        return (
          <PermissionTab
            onViewRolePermissions={(permissionId) => {
              setSelectedPermissionFilter(permissionId);
              setActivePage("RolePermission");
            }}
          />
        );
      case "RolePermission":
        return (
          <RolePermissionTab
            selectedPermissionFilter={selectedPermissionFilter}
            onClearPermissionFilter={() => setSelectedPermissionFilter(null)}
          />
        );
      case "UserEmployee": return <UserEmployeeTab />;
      default: return null;
    }
  };

  return (
    <>
      <PageMeta title="Role Configuration" description="Manage roles and permissions" />
      <div className="role-config-breadcrumb">
        <PageBreadcrumb pageTitle="Role Config" />
      </div>

      <div className="role-config-page -mt-2 w-full max-w-none px-0 pb-0">
        <div className="grid gap-3 xl:grid-cols-[205px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="self-start rounded-lg border border-gray-200 bg-white shadow-sm lg:sticky lg:top-2">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Setup Areas</p>
                <p className="text-xs font-medium text-gray-900">Structure and access</p>
              </div>
            </div>
            <nav
              id="role-config-setup-nav"
              className="grid grid-cols-1 gap-0.5 p-1.5"
              aria-label="Role configuration sections"
            >
              {pages.map((page) => {
                const isActive = activePage === page;
                const IconComponent = PAGE_ICONS[page];

                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => {
                      setActivePage(page);
                    }}
                    className={`group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-all duration-200 sm:h-9 lg:h-8 ${isActive
                      ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md sm:h-7 sm:w-7 ${isActive
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-cyan-600"
                      }`}>
                      {IconComponent}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">{PAGE_LABELS[page]}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 overflow-x-auto">
            <div className="min-w-0 animate-fadeIn">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .role-config-breadcrumb > div {
          margin-bottom: 0;
        }
      `}</style>
    </>
  );
};

export default RoleConfig;

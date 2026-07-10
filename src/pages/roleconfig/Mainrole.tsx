import React, { useState, useContext } from "react";
import { BackButton } from "../../components/common/BackButton";
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

const RoleConfig: React.FC = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || user?.roles?.includes("SUPER_ADMIN") || user?.roles?.includes("ADMIN")) && user?.userType !== "USER" && user?.userType !== "EMPLOYEE";

  const [activePage, setActivePage] = useState<PageType>("Tenant");
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
      <PageBreadcrumb pageTitle="Role Config" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-5 py-6">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Role Configuration</h1>
              <p className="text-sm text-gray-500 mt-1">Manage tenants, domains, roles, permissions and users</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Minimal Design */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="flex flex-wrap gap-1">
            {pages.map((page) => {
              const isActive = activePage === page;
              const IconComponent = PAGE_ICONS[page];

              return (
                <button
                  key={page}
                  onClick={() => setActivePage(page)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 flex items-center gap-2 ${isActive
                    ? "text-cyan-600 border-b-2 border-cyan-600 bg-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {IconComponent && <span className="h-4 w-4">{IconComponent}</span>}
                  {PAGE_LABELS[page]}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="animate-fadeIn">
          {renderContent()}
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
      `}</style>
    </>
  );
};

export default RoleConfig;
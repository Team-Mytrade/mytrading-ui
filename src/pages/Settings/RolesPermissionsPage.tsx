import React, { useState } from "react";

// ---- Role and Permission Config ----
const rolePermissions: Record<string, string[]> = {
  Admin: ["users:view", "users:edit", "leads:view", "leads:create", "reports:view"],
  Manager: ["users:view", "leads:view", "leads:create", "reports:view"],
  SalesRep: ["leads:view_own", "leads:create"],
  Support: ["tickets:view", "tickets:respond"],
  Viewer: ["reports:view", "leads:view"],
};

const roles = Object.keys(rolePermissions);

// ---- Sample Users ----
type User = { id: number; name: string; role: string };

const initialUsers: User[] = [
  { id: 1, name: "Alice", role: "Admin" },
  { id: 2, name: "Bob", role: "SalesRep" },
  { id: 3, name: "Charlie", role: "Viewer" },
];

// ---- Helper to check permission ----
const hasPermission = (role: string, permission: string): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

const RolesPermissionsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState<number>(users[0].id);

  const currentUser = users.find((u) => u.id === selectedUserId)!;

  const updateRole = (userId: number, newRole: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow border border-gray-200">
      <h2 className="text-2xl font-bold mb-6">Roles & Permissions Management</h2>

      {/* Select User */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Select User:</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(Number(e.target.value))}
          className="form-select w-full max-w-xs"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
      </div>

      {/* Role Assignment */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Change Role:</label>
        <select
          value={currentUser.role}
          onChange={(e) => updateRole(currentUser.id, e.target.value)}
          className="form-select w-full max-w-xs"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {/* Permissions Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leads Section */}
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold text-lg mb-2">Leads</h3>
          {hasPermission(currentUser.role, "leads:view") ||
          hasPermission(currentUser.role, "leads:view_own") ? (
            <p>✅ Can view leads</p>
          ) : (
            <p>❌ Cannot view leads</p>
          )}
          {hasPermission(currentUser.role, "leads:create") ? (
            <p>✅ Can create leads</p>
          ) : (
            <p>❌ Cannot create leads</p>
          )}
        </div>

        {/* Reports Section */}
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold text-lg mb-2">Reports</h3>
          {hasPermission(currentUser.role, "reports:view") ? (
            <p>✅ Can view reports</p>
          ) : (
            <p>❌ Cannot view reports</p>
          )}
        </div>

        {/* Tickets Section */}
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold text-lg mb-2">Support Tickets</h3>
          {hasPermission(currentUser.role, "tickets:view") ? (
            <p>✅ Can view tickets</p>
          ) : (
            <p>❌ Cannot view tickets</p>
          )}
          {hasPermission(currentUser.role, "tickets:respond") ? (
            <p>✅ Can respond to tickets</p>
          ) : (
            <p>❌ Cannot respond to tickets</p>
          )}
        </div>

        {/* Users Section */}
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold text-lg mb-2">User Management</h3>
          {hasPermission(currentUser.role, "users:view") ? (
            <p>✅ Can view users</p>
          ) : (
            <p>❌ Cannot view users</p>
          )}
          {hasPermission(currentUser.role, "users:edit") ? (
            <p>✅ Can edit users</p>
          ) : (
            <p>❌ Cannot edit users</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RolesPermissionsPage;

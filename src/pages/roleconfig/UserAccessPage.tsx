import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { RoleAccess, accessApi } from "../../access/accessApi";

interface UserRow {
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  superAdmin?: boolean;
}

/**
 * Assign roles to users in the current tenant. Only roles the signed-in user may grant can be
 * changed; the server applies the same delegation rule.
 */
export default function UserAccessPage() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleAccess[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [original, setOriginal] = useState<number[]>([]);
  const [assigned, setAssigned] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    fetch("/v1/api/user/getAll", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load users"))))
      .then((data) => setUsers((Array.isArray(data) ? data : []).filter((u: UserRow) => !u.superAdmin)))
      .catch((e) => ToasterService.error(e.message));
    accessApi.roles().then(setRoles).catch((e) => ToasterService.error(e.message));
  }, []);

  const selectUser = useCallback(async (u: UserRow) => {
    setSelectedUser(u);
    try {
      const ids = await accessApi.userRoles(u.userId);
      setOriginal(ids);
      setAssigned(ids);
    } catch (e) {
      ToasterService.error((e as Error).message);
    }
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      !q || `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.username}`.toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggleRole = (id: number) =>
    setAssigned((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const changed =
    assigned.length !== original.length || assigned.some((id) => !original.includes(id));

  const save = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await accessApi.assignRoles(selectedUser.userId, assigned);
      setOriginal(assigned);
      ToasterService.success("Roles updated. Changes apply at the user's next login.");
    } catch (e) {
      ToasterService.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <PageMeta title="User Access" description="Assign roles to users" />
      <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-white">User Access</h1>
      <p className="mb-4 text-sm text-gray-500">
        Choose a user, then the roles they should have. Roles you cannot grant are shown but locked.
      </p>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-900">
          <input
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="Search users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {filteredUsers.map((u) => (
              <li key={u.userId}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    selectedUser?.userId === u.userId ? "bg-cyan-50 text-cyan-700" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => selectUser(u)}
                >
                  <div className="font-medium">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username}
                    {u.userId === user?.userId && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </div>
                  <div className="text-xs text-gray-500">{u.username}</div>
                </button>
              </li>
            ))}
            {filteredUsers.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No users</li>}
          </ul>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
          {!selectedUser ? (
            <p className="text-sm text-gray-500">Select a user to manage their roles.</p>
          ) : (
            <>
              <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{selectedUser.username}</h2>
              <ul className="space-y-2">
                {roles.map((role) => {
                  const locked = !role.grantable;
                  return (
                    <li key={role.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <label className={`flex items-start gap-3 ${locked ? "opacity-60" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={assigned.includes(role.id)}
                          disabled={locked}
                          onChange={() => toggleRole(role.id)}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {role.roleName}
                            {role.systemRole && (
                              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">system</span>
                            )}
                            {locked && <span className="ml-2 text-xs text-gray-400">beyond your authority</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {role.permissions.map((p) => (
                              <span key={p} className="rounded bg-cyan-50 px-1.5 py-0.5 text-[11px] text-cyan-700">{p}</span>
                            ))}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex justify-end gap-2">
                <button className="rounded-lg px-4 py-2 text-sm" disabled={!changed} onClick={() => setAssigned(original)}>
                  Reset
                </button>
                <button
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!changed || saving}
                  onClick={save}
                >
                  Save roles
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

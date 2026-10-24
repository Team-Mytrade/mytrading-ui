import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, Pencil, UserCheck, UserX, X } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { usePermissions } from "../../access/usePermissions";
import { ManagedUser, RoleAccess, UserForm, errorText, userAdminApi } from "../../access/accessApi";
import {
  CARD, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON, STATS_ROW,
} from "../Payroll/hrmsUi";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

const emptyForm = (): UserForm => ({ username: "", email: "", firstName: "", lastName: "", designation: "", roleIds: [] });

const statusOf = (u: ManagedUser) => (!u.active ? "Inactive" : u.invitePending ? "Invite pending" : "Active");

/**
 * The company's logins. New users get no password: they receive a "set your password" email.
 * Roles are limited to what the signed-in user may grant (the server checks the same rule).
 */
export default function UsersPage() {
  const { user } = useContext(AuthContext);
  const { canCreate, canUpdate } = usePermissions();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<RoleAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  // Other pages link here with ?userId= or ?employeeId= to show one person
  const [searchParams, setSearchParams] = useSearchParams();
  const filterUserId = searchParams.get("userId");
  const filterEmployeeId = searchParams.get("employeeId");
  const filtered = filterUserId || filterEmployeeId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([userAdminApi.users(), userAdminApi.roles()]);
      setUsers(u);
      setRoles(r);
    } catch (err) {
      ToasterService.error(errorText(err, "Could not load users."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.active && !u.invitePending).length,
    pending: users.filter((u) => u.active && u.invitePending).length,
    inactive: users.filter((u) => !u.active).length,
  }), [users]);

  const openNew = () => {
    setForm(emptyForm());
    setEditing("new");
  };

  const openEdit = (u: ManagedUser) => {
    setForm({
      username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName,
      designation: u.designation ?? "", roleIds: u.roles.map((r) => r.id),
    });
    setEditing(u);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim() || (editing === "new" && !form.username?.trim())) {
      ToasterService.error("Username, email, first name and last name are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        const result = await userAdminApi.create(form);
        if (result.inviteSent) {
          ToasterService.success(`${result.user.firstName} was added and invited by email to set a password.`);
        } else {
          ToasterService.error(`${result.user.firstName} was added, but the invite email could not be sent. Use "Send invite" to try again.`);
        }
      } else if (editing) {
        await userAdminApi.update(editing.userId, form);
        const before = editing.roles.map((r) => r.id).sort().join(",");
        const after = [...(form.roleIds ?? [])].sort().join(",");
        if (before !== after) {
          await userAdminApi.assignRoles(editing.userId, form.roleIds ?? []);
        }
        ToasterService.success("User updated. Role changes apply from their next sign-in or token refresh.");
      }
      setEditing(null);
      load();
    } catch (err) {
      ToasterService.error(errorText(err, "Could not save the user."));
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async (u: ManagedUser) => {
    try {
      const { inviteSent } = await userAdminApi.invite(u.userId);
      if (inviteSent) ToasterService.success(`A set-password link was emailed to ${u.email}.`);
      else ToasterService.error("The email could not be sent. Check the mail settings of the user service.");
    } catch (err) {
      ToasterService.error(errorText(err, "Could not send the invite."));
    }
  };

  const toggleActive = async (u: ManagedUser) => {
    const verb = u.active ? "Deactivate" : "Activate";
    if (!window.confirm(`${verb} ${u.firstName} ${u.lastName}?${u.active ? " They won't be able to sign in." : ""}`)) return;
    try {
      await userAdminApi.setActive(u.userId, !u.active);
      ToasterService.success(`${u.firstName} ${u.active ? "deactivated" : "activated"}.`);
      load();
    } catch (err) {
      ToasterService.error(errorText(err, `Could not ${verb.toLowerCase()} the user.`));
    }
  };

  const columns: ColumnDef<ManagedUser & { id: string }>[] = [
    {
      key: "name", label: "Name", sortable: true,
      sortValueGetter: (u) => `${u.firstName} ${u.lastName}`,
      render: (u) => (
        <div>
          <span className="block text-xs font-semibold text-slate-900 dark:text-white">{u.firstName} {u.lastName}</span>
          <span className="text-[11px] text-slate-500 dark:text-gray-400">{u.designation || "—"}</span>
        </div>
      ),
    },
    { key: "username", label: "Username", sortable: true },
    { key: "email", label: "Email", sortable: true },
    {
      key: "roles", label: "Roles",
      render: (u) => u.roles.length === 0
        ? <span className="text-[11px] text-amber-600">No role (can only use self-service)</span>
        : (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <span key={r.id} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:border-transparent dark:bg-cyan-950/40 dark:text-cyan-300">
                {r.roleName}
              </span>
            ))}
          </div>
        ),
    },
    { key: "employeeCode", label: "Employee", render: (u) => u.employeeCode || "—" },
    {
      key: "status", label: "Status", sortable: true, sortValueGetter: statusOf,
      render: (u) => {
        const s = statusOf(u);
        const cls = s === "Active" ? "bg-emerald-50 text-emerald-700" : s === "Invite pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
        return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{s}</span>;
      },
    },
    {
      key: "actions", label: "Actions",
      render: (u) => !u.manageable ? (
        <span className="text-[11px] text-slate-400" title="This user has permissions beyond yours, so only a higher administrator can change their account">Restricted</span>
      ) : (
        <div className="flex items-center gap-1">
          {canUpdate && <button type="button" title="Edit" className={ROW_ICON_BUTTON} onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></button>}
          {canUpdate && u.active && (
            <button type="button" title={u.invitePending ? "Resend invite" : "Email a set-password link"} className={ROW_ICON_BUTTON} onClick={() => sendInvite(u)}>
              <Mail className="h-4 w-4" />
            </button>
          )}
          {canUpdate && u.userId !== user?.userId && (
            u.active
              ? <button type="button" title="Deactivate" className={ROW_ICON_BUTTON_DANGER} onClick={() => toggleActive(u)}><UserX className="h-4 w-4" /></button>
              : <button type="button" title="Activate" className={ROW_ICON_BUTTON} onClick={() => toggleActive(u)}><UserCheck className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  const assignedIds = new Set(form.roleIds ?? []);
  const toggleRole = (id: number) =>
    setForm((f) => ({ ...f, roleIds: assignedIds.has(id) ? (f.roleIds ?? []).filter((r) => r !== id) : [...(f.roleIds ?? []), id] }));

  return (
    <>
      <PageMeta title="Users" description="Company users, their roles and invites" />
      <PageBreadcrumb pageTitle="Users" actions={canCreate ? <AddButton label="Add user" onClick={openNew} /> : undefined} />

      <div className={PAGE_BODY}>
        <div className={STATS_ROW}>
          <StatsCard label="Users" value={stats.total} loading={loading} />
          <StatsCard label="Active" value={stats.active} loading={loading} />
          <StatsCard label="Invite pending" value={stats.pending} loading={loading} />
          <StatsCard label="Inactive" value={stats.inactive} loading={loading} />
        </div>

        {filtered && (
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-gray-300">
            Showing one user.
            <button type="button" className="font-semibold text-cyan-600 hover:underline" onClick={() => setSearchParams({})}>Show all users</button>
          </div>
        )}
        <ReusableTable
          data={users
            .filter((u) => (!filterUserId || u.userId === filterUserId) && (!filterEmployeeId || String(u.employeeId) === filterEmployeeId))
            .map((u) => ({ ...u, id: u.userId }))}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="name"
          searchable
          searchPlaceholder="Search name, username or email"
          enableRowDetails={false}
        />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className={`${CARD} w-full max-w-lg space-y-4 p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editing === "new" ? "Add user" : `Edit ${editing.firstName} ${editing.lastName}`}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>First name *</label>
                <input className={INPUT} value={form.firstName} maxLength={100} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Last name *</label>
                <input className={INPUT} value={form.lastName} maxLength={100} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Username (to sign in) *</label>
                <input className={INPUT} value={form.username} disabled={editing !== "new"} maxLength={150}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. asha.rao@company.com" />
              </div>
              <div>
                <label className={LABEL}>Email *</label>
                <input className={INPUT} type="email" value={form.email} maxLength={150} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Designation</label>
                <input className={INPUT} value={form.designation ?? ""} maxLength={100} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </div>
            </div>

            <div>
              <label className={LABEL}>Roles</label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-gray-700">
                {roles.length === 0 && <p className="text-xs text-slate-400">No roles yet.</p>}
                {roles.map((r) => (
                  <label key={r.id} className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs ${r.grantable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#222222]" : "opacity-50"}`}
                    title={r.grantable ? r.permissions.join(", ") : "You can't grant this role: it includes permissions you may not hand out"}>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={assignedIds.has(r.id)} disabled={!r.grantable} onChange={() => toggleRole(r.id)} />
                      <span className="font-medium text-slate-800 dark:text-gray-200">{r.roleName}</span>
                      {r.systemRole && <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-[#2a2a2a]">system</span>}
                    </span>
                    <span className="text-[10px] text-slate-400">{r.permissions.length} permission(s)</span>
                  </label>
                ))}
              </div>
              {editing === "new" && (
                <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">
                  No password is set here: the user gets an email to choose their own.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>
                {saving ? "Saving..." : editing === "new" ? "Add and send invite" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

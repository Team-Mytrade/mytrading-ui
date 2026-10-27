import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { Lock, Pencil, ShieldCheck, ShieldOff, SlidersHorizontal, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { AppModule, MODULE_LABELS, PERMISSION_ACTIONS } from "../../access/access";
import { RoleAccess, errorText, userAdminApi } from "../../access/accessApi";
import {
  CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON, STATS_ROW,
} from "../Payroll/hrmsUi";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

const ACTION_LABELS: Record<string, string> = {
  VIEW: "View", CREATE: "Create", UPDATE: "Edit", DELETE: "Delete", APPROVE: "Approve", EXPORT: "Export", ADMIN: "Admin (all)",
};

/** Draft being edited: null = nothing selected, id null = a new role. */
interface Draft {
  id: number | null;
  roleName: string;
  permissions: Set<string>;
}

/**
 * The company's roles as a module × action grid. System roles come from the platform and are read-only;
 * custom roles can only contain permissions the signed-in user may grant (checked again on the server).
 */
export default function RolesPage() {
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [roles, setRoles] = useState<RoleAccess[]>([]);
  const [modules, setModules] = useState<AppModule[]>([]);
  const [grantable, setGrantable] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m, g] = await Promise.all([userAdminApi.roles(), userAdminApi.modules(), userAdminApi.grantable()]);
      setRoles(r);
      setModules(m.filter((x) => x in MODULE_LABELS));
      setGrantable(new Set(g));
      return r;
    } catch (err) {
      ToasterService.error(errorText(err, "Could not load roles."));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().then((r) => r.length && setSelectedId((id) => id ?? r[0].id));
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const editing = draft !== null;
  // System roles are platform-managed: only the Super Admin may change their permissions (the server allows it)
  const { access } = useContext(AuthContext);
  const canEditSelected = Boolean(selected && (!selected.systemRole || access.superAdmin));
  const shown: Set<string> = draft ? draft.permissions : new Set(selected?.permissions ?? []);

  const stats = useMemo(() => ({
    total: roles.length,
    system: roles.filter((r) => r.systemRole).length,
    custom: roles.filter((r) => !r.systemRole).length,
    unused: roles.filter((r) => (r.userCount ?? 0) === 0).length,
  }), [roles]);

  const startNew = () => setDraft({ id: null, roleName: "", permissions: new Set() });

  const startEdit = (r: RoleAccess) => {
    setSelectedId(r.id);
    setDraft({ id: r.id, roleName: r.roleName, permissions: new Set(r.permissions) });
  };

  const toggle = (module: AppModule, action: string) => {
    if (!draft) return;
    const code = `${module}:${action}`;
    const next = new Set(draft.permissions);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setDraft({ ...draft, permissions: next });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.roleName.trim()) {
      ToasterService.error("Give the role a name.");
      return;
    }
    if (draft.permissions.size === 0) {
      ToasterService.error("Tick at least one permission.");
      return;
    }
    setSaving(true);
    try {
      const codes = [...draft.permissions];
      const saved = draft.id === null
        ? await userAdminApi.createRole(draft.roleName.trim(), codes)
        : await userAdminApi.updateRole(draft.id, draft.roleName.trim(), codes);
      ToasterService.success(draft.id === null ? "Role created." : "Role saved. Users get the change from their next sign-in or token refresh.");
      setDraft(null);
      await load();
      setSelectedId(saved.id);
    } catch (err) {
      ToasterService.error(errorText(err, "Could not save the role."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: RoleAccess) => {
    if (!window.confirm(`Delete the role "${r.roleName}"?`)) return;
    try {
      await userAdminApi.deleteRole(r.id);
      ToasterService.success("Role deleted.");
      if (selectedId === r.id) setSelectedId(null);
      setDraft(null);
      load();
    } catch (err) {
      ToasterService.error(errorText(err, "Could not delete the role."));
    }
  };

  return (
    <>
      <PageMeta title="Roles & Permissions" description="Roles and what each one may do" />
      <PageBreadcrumb pageTitle="Roles & Permissions" actions={<AddButton label="New role" onClick={startNew} disabled={editing} />} />

      <div className={PAGE_BODY}>
        <div className={STATS_ROW}>
          <StatsCard label="Roles" value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<ShieldCheck />} loading={loading} />
          <StatsCard label="System roles" value={stats.system} gradient="from-purple-50 to-indigo-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<Lock />} loading={loading} />
          <StatsCard label="Custom roles" value={stats.custom} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<SlidersHorizontal />} loading={loading} />
          <StatsCard label="Not assigned" value={stats.unused} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ShieldOff />} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* The role list scrolls on its own so the page fits the screen (breadcrumb + stat row ≈ 108px) */}
          <div className={`${CARD} p-2 lg:max-h-[calc(100cqh-108px)] lg:overflow-y-auto`}>
            {roles.length === 0 && !loading && <p className="p-3 text-xs text-slate-400">No roles yet.</p>}
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={editing}
                onClick={() => setSelectedId(r.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed ${
                  r.id === selectedId && draft?.id !== null ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200" : "text-slate-700 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-[#222222]"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {r.systemRole && <Lock className="h-3 w-3 shrink-0 text-slate-400" />}
                  {r.roleName}
                </span>
                <span className="shrink-0 text-[10px] text-slate-400">{r.userCount ?? 0} user(s)</span>
              </button>
            ))}
          </div>

          <div className={`${CARD} p-4`}>
            {!draft && !selected ? (
              <p className="text-xs text-slate-400">Select a role to see its permissions.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  {draft ? (
                    <input className={`${INPUT} max-w-sm`} value={draft.roleName} maxLength={100} autoFocus
                      placeholder="Role name, e.g. Sales Executive" onChange={(e) => setDraft({ ...draft, roleName: e.target.value })} />
                  ) : (
                    <div>
                      <h3 className={CARD_TITLE}>{selected!.roleName}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400">
                        {selected!.systemRole
                          ? access.superAdmin
                            ? `System role (${selected!.userCount ?? 0} user(s)): as Super Admin you can change its permissions.`
                            : "System role: only the Super Admin can change it. Create a custom role for different permissions."
                          : `${selected!.userCount ?? 0} user(s) have this role.`}
                        {!selected!.grantable && " Includes permissions you can't grant."}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {draft ? (
                      <>
                        <button type="button" className={SECONDARY_BUTTON} onClick={() => setDraft(null)}>Cancel</button>
                        <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={save}>{saving ? "Saving..." : "Save role"}</button>
                      </>
                    ) : selected && canEditSelected && (
                      <>
                        {canUpdate && selected.grantable && (
                          <button type="button" title="Edit role" className={ROW_ICON_BUTTON} onClick={() => startEdit(selected)}><Pencil className="h-4 w-4" /></button>
                        )}
                        {canDelete && !selected.systemRole && (
                          <button type="button" title={(selected.userCount ?? 0) > 0 ? "Remove it from its users first" : "Delete role"}
                            disabled={(selected.userCount ?? 0) > 0} className={`${ROW_ICON_BUTTON_DANGER} disabled:opacity-40`} onClick={() => remove(selected)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-gray-700 dark:text-gray-400">
                        <th className="py-2 pr-3 text-left font-semibold">Module</th>
                        {PERMISSION_ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center font-semibold">{ACTION_LABELS[a]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((m) => {
                        const admin = shown.has(`${m}:ADMIN`);
                        return (
                          <tr key={m} className="border-b border-slate-100 last:border-0 dark:border-gray-800">
                            <td className="py-2 pr-3 font-medium text-slate-800 dark:text-gray-200">{MODULE_LABELS[m]}</td>
                            {PERMISSION_ACTIONS.map((a) => {
                              const code = `${m}:${a}`;
                              const implied = admin && a !== "ADMIN";
                              const allowed = grantable.has(code);
                              return (
                                <td key={a} className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`${MODULE_LABELS[m]} ${ACTION_LABELS[a]}`}
                                    checked={shown.has(code) || implied}
                                    disabled={!draft || implied || (!allowed && !shown.has(code))}
                                    title={implied ? "Included in Admin" : draft && !allowed ? "You can't grant this permission" : undefined}
                                    onChange={() => toggle(m, a)}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {draft && (
                  <p className="mt-3 text-[11px] text-slate-500 dark:text-gray-400">
                    Greyed boxes are permissions you don't hold or don't administer. Admin includes every action of its module.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {!canCreate && !canUpdate && <p className="mt-3 text-[11px] text-slate-400">You can view roles but not change them.</p>}
      </div>
    </>
  );
}

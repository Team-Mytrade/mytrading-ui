import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import { StatusBadge, Toggle } from "../roleconfig/RoleConfigShared";
import { APP_MODULES, AppModule, MODULE_LABELS, getSelectedTenant, setSelectedTenant } from "../../access/access";
import { TenantAccess, platformApi } from "../../access/accessApi";

const OPTIONAL_MODULES = APP_MODULES.filter((m) => m !== "USERS");

const emptyForm = {
  tenantName: "",
  modules: [] as AppModule[],
  username: "",
  firstName: "",
  lastName: "",
  password: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white";

/** Super Admin: create tenants, choose their modules, activate/deactivate, and switch into a tenant. */
export default function TenantsPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<TenantAccess | null>(null);
  const [editModules, setEditModules] = useState<AppModule[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const selected = getSelectedTenant();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTenants(await platformApi.tenants());
    } catch (e) {
      ToasterService.error((e as Error).message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (list: AppModule[], module: AppModule) =>
    list.includes(module) ? list.filter((m) => m !== module) : [...list, module];

  const saveModules = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await platformApi.setModules(editing.tenantId, editModules);
      ToasterService.success(`Modules updated for ${editing.tenantName}`);
      setEditing(null);
      load();
    } catch (e) {
      ToasterService.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (tenant: TenantAccess, active: boolean) => {
    try {
      await platformApi.setActive(tenant.tenantId, active);
      ToasterService.success(`${tenant.tenantName} ${active ? "activated" : "deactivated"}`);
      load();
    } catch (e) {
      ToasterService.error((e as Error).message);
    }
  };

  const provision = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      ToasterService.error("Admin password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await platformApi.provision({
        tenantName: form.tenantName.trim(),
        modules: form.modules,
        admin: {
          username: form.username.trim(),
          email: form.username.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          password: form.password,
        },
      });
      ToasterService.success(`Tenant ${form.tenantName} created`);
      setCreating(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      ToasterService.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const workIn = (tenantId: string | null) => {
    setSelectedTenant(tenantId);
    ToasterService.success(tenantId ? `Now working in ${tenantId}` : "Now working across all tenants");
    navigate("/");
  };

  const moduleChecklist = (value: AppModule[], onChange: (v: AppModule[]) => void) => (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONAL_MODULES.map((m) => (
        <label key={m} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={value.includes(m)} onChange={() => onChange(toggle(value, m))} />
          {MODULE_LABELS[m]}
        </label>
      ))}
      <p className="col-span-2 text-xs text-gray-500">Users is a core module and is always enabled.</p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-3">
      <PageMeta title="Tenants & Modules" description="Manage tenants and the modules they can use" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tenants & Modules</h1>
          <p className="text-sm text-gray-500">
            {selected ? (
              <>
                Working in tenant <b>{selected}</b>.{" "}
                <button className="text-cyan-600 underline" onClick={() => workIn(null)}>Switch to all tenants</button>
              </>
            ) : (
              "Working across all tenants."
            )}
          </p>
        </div>
        <button
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          onClick={() => setCreating(true)}
        >
          New tenant
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No tenants yet</td></tr>
            )}
            {tenants.map((t) => (
              <tr key={t.tenantId}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{t.tenantName}</div>
                  <div className="text-xs text-gray-500">{t.tenantId}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {t.modules.map((m) => (
                      <span key={m} className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">
                        {MODULE_LABELS[m] ?? m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Toggle value={t.active} onChange={(v) => setActive(t, v)} />
                    <StatusBadge active={t.active} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    className="mr-3 text-cyan-600 hover:underline"
                    onClick={() => {
                      setEditing(t);
                      setEditModules(t.modules.filter((m) => m !== "USERS"));
                    }}
                  >
                    Modules
                  </button>
                  <button
                    className="text-gray-700 hover:underline disabled:text-gray-400 dark:text-gray-300"
                    disabled={selected === t.tenantId}
                    onClick={() => workIn(t.tenantId)}
                  >
                    {selected === t.tenantId ? "Current" : "Work in tenant"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Modules for {editing.tenantName}
            </h2>
            {moduleChecklist(editModules, setEditModules)}
            <div className="mt-6 flex justify-end gap-2">
              <button className="rounded-lg px-4 py-2 text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={saving}
                onClick={saveModules}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={provision}
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">New tenant</h2>
            <div className="space-y-3">
              <input className={inputClass} placeholder="Organisation name" required value={form.tenantName}
                onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Modules</p>
                {moduleChecklist(form.modules, (modules) => setForm({ ...form, modules }))}
              </div>
              <p className="pt-2 text-sm font-medium text-gray-700 dark:text-gray-300">Tenant Admin</p>
              <input className={inputClass} type="email" placeholder="Email (login)" required value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="First name" required value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <input className={inputClass} placeholder="Last name" required value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <input className={inputClass} type="password" autoComplete="new-password" required
                placeholder="Initial password (min 8 characters)" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Create tenant
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

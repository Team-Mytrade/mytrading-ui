import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LogIn, Mail, Pencil, Power, X } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import { APP_MODULES, AppModule, MODULE_LABELS, getSelectedTenant, setSelectedTenant } from "../../access/access";
import { TenantAccess, TenantAdmin, platformApi } from "../../access/accessApi";
import {
  CARD, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON, STATS_ROW,
} from "../Payroll/hrmsUi";

const OPTIONAL_MODULES = APP_MODULES.filter((m) => m !== "USERS");
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const EMAIL = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

const emptyForm = { tenantName: "", modules: [] as AppModule[], email: "", firstName: "", lastName: "" };

const message = (e: unknown, fallback: string) => (e as Error)?.message || fallback;

/**
 * Super Admin: the companies on the platform. Create one (its first Tenant Administrator is invited by
 * email), rename it, choose its modules, switch it on or off, resend the admin's invite, or work inside it.
 */
export default function TenantsPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<TenantAccess | null>(null);
  const [editName, setEditName] = useState("");
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
      ToasterService.error(message(e, "Could not load tenants."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.active).length,
    inactive: tenants.filter((t) => !t.active).length,
    users: tenants.reduce((sum, t) => sum + (t.userCount ?? 0), 0),
  }), [tenants]);

  const toggle = (list: AppModule[], module: AppModule) =>
    list.includes(module) ? list.filter((m) => m !== module) : [...list, module];

  const openEdit = (t: TenantAccess) => {
    setEditing(t);
    setEditName(t.tenantName);
    setEditModules(t.modules.filter((m) => m !== "USERS"));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      ToasterService.error("Enter the company name.");
      return;
    }
    setSaving(true);
    try {
      if (editName.trim() !== editing.tenantName) await platformApi.rename(editing.tenantId, editName.trim());
      const before = [...editing.modules].filter((m) => m !== "USERS").sort().join(",");
      if ([...editModules].sort().join(",") !== before) await platformApi.setModules(editing.tenantId, editModules);
      ToasterService.success(`${editName.trim()} saved.`);
      setEditing(null);
      load();
    } catch (e) {
      ToasterService.error(message(e, "Could not save the tenant."));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (t: TenantAccess) => {
    const verb = t.active ? "Deactivate" : "Activate";
    if (!window.confirm(`${verb} ${t.tenantName}?${t.active ? " None of its users will be able to sign in." : ""}`)) return;
    try {
      await platformApi.setActive(t.tenantId, !t.active);
      ToasterService.success(`${t.tenantName} ${t.active ? "deactivated" : "activated"}.`);
      load();
    } catch (e) {
      ToasterService.error(message(e, `Could not ${verb.toLowerCase()} the tenant.`));
    }
  };

  const inviteAdmin = async (t: TenantAccess, admin: TenantAdmin) => {
    try {
      const { inviteSent } = await platformApi.inviteAdmin(t.tenantId, admin.userId);
      if (inviteSent) ToasterService.success(`A set-password link was emailed to ${admin.email}.`);
      else ToasterService.error("The email could not be sent. Check the mail settings of the user service.");
    } catch (e) {
      ToasterService.error(message(e, "Could not send the invite."));
    }
  };

  const provision = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.tenantName.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      ToasterService.error("Company name and the admin's first and last name are required.");
      return;
    }
    if (!EMAIL.test(form.email.trim())) {
      ToasterService.error("Enter the admin's email address.");
      return;
    }
    setSaving(true);
    try {
      const email = form.email.trim().toLowerCase();
      const { tenant, inviteSent } = await platformApi.provision({
        tenantName: form.tenantName.trim(),
        modules: form.modules,
        admin: { username: email, email, firstName: form.firstName.trim(), lastName: form.lastName.trim() },
      });
      if (inviteSent) ToasterService.success(`${tenant.tenantName} created. ${form.firstName.trim()} was emailed a link to set a password.`);
      else ToasterService.error(`${tenant.tenantName} was created, but the invite email could not be sent. Use "Send invite" to try again.`);
      setCreating(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      ToasterService.error(message(err, "Could not create the tenant."));
    } finally {
      setSaving(false);
    }
  };

  const workIn = (tenantId: string | null) => {
    setSelectedTenant(tenantId);
    ToasterService.success(tenantId ? `Now working in ${tenants.find((t) => t.tenantId === tenantId)?.tenantName ?? tenantId}` : "Now working across all tenants");
    navigate("/");
  };

  const moduleChecklist = (value: AppModule[], onChange: (v: AppModule[]) => void) => (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 dark:border-gray-700">
        {OPTIONAL_MODULES.map((m) => (
          <label key={m} className="flex items-center gap-2 text-xs text-slate-700 dark:text-gray-300">
            <input type="checkbox" checked={value.includes(m)} onChange={() => onChange(toggle(value, m))} />
            {MODULE_LABELS[m]}
          </label>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Users is a core module and is always on.</p>
    </div>
  );

  const columns: ColumnDef<TenantAccess & { id: string }>[] = [
    {
      key: "tenantName", label: "Company", sortable: true,
      render: (t) => (
        <div>
          <span className="block text-xs font-semibold text-slate-900 dark:text-white">
            {t.tenantName}
            {selected === t.tenantId && <span className="ml-2 rounded bg-cyan-50 px-1.5 text-[10px] font-semibold text-cyan-700">working here</span>}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-gray-400">{t.tenantId}</span>
        </div>
      ),
    },
    {
      key: "modules", label: "Modules",
      render: (t) => (
        <div className="flex max-w-xs flex-wrap gap-1">
          {t.modules.map((m) => (
            <span key={m} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:border-transparent dark:bg-cyan-950/40 dark:text-cyan-300">
              {MODULE_LABELS[m] ?? m}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "admins", label: "Tenant admin",
      render: (t) => t.admins.length === 0 ? <span className="text-[11px] text-amber-600">None</span> : (
        <div className="space-y-1">
          {t.admins.map((a) => (
            <div key={a.userId} className="flex items-start gap-1">
              {a.active && (
                <button type="button" title={a.invitePending ? "Resend invite" : "Email a set-password link"} className={`${ROW_ICON_BUTTON} shrink-0`}
                  onClick={() => inviteAdmin(t, a)}>
                  <Mail className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0">
                <span className="block truncate text-xs text-slate-800 dark:text-gray-200">{a.fullName}</span>
                <span className="block truncate text-[11px] text-slate-500">{a.email}</span>
                {a.invitePending && <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Invite pending</span>}
                {!a.active && <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Inactive</span>}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    { key: "userCount", label: "Users", sortable: true },
    {
      key: "active", label: "Status", sortable: true, sortValueGetter: (t) => (t.active ? "Active" : "Inactive"),
      render: (t) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {t.active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions", label: "Actions",
      render: (t) => (
        <div className="flex items-center gap-1">
          <button type="button" title="Edit name and modules" className={ROW_ICON_BUTTON} onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></button>
          <button type="button" title={selected === t.tenantId ? "Already working here" : "Work in this tenant"} className={ROW_ICON_BUTTON}
            disabled={selected === t.tenantId || !t.active} onClick={() => workIn(t.tenantId)}>
            <LogIn className="h-4 w-4" />
          </button>
          <button type="button" title={t.active ? "Deactivate" : "Activate"} className={t.active ? ROW_ICON_BUTTON_DANGER : ROW_ICON_BUTTON}
            onClick={() => setActive(t)}>
            <Power className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tenants & Modules" description="Companies on the platform and the modules they use" />
      <PageBreadcrumb pageTitle="Tenants & Modules" actions={<AddButton label="New tenant" permission={null} onClick={() => setCreating(true)} />} />

      <div className={PAGE_BODY}>
        <div className={STATS_ROW}>
          <StatsCard label="Tenants" value={stats.total} loading={loading} />
          <StatsCard label="Active" value={stats.active} loading={loading} />
          <StatsCard label="Inactive" value={stats.inactive} loading={loading} />
          <StatsCard label="Users" value={stats.users} loading={loading} />
        </div>

        <div className="mb-3 text-xs text-slate-600 dark:text-gray-300">
          {selected ? (
            <>
              Working in <b>{tenants.find((t) => t.tenantId === selected)?.tenantName ?? selected}</b>.{" "}
              <button type="button" className="font-semibold text-cyan-600 hover:underline" onClick={() => workIn(null)}>Switch to all tenants</button>
            </>
          ) : (
            "Working across all tenants. Use the sign-in icon on a row to work inside one company."
          )}
        </div>

        <ReusableTable
          data={tenants.map((t) => ({ ...t, id: t.tenantId }))}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="tenantName"
          searchable
          searchPlaceholder="Search company or tenant id"
          enableRowDetails={false}
        />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD} w-full max-w-lg space-y-4 p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Edit {editing.tenantName}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className={LABEL} htmlFor="tenant-edit-name">Company name</label>
              <input id="tenant-edit-name" className={INPUT} value={editName} maxLength={255} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Modules</label>
              {moduleChecklist(editModules, setEditModules)}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={saveEdit}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={provision} className={`${CARD} max-h-full w-full max-w-lg space-y-4 overflow-y-auto p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">New tenant</h3>
              <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className={LABEL} htmlFor="tenant-name">Company name *</label>
              <input id="tenant-name" className={INPUT} value={form.tenantName} maxLength={255}
                onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Modules</label>
              {moduleChecklist(form.modules, (modules) => setForm({ ...form, modules }))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-gray-200">Tenant Administrator</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="tenant-admin-first">First name *</label>
                  <input id="tenant-admin-first" className={INPUT} value={form.firstName} maxLength={100}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="tenant-admin-last">Last name *</label>
                  <input id="tenant-admin-last" className={INPUT} value={form.lastName} maxLength={100}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL} htmlFor="tenant-admin-email">Email (also their username) *</label>
                  <input id="tenant-admin-email" className={INPUT} type="email" value={form.email} maxLength={150}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">
                They get an email to set their own password, then fill in the company details under Company Settings.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>{saving ? "Creating..." : "Create and send invite"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

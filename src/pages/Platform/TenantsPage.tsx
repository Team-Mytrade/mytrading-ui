import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Building2, CheckCircle2, LogIn, Mail, PauseCircle, Pencil, Power, PowerOff, Trash2, X } from "lucide-react";
import TenantClosureDialog, { TenantClosure, closing, closureApi } from "./TenantClosureDialog";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import { APP_MODULES, AppModule, MODULE_LABELS, getSelectedTenant, setSelectedTenant } from "../../access/access";
import { TenantAccess, TenantAdmin, TenantStatus, platformApi, tenantStatusOf } from "../../access/accessApi";
import {
  CARD, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON, STATS_ROW,
} from "../Payroll/hrmsUi";
import { formatDate } from "../../company/format";

import { t as tr } from "../../i18n/i18n";
const OPTIONAL_MODULES = APP_MODULES.filter((m) => m !== "USERS");
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const EMAIL = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

const emptyForm = { tenantName: "", modules: [] as AppModule[], email: "", firstName: "", lastName: "" };

const message = (e: unknown, fallback: string) => (e as Error)?.message || fallback;

const STATUS: Record<TenantStatus, { label: string; chip: string; effect: string }> = {
  ACTIVE: {
    label: "Active", chip: "bg-emerald-50 text-emerald-700",
    effect: "Its users can sign in and work as usual.",
  },
  SUSPENDED: {
    label: "Suspended", chip: "bg-amber-50 text-amber-700",
    effect: "Its users can't sign in, and open sessions end within 15 minutes. Use it for a temporary stop such as an unpaid subscription; nothing is deleted.",
  },
  INACTIVE: {
    label: "Inactive", chip: "bg-slate-100 text-slate-500",
    effect: "The account is closed: its users can't sign in, and open sessions end within 15 minutes. Its data is kept and it can be made active again.",
  },
};

const changedOn = (value?: string | null) =>
  value ? formatDate(value) : "";

/**
 * Super Admin: the companies on the platform. Create one (its first Tenant Administrator is invited by
 * email), rename it, choose its modules, suspend or close it, resend the admin's invite, or work inside it.
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
  const [statusFor, setStatusFor] = useState<TenantAccess | null>(null);
  const [nextStatus, setNextStatus] = useState<TenantStatus>("ACTIVE");
  const [reason, setReason] = useState("");
  const [closures, setClosures] = useState<Record<string, TenantClosure>>({});
  const [closureFor, setClosureFor] = useState<TenantAccess | null>(null);
  const selected = getSelectedTenant();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTenants(await platformApi.tenants());
      closureApi.all().then((list) => setClosures(Object.fromEntries(list.map((c) => [c.tenantId, c])))).catch(() => undefined);
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
    active: tenants.filter((t) => tenantStatusOf(t) === "ACTIVE").length,
    suspended: tenants.filter((t) => tenantStatusOf(t) === "SUSPENDED").length,
    inactive: tenants.filter((t) => tenantStatusOf(t) === "INACTIVE").length,
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

  const openStatus = (t: TenantAccess) => {
    setStatusFor(t);
    // Offer the likely next step: suspend an active company, reactivate a stopped one
    setNextStatus(tenantStatusOf(t) === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
    setReason("");
  };

  const saveStatus = async () => {
    if (!statusFor) return;
    if (nextStatus !== "ACTIVE" && !reason.trim()) {
      ToasterService.error(`Give the reason for ${nextStatus === "SUSPENDED" ? "suspending" : "deactivating"} ${statusFor.tenantName}.`);
      return;
    }
    setSaving(true);
    try {
      await platformApi.setStatus(statusFor.tenantId, nextStatus, reason.trim());
      ToasterService.success(`${statusFor.tenantName} is now ${STATUS[nextStatus].label.toLowerCase()}.`);
      setStatusFor(null);
      load();
    } catch (e) {
      ToasterService.error(message(e, "Could not change the status."));
    } finally {
      setSaving(false);
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
      <p className="mt-1 text-[11px] text-slate-500">{tr("Users is a core module and is always on.")}</p>
    </div>
  );

  const columns: ColumnDef<TenantAccess & { id: string }>[] = [
    {
      key: "tenantName", label: "Company", sortable: true,
      render: (t) => (
        <div>
          <span className="block text-xs font-semibold text-slate-900 dark:text-white">
            {t.tenantName}
            {selected === t.tenantId && <span className="ml-2 rounded bg-cyan-50 px-1.5 text-[10px] font-semibold text-cyan-700">{tr("working here")}</span>}
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
      render: (t) => t.admins.length === 0 ? <span className="text-[11px] text-amber-600">{tr("None")}</span> : (
        <div className="space-y-1">
          {t.admins.map((a) => (
            <div key={a.userId} className="flex items-start gap-1">
              {a.active && (
                <button type="button" title={tr(a.invitePending ? "Resend invite" : "Email a set-password link")} className={`${ROW_ICON_BUTTON} shrink-0`}
                  onClick={() => inviteAdmin(t, a)}>
                  <Mail className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0">
                <span className="block truncate text-xs text-slate-800 dark:text-gray-200">{a.fullName}</span>
                <span className="block truncate text-[11px] text-slate-500">{a.email}</span>
                {a.invitePending && <span className="mt-0.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{tr("Invite pending")}</span>}
                {!a.active && <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{tr("Inactive")}</span>}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    { key: "userCount", label: "Users", sortable: true },
    {
      key: "status", label: "Status", sortable: true, sortValueGetter: (t) => STATUS[tenantStatusOf(t)].label,
      render: (t) => {
        const status = STATUS[tenantStatusOf(t)];
        return (
          <div className="max-w-[14rem]">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>{status.label}</span>
            {t.statusReason && (
              <span className="mt-1 block truncate text-[11px] text-slate-500 dark:text-gray-400" title={t.statusReason}>
                {t.statusReason}
              </span>
            )}
            {t.statusChangedAt && <span className="block text-[10px] text-slate-400">{tr("since")} {changedOn(t.statusChangedAt)}</span>}
            {closing(closures[t.tenantId]) && (
              <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                {closures[t.tenantId].status === "DELETED" ? tr("Data deleted")
                  : `${tr("Data deleted after")} ${formatDate(`${closures[t.tenantId].deleteAfter}Z`)}`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions", label: "Actions",
      render: (t) => (
        <div className="flex items-center gap-1">
          <button type="button" title={tr("Edit name and modules")} className={ROW_ICON_BUTTON} onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></button>
          <button type="button" title={tr(selected === t.tenantId ? "Already working here" : "Work in this tenant")} className={ROW_ICON_BUTTON}
            disabled={selected === t.tenantId || !t.active} onClick={() => workIn(t.tenantId)}>
            <LogIn className="h-4 w-4" />
          </button>
          {!closing(closures[t.tenantId]) && (
            <button type="button" title={tr("Change status (suspend, close or reactivate)")} className={t.active ? ROW_ICON_BUTTON_DANGER : ROW_ICON_BUTTON}
              onClick={() => openStatus(t)}>
              <Power className="h-4 w-4" />
            </button>
          )}
          <button type="button" title={tr(closing(closures[t.tenantId]) ? "Closure and final export" : "Close the company and delete its data")}
            className={ROW_ICON_BUTTON_DANGER} onClick={() => setClosureFor(t)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={tr("Tenants & Modules")} description="Companies on the platform and the modules they use" />
      <PageBreadcrumb pageTitle="Tenants & Modules" actions={<AddButton label={tr("New tenant")} permission={null} onClick={() => setCreating(true)} />} />

      <div className={PAGE_BODY}>
        <div className={STATS_ROW}>
          <StatsCard label={tr("Tenants")} value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<Building2 />} loading={loading} />
          <StatsCard label={tr("Active")} value={stats.active} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircle2 />} loading={loading} />
          <StatsCard label={tr("Suspended")} value={stats.suspended} gradient="from-amber-50 to-orange-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<PauseCircle />} loading={loading} />
          <StatsCard label={tr("Inactive")} value={stats.inactive} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" icon={<PowerOff />} loading={loading} />
        </div>

        <div className="mb-3 text-xs text-slate-600 dark:text-gray-300">
          {selected ? (
            <>
              Working in <b>{tenants.find((t) => t.tenantId === selected)?.tenantName ?? selected}</b>.{" "}
              <button type="button" className="font-semibold text-cyan-600 hover:underline" onClick={() => workIn(null)}>{tr("Switch to all tenants")}</button>
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
          searchPlaceholder={tr("Search company or tenant id")}
          enableRowDetails={false}
        />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD} w-full max-w-lg space-y-4 p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tr("Edit")} {editing.tenantName}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className={LABEL} htmlFor="tenant-edit-name">{tr("Company name")}</label>
              <input id="tenant-edit-name" className={INPUT} value={editName} maxLength={255} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>{tr("Modules")}</label>
              {moduleChecklist(editModules, setEditModules)}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(null)}>{tr("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={saveEdit}>{tr(saving ? "Saving..." : "Save")}</button>
            </div>
          </div>
        </div>
      )}

      {closureFor && (
        <TenantClosureDialog tenant={closureFor} closure={closures[closureFor.tenantId]} onClose={() => setClosureFor(null)}
          onChanged={(c) => {
            setClosures((all) => ({ ...all, [c.tenantId]: c }));
            if (c.status === "CANCELLED") setClosureFor(null);
            load();
          }} />
      )}

      {statusFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${CARD} w-full max-w-lg space-y-4 p-5`} role="dialog" aria-labelledby="tenant-status-title">
            <div className="flex items-center justify-between">
              <h3 id="tenant-status-title" className="text-sm font-semibold text-slate-900 dark:text-white">{tr("Status of")} {statusFor.tenantName}</h3>
              <button type="button" onClick={() => setStatusFor(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-600 dark:text-gray-300">
              {tr("Now")} <b>{STATUS[tenantStatusOf(statusFor)].label}</b>
              {statusFor.statusChangedAt && <> since {changedOn(statusFor.statusChangedAt)}</>}
              {statusFor.statusReason && <>: {statusFor.statusReason}</>}
            </p>
            <div>
              <label className={LABEL} htmlFor="tenant-status">{tr("New status")}</label>
              <select id="tenant-status" className={INPUT} value={nextStatus} onChange={(e) => setNextStatus(e.target.value as TenantStatus)}>
                {(Object.keys(STATUS) as TenantStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{STATUS[nextStatus].effect}</p>
            </div>
            <div>
              <label className={LABEL} htmlFor="tenant-status-reason">
                {nextStatus === "ACTIVE" ? "Note (optional)" : "Reason *"}
              </label>
              <textarea id="tenant-status-reason" className={INPUT} rows={3} maxLength={500} value={reason}
                placeholder={nextStatus === "ACTIVE" ? "e.g. Payment received" : nextStatus === "SUSPENDED" ? "e.g. Subscription unpaid since 1 Oct" : "e.g. Customer cancelled the contract"}
                onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setStatusFor(null)}>{tr("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={saving || (nextStatus === "ACTIVE" && tenantStatusOf(statusFor) === "ACTIVE")}
                onClick={saveStatus}>
                {saving ? "Saving..." : nextStatus === "ACTIVE" ? "Make active" : nextStatus === "SUSPENDED" ? "Suspend" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={provision} className={`${CARD} max-h-full w-full max-w-lg space-y-4 overflow-y-auto p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tr("New tenant")}</h3>
              <button type="button" onClick={() => setCreating(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className={LABEL} htmlFor="tenant-name">{tr("Company name *")}</label>
              <input id="tenant-name" className={INPUT} value={form.tenantName} maxLength={255}
                onChange={(e) => setForm({ ...form, tenantName: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>{tr("Modules")}</label>
              {moduleChecklist(form.modules, (modules) => setForm({ ...form, modules }))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-gray-200">{tr("Tenant Administrator")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="tenant-admin-first">{tr("First name *")}</label>
                  <input id="tenant-admin-first" className={INPUT} value={form.firstName} maxLength={100}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="tenant-admin-last">{tr("Last name *")}</label>
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
                {tr("They get an email to set their own password, then fill in the company details under Company Settings.")}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setCreating(false)}>{tr("Cancel")}</button>
              <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>{tr(saving ? "Creating..." : "Create and send invite")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

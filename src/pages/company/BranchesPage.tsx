import { useContext, useMemo, useState } from "react";
import { Building2, GitBranch, Pencil, Star, X } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { getSelectedTenant, hasPermission } from "../../access/access";
import { errorText } from "../../access/accessApi";
import { useCompany } from "../../company/companyApi";
import { type Branch, type BranchRequest, branchesApi, clearBranchCache, useBranches } from "../../company/branchesApi";
import { CARD, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, SECONDARY_BUTTON, STATS_ROW } from "../Payroll/hrmsUi";
import { formatDateTime } from "../../company/format";
import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

type Form = Required<Omit<BranchRequest, "headOffice" | "active">> & { headOffice: boolean; active: boolean };

const emptyForm = (country: string): Form => ({
  code: "", name: "", nameArabic: "", addressLine: "", city: "", state: "", country, phone: "", email: "",
  commercialRegistration: "", headOffice: false, active: true,
});

const formOf = (b: Branch): Form => ({
  code: b.code, name: b.name, nameArabic: b.nameArabic ?? "", addressLine: b.addressLine ?? "", city: b.city ?? "",
  state: b.state ?? "", country: b.country ?? "", phone: b.phone ?? "", email: b.email ?? "",
  commercialRegistration: b.commercialRegistration ?? "", headOffice: b.headOffice, active: b.active,
});

/**
 * Settings → Branches (backlog 9.1.1, BR-1). The company's branches with their own address, contact and commercial
 * registration; one of them is the head office. Warehouses and users are given their branch on their own pages.
 */
export default function BranchesPage() {
  const { access } = useContext(AuthContext);
  const { company } = useCompany();
  const { branches, loaded, reload } = useBranches();
  const canEdit = hasPermission(access, "USERS:ADMIN") && (!access.superAdmin || !!getSelectedTenant());
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  const [form, setForm] = useState<Form>(emptyForm(""));
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => ({
    total: branches.length,
    active: branches.filter((b) => b.active).length,
    inactive: branches.filter((b) => !b.active).length,
  }), [branches]);

  const openNew = () => {
    // The first branch is the head office
    setForm({ ...emptyForm(company?.country ?? ""), headOffice: branches.length === 0 });
    setEditing("new");
  };

  const openEdit = (b: Branch) => {
    setForm(formOf(b));
    setEditing(b);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      ToasterService.error(t("Enter the branch code and name."));
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        const created = await branchesApi.create(form);
        ToasterService.success(t("Branch {code} added.", { code: created.code }));
      } else if (editing) {
        await branchesApi.update(editing.id, form);
        ToasterService.success(t("Branch {code} saved.", { code: form.code.trim().toUpperCase() }));
      }
      setEditing(null);
      clearBranchCache();
      reload();
    } catch (err) {
      ToasterService.error(t(errorText(err, "Could not save the branch.")));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<Branch>[] = [
    {
      key: "code", label: "Code", sortable: true,
      render: (b) => (
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
          {b.code}
          {b.headOffice && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label={t("Head office")} />}
        </span>
      ),
    },
    {
      key: "name", label: "Name", sortable: true,
      render: (b) => (
        <div>
          <span className="block text-xs font-semibold text-slate-900 dark:text-white">{b.name}</span>
          {b.nameArabic && <span className="text-[11px] text-slate-500 dark:text-gray-400" dir="rtl">{b.nameArabic}</span>}
        </div>
      ),
    },
    { key: "city", label: "City", sortable: true, render: (b) => [b.city, b.state].filter(Boolean).join(", ") || "—" },
    // Numbers keep their order in Arabic
    { key: "phone", label: "Phone", render: (b) => (b.phone ? <span dir="ltr">{b.phone}</span> : "—") },
    { key: "commercialRegistration", label: "Commercial registration", render: (b) => b.commercialRegistration || "—" },
    {
      key: "active", label: "Status", sortable: true, sortValueGetter: (b) => (b.headOffice ? 0 : b.active ? 1 : 2),
      render: (b) => (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.headOffice ? "bg-amber-50 text-amber-700"
          : b.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {t(b.headOffice ? "Head office" : b.active ? "Active" : "Switched off")}
        </span>
      ),
    },
    ...(canEdit ? [{
      key: "actions", label: "Actions",
      render: (b: Branch) => (
        <button type="button" title={t("Edit")} className={ROW_ICON_BUTTON} onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></button>
      ),
    }] : []),
  ];

  const field = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={LABEL} htmlFor={`branch-${key}`}>{t(label)}</label>
      <input id={`branch-${key}`} className={INPUT} value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );

  const wasHeadOffice = editing !== "new" && editing?.headOffice;

  return (
    <>
      <PageMeta title={t("Branches")} description="The company's branches" />
      <PageBreadcrumb pageTitle="Branches" actions={canEdit ? <AddButton label={t("Add branch")} onClick={openNew} /> : undefined} />

      <div className={PAGE_BODY}>
        <div className={STATS_ROW}>
          <StatsCard label={t("Branches")} value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<GitBranch />} loading={!loaded} />
          <StatsCard label={t("Active")} value={stats.active} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<Building2 />} loading={!loaded} />
          <StatsCard label={t("Switched off")} value={stats.inactive} gradient="from-slate-50 to-gray-50" borderColor="border-slate-100" labelColor="text-slate-500" icon={<Building2 />} loading={!loaded} />
        </div>

        {loaded && branches.length === 0 && (
          <div className={`${CARD} mb-4 p-4 text-sm text-slate-600 dark:text-gray-300`}>
            {t("No branches yet. Add the head office first, then each branch with its own address. Then give each warehouse its branch (Inventory → Warehouses) and each user the branches they work in (Settings → Users).")}
          </div>
        )}

        <ReusableTable data={branches} columns={columns} loading={!loaded} pageSize={10} defaultSortKey="active"
          searchable searchPlaceholder={t("Search code, name or city")} enableRowDetails={false} />
      </div>

      {editing && (
        <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form data-overlay-panel onSubmit={save} className={`${CARD} max-h-full w-full max-w-lg space-y-4 overflow-y-auto p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editing === "new" ? t("Add branch") : t("Edit branch {code}", { code: editing.code })}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600" aria-label={t("Close")}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field("code", "Code *", { maxLength: 20, placeholder: "DXB", style: { textTransform: "uppercase" } })}
              {field("name", "Name *", { maxLength: 150, placeholder: t("e.g. Dubai branch") })}
              <div className="col-span-2">{field("nameArabic", "Name in Arabic", { maxLength: 150, dir: "rtl" })}</div>
              <div className="col-span-2">{field("addressLine", "Address", { maxLength: 300 })}</div>
              {field("city", "City", { maxLength: 100 })}
              {field("state", "Emirate / region", { maxLength: 100 })}
              {field("country", "Country", { maxLength: 100 })}
              {field("phone", "Phone", { maxLength: 50, type: "tel", placeholder: "+971 4 123 4567" })}
              {field("email", "Email", { maxLength: 150, type: "email" })}
              {field("commercialRegistration", "Commercial registration no.", { maxLength: 50 })}
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-gray-700">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={form.headOffice} disabled={!!wasHeadOffice}
                  onChange={(e) => setForm({ ...form, headOffice: e.target.checked, active: e.target.checked ? true : form.active })} />
                <span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{t("Head office")}</span>
                  <span className="block text-slate-500 dark:text-gray-400">
                    {t(wasHeadOffice ? "To move it, make another branch the head office." : "The company has one head office; ticking this moves it here.")}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={form.active} disabled={form.headOffice}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{t("In use")}</span>
                  <span className="block text-slate-500 dark:text-gray-400">
                    {t("A branch is switched off rather than deleted: its warehouses, users and documents keep it.")}
                  </span>
                </span>
              </label>
            </div>

            {editing !== "new" && editing.updatedAt && (
              <p className="text-[11px] text-slate-400">
                {t("Last changed {when} by {who}", { when: formatDateTime(editing.updatedAt), who: editing.updatedBy ?? "—" })}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(null)}>{t("Cancel")}</button>
              <button type="submit" className={PRIMARY_BUTTON} disabled={saving}>{saving ? t("Saving…") : t("Save")}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

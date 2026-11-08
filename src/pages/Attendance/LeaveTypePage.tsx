import React, { useEffect, useState } from "react";
import axios from "axios";
import { AlertCircle, Edit2, Trash2 } from "lucide-react";
import { CheckCircleIcon, TagIcon, BanknotesIcon, XCircleIcon } from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError, ATTENDANCE_API } from "./attendanceApi";
import { t } from "../../i18n/i18n";

type Category = "SICK" | "CASUAL" | "PAID" | "UNPAID" | "OTHER";

/** A company leave type: built-in ones can be renamed or switched off; HR adds its own. */
interface LeaveTypeModel {
  id?: number;
  code: string;
  name: string;
  description?: string | null;
  paid: boolean;
  category?: Category | null;
  halfDayAllowed: boolean;
  color?: string | null;
  builtIn?: boolean;
  active: boolean;
}

const API_URL = `${ATTENDANCE_API}/leave-types`;

const CATEGORY_LABEL: Record<Category, string> = {
  CASUAL: "Casual", SICK: "Sick", PAID: "Paid", UNPAID: "Unpaid", OTHER: "Other",
};

const emptyForm: LeaveTypeModel = { code: "", name: "", description: "", paid: true, category: "PAID", halfDayAllowed: true, color: "#0EA5E9", active: true };

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

/** Attendance → Leave Types: the leave types policies, balances and requests use. */
const LeaveTypePage: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions("ATTENDANCE");
  const [types, setTypes] = useState<LeaveTypeModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeModel | null>(null);
  const [form, setForm] = useState<LeaveTypeModel>(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get<LeaveTypeModel[]>(API_URL);
      setTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the leave types."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing({ ...emptyForm }); setForm({ ...emptyForm }); };
  const openEdit = (row: LeaveTypeModel) => { setEditing(row); setForm({ ...row, description: row.description || "", color: row.color || "" }); };

  const save = async () => {
    if (!form.name.trim()) return ToasterService.warning("Give the leave type a name");
    if (!editing?.id && !/^[A-Za-z][A-Za-z0-9_ ]{1,29}$/.test(form.code.trim())) {
      return ToasterService.warning("Code: 2 to 30 letters, digits or underscores, starting with a letter");
    }
    setSaving(true);
    try {
      const payload = { ...form, code: form.code.trim(), name: form.name.trim(), color: form.color || null };
      if (editing?.id) await axios.put(`${API_URL}/${editing.id}`, payload);
      else await axios.post(API_URL, payload);
      ToasterService.success(editing?.id ? "Leave type saved" : "Leave type added");
      setEditing(null);
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "The leave type was not saved."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: LeaveTypeModel) => {
    if (!row.id) return;
    const message = row.builtIn ? `Switch off ${row.name}? It stops being offered in new policies.`
      : `Delete ${row.name}? If a policy uses it, it is switched off instead.`;
    if (!window.confirm(message)) return;
    try {
      await axios.delete(`${API_URL}/${row.id}`);
      ToasterService.success(row.builtIn ? "Leave type switched off" : "Leave type removed");
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "The leave type could not be removed."));
    }
  };

  const columns: ColumnDef<LeaveTypeModel>[] = [
    {
      key: "name", label: "Leave type", sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color || "#94A3B8" }} />
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span>
            <span className="font-mono text-[10px] text-gray-500">{r.code}{r.builtIn ? ` · ${t("built-in")}` : ""}</span>
          </div>
        </div>
      ),
    },
    { key: "category", label: "Category", sortable: true, render: (r) => <span className="text-xs">{r.category ? t(CATEGORY_LABEL[r.category]) : "—"}</span> },
    {
      key: "paid", label: "Pay", sortable: true,
      render: (r) => <span className={`text-xs font-semibold ${r.paid ? "text-emerald-600" : "text-rose-600"}`}>{t(r.paid ? "Paid" : "Unpaid (loss of pay)")}</span>,
    },
    { key: "halfDayAllowed", label: "Half day", render: (r) => <span className="text-xs">{t(r.halfDayAllowed ? "Allowed" : "Full days only")}</span> },
    {
      key: "active", label: "Status", sortable: true,
      render: (r) => (
        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${r.active ? "border-emerald-100 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-gray-100 text-gray-500"}`}>
          {t(r.active ? "Active" : "Switched off")}
        </span>
      ),
    },
    {
      key: "actions", label: "Actions", headerClassName: "text-right", className: "text-right", excludeFromDetails: true,
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canUpdate && (
            <button type="button" title={t("Edit")} onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && r.active && (
            <button type="button" title={t(r.builtIn ? "Switch off" : "Delete")} onClick={() => remove(r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Leave Types")} description="The leave types your company offers" />
      <PageBreadcrumb pageTitle="Leave Types" actions={canCreate ? <AddButton label={t("Add Leave Type")} onClick={openNew} /> : undefined} />
      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Leave types")} value={types.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<TagIcon className="h-5 w-5" />} />
          <StatsCard label={t("Active")} value={types.filter((x) => x.active).length} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-5 w-5" />} />
          <StatsCard label={t("Paid")} value={types.filter((x) => x.paid).length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BanknotesIcon className="h-5 w-5" />} />
          <StatsCard label={t("Switched off")} value={types.filter((x) => !x.active).length} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<XCircleIcon className="h-5 w-5" />} onRefresh={load} />
        </div>
        <ReusableTable
          data={types.map((x) => ({ ...x, id: x.id }))}
          columns={columns}
          loading={loading}
          pageSize={15}
          defaultSortKey="name"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No leave types")}</p>
            </div>
          }
        />
      </div>

      {editing && (
        <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div data-overlay-panel className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#191919]" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t(editing.id ? "Edit leave type" : "Add leave type")}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("Code")} *
                <input className={`${input} mt-1 font-mono uppercase`} value={form.code} disabled={!!editing.id} maxLength={30} placeholder="BIRTHDAY"
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              </label>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("Name")} *
                <input className={`${input} mt-1`} value={form.name} maxLength={60} placeholder={t("Birthday leave")}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("Category")}
                <select className={`${input} mt-1`} value={form.category || "OTHER"} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as Category }))}>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("Calendar colour")}
                <input type="color" className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-1" value={form.color || "#0EA5E9"}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} />
              </label>
              <label className="sm:col-span-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("Description")}
                <input className={`${input} mt-1`} value={form.description || ""} maxLength={300}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.paid} disabled={form.code === "LOSS_OF_PAY"} onChange={(e) => setForm((p) => ({ ...p, paid: e.target.checked }))} />
                {t("Paid leave (unpaid needs no balance and counts as loss of pay)")}
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.halfDayAllowed} onChange={(e) => setForm((p) => ({ ...p, halfDayAllowed: e.target.checked }))} />
                {t("Can be taken as a half day")}
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                {t("Active")}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">{t("Cancel")}</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                {t(saving ? "Saving..." : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeaveTypePage;

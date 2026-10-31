import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import * as XLSX from "xlsx";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { AuditFilters, AuditQuery, AuditRow, actionLabel, auditApi, fieldLabel, moduleLabel } from "../../audit/auditApi";
import { formatDateTime, todayIso } from "../../company/format";
import { CARD, PAGE_BODY, TOOL_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";
const PAGE_SIZE = 50;
const EXPORT_LIMIT = 5000;

const daysAgo = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

// The log keeps UTC; shown in the company's time zone
const when = (row: AuditRow) => formatDateTime(row.occurredAt ? `${row.occurredAt}Z` : null);
const who = (row: AuditRow) => row.fullName || row.username || t("System");

interface Form {
  from: string;
  to: string;
  module: string;
  action: string;
  userId: string;
  q: string;
}

/**
 * Who did what, and when, across the company: sign-ins, settings, users and roles, and the business actions of
 * every module, with the fields that changed. Tenant Administrators (USERS:ADMIN) only.
 */
export default function AuditLogPage() {
  const today = todayIso();
  const [form, setForm] = useState<Form>({ from: daysAgo(today, 30), to: today, module: "", action: "", userId: "", q: "" });
  const [query, setQuery] = useState<AuditQuery>({ from: form.from, to: form.to });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditFilters>({ modules: [], actions: [], users: [] });
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    auditApi.filters().then(setFilters).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    auditApi.search({ ...query, page, size: PAGE_SIZE })
      .then((result) => {
        setRows(result.items);
        setTotal(result.total);
        setOpen(new Set());
      })
      .catch((err) => ToasterService.error("The audit log could not be loaded", errorText(err, "Is the user service running?")))
      .finally(() => setLoading(false));
  }, [query, page]);

  useEffect(load, [load]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.from && form.to && form.to < form.from) {
      ToasterService.error("The end date can't be before the start date.");
      return;
    }
    setPage(0);
    setQuery({ from: form.from, to: form.to, module: form.module, action: form.action, userId: form.userId, q: form.q.trim() });
  };

  const toggle = (id: number) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Everything the filters match (up to EXPORT_LIMIT rows), one line per changed field
  const exportExcel = async () => {
    setExporting(true);
    try {
      const all: AuditRow[] = [];
      for (let p = 0; all.length < EXPORT_LIMIT; p++) {
        const result = await auditApi.search({ ...query, page: p, size: 200 });
        all.push(...result.items);
        if (result.items.length < 200 || all.length >= result.total) break;
      }
      const lines = all.flatMap((r) => {
        const base = {
          [t("Time")]: when(r), [t("User")]: who(r), [t("Module")]: moduleLabel(r.module), [t("Action")]: actionLabel(r.action),
          [t("Record")]: r.reference ?? r.entityId ?? "", [t("Summary")]: r.summary ?? "", [t("IP address")]: r.ipAddress ?? "",
        };
        return r.changes.length === 0
          ? [{ ...base, [t("Field")]: "", [t("Before")]: "", [t("After")]: "" }]
          : r.changes.map((c) => ({ ...base, [t("Field")]: fieldLabel(c.field), [t("Before")]: c.from ?? "", [t("After")]: c.to ?? "" }));
      });
      const ws = XLSX.utils.json_to_sheet(lines);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit log");
      XLSX.writeFile(wb, `Audit_Log_${query.from ?? ""}_${query.to ?? ""}.xlsx`);
      if (all.length >= EXPORT_LIMIT) {
        ToasterService.success(`Exported the first ${EXPORT_LIMIT} entries; narrow the dates for the rest.`);
      }
    } catch (err) {
      ToasterService.error("The audit log could not be exported", errorText(err, "Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageMeta title={t("Audit Log")} description="Who did what, and when, across the company" />
      <PageBreadcrumb
        pageTitle="Audit Log"
        actions={(
          <div className="flex items-center gap-2">
            <button type="button" className={TOOL_BUTTON} onClick={load} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" /> {t("Refresh")}
            </button>
            <button type="button" className={TOOL_BUTTON} onClick={exportExcel} disabled={exporting || total === 0}>
              <Download className="h-3.5 w-3.5" /> {t(exporting ? "Exporting..." : "Export")}
            </button>
          </div>
        )}
      />
      <div className={`${PAGE_BODY} space-y-4`}>
        <form onSubmit={search} className={`${CARD} grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-7`}>
          <div>
            <label className={LABEL} htmlFor="audit-from">{t("From")}</label>
            <input id="audit-from" type="date" className={INPUT} value={form.from} max={form.to || undefined} onChange={set("from")} />
          </div>
          <div>
            <label className={LABEL} htmlFor="audit-to">{t("To")}</label>
            <input id="audit-to" type="date" className={INPUT} value={form.to} min={form.from || undefined} onChange={set("to")} />
          </div>
          <div>
            <label className={LABEL} htmlFor="audit-module">{t("Module")}</label>
            <select id="audit-module" className={INPUT} value={form.module} onChange={set("module")}>
              <option value="">{t("All modules")}</option>
              {filters.modules.map((m) => <option key={m} value={m}>{t(moduleLabel(m))}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="audit-action">{t("Action")}</label>
            <select id="audit-action" className={INPUT} value={form.action} onChange={set("action")}>
              <option value="">{t("All actions")}</option>
              {filters.actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="audit-user">{t("User")}</label>
            <select id="audit-user" className={INPUT} value={form.userId} onChange={set("userId")}>
              <option value="">{t("Everyone")}</option>
              {filters.users.map((u) => <option key={u.userId} value={u.userId}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="audit-q">{t("Contains")}</label>
            <input id="audit-q" className={INPUT} value={form.q} placeholder={t("Invoice no., name...")} onChange={set("q")} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
              <Search className="h-4 w-4" /> {t("Search")}
            </button>
          </div>
        </form>

        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={`${TH} w-8`} aria-label={t("Details")} />
                  <th className={TH}>{t("Time")}</th>
                  <th className={TH}>{t("User")}</th>
                  <th className={TH}>{t("Module")}</th>
                  <th className={TH}>{t("Action")}</th>
                  <th className={TH}>{t("Record")}</th>
                  <th className={TH}>{t("Summary")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("Nothing was recorded for these filters.")}</td></tr>
                ) : rows.map((row) => {
                  const expanded = open.has(row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr className="cursor-pointer hover:bg-slate-50 dark:hover:bg-[#202020]" onClick={() => toggle(row.id)}>
                        <td className={TD}>
                          <button type="button" aria-expanded={expanded} aria-label={t(expanded ? "Hide details" : "Show details")}
                            className="text-slate-400 hover:text-cyan-600" onClick={(e) => { e.stopPropagation(); toggle(row.id); }}>
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{when(row)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{who(row)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{t(moduleLabel(row.module))}</td>
                        <td className={`${TD} whitespace-nowrap font-medium`}>{actionLabel(row.action)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{row.reference ?? row.entityId ?? "—"}</td>
                        <td className={`${TD} min-w-[320px]`}>
                          {row.summary ?? ""}
                          {row.changes.length > 0 && (
                            <span className="ms-2 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                              {row.changes.length} {t(row.changes.length === 1 ? "change" : "changes")}
                            </span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/60 dark:bg-[#1d1d1d]">
                          <td />
                          <td colSpan={6} className="px-3 pb-4 pt-1">
                            {row.changes.length > 0 ? (
                              <table className="mb-2 min-w-[420px] text-sm">
                                <thead>
                                  <tr>
                                    <th className={TH}>{t("Field")}</th>
                                    <th className={TH}>{t("Before")}</th>
                                    <th className={TH}>{t("After")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.changes.map((c) => (
                                    <tr key={c.field}>
                                      <td className={`${TD} font-medium`}>{t(fieldLabel(c.field))}</td>
                                      <td className={`${TD} text-red-700 dark:text-red-300`}>{c.from ?? <span className="text-slate-400">—</span>}</td>
                                      <td className={`${TD} text-emerald-700 dark:text-emerald-300`}>{c.to ?? <span className="text-slate-400">—</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="mb-2 text-xs text-slate-500">{t("No field changes were recorded for this action.")}</p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-gray-400">
                              {row.username && <>{t("Username")}: {row.username} · </>}
                              {row.ipAddress && <>{t("IP address")}: {row.ipAddress} · </>}
                              {row.entityType && <>{row.entityType}{row.entityId ? ` #${row.entityId}` : ""} · </>}
                              {row.source}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-gray-800 dark:text-gray-400">
            <span>{total} {t(total === 1 ? "entry" : "entries")}</span>
            <div className="flex items-center gap-2">
              <button type="button" className={TOOL_BUTTON} disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>{t("Previous")}</button>
              <span>{t("Page")} {page + 1} / {pages}</span>
              <button type="button" className={TOOL_BUTTON} disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>{t("Next")}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

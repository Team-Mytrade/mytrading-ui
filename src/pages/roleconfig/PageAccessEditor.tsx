import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Search } from "lucide-react";
import { navItems } from "../../layout/AppSidebar";
import { AppModule, MODULE_LABELS, isSelfServicePath, moduleForPath } from "../../access/access";
import type { PageLimit } from "../../access/accessApi";
import { t } from "../../i18n/i18n";

/*
 * Page access for a role (Roles & Permissions): the menu as the sidebar shows it, menu → section → page, with
 * View / Create / Edit / Delete / Approve / Export per page. A page can only allow what its module allows (the
 * module rights tab); a page left as it is follows the module. Unticking View hides the page. The services refuse
 * the switched-off actions too.
 */

export const PAGE_ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT"] as const;
type PageAction = (typeof PAGE_ACTIONS)[number];

const ACTION_LABELS: Record<PageAction, string> = {
  VIEW: "View", CREATE: "Create", UPDATE: "Edit", DELETE: "Delete", APPROVE: "Approve", EXPORT: "Export",
};

interface PageRow {
  key: string;
  name: string;
  module: AppModule;
  section?: string;
}

interface MenuGroup {
  menu: string;
  pages: PageRow[];
}

type NavLike = { name: string; path?: string; section?: string; subItems?: NavLike[] };

/** Every menu page a role's rights apply to, grouped by menu (self-service, report and platform pages left out). */
const menuGroups = (): MenuGroup[] => {
  const seen = new Set<string>();
  const groups: MenuGroup[] = [];
  const pageOf = (name: string, path: string | undefined, section?: string): PageRow | null => {
    if (!path || seen.has(path) || isSelfServicePath(path)) return null;
    const module = moduleForPath(path);
    if (!module || module === "PLATFORM") return null;
    seen.add(path);
    return { key: path, name, module, section };
  };
  for (const nav of navItems as NavLike[]) {
    const pages: PageRow[] = [];
    const top = pageOf(nav.name, nav.path);
    if (top) pages.push(top);
    for (const sub of nav.subItems ?? []) {
      if (sub.subItems) {
        for (const leaf of sub.subItems) {
          const row = pageOf(leaf.name, leaf.path, sub.name);
          if (row) pages.push(row);
        }
      } else {
        const row = pageOf(sub.name, sub.path, sub.section);
        if (row) pages.push(row);
      }
    }
    if (pages.length) groups.push({ menu: nav.name, pages });
  }
  return groups;
};

interface Props {
  /** The role's module rights (MODULE:ACTION, ADMIN included). */
  permissions: Set<string>;
  /** The role's page limits by page. */
  limits: Map<string, PageLimit>;
  /** Null when read-only. */
  onChange: ((limits: Map<string, PageLimit>) => void) | null;
}

export default function PageAccessEditor({ permissions, limits, onChange }: Props) {
  const groups = useMemo(menuGroups, []);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);

  const moduleAllows = (module: AppModule, action: PageAction) =>
    permissions.has(`${module}:${action}`) || permissions.has(`${module}:ADMIN`);
  const moduleActions = (module: AppModule) => PAGE_ACTIONS.filter((a) => moduleAllows(module, a));

  const allowed = (page: PageRow, action: PageAction) => {
    if (!moduleAllows(page.module, action)) return false;
    const limit = limits.get(page.key);
    return !limit || (limit.actions.includes(action) && limit.actions.includes("VIEW"));
  };

  const toggle = (page: PageRow, action: PageAction) => {
    if (!onChange) return;
    const full = moduleActions(page.module);
    const current = new Set<string>(limits.get(page.key)?.actions ?? full);
    if (allowed(page, action)) {
      // Off: View off hides the page, so nothing else stays on
      if (action === "VIEW") current.clear();
      else current.delete(action);
    } else {
      current.add(action);
      current.add("VIEW");
    }
    const next = new Map(limits);
    const actions = full.filter((a) => current.has(a));
    if (actions.length === full.length) next.delete(page.key);
    else next.set(page.key, { pageKey: page.key, module: page.module, actions });
    onChange(next);
  };

  const reset = (page: PageRow) => {
    if (!onChange) return;
    const next = new Map(limits);
    next.delete(page.key);
    onChange(next);
  };

  const query = search.trim().toLowerCase();
  const shownGroups = groups
    .map((g) => ({
      ...g,
      pages: g.pages.filter((p) =>
        moduleActions(p.module).length > 0 &&
        (!changedOnly || limits.has(p.key)) &&
        (!query || [p.name, t(p.name), g.menu, t(g.menu), p.section ?? "", p.key].some((x) => x.toLowerCase().includes(query)))),
    }))
    .filter((g) => g.pages.length > 0);
  const expanded = (menu: string) => open.has(menu) || query !== "" || changedOnly;
  const flip = (menu: string) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(menu)) n.delete(menu);
    else n.add(menu);
    return n;
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search pages")}
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-gray-200" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-300">
          <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
          {t("Only pages limited for this role")} ({limits.size})
        </label>
      </div>

      {shownGroups.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-400">
          {t(permissions.size === 0 ? "Give the role module rights first: pages follow them." : "No pages match.")}
        </p>
      )}

      <div className="space-y-2">
        {shownGroups.map((group) => {
          const limited = group.pages.filter((p) => limits.has(p.key)).length;
          return (
            <section key={group.menu} className="overflow-hidden rounded-lg border border-slate-200 dark:border-gray-700">
              <button type="button" onClick={() => flip(group.menu)}
                className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:bg-[#222222] dark:text-gray-100 dark:hover:bg-[#2a2a2a]">
                <span className="flex items-center gap-1.5">
                  {expanded(group.menu) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {t(group.menu)}
                  <span className="font-normal text-slate-500 dark:text-gray-400">· {group.pages.length} {t("pages")}</span>
                </span>
                {limited > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    {limited} {t("limited")}
                  </span>
                )}
              </button>
              {expanded(group.menu) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-gray-700 dark:text-gray-400">
                        <th className="px-3 py-1.5 text-left font-semibold">{t("Page")}</th>
                        {PAGE_ACTIONS.map((a) => <th key={a} className="px-2 py-1.5 text-center font-semibold">{t(ACTION_LABELS[a])}</th>)}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.pages.map((page, i) => {
                        const newSection = page.section && page.section !== group.pages[i - 1]?.section;
                        const isLimited = limits.has(page.key);
                        return [
                          newSection ? (
                            <tr key={`${page.key}-section`}>
                              <td colSpan={PAGE_ACTIONS.length + 2} className="bg-white px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-transparent dark:text-gray-500">
                                {t(page.section!)}
                              </td>
                            </tr>
                          ) : null,
                          <tr key={page.key} className={`border-b border-slate-100 last:border-0 dark:border-gray-800 ${isLimited ? "bg-amber-50/60 dark:bg-amber-500/5" : ""}`}>
                            <td className="px-3 py-1.5">
                              <span className="font-medium text-slate-800 dark:text-gray-200">{t(page.name)}</span>
                              <span className="ml-1.5 text-[10px] text-slate-400">{t(MODULE_LABELS[page.module])}</span>
                            </td>
                            {PAGE_ACTIONS.map((a) => {
                              const inModule = moduleAllows(page.module, a);
                              return (
                                <td key={a} className="px-2 py-1.5 text-center">
                                  <input type="checkbox" aria-label={`${t(page.name)} ${t(ACTION_LABELS[a])}`}
                                    checked={allowed(page, a)} disabled={!onChange || !inModule}
                                    title={!inModule ? t("The role's module rights don't include this") : undefined}
                                    onChange={() => toggle(page, a)} />
                                </td>
                              );
                            })}
                            <td className="pr-2 text-center">
                              {isLimited && onChange && (
                                <button type="button" title={t("Follow the module rights again")} onClick={() => reset(page)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#2a2a2a]">
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              )}
                            </td>
                          </tr>,
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500 dark:text-gray-400">
        {t("A page follows the role's module rights until you change it here (highlighted). Unticking View hides the page; greyed boxes are outside the module rights.")}
      </p>
    </div>
  );
}

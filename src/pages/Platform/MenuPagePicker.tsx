import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AppModule, MODULE_LABELS } from "../../access/access";
import { MenuPage, menuGroups } from "../../access/menuPages";
import { t } from "../../i18n/i18n";

/*
 * Which main menus and sub menu pages a company gets (Tenants & Modules). A module is on when any of its pages is
 * ticked; its unticked pages are the company's hidden pages (nobody there sees them, the services refuse changes on
 * them). Users (Settings) is a core module and isn't listed: it is always on.
 */

interface Props {
  modules: AppModule[];
  hiddenPages: string[];
  onChange: (modules: AppModule[], hiddenPages: string[]) => void;
}

const optional = (p: MenuPage) => p.module !== "USERS";

export default function MenuPagePicker({ modules, hiddenPages, onChange }: Props) {
  const groups = useMemo(
    () => menuGroups().map((g) => ({ ...g, pages: g.pages.filter(optional) })).filter((g) => g.pages.length > 0),
    [],
  );
  const allPages = useMemo(() => groups.flatMap((g) => g.pages), [groups]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const on = (p: MenuPage, mods = modules, hidden = hiddenPages) => mods.includes(p.module) && !hidden.includes(p.key);

  /** Applies page switches, keeping modules and hidden pages in step. */
  const apply = (changes: { page: MenuPage; on: boolean }[]) => {
    let mods = [...modules];
    let hidden = new Set(hiddenPages);
    for (const { page, on: wanted } of changes) {
      if (wanted) {
        if (!mods.includes(page.module)) {
          // Turning a module on through one page: its other pages stay off until ticked
          mods = [...mods, page.module];
          allPages.filter((p) => p.module === page.module && p.key !== page.key).forEach((p) => hidden.add(p.key));
        }
        hidden.delete(page.key);
      } else if (mods.includes(page.module)) {
        hidden.add(page.key);
      }
    }
    // A module with none of its pages left is switched off (and its pages no longer need listing)
    for (const m of [...mods]) {
      const pages = allPages.filter((p) => p.module === m);
      if (pages.length > 0 && pages.every((p) => hidden.has(p.key))) {
        mods = mods.filter((x) => x !== m);
        pages.forEach((p) => hidden.delete(p.key));
      }
    }
    hidden = new Set([...hidden].filter((k) => allPages.some((p) => p.key === k && mods.includes(p.module))));
    onChange(mods, [...hidden].sort());
  };

  const total = allPages.length;
  const ticked = allPages.filter((p) => on(p)).length;
  const flip = (menu: string) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(menu)) n.delete(menu);
    else n.add(menu);
    return n;
  });

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-gray-300">
          <input type="checkbox" checked={ticked === total}
            ref={(el) => { if (el) el.indeterminate = ticked > 0 && ticked < total; }}
            onChange={(e) => apply(allPages.map((page) => ({ page, on: e.target.checked })))} />
          {t("Select all")}
        </label>
        <span className="text-[11px] text-slate-500 dark:text-gray-400">{ticked} / {total} {t("pages")}</span>
      </div>

      <div className="max-h-[22rem] space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-gray-700">
        {groups.map((g) => {
          const count = g.pages.filter((p) => on(p)).length;
          const expanded = open.has(g.menu);
          return (
            <section key={g.menu} className="overflow-hidden rounded-md border border-slate-100 bg-white dark:border-gray-800 dark:bg-transparent">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input type="checkbox" aria-label={t(g.menu)} checked={count === g.pages.length}
                  ref={(el) => { if (el) el.indeterminate = count > 0 && count < g.pages.length; }}
                  onChange={(e) => apply(g.pages.map((page) => ({ page, on: e.target.checked })))} />
                <button type="button" onClick={() => flip(g.menu)} aria-expanded={expanded}
                  className="flex flex-1 items-center justify-between gap-2 text-left text-xs font-semibold text-slate-800 dark:text-gray-100">
                  <span className="flex items-center gap-1">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                    {t(g.menu)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    count === 0 ? "bg-slate-100 text-slate-500 dark:bg-gray-800 dark:text-gray-400"
                      : count === g.pages.length ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                    {count} / {g.pages.length}
                  </span>
                </button>
              </div>
              {expanded && (
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-2 sm:grid-cols-2 dark:border-gray-800">
                  {g.pages.map((p, i) => (
                    <Fragment key={p.key}>
                      {p.section && p.section !== g.pages[i - 1]?.section && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:col-span-2 dark:text-gray-500">{t(p.section)}</p>
                      )}
                      <label className="flex items-center gap-2 py-0.5 text-xs text-slate-700 dark:text-gray-300">
                        <input type="checkbox" checked={on(p)} onChange={(e) => apply([{ page: p, on: e.target.checked }])} />
                        <span>{t(p.name)}</span>
                        {t(MODULE_LABELS[p.module]) !== t(g.menu) && (
                          <span className="text-[10px] text-slate-400">{t(MODULE_LABELS[p.module])}</span>
                        )}
                      </label>
                    </Fragment>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">
        {t("Tick a main menu for all its sub menus, or open it to choose sub menus. Settings (Users) is a core module and is always on.")}
      </p>
    </div>
  );
}

import { navItems } from "../layout/AppSidebar";
import { AppModule, isSelfServicePath, moduleForPath } from "./access";
import type { PageLimit } from "./accessApi";

/*
 * The menu as the sidebar shows it, main menu → sub menu pages, each page with the module its rights come from.
 * Used by Tenants & Modules (which sub menus a company gets), Roles & Permissions → Page access and the user form's
 * "What they'll see". Self-service, report and platform pages are left out (they follow other rules).
 */

export interface MenuPage {
  key: string;
  name: string;
  module: AppModule;
  section?: string;
}

export interface MenuGroup {
  menu: string;
  pages: MenuPage[];
}

type NavLike = { name: string; path?: string; section?: string; subItems?: NavLike[] };

export const menuGroups = (): MenuGroup[] => {
  const seen = new Set<string>();
  const groups: MenuGroup[] = [];
  const pageOf = (name: string, path: string | undefined, section?: string): MenuPage | null => {
    if (!path || seen.has(path) || isSelfServicePath(path)) return null;
    const module = moduleForPath(path);
    if (!module || module === "PLATFORM") return null;
    seen.add(path);
    return { key: path, name, module, section };
  };
  for (const nav of navItems as NavLike[]) {
    const pages: MenuPage[] = [];
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

/**
 * The menu a person gets from these roles: pages of modules a role opens (ADMIN or VIEW), less pages a role hides
 * (limits always win, as on the server) and pages the company doesn't have. The Tenant Administrator role is never
 * limited by roles.
 */
export const menuForRoles = (
  roles: { roleCode: string; permissions: string[]; pageLimits?: PageLimit[] }[],
  companyHidden: string[] = [],
): { menu: string; pages: (MenuPage & { hidden: boolean })[] }[] => {
  const tenantAdmin = roles.some((r) => r.roleCode === "TENANT_ADMIN");
  const opens = (module: string, codes: string[]) =>
    codes.includes(`${module}:VIEW`) || codes.includes(`${module}:ADMIN`);
  return menuGroups()
    .map((g) => ({
      menu: g.menu,
      pages: g.pages
        .filter((p) => roles.some((r) => opens(p.module, r.permissions)) && !companyHidden.includes(p.key))
        .map((p) => ({
          ...p,
          hidden: !tenantAdmin && roles.some((r) => {
            if (!opens(p.module, r.permissions)) return false;
            const limit = r.pageLimits?.find((l) => l.pageKey === p.key);
            return !!limit && !limit.actions.includes("VIEW");
          }),
        })),
    }))
    .filter((g) => g.pages.length > 0);
};

/* ---- Tenants & Modules: which sub menus a company gets ---- */

const optional = (p: MenuPage) => p.module !== "USERS";

/** Main menus with their sub menu pages a company can be given (Settings / Users left out: always on). */
export const pickerGroups = () =>
  menuGroups().map((g) => ({ ...g, pages: g.pages.filter(optional) })).filter((g) => g.pages.length > 0);

/** Whether the company gets this page. */
export const pageOn = (p: MenuPage, modules: AppModule[], hiddenPages: string[]) =>
  modules.includes(p.module) && !hiddenPages.includes(p.key);

/** Applies page switches, keeping modules and hidden pages in step. */
export const switchPages = (
  modules: AppModule[], hiddenPages: string[], changes: { page: MenuPage; on: boolean }[],
): { modules: AppModule[]; hiddenPages: string[] } => {
  const allPages = pickerGroups().flatMap((g) => g.pages);
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
  return { modules: mods, hiddenPages: [...hidden].sort() };
};

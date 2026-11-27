// Reports and dashboards for one branch (backlog 9.1.1, BR-1 step 5). The branch picked is kept in the page's address
// (?branch=<id>), and while a page that offers the picker is open, every read (GET) from finance, sales and purchase
// carries it: those services then count only that branch's documents (their branch filter), and a person limited to
// some branches can never see another one this way. Changing the branch draws the page again (AppLayout keys the page
// on it). Stock, CRM, HR and delivery figures have no branch of their own and stay company-wide.
import axios from "axios";
import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { REPORTS } from "../pages/reports/center/reportCatalogue";
import { t } from "../i18n/i18n";
import { useMyBranches } from "./branchesApi";

export const BRANCH_PARAM = "branch";

// The Command Center (its Sales, Purchase, Invoice and Reports dashboards) and the reports that count by branch
const branchPaths = () => new Set(["/", ...REPORTS.filter((r) => r.byBranch).map((r) => r.path)]);

/** Whether this page can be viewed for one branch. */
export const isBranchViewPath = (pathname: string) => {
  const path = pathname.replace(/^\/myTrading/, "") || "/";
  return branchPaths().has(path.length > 1 ? path.replace(/\/$/, "") : path);
};

/** The branch the current page is viewed for, or null (every branch the person may see). */
export const viewedBranch = (): string | null => {
  if (typeof window === "undefined" || !isBranchViewPath(window.location.pathname)) return null;
  const value = new URLSearchParams(window.location.search).get(BRANCH_PARAM);
  return value && /^[1-9]\d{0,17}$/.test(value) ? value : null;
};

// Services that keep documents by branch
const BRANCHED_APIS = /^\/v1\/api\/(invoice|sales|purchase|customer-financial)\//;

let installed = false;

/** Adds ?branch to finance, sales and purchase reads while a page is viewed for one branch. Installed once. */
export const installBranchView = () => {
  if (installed) return;
  installed = true;
  axios.interceptors.request.use((config) => {
    const branch = viewedBranch();
    const method = (config.method ?? "get").toLowerCase();
    const url = config.url ?? "";
    const path = url.startsWith("http") ? (() => { try { return new URL(url).pathname; } catch { return url; } })() : url;
    if (branch && method === "get" && BRANCHED_APIS.test(path)) {
      const params = (config.params ?? {}) as Record<string, unknown>;
      if (params[BRANCH_PARAM] == null && !/[?&]branch=/.test(url)) {
        config.params = { ...params, [BRANCH_PARAM]: branch };
      }
    }
    return config;
  });
};

installBranchView();

/**
 * "Branch" picker for reports and dashboards: All branches (or all of the person's) or one. Shown only on pages that
 * count by branch and when there is more than one branch to choose from.
 */
export const BranchViewPicker: React.FC<{ className?: string }> = ({ className }) => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { branches, limited } = useMyBranches();
  if (!isBranchViewPath(location.pathname) || branches.length < 2) return null;
  const value = params.get(BRANCH_PARAM) ?? "";
  const change = (next: string) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next) updated.set(BRANCH_PARAM, next);
      else updated.delete(BRANCH_PARAM);
      return updated;
    }, { replace: true });
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium text-slate-600 dark:text-gray-300">{t("Branch")}</span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        aria-label={t("Branch")}
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <option value="">{t(limited ? "All my branches" : "All branches")}</option>
        {branches.filter((b) => b.active || String(b.id) === value).map((b) => (
          <option key={b.id} value={b.id}>{`${b.code} · ${b.name}`}</option>
        ))}
      </select>
    </label>
  );
};

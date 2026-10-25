import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Building2, Globe, Settings2, ShieldCheck } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getSelectedTenant, setSelectedTenant } from "./access";
import { TenantAccess, platformApi } from "./accessApi";
import { ToasterService } from "../Services/ToasterService";

const ALL = "";

// Cyan theme (matches the #4DD0E1 Add buttons and the sidebar). The select sets its own height with no
// vertical padding: the forms plugin's padding and line height cut the text off in a short select.
const BAR =
  "flex flex-wrap items-center justify-between gap-2 border-b border-[#d5eef2] bg-[#f4fcfd] px-3 py-1.5 text-xs text-slate-600 dark:border-gray-800 dark:bg-[#191919] dark:text-gray-300";
const BADGE =
  "inline-flex items-center gap-1 rounded-full bg-[#0097a7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-cyan-800";
const PICKER =
  "h-8 w-52 cursor-pointer truncate rounded-lg border border-[#b2ebf2] bg-white py-0 pl-8 pr-8 text-xs font-medium leading-normal text-slate-800 shadow-sm outline-none transition-colors hover:border-[#4dd0e1] focus:border-[#0097a7] focus:ring-2 focus:ring-[#4dd0e1]/40 sm:w-64 dark:border-gray-700 dark:bg-[#202020] dark:text-gray-200";
const BAR_BUTTON =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#b2ebf2] bg-white px-3 text-xs font-medium text-[#006f7a] shadow-sm transition-colors hover:border-[#4dd0e1] hover:bg-[#e0f7fa] dark:border-gray-700 dark:bg-[#202020] dark:text-cyan-300 dark:hover:bg-[#262626]";

/**
 * Super Admin bar under the header: which company their actions apply to, and a picker to switch.
 * Switching reloads the workspace from the dashboard so no page keeps another company's data.
 */
export default function TenantBanner() {
  const { access } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState(getSelectedTenant());
  const [tenants, setTenants] = useState<TenantAccess[]>([]);

  useEffect(() => {
    const update = () => setTenantId(getSelectedTenant());
    window.addEventListener("app-tenant-changed", update);
    return () => window.removeEventListener("app-tenant-changed", update);
  }, []);

  useEffect(() => {
    if (!access.superAdmin) return;
    platformApi.tenants().then(setTenants, () => setTenants([]));
  }, [access.superAdmin, tenantId]);

  if (!access.superAdmin) return null;

  const current = tenants.find((t) => t.tenantId === tenantId);
  const sorted = [...tenants].sort((a, b) => a.tenantName.localeCompare(b.tenantName));

  const switchTo = (next: string) => {
    const value = next === ALL ? null : next;
    if (value === tenantId) return;
    setSelectedTenant(value);
    const name = value ? tenants.find((t) => t.tenantId === value)?.tenantName ?? value : null;
    ToasterService.success(name ? `Now working in ${name}` : "Now working across all tenants");
    navigate("/");
  };

  return (
    <div className={BAR}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={BADGE}>
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Super Admin
        </span>
        <span className="hidden font-medium text-slate-500 sm:inline dark:text-gray-400">Working in</span>
        <div className="relative">
          {tenantId ? (
            <Building2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#0097a7]" aria-hidden="true" />
          ) : (
            <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#0097a7]" aria-hidden="true" />
          )}
          <select
            aria-label="Company to work in"
            className={PICKER}
            value={tenantId ?? ALL}
            onChange={(e) => switchTo(e.target.value)}
          >
            <option value={ALL}>All tenants (platform)</option>
            {/* The selected tenant stays listed even before the list loads */}
            {tenantId && !current && <option value={tenantId}>{tenantId}</option>}
            {sorted.map((t) => (
              <option key={t.tenantId} value={t.tenantId} disabled={!t.active && t.tenantId !== tenantId}>
                {t.tenantName}{t.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        {current && <span className="hidden truncate text-[11px] text-slate-500 dark:text-gray-400 md:inline">{current.tenantId}</span>}
      </div>

      <div className="flex items-center gap-2">
        {tenantId && (
          <button type="button" className={BAR_BUTTON} onClick={() => switchTo(ALL)}>
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            All tenants
          </button>
        )}
        <Link to="/platform/tenants" className={BAR_BUTTON}>
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          Manage tenants
        </Link>
      </div>
    </div>
  );
}

import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Building2, Globe, Settings2, ShieldCheck } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getSelectedTenant, setSelectedTenant } from "./access";
import { TenantAccess, platformApi } from "./accessApi";
import { ToasterService } from "../Services/ToasterService";
import { TOOL_BUTTON, TOOL_INPUT } from "../pages/Payroll/hrmsUi";

const ALL = "";

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
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5 text-xs ${
        tenantId
          ? "border-cyan-100 bg-cyan-50/70 text-cyan-900 dark:border-cyan-950 dark:bg-cyan-950/30 dark:text-cyan-100"
          : "border-slate-200 bg-white text-slate-600 dark:border-gray-800 dark:bg-[#191919] dark:text-gray-300"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:border-cyan-900 dark:bg-transparent dark:text-cyan-300">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Super Admin
        </span>
        <span className="hidden sm:inline">Working in</span>
        <div className="relative">
          {tenantId ? (
            <Building2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-600" aria-hidden="true" />
          ) : (
            <Globe className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          )}
          <select
            aria-label="Company to work in"
            className={`${TOOL_INPUT} w-48 cursor-pointer truncate pl-7 pr-7 font-medium sm:w-64`}
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
        {current && <span className="hidden truncate text-[11px] text-cyan-700/70 dark:text-cyan-300/60 md:inline">{current.tenantId}</span>}
      </div>

      <div className="flex items-center gap-2">
        {tenantId && (
          <button type="button" className={TOOL_BUTTON} onClick={() => switchTo(ALL)}>
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            All tenants
          </button>
        )}
        <Link to="/platform/tenants" className={TOOL_BUTTON}>
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          Manage tenants
        </Link>
      </div>
    </div>
  );
}

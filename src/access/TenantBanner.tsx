import { useContext, useEffect, useState } from "react";
import { Link } from "react-router";
import { AuthContext } from "../context/AuthContext";
import { getSelectedTenant, setSelectedTenant } from "./access";

/** Reminds a Super Admin which tenant their actions apply to. */
export default function TenantBanner() {
  const { access } = useContext(AuthContext);
  const [tenantId, setTenantId] = useState(getSelectedTenant());

  useEffect(() => {
    const update = () => setTenantId(getSelectedTenant());
    window.addEventListener("app-tenant-changed", update);
    return () => window.removeEventListener("app-tenant-changed", update);
  }, []);

  if (!access.superAdmin) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-amber-50 px-3 py-1 text-xs text-amber-800">
      <span>
        Super Admin · {tenantId ? <>working in tenant <b>{tenantId}</b></> : "working across all tenants"}
      </span>
      <span className="flex gap-3">
        {tenantId && (
          <button className="underline" onClick={() => setSelectedTenant(null)}>All tenants</button>
        )}
        <Link to="/platform/tenants" className="underline">Switch tenant</Link>
      </span>
    </div>
  );
}

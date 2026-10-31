import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Usage, bytesText, plansApi } from "../../platform/plansApi";

import { t } from "../../i18n/i18n";

/**
 * A warning from 80% of the company's plan (users or storage), for administrators; nothing shows without a plan,
 * below 80%, or when the usage can't be read (e.g. no USERS:ADMIN).
 */
export default function PlanUsageNotice({ kind }: { kind: "users" | "storage" }) {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    plansApi.usage().then(setUsage).catch(() => setUsage(null));
  }, []);

  if (!usage || !usage.warnings.includes(kind)) return null;
  const full = kind === "users"
    ? usage.maxUsers != null && usage.users >= usage.maxUsers
    : usage.maxStorageBytes != null && usage.storageBytes >= usage.maxStorageBytes;
  const amount = kind === "users"
    ? `${usage.users} / ${usage.maxUsers} ${t("active users")}`
    : `${bytesText(usage.storageBytes)} / ${bytesText(usage.maxStorageBytes ?? 0)}`;
  return (
    <div role="status" className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${full
      ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <b>{usage.planName}: {amount}.</b>{" "}
        {t(full
          ? kind === "users" ? "New users can't be added until one is deactivated or the plan is raised." : "New files can't be added until some are removed or the plan is raised."
          : "You are close to your plan's limit. New users or files are refused once it is reached.")}
      </span>
    </div>
  );
}

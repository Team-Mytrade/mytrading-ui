import { Building2 } from "lucide-react";
import { MODULE_LABELS, AppModule } from "./access";

/**
 * Shown to a Super Admin on a company page (HR, Payroll, Attendance) before they pick the company to work in:
 * these records belong to one company, so the page waits for the choice in the Super Admin bar above.
 */
export default function ChooseCompany({ module }: { module: AppModule }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <Building2 className="mb-3 h-12 w-12 text-[rgb(var(--brand-600,0_151_167))]" aria-hidden="true" />
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Choose the company to work in</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-gray-400">
        {MODULE_LABELS[module]} records belong to one company. Pick it in the Super Admin bar above ("Working in"),
        and this page opens with that company's data.
      </p>
    </div>
  );
}

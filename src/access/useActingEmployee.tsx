import { ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import axios from "axios";
import { UserCheck } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import SearchableSelect from "../components/inputfeild/SearchableSelect";
import { CurrentEmployee, useCurrentEmployee } from "./useCurrentEmployee";
import { t } from "../i18n/i18n";

interface EmployeeOption {
  id: number;
  code: string;
  name: string;
}

export interface ActingEmployee {
  /** Whose request the page raises: the signed-in user's own record, or the employee an admin picked. */
  employee: CurrentEmployee;
  /** An admin is raising it for someone else. */
  onBehalf: boolean;
  /** Admins may pick any active employee. */
  canActForOthers: boolean;
  /** The "On behalf of" picker and banner (null for everyone else). */
  picker: ReactNode;
}

// Where each module's screens read the company's active employees
const EMPLOYEE_SOURCES: Record<"ATTENDANCE" | "HRM", string> = {
  ATTENDANCE: "/v1/api/attendance/employees",
  HRM: "/v1/api/common/employee/active",
};

// Attendance lists { id, employeeCode, name }; the common service { id, employeeCode, firstName, lastName }
interface EmployeeRow {
  id: number;
  employeeCode?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

const toOption = (e: EmployeeRow): EmployeeOption => ({
  id: Number(e.id),
  code: e.employeeCode || `EMP-${e.id}`,
  name: e.name || [e.firstName, e.lastName].filter(Boolean).join(" ") || e.employeeCode || `Employee ${e.id}`,
});

/**
 * The employee a request page acts for. Tenant admins and the module's admin role (MODULE:ADMIN) can pick any
 * active employee and raise requests on their behalf, e.g. for someone who can't sign in; the request then goes
 * to that employee's reporting manager as usual. Everyone else acts for themselves. The pick is kept in the
 * ?employeeId= of the page, so "Apply leave for" links from an employee's page open with them chosen.
 */
export const useActingEmployee = (module: "ATTENDANCE" | "HRM"): ActingEmployee => {
  const self = useCurrentEmployee();
  const { access } = useContext(AuthContext);
  const [params, setParams] = useSearchParams();
  const canActForOthers = access.superAdmin || access.permissions.includes(`${module}:ADMIN`);
  const [options, setOptions] = useState<EmployeeOption[]>([]);

  useEffect(() => {
    if (!canActForOthers) return;
    axios.get(EMPLOYEE_SOURCES[module])
      .then((r) => setOptions((Array.isArray(r.data) ? r.data : []).map(toOption)))
      .catch(() => setOptions([]));
  }, [canActForOthers, module]);

  const requested = Number(params.get("employeeId")) || null;
  const actingId = canActForOthers && requested ? requested : self.hasEmployee ? self.id : null;
  const onBehalf = actingId != null && actingId !== (self.hasEmployee ? self.id : null);
  const chosen = options.find((o) => o.id === actingId);

  const employee = useMemo<CurrentEmployee>(() => {
    if (!onBehalf) return self;
    return {
      ...self,
      id: actingId ?? 0,
      hasEmployee: actingId != null,
      name: chosen?.name ?? `Employee ${actingId}`,
      code: chosen?.code ?? `EMP-${actingId}`,
      email: "",
    };
  }, [self, onBehalf, actingId, chosen]);

  const choose = (value: string) => {
    const next = new URLSearchParams(params);
    if (value && Number(value) !== (self.hasEmployee ? self.id : null)) next.set("employeeId", value);
    else next.delete("employeeId");
    setParams(next, { replace: true });
  };

  const picker = canActForOthers ? (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-end">
        <SearchableSelect
          label={t("On behalf of")}
          value={actingId ?? ""}
          options={options.map((o) => ({ value: o.id, label: `${o.name} (${o.code})`, keywords: [o.code] }))}
          onChange={choose}
          placeholder={t("Choose an employee")}
          emptyOptionLabel={self.hasEmployee ? t("Myself") : undefined}
        />
        {onBehalf ? (
          <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <UserCheck className="h-4 w-4 shrink-0" />
            {t("Submitting for")} {employee.name} ({employee.code}). {t("Their reporting manager approves it, and they are notified.")}
          </p>
        ) : !self.hasEmployee ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("Choose the employee to raise the request for.")}</p>
        ) : null}
      </div>
    </div>
  ) : null;

  return { employee, onBehalf, canActForOthers, picker };
};

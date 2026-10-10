import { useContext } from "react";
import { Link, useLocation } from "react-router";
import { ShieldOff } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { isSelfServicePath } from "./access";

/** Shown instead of a page whose module or permission the user does not have. */
export default function NoAccess() {
  const { access } = useContext(AuthContext);
  const location = useLocation();
  const noEmployee = isSelfServicePath(location.pathname) !== null && access.employeeId == null;

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-gray-900">
        <ShieldOff className="mx-auto h-10 w-10 text-gray-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          {noEmployee ? "Employee self-service" : "No access"}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {noEmployee
            ? "These screens are for employees. Your account has no linked employee record, so punch-in, leave and self-service are not available."
            : "This module is not enabled for your organisation, or your role does not include it. Ask your administrator for access."}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

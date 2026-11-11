import { useContext, useMemo } from "react";
import { useLocation } from "react-router";
import { AuthContext } from "../context/AuthContext";
import { AppModule, hasPermission, isSelfServicePath, moduleForPath } from "./access";

export type PermissionAction = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "EXPORT";

export interface ModulePermissions {
  can: (action: PermissionAction) => boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
}

/**
 * What the signed-in user may do in a module, for showing or hiding buttons. Defaults to the module of
 * the current page (see the route map in access.ts). Pages outside any module, Super Admin pages and
 * self-service pages allow everything here: the backend decides there. The backend is always the authority.
 */
export const usePermissions = (module?: AppModule): ModulePermissions => {
  const { access } = useContext(AuthContext);
  const { pathname } = useLocation();

  return useMemo(() => {
    const pageModule = module ?? (isSelfServicePath(pathname) ? null : moduleForPath(pathname));
    const can = (action: PermissionAction) =>
      !pageModule ||
      pageModule === "PLATFORM" ||
      hasPermission(access, `${pageModule}:${action}`) ||
      hasPermission(access, `${pageModule}:ADMIN`);
    return {
      can,
      canCreate: can("CREATE"),
      canUpdate: can("UPDATE"),
      canDelete: can("DELETE"),
      canApprove: can("APPROVE"),
      canExport: can("EXPORT"),
    };
  }, [access, module, pathname]);
};

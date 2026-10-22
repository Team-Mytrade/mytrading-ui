import { useContext, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";

export interface CurrentEmployee {
  // Employee record id from the login token; 0 when the account has no employee record
  id: number;
  hasEmployee: boolean;
  name: string;
  code: string;
  role: string;
  email: string;
  dept: string;
  location: string;
}

/**
 * The signed-in user's own employee identity. Comes from the token (employeeId claim); the server
 * also ignores any other employee id for self-service calls.
 */
export const useCurrentEmployee = (): CurrentEmployee => {
  const { user, access } = useContext(AuthContext);
  return useMemo(
    () => ({
      id: access.employeeId ?? 0,
      hasEmployee: access.employeeId != null,
      name: user?.fullName || user?.username || "User",
      code: access.employeeId != null ? `EMP-${access.employeeId}` : "",
      role: user?.role || "",
      email: user?.email || user?.username || "",
      dept: "",
      location: "",
    }),
    [user, access.employeeId],
  );
};

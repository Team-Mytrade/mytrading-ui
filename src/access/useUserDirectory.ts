import { useEffect, useState } from "react";
import axios from "axios";

export interface DirectoryUser {
  userId: string;
  username: string;
  fullName: string;
  employeeId: number | null;
}

let cache: Promise<DirectoryUser[]> | null = null;

/** Active users of the current tenant, for pickers such as "Assigned To". Loaded once per page load. */
export const useUserDirectory = (): { users: DirectoryUser[]; loading: boolean } => {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cache) {
      cache = axios
        .get<DirectoryUser[]>("/v1/api/user/access/directory")
        .then((res) => (Array.isArray(res.data) ? res.data : []))
        .catch(() => {
          cache = null; // retry next time
          return [];
        });
    }
    let active = true;
    cache.then((list) => {
      if (active) {
        setUsers(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return { users, loading };
};

/** "Full Name (username)" options for a select, plus an empty "Unassigned" choice. */
export const userOptions = (users: DirectoryUser[], current?: string) => {
  const options = [
    { id: "", name: "Unassigned" },
    ...users.map((u) => ({ id: u.username, name: u.fullName ? `${u.fullName} (${u.username})` : u.username })),
  ];
  // Keep a legacy free-text value visible so editing doesn't silently drop it
  if (current && !users.some((u) => u.username === current)) {
    options.push({ id: current, name: `${current} (not a user)` });
  }
  return options;
};

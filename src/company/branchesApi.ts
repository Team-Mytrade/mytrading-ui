import axios from "axios";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * The company's branches (backlog 9.1.1, BR-1): Settings → Branches. Every signed-in user reads them (branch pickers on
 * warehouses and users, and later on documents); only a company administrator adds and changes them.
 */
export interface Branch {
  id: number;
  code: string;
  name: string;
  nameArabic?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  commercialRegistration?: string | null;
  headOffice: boolean;
  active: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export type BranchRequest = Omit<Branch, "id" | "updatedAt" | "updatedBy" | "headOffice" | "active"> & {
  headOffice?: boolean | null;
  active?: boolean | null;
};

/** Number by branch (BR-1 step 4): new documents in a branch get its own series, its code in front. */
export interface BranchNumbering {
  numberByBranch: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

const BRANCHES = "/v1/api/user/company/branches";

export const branchesApi = {
  list: () => axios.get<Branch[]>(BRANCHES).then((r) => (Array.isArray(r.data) ? r.data : [])),
  create: (request: BranchRequest) => axios.post<Branch>(BRANCHES, request).then((r) => r.data),
  update: (id: number, request: BranchRequest) => axios.put<Branch>(`${BRANCHES}/${id}`, request).then((r) => r.data),
  numbering: () => axios.get<BranchNumbering>(`${BRANCHES}/numbering`).then((r) => r.data),
  setNumbering: (numberByBranch: boolean) =>
    axios.put<BranchNumbering>(`${BRANCHES}/numbering`, { numberByBranch }).then((r) => r.data),
};

// One list for the whole page: every picker on it shares the same request
let cache: Promise<Branch[]> | null = null;

export const clearBranchCache = () => {
  cache = null;
};

/** The company's branches (head office first); empty while loading or when they can't be read. */
export const useBranches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (fresh = false) => {
    if (fresh || !cache) cache = branchesApi.list().catch(() => {
      cache = null;
      return [];
    });
    const list = await cache;
    setBranches(list);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { branches, loaded, reload: () => load(true) };
};

/**
 * The branches the signed-in user may put documents in and read (BR-1 step 3): their own when Settings → Users limits
 * them, else all. For document pickers and filters; set-up pages (warehouses, users) list every branch.
 */
export const useMyBranches = () => {
  const { access } = useContext(AuthContext);
  const all = useBranches();
  // A string, so a new token with the same branches doesn't refilter
  const mineKey = (access.branches ?? []).join(",");
  const limited = !access.superAdmin && mineKey !== "";
  const branches = useMemo(() => {
    if (!limited) return all.branches;
    const ids = mineKey.split(",").map(Number);
    return all.branches.filter((b) => ids.includes(b.id));
  }, [all.branches, limited, mineKey]);
  return { ...all, branches, limited };
};

/** "DXB · Dubai" for a picker or a list; "#7" for a branch the list doesn't have. */
export const branchLabel = (branches: Branch[], id?: number | null): string => {
  if (id == null) return "";
  const branch = branches.find((b) => b.id === id);
  return branch ? `${branch.code} · ${branch.name}` : `#${id}`;
};

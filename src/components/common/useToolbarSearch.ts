import { useEffect, useState } from "react";

/**
 * The text typed in the list toolbar's search (beside the stat cards), for pages that filter their rows themselves
 * (e.g. by names looked up from ids). Pass `externalSearch` to the ReusableTable so it doesn't filter again.
 */
export const useToolbarSearch = (): string => {
  const [search, setSearch] = useState("");
  useEffect(() => {
    const apply = (event: Event) => setSearch(String((event as CustomEvent<string>).detail ?? ""));
    window.addEventListener("reusable-table:quick-search", apply);
    return () => window.removeEventListener("reusable-table:quick-search", apply);
  }, []);
  return search;
};

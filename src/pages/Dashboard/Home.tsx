import { Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, LayoutGrid } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import { getAccessibleDashboards, type DashboardEntry } from "./dashboardRegistry";
import ModuleSnapshot from "./ModuleSnapshot";
import "./Home.css";

const STORAGE_KEY = "cc-active-module";

export default function Home() {
  const { user } = useContext(AuthContext);
  const accessible = useMemo(() => getAccessibleDashboards(user), [user]);
  const defaultKey = accessible[0]?.key ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const urlModule = searchParams.get("module") ?? "";
  const [storedKey, setStoredKey] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) || "" : ""));
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (urlModule && accessible.some((m) => m.key === urlModule)) {
      localStorage.setItem(STORAGE_KEY, urlModule);
      setStoredKey(urlModule);
    }
  }, [urlModule, accessible]);

  useEffect(() => {
    if (!urlModule && defaultKey) {
      setSearchParams({ module: defaultKey }, { replace: true });
    }
  }, [urlModule, defaultKey, setSearchParams]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  const active = useMemo<DashboardEntry | undefined>(() => {
    const candidate = urlModule || storedKey || defaultKey;
    return accessible.find((m) => m.key === candidate) ?? accessible[0];
  }, [accessible, urlModule, storedKey, defaultKey]);

  const selectModule = useCallback(
    (key: string) => {
      setSearchParams({ module: key }, { replace: true });
      localStorage.setItem(STORAGE_KEY, key);
      setStoredKey(key);
      setOpen(false);
    },
    [setSearchParams]
  );

  const ActiveComponent = active?.Component ?? null;

  return (
    <>
      <PageMeta title="Command Center" description="Unified dashboard for all modules" />
      <main className="cc-shell">
        <header className="cc-bar">
          <div className="cc-bar__title">
            <span className="cc-bar__logo"><LayoutGrid size={18} /></span>
            <div>
              <h1>Command Center</h1>
              <p>Pick a module to load its dashboard — {user?.fullName || "Admin"}</p>
            </div>
          </div>
          <div ref={selectRef} className={`cc-select${open ? " is-open" : ""}`}>
            <button type="button" className="cc-select__trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
              {active ? (
                <>
                  <span className={`cc-select__dot cc-select__dot--${active.tone}`}><active.icon size={16} /></span>
                  <span className="cc-select__label">{active.label} dashboard</span>
                  <ChevronDown size={16} className="cc-select__chevron" />
                </>
              ) : (
                <span className="cc-select__label">No module</span>
              )}
            </button>
            {open && (
              <div className="cc-select__menu" role="listbox">
                {accessible.map((module) => (
                  <button type="button" key={module.key} role="option" aria-selected={module.key === active?.key} className={module.key === active?.key ? "is-selected" : ""} onClick={() => selectModule(module.key)}>
                    <span className={`cc-select__dot cc-select__dot--${module.tone}`}><module.icon size={15} /></span>
                    <span className="cc-select__menu-name">{module.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="cc-panel">
          {ActiveComponent ? (
            <Suspense fallback={<div className="cc-loader"><span>Loading {active!.label} dashboard…</span></div>}>
              <ActiveComponent />
            </Suspense>
          ) : active ? (
            <ModuleSnapshot module={active} />
          ) : (
            <div className="cc-empty">No dashboards are available for your access.</div>
          )}
        </div>
      </main>
    </>
  );
}

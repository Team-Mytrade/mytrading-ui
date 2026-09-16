import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { CUSTOMER_UTILS } from "../config/constants";
import { navItems } from "../layout/AppSidebar";  // ← Correct import path

// Search result types
type SearchResult = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  action?: () => void;
  category: "page" | "action";
  parent?: string;
  children?: SearchResult[];
};

// Imperative handle so AppHeader can forward document-level keydown events
// into the currently-mounted SearchBar (needed for keyboard-only usage).
type SearchBarHandle = {
  handleGlobalKey: (event: KeyboardEvent) => void;
};

// Shared icon-button style so every icon action in the header has the same footprint
const ICON_BUTTON_CLASS =
  "flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800";

const IconButton = ({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) => (
  <button onClick={onClick} aria-label={label} title={label} className={ICON_BUTTON_CLASS}>
    {children}
  </button>
);

// ---------- Windows 11 context-menu styling primitives ----------
// Rounded corners, hairline border, layered shadow, subtle hover fill.
const MENU_WRAP =
  "absolute top-full left-0 mt-2 z-[9999] " +
  "min-w-[260px] p-1.5 rounded-lg " +
  "bg-white/95 dark:bg-[#202020]/95 backdrop-blur-xl " +
  "border border-black/5 dark:border-white/10 " +
  "shadow-[0_8px_32px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04)] " +
  "text-[13px] text-gray-800 dark:text-gray-100";

const MENU_ITEM =
  "group flex items-center w-full h-8 px-3 rounded-[5px] " +
  "text-left text-[13px] leading-none " +
  "hover:bg-black/[0.05] dark:hover:bg-white/[0.06] " +
  "focus:bg-black/[0.05] dark:focus:bg-white/[0.06] focus:outline-none " +
  "transition-colors";

const MENU_ITEM_ACTIVE = "bg-black/[0.05] dark:bg-white/[0.06]";

const MENU_ICON =
  "flex items-center justify-center w-4 h-4 mr-3 shrink-0 " +
  "text-gray-600 dark:text-gray-300";

const MENU_CHEVRON = (
  <svg viewBox="0 0 12 12" className="w-3 h-3 ml-auto text-gray-500 dark:text-gray-400">
    <path
      d="M4.5 2.5 8 6l-3.5 3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Small monochrome icon slot — renders nothing when no icon is provided.
const IconSlot = ({ children }: { children?: React.ReactNode }) => {
  if (!children) return null;
  return <span className={MENU_ICON}>{children}</span>;
};

// Fuzzy match: every character of `needle` must appear in `haystack` in order.
// "sord" → matches "Sales Order". "emp" → matches "Add Employee".
const fuzzyMatch = (haystack: string, needle: string): boolean => {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let i = 0;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] === n[i]) i++;
  }
  return i === n.length;
};

// Recently picked items, persisted so the empty-query menu can show them.
const RECENTS_KEY = "appheader:recents";
const RECENTS_LIMIT = 5;

const loadRecents = (): SearchResult[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRecents = (items: SearchResult[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(items));
  } catch {}
};

// Search bar — Win11-styled. Empty query shows only main modules (no scroll).
// Typing shows a flat filtered list. Hovering a module opens a flyout submenu.
//
// Keyboard model (two focus levels):
//   Level 0 (modules list):
//     ↑ ↓  move between modules
//     → or Enter  descend into a module that has children
//     Enter on a leaf module  navigate
//     Esc  close menu
//   Level 1 (flyout):
//     ↑ ↓  move between children
//     ← or Esc  go back up to the parent module
//     Enter  navigate to the highlighted child
const SearchBar = forwardRef<
  SearchBarHandle,
  {
    className?: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isOpen: boolean;
    query: string;
    onQueryChange: (v: string) => void;
    onOpenChange: (v: boolean) => void;
    mainModules: SearchResult[];
    actions: SearchResult[];
    recents: SearchResult[];
    onPick: (r: SearchResult) => void;
  }
>(function SearchBar(
  {
    className = "",
    inputRef,
    containerRef,
    isOpen,
    query,
    onQueryChange,
    onOpenChange,
    mainModules,
    actions,
    recents,
    onPick,
  },
  ref
) {
  const isMac =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  // Which top-level module's flyout is open (by id)
  const [openFlyoutId, setOpenFlyoutId] = useState<string | null>(null);
  // Highlight in the modules list (level 0)
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Highlight inside the open flyout (level 1)
  const [highlightedChildId, setHighlightedChildId] = useState<string | null>(null);
  // Which level currently owns keyboard focus
  const [level, setLevel] = useState<0 | 1>(0);

  // Reset flyout/highlight state every time the menu transitions to open,
  // so ⌘K or tapping the input always starts fresh at level 0 with no
  // stale submenu from the previous session.
  useEffect(() => {
    if (isOpen) {
      setOpenFlyoutId(null);
      setHighlightedId(null);
      setHighlightedChildId(null);
      setLevel(0);
    }
  }, [isOpen]);

  const q = query.trim().toLowerCase();
  const showingModulesOnly = !q;
  // While typing, flatten modules + their children + actions and fuzzy-filter.
  // Modules themselves are included so typing "Sales" surfaces the "Sales"
  // module; its children are flattened too so "sales order" surfaces the
  // specific page.
  const flatFiltered = useMemo(() => {
    if (!q) return [];

    // Build a flat pool: each module, each child of each module, and actions.
    const pool: SearchResult[] = [];
    mainModules.forEach((mod) => {
      // Include the module itself (path may be undefined — that's fine,
      // picking it will just do nothing, which we guard in handlePick).
      pool.push(mod);
      (mod.children ?? []).forEach((child) => pool.push(child));
    });
    actions.forEach((a) => pool.push(a));

    return pool.filter((r) => {
      // Match against the item's own label
      if (fuzzyMatch(r.label, q)) return true;
      // Match against its parent breadcrumb
      if (r.parent && fuzzyMatch(r.parent, q)) return true;
      return false;
    });
  }, [q, mainModules, actions]);

  // The list keyboard navigation walks over
  const visibleList: SearchResult[] = showingModulesOnly
    ? mainModules
    : flatFiltered;

  // Single source of truth for keyboard handling — used by both the
  // input's own onKeyDown and the global document listener (via ref).
  const runKey = (event: {
    key: string;
    preventDefault: () => void;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
  }) => {
    if (!isOpen) return;

    // ---- ESC ----
    if (event.key === "Escape") {
      event.preventDefault();
      if (level === 1) {
        setLevel(0);
        setOpenFlyoutId(null);
        setHighlightedChildId(null);
        return;
      }
      onOpenChange(false);
      onQueryChange("");
      setOpenFlyoutId(null);
      setHighlightedId(null);
      setHighlightedChildId(null);
      setLevel(0);
      return;
    }

    // ============================================================
    // Typing mode — flat list only, no flyouts
    // ============================================================
    if (!showingModulesOnly) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (visibleList.length === 0) return;
        const cur = visibleList.findIndex((r) => r.id === highlightedId);
        const next =
          event.key === "ArrowDown"
            ? cur < visibleList.length - 1
              ? cur + 1
              : 0
            : cur > 0
            ? cur - 1
            : visibleList.length - 1;
        setHighlightedId(visibleList[next].id);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const explicit = visibleList.find((r) => r.id === highlightedId);
        const fallback = query.trim() ? visibleList[0] : undefined;
        const target = explicit ?? fallback;
        if (target) onPick(target);
      }
      return;
    }

    // ============================================================
    // Empty-query mode — modules list + flyouts (two levels)
    // ============================================================

    // -------- Level 1: inside the flyout --------
    if (level === 1 && openFlyoutId) {
      const children =
        mainModules.find((m) => m.id === openFlyoutId)?.children ?? [];

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (children.length === 0) return;
        const cur = children.findIndex((c) => c.id === highlightedChildId);
        const next =
          event.key === "ArrowDown"
            ? cur < children.length - 1
              ? cur + 1
              : 0
            : cur > 0
            ? cur - 1
            : children.length - 1;
        setHighlightedChildId(children[next].id);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setLevel(0);
        setOpenFlyoutId(null);
        setHighlightedChildId(null);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const target =
          children.find((c) => c.id === highlightedChildId) ?? children[0];
        if (target) onPick(target);
        return;
      }

      return;
    }

    // -------- Level 0: modules list --------
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleList.length === 0) return;
      const cur = visibleList.findIndex((r) => r.id === highlightedId);
      const next =
        event.key === "ArrowDown"
          ? cur < visibleList.length - 1
            ? cur + 1
            : 0
          : cur > 0
          ? cur - 1
          : visibleList.length - 1;
      setHighlightedId(visibleList[next].id);
      // moving between modules closes any open flyout
      setOpenFlyoutId(null);
      setHighlightedChildId(null);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const cur = mainModules.find((r) => r.id === highlightedId);
      if (cur?.children?.length) {
        setOpenFlyoutId(cur.id);
        setHighlightedChildId(cur.children[0].id);
        setLevel(1);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const cur = mainModules.find((r) => r.id === highlightedId);
      if (cur?.children?.length) {
        // descend instead of navigating
        setOpenFlyoutId(cur.id);
        setHighlightedChildId(cur.children[0].id);
        setLevel(1);
        return;
      }
      if (cur) onPick(cur);
      return;
    }
  };

  // Expose the same handler so AppHeader can forward document keys to us.
  useImperativeHandle(
    ref,
    () => ({
      handleGlobalKey: (event: KeyboardEvent) => runKey(event),
    }),
    [
      isOpen,
      visibleList,
      highlightedId,
      showingModulesOnly,
      openFlyoutId,
      highlightedChildId,
      level,
      query,
      mainModules,
    ]
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            fill="none"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9.375 16.708a7.333 7.333 0 1 0 0-14.667 7.333 7.333 0 0 0 0 14.667Zm7.815-1.358 2.94 2.94a.833.833 0 0 1-1.179 1.178l-2.94-2.94a9.167 9.167 0 1 1 1.18-1.18Z"
              fill="currentColor"
            />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="text"
          placeholder="Search or type command..."
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setHighlightedId(null);
            setOpenFlyoutId(null);
            setHighlightedChildId(null);
            setLevel(0);
            if (!isOpen) onOpenChange(true);
          }}
          // Toggle open/close when tapping the input directly.
          onMouseDown={(e) => {
            if (isOpen) {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
              onOpenChange(false);
              onQueryChange("");
              setHighlightedId(null);
              setOpenFlyoutId(null);
              setHighlightedChildId(null);
              setLevel(0);
              return;
            }
            // Otherwise open fresh.
            setHighlightedId(null);
            setOpenFlyoutId(null);
            setHighlightedChildId(null);
            setLevel(0);
            onOpenChange(true);
          }}
          onFocus={() => {
            if (!isOpen) {
              setHighlightedId(null);
              setOpenFlyoutId(null);
              setHighlightedChildId(null);
              setLevel(0);
              onOpenChange(true);
            }
          }}
          onKeyDown={runKey}
          className="w-full h-8 pl-9 pr-20 text-[13px] rounded-md
                     bg-white dark:bg-[#2b2b2b]
                     border border-black/10 dark:border-white/10
                     text-gray-800 dark:text-gray-100
                     placeholder:text-gray-500 dark:placeholder:text-gray-400
                     focus:outline-none focus:border-blue-500/60
                     focus:ring-2 focus:ring-blue-500/20 transition-colors"
        />

        <span className="absolute inset-y-0 right-0 flex items-center pr-2">
          <kbd
            className="inline-flex items-center justify-center h-5 px-1.5
                       text-[11px] font-medium
                       text-gray-600 dark:text-gray-300
                       bg-black/[0.04] dark:bg-white/[0.06]
                       border border-black/5 dark:border-white/10
                       rounded"
          >
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </span>
      </div>

      {/* Win11-style menu */}
      {isOpen && (
        <div className={MENU_WRAP} role="listbox" aria-label="Search results">
          {/* ---------- EMPTY QUERY: recent + main modules ---------- */}
          {showingModulesOnly && (
            <>
              {/* Recent section (only when we have recents) */}
              {recents.length > 0 && (
                <>
                  <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Recent
                  </div>
                  {recents.map((r) => (
                    <button
                      key={`recent-${r.id}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className={MENU_ITEM}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPick(r)}
                    >
                      <IconSlot>{r.icon}</IconSlot>
                      <span className="truncate">{r.label}</span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-black/[0.06] dark:bg-white/[0.08]" />
                </>
              )}

              <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Modules
              </div>

              {mainModules.map((mod) => {
                const hasChildren = !!mod.children?.length;
                const isHighlighted = highlightedId === mod.id;
                const isFlyoutOpen = openFlyoutId === mod.id;

                return (
                  <div
                    key={mod.id}
                    className="relative"
                    onMouseEnter={() => {
                      setHighlightedId(mod.id);
                      setOpenFlyoutId(hasChildren ? mod.id : null);
                      setLevel(0);
                      setHighlightedChildId(null);
                    }}
                    onMouseLeave={() => {
                      setOpenFlyoutId((cur) => (cur === mod.id ? null : cur));
                    }}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      aria-haspopup={hasChildren || undefined}
                      aria-expanded={isFlyoutOpen || undefined}
                      className={`${MENU_ITEM} ${
                        isHighlighted || isFlyoutOpen ? MENU_ITEM_ACTIVE : ""
                      }`}
                      // Prevent the input from losing focus on press; keeps
                      // the menu open through the click so navigation fires.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (hasChildren) {
                          setOpenFlyoutId(isFlyoutOpen ? null : mod.id);
                        } else {
                          onPick(mod);
                        }
                      }}
                    >
                      <IconSlot>{mod.icon}</IconSlot>
                      <span className="truncate">{mod.label}</span>
                      {hasChildren && MENU_CHEVRON}
                    </button>

                    {/* Flyout submenu */}
                    {hasChildren && isFlyoutOpen && (
                      <div
                        className={`${MENU_WRAP} !left-full !top-[-6px] !mt-0 ml-1`}
                        role="menu"
                        onMouseEnter={() => setOpenFlyoutId(mod.id)}
                      >
                        {mod.children!.map((child) => {
                          const isChildHighlighted =
                            level === 1 && highlightedChildId === child.id;
                          return (
                            <div key={child.id} className="relative">
                              <button
                                type="button"
                                role="menuitem"
                                aria-selected={isChildHighlighted}
                                className={`${MENU_ITEM} ${
                                  isChildHighlighted ? MENU_ITEM_ACTIVE : ""
                                }`}
                                onMouseEnter={() => {
                                  setLevel(1);
                                  setHighlightedChildId(child.id);
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onPick(child)}
                              >
                                <IconSlot>{child.icon}</IconSlot>
                                <span className="truncate">{child.label}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ---------- TYPING: flat filtered list ---------- */}
          {!showingModulesOnly && (
            <>
              {flatFiltered.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px] text-gray-500 dark:text-gray-400">
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                <>
                  <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Results
                  </div>

                  {flatFiltered.map((r) => {
                    const isHighlighted = highlightedId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        className={`${MENU_ITEM} ${
                          isHighlighted ? MENU_ITEM_ACTIVE : ""
                        }`}
                        onMouseEnter={() => setHighlightedId(r.id)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onPick(r)}
                      >
                        <IconSlot>{r.icon}</IconSlot>
                        <span className="truncate">{r.label}</span>
                        {r.parent && (
                          <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {r.parent}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recents, setRecents] = useState<SearchResult[]>(() => loadRecents());

  // Two refs — one per rendered SearchBar (desktop + mobile)
  const inputRef = useRef<HTMLInputElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Imperative handles for forwarding global keydown into the active bar
  const desktopSearchBarRef = useRef<SearchBarHandle>(null);
  const mobileSearchBarRef = useRef<SearchBarHandle>(null);

  const navigate = useNavigate();

  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          console.error("Failed to enter fullscreen:", err);
        });
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
          })
          .catch((err) => {
            console.error("Failed to exit fullscreen:", err);
          });
      }
    }
  };

  // Build search results from navItems — main modules (top level) + children (sub-items)
  const mainModules = useMemo<SearchResult[]>(() => {
    return (navItems as any[]).map((item) => {
      const children: SearchResult[] = [];

      // Process subItems (one level or nested) into flyout children
      (item.subItems ?? []).forEach((sub: any) => {
        if (sub.subItems?.length) {
          sub.subItems.forEach((leaf: any) => {
            if (leaf.path) {
              children.push({
                id:
                  leaf.path.replace(/\//g, "_") ||
                  leaf.name.toLowerCase().replace(/\s+/g, "_"),
                label: leaf.name,
                path: leaf.path,
                category: "page",
                parent: `${item.name} > ${sub.name}`,
              });
            }
          });
        } else if (sub.path) {
          children.push({
            id:
              sub.path.replace(/\//g, "_") ||
              sub.name.toLowerCase().replace(/\s+/g, "_"),
            label: sub.name,
            path: sub.path,
            category: "page",
            parent: item.name,
          });
        }
      });

      return {
        id:
          item.path?.replace(/\//g, "_") ||
          item.name.toLowerCase().replace(/\s+/g, "_"),
        label: item.name,
        path: item.path,
        category: "page" as const,
        children,
      };
    });
  }, []);

  // Actions — only shown while typing
  const actions = useMemo<SearchResult[]>(
    () => [
      { id: "create-customer", label: "Add New Customer", category: "action",
        action: () => navigate("/customer-management?action=create") },
      { id: "create-sales-order", label: "Create Sales Order", category: "action",
        action: () => navigate("/sales-orders?action=create") },
      { id: "create-purchase-order", label: "Create Purchase Order", category: "action",
        action: () => navigate("/purchase-orders?action=create") },
      { id: "create-invoice", label: "Create Invoice", category: "action",
        action: () => navigate("/invoices?action=create") },
      { id: "create-batch", label: "Create New Batch", category: "action",
        action: () => navigate("/batch?action=create") },
      { id: "create-warehouse", label: "Add Warehouse", category: "action",
        action: () => navigate("/warehouse?action=create") },
      { id: "create-employee", label: "Add Employee", category: "action",
        action: () => navigate("/employeeRecords?action=create") },
      { id: "create-leave", label: "Apply for Leave", category: "action",
        action: () => navigate("/att_leaveRequest?action=create") },
      { id: "punch-attendance", label: "Punch Attendance", category: "action",
        action: () => navigate("/att_punch") },
    ],
    [navigate]
  );

  // Centralized pick handler so desktop and mobile behave identically.
  // Close the menu first, then navigate, then clear the query — this order
  // avoids a flicker where the menu re-renders with an empty input mid-route-change.
  const handlePick = (r: SearchResult) => {
    setIsSearchOpen(false);
    setApplicationMenuOpen(false); // close mobile menu after navigation

    if (r.action) {
      r.action();
    } else if (r.path) {
      navigate(r.path);
    }

    // Record this pick in recents (dedup by id, newest first, capped).
    // Only store navigable entries so recents remain usable.
    if (r.path) {
      const next = [
        { id: r.id, label: r.label, path: r.path, category: r.category, parent: r.parent },
        ...recents.filter((x) => x.id !== r.id),
      ].slice(0, RECENTS_LIMIT);
      setRecents(next);
      saveRecents(next);
    }

    // Clear query on the next tick so the current render finishes cleanly.
    setTimeout(() => setSearchQuery(""), 0);
  };

  // Handle keyboard shortcuts — ⌘K / Ctrl+K to open, ESC to close, and
  // forward arrow/Enter keys to the active SearchBar for keyboard-only use.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl K — toggle the search menu
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();

        // If the menu is already open, close it and blur the input so
        // focus doesn't keep re-opening it via the input's focus handler.
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery("");
          (inputRef.current ?? mobileInputRef.current)?.blur();
          return;
        }

        // Otherwise open fresh.
        setApplicationMenuOpen(false);
        setIsSearchOpen(true);
        setSearchQuery("");

        // Focus the desktop input, retrying briefly in case the menu
        // hasn't mounted yet on this tick. Falls back to the mobile input
        // when the desktop bar isn't rendered (small viewport).
        let tries = 0;
        const focusInput = () => {
          const el = inputRef.current ?? mobileInputRef.current;
          if (el) {
            el.focus();
            const len = el.value.length;
            try {
              el.setSelectionRange(len, len);
            } catch {}
            return;
          }
          if (tries++ < 10) requestAnimationFrame(focusInput);
        };
        requestAnimationFrame(focusInput);
        return;
      }

      // While the menu is open, forward navigation keys to whichever
      // SearchBar is mounted. Skip modifier combos — those belong to the
      // browser.
      if (isSearchOpen && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const handler =
          desktopSearchBarRef.current ?? mobileSearchBarRef.current;
        if (handler) handler.handleGlobalKey(event);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Handle click outside — use `click` (not mousedown) so the input's
  // own mousedown that opens the menu has already landed before we check
  // whether the click was outside. This prevents the "needs multiple taps"
  // race that happens right after navigation.
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // If the click landed inside either search container, do nothing.
      if (
        desktopSearchRef.current?.contains(target) ||
        mobileSearchRef.current?.contains(target)
      ) {
        return;
      }

      // Otherwise close and reset fully.
      setIsSearchOpen(false);
      setSearchQuery("");
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isSearchOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 w-full bg-white border-b border-gray-200 dark:bg-[#171717] dark:border-[#292929]">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          <div className="flex items-center flex-1 gap-4">
            {/* Logo - Mobile */}
            <Link to="/" className="lg:hidden">
              <img
                className="w-auto h-8 dark:hidden"
                src={CUSTOMER_UTILS.ICON}
                alt="Logo"
              />
              <img
                className="hidden w-auto h-8 dark:block"
                src={CUSTOMER_UTILS.ICON_D}
                alt="Logo"
              />
            </Link>

            {/* Desktop Search Bar — own ref */}
            <SearchBar
              ref={desktopSearchBarRef}
              className="hidden lg:block w-[50%]"
              inputRef={inputRef}
              containerRef={desktopSearchRef}
              isOpen={isSearchOpen}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onOpenChange={setIsSearchOpen}
              mainModules={mainModules}
              actions={actions}
              recents={recents}
              onPick={handlePick}
            />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={toggleApplicationMenu}
              className="p-2 text-gray-700 rounded-lg lg:hidden hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Application menu"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM18 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <div
              className={`${
                isApplicationMenuOpen ? "flex" : "hidden"
              } lg:flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 absolute lg:static top-16 left-0 right-0 bg-white dark:bg-[#171717] shadow-lg lg:shadow-none border-t lg:border-t-0 border-gray-200 dark:border-[#292929] p-4 lg:p-0`}
            >
              {/* Mobile Search — own ref + own input ref */}
              <div className="w-full mb-2 lg:hidden">
                <SearchBar
                  ref={mobileSearchBarRef}
                  inputRef={mobileInputRef}
                  containerRef={mobileSearchRef}
                  isOpen={isSearchOpen}
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  onOpenChange={setIsSearchOpen}
                  mainModules={mainModules}
                  actions={actions}
                  recents={recents}
                  onPick={handlePick}
                />
              </div>

              <div className="flex items-center justify-between lg:justify-start gap-3 sm:gap-4 text-sm w-full lg:w-auto">
                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <path fillRule="evenodd" clipRule="evenodd" d="M9 3H3v6h2V5h4V3zm6 0h6v6h-2V5h-4V3zm-8 18H3v-6h2v4h4v2zm8 0h6v-6h-2v4h-4v2z" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <path fillRule="evenodd" clipRule="evenodd" d="M8 3H3v5h2V5h3V3zm8 0h5v5h-2V5h-3V3zM8 21H3v-5h2v3h3v2zm8 0h5v-5h-2v3h-3v2z" fill="currentColor" />
                    </svg>
                  )}
                </button>

                <ThemeToggleButton />
                <NotificationDropdown />

                <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

                <UserDropdown />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default AppHeader;
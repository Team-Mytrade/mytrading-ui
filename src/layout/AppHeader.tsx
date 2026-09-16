import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useSidebar } from "../context/SidebarContext";
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
  category: "page" | "action" | "recent";
  parent?: string;
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

const SearchBar = ({
  className = "",
  inputRef,
}: {
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) => {
  const isMac =
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <svg
          className="w-5 h-5 text-gray-500 dark:text-gray-400"
          fill="none"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.375 16.708a7.333 7.333 0 1 0 0-14.667 7.333 7.333 0 0 0 0 14.667Zm7.815-1.358 2.94 2.94a.833.833 0 0 1-1.179 1.178l-2.94-2.94a9.167 9.167 0 1 1 1.18-1.18Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="text"
        placeholder="Search or type command..."
        className="w-full h-10 pl-10 pr-16 text-sm bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
      />

      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        <kbd className="inline-flex items-center justify-center h-5 w-auto px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-300 rounded dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>
    </div>
  );
};

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { isMobileOpen, isExpanded, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  // True whenever the sidebar is "open" in either mode (mobile drawer or desktop expanded)
  const isSidebarOpen = isMobileOpen || isExpanded;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

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

  // Build search results from navItems
  const searchResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = [];

    // Helper to flatten nav items
    const flattenNavItems = (items: any[], parent?: string) => {
      items.forEach((item) => {
        // Add the main item if it has a path
        if (item.path) {
          results.push({
            id: item.path.replace(/\//g, "_") || item.name.toLowerCase().replace(/\s+/g, "_"),
            label: item.name,
            path: item.path,
            category: "page",
            parent: parent,
          });
        }

        // Process subItems
        if (item.subItems) {
          item.subItems.forEach((subItem: any) => {
            // If subItem has its own subItems (nested)
            if (subItem.subItems) {
              subItem.subItems.forEach((nestedItem: any) => {
                if (nestedItem.path) {
                  results.push({
                    id: nestedItem.path.replace(/\//g, "_") || nestedItem.name.toLowerCase().replace(/\s+/g, "_"),
                    label: nestedItem.name,
                    path: nestedItem.path,
                    category: "page",
                    parent: `${item.name} > ${subItem.name}`,
                  });
                }
              });
            } else if (subItem.path) {
              results.push({
                id: subItem.path.replace(/\//g, "_") || subItem.name.toLowerCase().replace(/\s+/g, "_"),
                label: subItem.name,
                path: subItem.path,
                category: "page",
                parent: item.name,
              });
            }
          });
        }
      });
    };

    // Flatten all nav items
    flattenNavItems(navItems);

    // Add actions
    results.push(
      { 
        id: "create-customer", 
        label: "Add New Customer", 
        category: "action",
        action: () => navigate("/customer-management?action=create")
      },
      { 
        id: "create-sales-order", 
        label: "Create Sales Order", 
        category: "action",
        action: () => navigate("/sales-orders?action=create")
      },
      { 
        id: "create-purchase-order", 
        label: "Create Purchase Order", 
        category: "action",
        action: () => navigate("/purchase-orders?action=create")
      },
      { 
        id: "create-invoice", 
        label: "Create Invoice", 
        category: "action",
        action: () => navigate("/invoices?action=create")
      },
      { 
        id: "create-batch", 
        label: "Create New Batch", 
        category: "action",
        action: () => navigate("/batch?action=create")
      },
      { 
        id: "create-warehouse", 
        label: "Add Warehouse", 
        category: "action",
        action: () => navigate("/warehouse?action=create")
      },
      { 
        id: "create-employee", 
        label: "Add Employee", 
        category: "action",
        action: () => navigate("/employeeRecords?action=create")
      },
      { 
        id: "create-leave", 
        label: "Apply for Leave", 
        category: "action",
        action: () => navigate("/att_leaveRequest?action=create")
      },
      { 
        id: "punch-attendance", 
        label: "Punch Attendance", 
        category: "action",
        action: () => navigate("/att_punch")
      },
    );

    if (!searchQuery.trim()) return results;

    const query = searchQuery.toLowerCase().trim();
    return results.filter(
      (result) =>
        result.label.toLowerCase().includes(query) ||
        result.id.toLowerCase().includes(query) ||
        result.category.toLowerCase().includes(query) ||
        result.parent?.toLowerCase().includes(query)
    );
  }, [searchQuery, navigate]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Open search: ⌘K or Ctrl K
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
        setSearchQuery("");
        setSelectedIndex(-1);
        setTimeout(() => inputRef.current?.focus(), 100);
      }

      // Close search: ESC
      if (event.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSelectedIndex(-1);
      }
    };

    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchOpen]);

  // Handle keyboard navigation in results
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isSearchOpen) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          const result = searchResults[selectedIndex];
          if (result.action) {
            result.action();
          } else if (result.path) {
            navigate(result.path);
          }
          setIsSearchOpen(false);
          setSearchQuery("");
          setSelectedIndex(-1);
        }
        break;
    }
  };

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
      <header className="sticky top-0 z-20 w-full bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          <div className="flex items-center flex-1 gap-4">
            {/* Sidebar Toggle */}
            <button
              className="flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              onClick={handleToggle}
              aria-label="Toggle Sidebar"
            >
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${
                  isSidebarOpen ? "" : "rotate-180"
                }`}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M15 6L9 12L15 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

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

            {/* Search Bar Container */}
            <div className="hidden lg:block w-[50%] relative" ref={searchContainerRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
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
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search or type command..."
                  className="w-full h-8 pl-10 pr-24 text-sm bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedIndex(-1);
                    if (!isSearchOpen) setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={handleKeyDown}
                />

                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <kbd className="inline-flex items-center justify-center h-5 w-auto px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-300 rounded dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
                    {isMac ? "⌘K" : "Ctrl K"}
                  </kbd>
                </div>
              </div>

              {/* Search Results Dropdown */}
              {isSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[9999]">
                  {searchResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((result, index) => (
                        <button
                          key={result.id}
                          onClick={() => {
                            if (result.action) {
                              result.action();
                            } else if (result.path) {
                              navigate(result.path);
                            }
                            setIsSearchOpen(false);
                            setSearchQuery("");
                            setSelectedIndex(-1);
                          }}
                          className={`flex items-center w-full px-4 py-2.5 text-sm transition-colors ${
                            index === selectedIndex
                              ? "bg-blue-50 dark:bg-blue-900/30"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          <div className="flex-1 text-left">
                            <span className="text-gray-700 dark:text-gray-200">
                              {result.label}
                            </span>
                            {result.parent && (
                              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                {result.parent}
                              </span>
                            )}
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 capitalize">
                              {result.category}
                            </span>
                          </div>
                          {result.path && (
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.length === 0 && searchQuery && (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No results found for "<span className="font-medium">{searchQuery}</span>"
                    </div>
                  )}

                  {(searchResults.length > 0 || searchQuery) && (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                      <span className="text-xs text-gray-400">
                        {searchResults.length > 0 ? (
                          "↑↓ Navigate • Enter Select • ESC Close"
                        ) : (
                          "Type to search..."
                        )}
                      </span>
                      <span className="text-xs text-gray-400">
                        {searchResults.length} results
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
              } lg:flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 absolute lg:static top-16 left-0 right-0 bg-white dark:bg-gray-900 shadow-lg lg:shadow-none border-t lg:border-t-0 border-gray-200 dark:border-gray-800 p-4 lg:p-0`}
            >
              {/* Mobile Search */}
              <div className="w-full mb-2 lg:hidden">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full h-10 pl-4 pr-16 text-sm bg-gray-100 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedIndex(-1);
                      if (!isSearchOpen) setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <kbd className="inline-flex items-center justify-center text-xs text-gray-500 h-6 w-auto px-2 bg-gray-200 dark:bg-gray-700 rounded dark:text-gray-400">
                      {isMac ? "⌘K" : "Ctrl K"}
                    </kbd>
                  </div>
                </div>
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

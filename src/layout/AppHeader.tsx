import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { CUSTOMER_UTILS } from "../config/constants";

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
  const { isMobileOpen, isExpanded, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-20 w-full bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center flex-1 gap-4">
          <IconButton onClick={handleToggle} label="Toggle Sidebar">
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${
                isSidebarOpen ? "" : "rotate-180"
              }`}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 6L9 12L15 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>

          {/* Logo - Mobile */}
          <Link to="/" className="lg:hidden">
            <img className="w-auto h-8 dark:hidden" src={CUSTOMER_UTILS.ICON} alt="Logo" />
            <img
              className="hidden w-auto h-8 dark:block"
              src={CUSTOMER_UTILS.ICON_D}
              alt="Logo"
            />
          </Link>

          <SearchBar inputRef={inputRef} className="hidden lg:block w-[50%]" />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Application Menu Toggle - Mobile */}
          <button
            onClick={toggleApplicationMenu}
            aria-label="Application menu"
            className={`${ICON_BUTTON_CLASS} lg:hidden`}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
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
            <SearchBar className="w-full mb-2 lg:hidden" />

            <div className="flex items-center justify-between lg:justify-start gap-3 sm:gap-4 text-sm w-full lg:w-auto">
              <IconButton
                onClick={toggleFullscreen}
                label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M9 3H3v6h2V5h4V3zm6 0h6v6h-2V5h-4V3zm-8 18H3v-6h2v4h4v2zm8 0h6v-6h-2v4h-4v2z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M8 3H3v5h2V5h3V3zm8 0h5v5h-2V5h-3V3zM8 21H3v-5h2v3h3v2zm8 0h5v-5h-2v3h-3v2z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </IconButton>

              <ThemeToggleButton />
              <NotificationDropdown />

              <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

              <UserDropdown />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

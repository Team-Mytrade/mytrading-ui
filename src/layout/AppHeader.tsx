import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { CUSTOMER_UTILS } from "../config/constants";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const inputRef = useRef<HTMLInputElement>(null);

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
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
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
    <header className="sticky top-0 z-50 w-full bg-white  border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        <div className="flex items-center flex-1 gap-4">
          <button
            className="flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                viewBox="0 0 16 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                  fill="currentColor"
                />
              </svg>
            )}
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

          <div className="hidden lg:block w-[50%]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg
                  className="w-4 h-4 text-gray-500 dark:text-gray-400"
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

              {/* Input Field */}
              <input
                ref={inputRef}
                type="text"
                placeholder="Search or type command..."
                className="w-full h-8 pl-10 pr-24 text-sm bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
              />

              {/* Command Key */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <kbd className="inline-flex items-center h-5 w-8 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-300 rounded dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Application Menu Toggle - Mobile */}
          <button
            onClick={toggleApplicationMenu}
            className="p-2 text-gray-700 rounded-lg lg:hidden hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Application menu"
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
            className={`${isApplicationMenuOpen ? "flex" : "hidden"
              } lg:flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 absolute lg:static top-16 left-0 right-0 bg-white dark:bg-gray-900 shadow-lg lg:shadow-none border-t lg:border-t-0 border-gray-200 dark:border-gray-800 p-4 lg:p-0`}
          >
            <div className="w-full mb-2 lg:hidden">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full h-10 pl-4 pr-12 text-sm bg-gray-100 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <kbd className="inline-flex items-center justify-center text-xs text-gray-500 h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded dark:text-gray-400">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between lg:justify-start gap-3 sm:gap-4 text-sm w-full lg:w-auto">
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
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
              </button>

              <ThemeToggleButton />
              <NotificationDropdown />

              <div className="hidden lg:block h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

              <UserDropdown />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

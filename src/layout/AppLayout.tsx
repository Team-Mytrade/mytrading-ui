import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet, useLocation } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { AuthContext } from "../context/AuthContext";
import SignIn from "../pages/AuthPages/SignIn";
import { useContext } from "react";
import { canAccessPath } from "../access/access";
import NoAccess from "../access/NoAccess";
import TenantBanner from "../access/TenantBanner";
import { useRegionalVersion } from "../company/companyApi";
import { useLanguage } from "../i18n/i18n";


import { useState, useEffect, Suspense } from "react";
import PageLoading from "../components/common/PageLoading";
import "../styles/SalesDarkMode.css";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, sidebarWidth, isResizing } = useSidebar();
  const location = useLocation();
  const { access, isLoggedIn } = useContext(AuthContext);
  // Dates, times and money follow the company's regional settings
  const regional = useRegionalVersion(isLoggedIn);
  const lang = useLanguage();
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);
  const isSalesModule = [
    "/sales-dashboard", "/sales-targets", "/sales-persons", "/sales-orders",
    "/return-requests", "/refunds", "/quotations", "/quote-view", "/credit-limit",
    "/sales-channels", "/service-schedules", "/service-schedule-notify",
  ].some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (

    <div className="h-screen overflow-hidden bg-[#eaf8fa] dark:bg-[#1f1f1f] lg:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        style={{
          // Start side: the sidebar is on the right in Arabic
          marginInlineStart: isLargeScreen
            ? (isExpanded || isHovered ? `${sidebarWidth}px` : "60px")
            : "0px",
          width: isLargeScreen
            ? `calc(100% - ${(isExpanded || isHovered ? `${sidebarWidth}px` : "60px")})`
            : "100%",
        }}
        className={`flex h-screen min-w-0 flex-col overflow-hidden ${isResizing ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
      >
        <div className="shrink-0">
          <AppHeader />
          <TenantBanner />
        </div>
        {/* Every page scrolls vertically when its content is taller than the window (a list of "scrollable
            pages" used to decide this, and pages missing from it were cut off); never sideways */}
        <div className={`app-content-tight app-content-scroll min-h-0 flex-1 w-full overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-[3px] md:px-3 md:py-[3px] ${isSalesModule ? "sales-module" : ""}`}>
          {!regional.ready && isLoggedIn ? (
            <PageLoading />
          ) : canAccessPath(access, location.pathname) ? (
            // Pages are loaded on demand; header and sidebar stay while one loads. A new language or regional
            // setting draws the page again.
            <Suspense key={`${regional.version}-${lang}`} fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          ) : (
            <NoAccess />
          )}
        </div>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  const { isLoggedIn, loading } = useContext(AuthContext);
  const hasStoredSession = !!localStorage.getItem("accessToken");

  if (loading && hasStoredSession) {
    return (
      <SidebarProvider>
        <LayoutContent />
      </SidebarProvider>
    );
  }

  if (loading) {
    return null;
  }

  if (!isLoggedIn) {
    return <SignIn />;
  }

  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;

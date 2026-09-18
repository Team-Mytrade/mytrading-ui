import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet, useLocation } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { AuthContext } from "../context/AuthContext";
import SignIn from "../pages/AuthPages/SignIn";
import { useContext } from "react";


import { useState, useEffect } from "react";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, sidebarWidth, isResizing } = useSidebar();
  const location = useLocation();
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);
  const isScrollablePage = 
    location.pathname === "/" || 
    location.pathname.startsWith("/att_leaveDashboard") || 
    location.pathname.startsWith("/att_leaveManagerDashboard") ||
    location.pathname.startsWith("/att_leaveRequest") ||
    location.pathname.startsWith("/att_timesheetManagement") ||
    location.pathname.startsWith("/att_requests") ||
    location.pathname.startsWith("/att_punch") ||
    location.pathname.startsWith("/att_selfService") ||
    location.pathname.startsWith("/att_attendanceTracking") ||
    location.pathname.startsWith("/att_holidayCalendar") ||
    location.pathname.startsWith("/payrollSummary") ||
    location.pathname.startsWith("/departmentSummary") ||
    location.pathname.startsWith("/payrollEngine") ||
    location.pathname.startsWith("/it-declaration") ||
    location.pathname.startsWith("/addEmployee");

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (

    <div className="h-screen overflow-hidden bg-[#e7e9ee] dark:bg-[#1f1f1f] lg:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        style={{
          marginLeft: isLargeScreen
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
        </div>
        <div className={`app-content-tight min-h-0 flex-1 w-full px-2 py-[3px] md:px-3 md:py-[3px] ${isScrollablePage ? "overflow-x-hidden overflow-y-auto overscroll-contain no-scrollbar" : "overflow-hidden"}`}>
          <Outlet />
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

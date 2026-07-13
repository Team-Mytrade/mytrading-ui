import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { AuthContext } from "../context/AuthContext";
import SignIn from "../pages/AuthPages/SignIn";
import { useContext } from "react";


import { useState, useEffect } from "react";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, sidebarWidth, isResizing } = useSidebar();
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (

    <div className="min-h-screen xl:flex">
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
        className={`min-w-0 ${isResizing ? "transition-none" : "transition-all duration-300 ease-in-out"}`}
      >
        <AppHeader />
        <div className="app-content-tight w-full px-2 py-[3px] md:px-3 md:py-[3px]">
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

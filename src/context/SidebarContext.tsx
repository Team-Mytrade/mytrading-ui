import { createContext, useContext, useState, useEffect } from "react";

type SidebarContextType = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  activeItem: string | null;
  openSubmenu: string | null;
  sidebarWidth: number;
  isResizing: boolean;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setActiveItem: (item: string | null) => void;
  toggleSubmenu: (item: string) => void;
  setSidebarWidth: (width: number) => void;
  setIsResizing: (resizing: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem("sidebarExpanded");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidthState] = useState<number>(() => {
    const saved = localStorage.getItem("sidebarWidth");
    const savedWidth = saved ? parseInt(saved, 10) : 300;
    return Math.max(220, Math.min(300, savedWidth));
  });
  const [isResizing, setIsResizing] = useState(false);

  const setSidebarWidth = (width: number) => {
    const constrainedWidth = Math.max(220, Math.min(300, width));
    setSidebarWidthState(constrainedWidth);
    localStorage.setItem("sidebarWidth", constrainedWidth.toString());
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarExpanded", JSON.stringify(next));
      return next;
    });
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const toggleSubmenu = (item: string) => {
    setOpenSubmenu((prev) => (prev === item ? null : item));
  };

  return (
    <SidebarContext.Provider
      value={{
        isExpanded: isMobile ? false : isExpanded,
        isMobileOpen,
        isHovered,
        activeItem,
        openSubmenu,
        sidebarWidth,
        isResizing,
        toggleSidebar,
        toggleMobileSidebar,
        setIsHovered,
        setActiveItem,
        toggleSubmenu,
        setSidebarWidth,
        setIsResizing,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

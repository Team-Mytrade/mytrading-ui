import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Activity,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BellRing,
  BookMarked,
  BookOpen,
  BookmarkCheck,
  Boxes,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CalendarX,
  Car,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock,
  Coins,
  Contact,
  CreditCard,
  Database,
  FileCheck,
  FileText,
  Fingerprint,
  FolderOpen,
  FolderTree,
  Gauge,
  HandCoins,
  Handshake,
  Landmark,
  Layers,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MapPin,
  MessagesSquare,
  Network,
  NotebookText,
  Package,
  PackageCheck,
  PackageMinus,
  Percent,
  PieChart,
  Receipt,
  ReceiptText,
  Route,
  Scale,
  ScanBarcode,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Target,
  Truck,
  Undo2,
  UserCheck,
  UserCircle,
  UserPlus,
  UserRound,
  Users,
  Radar,
  Smartphone,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { AuthContext } from "../context/AuthContext";
import { AccessInfo, canAccessPath, hasPermission } from "../access/access";
import "../styles/AppSidebar.css";
import { publicAsset } from "../utils/assets";

// Items are shown only when the user can reach their module (see access.ts) and,
// if set, holds `permission`. The backend enforces the same rules.
type SubItem = {
  name: string;
  path?: string;
  subItems?: { name: string; path: string; icon?: LucideIcon }[];
  permission?: string;
  // Shown before the item; consecutive items with the same section are grouped under one heading
  icon?: LucideIcon;
  section?: string;
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: SubItem[];
  superAdminOnly?: boolean;
};

const filterNavItems = (items: NavItem[], access: AccessInfo): NavItem[] => {
  const visible = (path?: string, permission?: string) =>
    (!path || canAccessPath(access, path)) && (!permission || hasPermission(access, permission));

  return items.flatMap((nav) => {
    if (nav.superAdminOnly && !access.superAdmin) return [];
    if (!nav.subItems) return visible(nav.path) ? [nav] : [];

    const subItems = nav.subItems.flatMap((sub) => {
      if (!sub.subItems) return visible(sub.path, sub.permission) ? [sub] : [];
      const nested = sub.subItems.filter((ss) => visible(ss.path, sub.permission));
      return nested.length ? [{ ...sub, subItems: nested }] : [];
    });
    return subItems.length ? [{ ...nav, subItems }] : [];
  });
};


export const navItems: NavItem[] = [
  {
    icon: <LayoutDashboard className="w-5 h-5" />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    name: "Reports",
    subItems: [
      // Static demo reports removed; CRM reports live under CRM
      { name: "Inventory Report", path: "/inventory-report", icon: Boxes },
      { name: "Purchase Reports", path: "/purchase-reports", icon: ClipboardList },
      { name: "Finance Report", path: "/financeReport", icon: Landmark },
      { name: "Tax Report", path: "/taxReport", icon: Percent },
    ],
  },
  {
    icon: <Users className="w-5 h-5" />,
    name: "CRM",
    subItems: [
      { name: "Segments", path: "/customer-segment", icon: PieChart, section: "Customers" },
      { name: "Key Contacts", path: "/contactPerson", icon: Contact, section: "Customers" },
      { name: "Leads", path: "/leads", icon: Target, section: "Pipeline" },
      { name: "Deals", path: "/opportunities", icon: Handshake, section: "Pipeline" },
      { name: "Interactions", path: "/communication-history", icon: MessagesSquare, section: "Activity" },
      { name: "Tasks", path: "/activities", icon: ListTodo, section: "Activity" },
      { name: "Reports", path: "/crm-reports", icon: BarChart3, section: "Activity" },
    ],
  },

  {
    icon: <Database className="w-5 h-5" />,
    name: "Common",
    subItems: [
      // Master data every module uses (mytrade-common-service)
      { name: "Customers", path: "/customer-management", icon: Users, section: "Master data" },
      { name: "Vendors", path: "/common/vendors", icon: Store, section: "Master data" },
      { name: "Product Categories", path: "/common/categories", icon: FolderTree, section: "Master data" },
      { name: "Products", path: "/common/products", icon: Package, section: "Master data" },
      { name: "Tax Types", path: "/taxTypes", icon: Percent, section: "Tax" },
      { name: "Tax Details", path: "/taxDetails", icon: FileText, section: "Tax" },
    ],
  },

  {
    icon: <ShoppingCart className="w-5 h-5" />,
    name: "Sales",
    subItems: [
      { name: "Sales Dashboard", path: "/sales-dashboard", icon: LayoutDashboard, section: "Overview" },
      { name: "Sales Persons", path: "/sales-persons", icon: UserRound, section: "Team" },
      { name: "Sales Targets", path: "/sales-targets", icon: Target, section: "Team" },
      { name: "Sales Channels", path: "/sales-channels", icon: Network, section: "Team" },
      { name: "Quotations", path: "/quotations", icon: FileText, section: "Orders" },
      { name: "Sales Orders", path: "/sales-orders", icon: ShoppingCart, section: "Orders" },
      { name: "Credit Limit", path: "/credit-limit", icon: Wallet, section: "Orders" },
      { name: "Return Requests", path: "/return-requests", icon: Undo2, section: "Returns" },
      { name: "Refunds", path: "/refunds", icon: HandCoins, section: "Returns" },
      { name: "Service Schedules", path: "/service-schedules", icon: CalendarClock, section: "Service" },
      { name: "Service Schedule Notify", path: "/service-schedule-notify", icon: BellRing, section: "Service" },
    ],
  },

  {
    icon: <Boxes className="w-5 h-5" />,
    name: "Inventory",
    subItems: [
      { name: "Warehouse", path: "/warehouse", icon: Warehouse, section: "Stock" },
      { name: "Inventory Stock", path: "/inventory", icon: Boxes, section: "Stock" },
      { name: "Stock Level", path: "/stock-level", icon: Gauge, section: "Stock" },
      { name: "Stock Movement", path: "/stock-movement", icon: ArrowLeftRight, section: "Movements" },
      { name: "Stock Adjustment", path: "/stock-adjustment", icon: SlidersHorizontal, section: "Movements" },
      { name: "Inventory Reservation", path: "/inventory-reservation", icon: BookmarkCheck, section: "Movements" },
      { name: "Quality Inspection", path: "/quality-inspection", icon: ShieldCheck, section: "Quality & tracking" },
      { name: "Batch", path: "/batch", icon: Layers, section: "Quality & tracking" },
      { name: "Serial Number", path: "/serial-number", icon: ScanBarcode, section: "Quality & tracking" },
    ],
  },
  {
    icon: <ShoppingBag className="w-5 h-5" />,
    name: "Purchase Service",
    subItems: [
      { name: "Purchase Requisitions", path: "/purchase-service/requisitions", icon: ClipboardList },
      { name: "Purchase Orders", path: "/purchase-service/orders", icon: ShoppingBag },
      { name: "Goods Receipt Notes", path: "/purchase-service/goods-receipt-notes", icon: PackageCheck },
      { name: "Purchase Returns", path: "/purchase-service/returns", icon: Undo2 },
    ],
  },

  {
    icon: <CreditCard className="w-5 h-5" />,
    name: "Invoice",
    subItems: [
      { name: "Invoices", path: "/invoices", icon: Receipt, section: "Sales" },
      { name: "Payment Receipts", path: "/paymentReceipts", icon: ReceiptText, section: "Sales" },
      { name: "Accounts Receivable", path: "/accountsReceivable", icon: HandCoins, section: "Sales" },
      { name: "Purchase Invoices", path: "/purchaseInvoices", icon: FileText, section: "Purchases" },
      { name: "Vendor Payments", path: "/vendorPayments", icon: Banknote, section: "Purchases" },
      { name: "Accounts Payable", path: "/accountsPayable", icon: Wallet, section: "Purchases" },
      { name: "Payment Terms", path: "/paymentTerms", icon: CalendarClock, section: "Purchases" },
      { name: "General Accounts", path: "/generalAccounts", icon: Landmark, section: "Accounting" },
      { name: "Journal Entries", path: "/journalEntries", icon: BookOpen, section: "Accounting" },
      { name: "General Ledger", path: "/generalLedger", icon: BookMarked, section: "Accounting" },
      { name: "Expense / Revenue", path: "/expenseRevenue", icon: Scale, section: "Accounting" },
      { name: "Tax Records", path: "/taxRecords", icon: Percent, section: "Tax" },
    ],
  },
  {
    icon: <Truck className="w-5 h-5" />,
    name: "Delivery",
    subItems: [
      { name: "Delivery Order", path: "/deliveryOrder", icon: Truck, section: "Orders" },
      { name: "Delivery Status", path: "/deliveryStatus", icon: Activity, section: "Orders" },
      { name: "Delivery Note", path: "/delivery-note", icon: NotebookText, section: "Orders" },
      { name: "Shipment", path: "/shipment", icon: PackageCheck, section: "Orders" },
      { name: "Goods Issue", path: "/goodsIssue", icon: PackageMinus, section: "Orders" },
      { name: "Schedule", path: "/schedule", icon: CalendarRange, section: "Planning" },
      { name: "Routes", path: "/route", icon: Route, section: "Planning" },
      { name: "Customer Address", path: "/customerAddress", icon: MapPin, section: "Planning" },
      { name: "Live Tracking", path: "/vehicle-tracking", icon: Radar, section: "Fleet" },
      { name: "Vehicles", path: "/vehicle", icon: Car, section: "Fleet" },
      { name: "Transporters", path: "/transporter", icon: Building2, section: "Fleet" },
      { name: "Driver Mode", path: "/driver", permission: "DELIVERY:UPDATE", icon: Smartphone, section: "Fleet" },
    ],
  },

  {
    icon: <Briefcase className="w-5 h-5" />,
    name: "HRMS",
    subItems: [
      { name: "Records", path: "/employeeRecords", icon: Users, section: "People" },
      { name: "Department", path: "/employeeDepartments", icon: Building2, section: "People" },
      { name: "Documents", path: "/employeeDocuments", icon: FolderOpen, section: "People" },
      { name: "Salary", path: "/employeeSalary", icon: Banknote, section: "Payroll" },
      { name: "Salary Structure", path: "/salaryStructure", icon: Layers, section: "Payroll" },
      { name: "Compensation", path: "/employeeCompensation", icon: Coins, section: "Payroll" },
      { name: "Payslips", path: "/employeePayslips", icon: Receipt, section: "Payroll" },
      { name: "Payroll Engine", path: "/payrollEngine", permission: "HRM:APPROVE", icon: Settings2, section: "Payroll" },
      { name: "IT Declaration", path: "/it-declaration", icon: FileCheck, section: "Payroll" },
      {
        name: "Reports",
        icon: BarChart3,
        section: "Payroll",
        subItems: [
          { name: "Payroll Summary", path: "/payrollSummary", icon: PieChart },
          { name: "Department Summary", path: "/departmentSummary", icon: Building },
        ],
      },
      { name: "Exit Management", path: "/exit-management", icon: LogOut, section: "Exits" },
      { name: "Exit Approvals", path: "/exitApprovals", permission: "HRM:APPROVE", icon: UserCheck, section: "Exits" },
    ],
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    name: "Attendance",
    subItems: [
      { name: "Employee Self Service", path: "/att_selfService", icon: UserRound, section: "Overview" },
      { name: "Manager Leave Dashboard", path: "/att_leaveManagerDashboard", permission: "ATTENDANCE:APPROVE", icon: LayoutDashboard, section: "Overview" },
      { name: "Attendance Tracking", path: "/att_attendanceTracking", icon: Activity, section: "Overview" },
      { name: "Holiday Calendar", path: "/att_holidayCalendar", icon: CalendarDays, section: "Overview" },

      { name: "Attendance Punch", path: "/att_punch", icon: Fingerprint, section: "Requests" },
      { name: "Leave Requests", path: "/att_leaveRequest", icon: CalendarX, section: "Requests" },
      { name: "Attendance Regularization", path: "/att_timesheetManagement", icon: ClipboardPen, section: "Requests" },
      { name: "On-Duty Requests", path: "/att_requests", icon: Briefcase, section: "Requests" },

      { name: "Shift Roster & Schedule", path: "/att_shiftSchedule", permission: "ATTENDANCE:UPDATE", icon: CalendarClock, section: "Shifts" },
      { name: "Shift Master", path: "/att_shift", permission: "ATTENDANCE:ADMIN", icon: Clock, section: "Shifts" },

      { name: "Attendance Policy", path: "/att_attendancePolicy", permission: "ATTENDANCE:ADMIN", icon: ScrollText, section: "Policies" },
      { name: "Leave Policy Master", path: "/att_leavePolicy", permission: "ATTENDANCE:ADMIN", icon: BookOpen, section: "Policies" },

      { name: "Leave Approvals", path: "/att_attendanceApproval", permission: "ATTENDANCE:APPROVE", icon: CalendarCheck, section: "Approvals" },
      { name: "Regularization Approvals", path: "/att_regularizationApproval", permission: "ATTENDANCE:APPROVE", icon: ClipboardCheck, section: "Approvals" },
      { name: "On-Duty Approvals", path: "/att_onDutyApproval", permission: "ATTENDANCE:APPROVE", icon: BadgeCheck, section: "Approvals" },

      { name: "Attendance Reports", path: "/att_reports", icon: BarChart3, section: "Reports" },
    ],
  },
  {
    icon: <UserCircle className="w-5 h-5" />,
    name: "Profile",
    subItems: [
      { name: "My Profile", path: "/profile", icon: UserRound, section: "Account" },
      { name: "Users", path: "/role_config", icon: UserPlus, section: "Users & roles" },
      { name: "Roles & Permissions", path: "/rolesPermissions", icon: ShieldCheck, section: "Users & roles" },
      { name: "Company Settings", path: "/company-settings", permission: "USERS:ADMIN", icon: Building, section: "Company" },
    ],
  },
  {
    icon: <Building2 className="w-5 h-5" />,
    name: "Platform",
    superAdminOnly: true,
    subItems: [
      { name: "Tenants & Modules", path: "/platform/tenants", icon: Building2 },
    ],
  },
];

// CRM detail pages use a shared route (`/crm-view/:requestFrom/:id`). Keep the
// corresponding CRM module selected and expanded while viewing one of them.
const crmDetailNavPaths: Record<string, string> = {
  segments: "/customer-segment",
  contacts: "/contactPerson",
  leads: "/leads",
  tasks: "/activities",
  customers: "/customer-management",
  opportunities: "/opportunities",
  deals: "/opportunities",
};

const getInitials = (fullName: string): string => {
  if (!fullName) return "U";
  const names = fullName.trim().split(" ");
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

const generateInitialsImage = (fullName: string, size: number = 40): string => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#06b6d4";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${size * 0.4}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const initials = getInitials(fullName);
  ctx.fillText(initials, size / 2, size / 2);

  return canvas.toDataURL("image/png");
};

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    setIsResizing,
    toggleSidebar,
    expandSidebar,
    toggleMobileSidebar,
  } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, access, loading: authLoading, profileImage: sharedProfileImage, hasProfileImage } = useContext(AuthContext);
  const visibleNavItems = useMemo(() => filterNavItems(navItems, access), [access]);
  const isSidebarManuallyToggledRef = useRef(false);

  const [openSubSubmenu, setOpenSubSubmenu] = useState<string | null>(null);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [railTooltip, setRailTooltip] = useState<{ name: string; top: number; left: number } | null>(null);

  // FIX (#3): default role must carry no special privileges. "Admin" previously
  // meant every user was briefly treated as an admin while the real role loaded,
  // which could flash role-gated nav items (Exit Approvals, Configurations,
  // Attendance policy screens, etc.) before permissions were actually known.
  // Name, role and photo come from the session (AuthContext fetches the photo once for every screen)
  const userName = user?.fullName || "User";
  const userRole = user?.role || "";
  const loadingProfile = authLoading;
  const profileImage = useMemo(
    () => (hasProfileImage ? sharedProfileImage : generateInitialsImage(userName)),
    [hasProfileImage, sharedProfileImage, userName]
  );

  const isActive = useCallback(
    (path: string) => {
      if (location.pathname === path || location.pathname.startsWith(`${path}/`)) {
        return true;
      }

      // The customer create / edit pages belong to the Customers list
      if (path === "/customer-management" && location.pathname.startsWith("/customers/")) {
        return true;
      }

      const detailMatch = location.pathname.match(/^\/crm-view\/([^/]+)\/[^/]+$/);
      return detailMatch ? crmDetailNavPaths[detailMatch[1]] === path : false;
    },
    [location.pathname]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
    },
    [setIsResizing]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(300, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth, setIsResizing]);

  useEffect(() => {
    let submenuMatched = false;
    visibleNavItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem, subIndex) => {
          // Check level 2 items
          if (subItem.path && isActive(subItem.path)) {
            setSelectedModuleIndex(index);
            // Close sub-submenus if we match a level 2 item
            setOpenSubSubmenu(null);
            submenuMatched = true;
          }
          // Check level 3 items (nested sub-menus)
          if (subItem.subItems) {
            subItem.subItems.forEach((ssItem) => {
              if (ssItem.path && isActive(ssItem.path)) {
                setSelectedModuleIndex(index);
                setOpenSubSubmenu(`${index}-${subIndex}`);
                submenuMatched = true;
              }
            });
          }
        });
      }
    });
    if (!submenuMatched) {
      setOpenSubSubmenu(null);
      const directRouteIndex = visibleNavItems.findIndex((nav) => nav.path && isActive(nav.path));
      if (directRouteIndex >= 0) setSelectedModuleIndex(directRouteIndex);
    }
  }, [location.pathname, isActive, visibleNavItems]);

  // Items are already filtered by access
  const getFirstVisibleSubmenuPath = (nav: NavItem): string | undefined => {
    const firstVisibleItem = nav.subItems?.[0];
    return firstVisibleItem?.path || firstVisibleItem?.subItems?.[0]?.path;
  };

  const selectFirstSubmenu = (nav: NavItem) => {
    const firstPath = getFirstVisibleSubmenuPath(nav);
    if (firstPath && !isActive(firstPath)) {
      navigate(firstPath);
    }
  };

  const handleSubSubmenuToggle = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpenSubSubmenu(prev => prev === key ? null : key);
  };

  const handleRailNavigation = (nav: NavItem, index: number) => {
    setSelectedModuleIndex(index);
    setRailTooltip(null);
    if (nav.path) {
      navigate(nav.path);
      return;
    }
    if (window.innerWidth < 1024 && !isMobileOpen) {
      toggleMobileSidebar();
    } else if (!isExpanded) {
      expandSidebar();
    }
    setOpenSubSubmenu(null);
    selectFirstSubmenu(nav);
  };

  const handlePanelToggle = () => {
    isSidebarManuallyToggledRef.current = true;
    // On small screens `isExpanded` is deliberately forced off by the sidebar
    // context, so the trigger must control the drawer state instead.
    if (window.innerWidth < 1024) {
      toggleMobileSidebar();
      return;
    }
    toggleSidebar();
  };

  const handleSidebarMouseLeave = () => {
    if (window.innerWidth >= 1024 && isExpanded && !isResizing && !isSidebarManuallyToggledRef.current) {
      setOpenSubSubmenu(null);
      setRailTooltip(null);
      toggleSidebar();
    }
  };

  const handleSidebarMouseEnter = () => {
    if (window.innerWidth >= 1024 && !isExpanded && !isMobileOpen && !isResizing && !isSidebarManuallyToggledRef.current) {
      expandSidebar();
    }
  };

  const handleRailTooltip = (nav: NavItem, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setRailTooltip({ name: nav.name, top: rect.top + rect.height / 2, left: rect.right + 12 });
  };

  const closeMobileDrawer = () => {
    if (isMobileOpen) toggleMobileSidebar();
  };

  const renderLink = (name: string, path: string | undefined, icon: React.ReactNode, nested = false) => {
    const active = !!path && isActive(path);
    return (
      <Link
        key={name}
        to={path || "#"}
        onClick={closeMobileDrawer}
        aria-current={active ? "page" : undefined}
        className={`app-nav__link${nested ? " app-nav__link--nested" : ""}${active ? " is-active" : ""}`}
      >
        {icon && <span className="app-nav__icon" aria-hidden="true">{icon}</span>}
        <span className="app-nav__label">{name}</span>
      </Link>
    );
  };

  // The panel shows the module picked in the rail: a header, then its pages grouped by section
  const renderModulePanel = (nav: NavItem, index: number) => {
    const subItems = nav.subItems ?? [];
    const pageCount = subItems.length
      ? subItems.reduce((count, sub) => count + (sub.subItems?.length ?? 1), 0)
      : 1;

    return (
      <div key={nav.name} className="app-nav">
        <div className="app-nav__header">
          <span className="app-nav__header-icon" aria-hidden="true">{nav.icon}</span>
          <div className="app-nav__header-text">
            <span className="app-nav__title">{nav.name}</span>
            <span className="app-nav__meta">{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          </div>
        </div>

        <div className="app-nav__list">
          {!nav.subItems && renderLink(nav.name, nav.path, nav.icon)}

          {subItems.map((sub, subIndex) => {
            const SubIcon = sub.icon;
            const heading = sub.section && sub.section !== subItems[subIndex - 1]?.section ? sub.section : null;

            let entry: React.ReactNode;
            if (sub.subItems?.length) {
              const groupKey = `${index}-${subIndex}`;
              const open = openSubSubmenu === groupKey;
              const childActive = sub.subItems.some((ss) => isActive(ss.path));
              entry = (
                <div className="app-nav__group">
                  <button
                    type="button"
                    onClick={(e) => handleSubSubmenuToggle(groupKey, e)}
                    aria-expanded={open}
                    className={`app-nav__link app-nav__toggle${childActive ? " has-active" : ""}`}
                  >
                    {SubIcon && <span className="app-nav__icon" aria-hidden="true"><SubIcon /></span>}
                    <span className="app-nav__label">{sub.name}</span>
                    <ChevronDown className={`app-nav__chevron${open ? " is-open" : ""}`} aria-hidden="true" />
                  </button>
                  <div className={`app-nav__children${open ? " is-open" : ""}`}>
                    <div className="app-nav__children-inner">
                      {sub.subItems.map((ss) => {
                        const ChildIcon = ss.icon;
                        return renderLink(ss.name, ss.path, ChildIcon ? <ChildIcon /> : null, true);
                      })}
                    </div>
                  </div>
                </div>
              );
            } else {
              entry = renderLink(sub.name, sub.path, SubIcon ? <SubIcon /> : null);
            }

            return (
              <Fragment key={sub.name}>
                {heading && <p className="app-nav__section">{heading}</p>}
                {entry}
              </Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay Handled by Backdrop.tsx */}

      <aside
        style={{
          width: isExpanded || isMobileOpen ? `${sidebarWidth}px` : "60px",
        }}
        className={`
          app-sidebar ${isExpanded || isMobileOpen ? "app-sidebar--expanded" : "app-sidebar--collapsed"} fixed top-0 left-0 h-screen bg-white border-r border-gray-200
          shadow-lg z-[50] flex flex-col
          ${isResizing ? "transition-none select-none" : "transition-all duration-300 ease-in-out"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <button
          type="button"
          className="app-sidebar__collapse"
          onClick={handlePanelToggle}
          aria-label={isExpanded || isMobileOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isExpanded || isMobileOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded || isMobileOpen ? <ChevronsLeft size={17} /> : <ChevronsRight size={17} />}
        </button>
        <nav className="app-sidebar__rail" aria-label="Primary modules">
          <Link to="/" className="app-sidebar__rail-brand" aria-label="Go to dashboard">
            <img src={publicAsset("images/logo/logo-icon.png")} alt="" width={30} height={30} />
          </Link>
          <div className="app-sidebar__rail-items">
            {visibleNavItems.map((nav, index) => {
              const active = selectedModuleIndex === index;
              return (
                <button
                  key={nav.name}
                  type="button"
                  className={`app-sidebar__rail-button${active ? " is-active" : ""}`}
                  onClick={() => handleRailNavigation(nav, index)}
                  onMouseEnter={(event) => handleRailTooltip(nav, event)}
                  onMouseLeave={() => setRailTooltip(null)}
                  aria-label={nav.name}
                >
                  {nav.icon}
                </button>
              );
            })}
          </div>
        </nav>
        {/* Logo */}
        <div className="app-sidebar__brand flex items-center h-16 px-4 border-b border-gray-200">
          <Link to="/" className="app-sidebar__brand-link flex items-center" aria-label="Go to dashboard">
            {isExpanded || isMobileOpen ? (
              <>
                <img src={publicAsset("images/logo/logo.png")} alt="Logo" width={120} height={32} />
              </>
            ) : (
              <img
                src={publicAsset("images/logo/logo-icon.png")}
                alt="Logo"
                width={32}
                height={32}
                className="mx-auto"
              />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="app-sidebar__navigation flex-1 overflow-y-auto" aria-label="Module pages">
          {visibleNavItems[selectedModuleIndex] && renderModulePanel(visibleNavItems[selectedModuleIndex], selectedModuleIndex)}
        </nav>

        {/* User Profile */}
        <div className="app-sidebar__profile p-3 mt-auto border-t border-gray-200">
          <Link
            to="/profile"
            className={`
              flex items-center rounded-lg transition-all duration-200
              ${isExpanded || isMobileOpen ? "gap-3 px-3 py-2 hover:bg-gray-50" : "justify-center"}
            `}
          >
            {loadingProfile ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : profileImage ? (
              <img src={profileImage} alt={userName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center">
                <span className="text-sm font-medium text-cyan-600">
                  {getInitials(userName)}
                </span>
              </div>
            )}

            {(isExpanded || isMobileOpen) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {loadingProfile ? "Loading..." : userName}
                </p>
                <p className="text-xs text-gray-500 truncate">{userRole || "—"}</p>
              </div>
            )}
          </Link>
        </div>
        {/* Resizer Handle */}
        {(isExpanded || isMobileOpen) && (
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-cyan-500/30 active:bg-cyan-500 transition-colors z-30 group flex items-center justify-center"
          >
            <div className="w-0.5 h-8 bg-gray-200 group-hover:bg-cyan-500 rounded transition-colors" />
          </div>
        )}
      </aside>

      {railTooltip && (
        <div className="app-sidebar__rail-tooltip" style={{ top: railTooltip.top, left: railTooltip.left }} role="tooltip">
          {railTooltip.name}
        </div>
      )}
    </>
  );
};

export default AppSidebar;

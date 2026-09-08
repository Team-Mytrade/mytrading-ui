import { useCallback, useEffect, useRef, useState, useContext } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  Truck,
  FileText,
  CreditCard,
  Calendar,
  UserCircle,
  ChevronDown,
  CheckSquare,
  Briefcase,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { AuthContext } from "../context/AuthContext";

type SubItem = {
  name: string;
  path?: string;
  subItems?: { name: string; path: string }[];
  roles?: string[];
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: SubItem[];
  roles?: string[];
};

export const navItems: NavItem[] = [
  {
    icon: <LayoutDashboard className="w-5 h-5" />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <Users className="w-5 h-5" />,
    name: "CRM",
    subItems: [
      { name: "Segments", path: "/customer-segment" },
      { name: "Key Contacts", path: "/contactPerson" },
      { name: "Leads", path: "/leads" },
      { name: "Deals", path: "/opportunities" },
      { name: "Interactions", path: "/communication-history" },
      { name: "Tasks", path: "/activities" },
      { name: "Segments", path: "/customer-segment" },

    ],
  },

  {
    icon: <Package className="w-5 h-5" />,
    name: "Common",
    subItems: [
      { name: "Customers", path: "/customer-management" },
      { name: "Vendors", path: "/vendors" },
      { name: "Invoice Vendors", path: "/invoiceVendors" },
      { name: "Product Categories", path: "/product-categories" },
      { name: "Products", path: "/purchase-products" },
      { name: "Tax Types", path: "/taxTypes" },
      { name: "Tax Details", path: "/taxDetails" },
    ],
  },

  {
    icon: <ShoppingCart className="w-5 h-5" />,
    name: "Sales",
    subItems: [
      { name: "Sales Persons", path: "/sales-persons" },
      { name: "Sales Targets", path: "/sales-targets" },
      { name: "Sales Channels", path: "/sales-channels" },
      { name: "Credit Limit", path: "/credit-limit" },
      { name: "Quotations", path: "/quotations" },
      { name: "Sales Orders", path: "/sales-orders" },
      { name: "Return Requests", path: "/return-requests" },
      { name: "Refunds", path: "/refunds" },
      { name: "Service Schedules", path: "/service-schedules" },
      { name: "Service Schedule Notify", path: "/service-schedule-notify" },
      { name: "Sales Dashboard", path: "/sales-dashboard" },
    ],
  },

  {
    icon: <Package className="w-5 h-5" />,
    name: "Inventory",
    subItems: [
      { name: "Warehouse", path: "/warehouse" },
      { name: "Quality Inspection", path: "/quality-inspection" },
      { name: "Batch", path: "/batch" },
      { name: "Serial Number", path: "/serial-number" },
      { name: "Inventory Stock", path: "/inventory" },
      { name: "Stock Level", path: "/stock-level" },
      { name: "Inventory Reservation", path: "/inventory-reservation" },
      { name: "Stock Adjustment", path: "/stock-adjustment" },
      { name: "Stock Movement", path: "/stock-movement" },
      { name: "Inventory Report", path: "/inventory-report" },
    ],
  },
  {
    icon: <FileText className="w-5 h-5" />,
    name: "Purchase",
    subItems: [
      { name: "Terms and Conditions", path: "/terms-and-conditions" },
      { name: "Purchase Requisitions", path: "/purchase-requisitions" },
      { name: "Requisition Line Items", path: "/requisition-line-items" },
      { name: "Purchase Orders", path: "/purchase-orders" },
      { name: "Goods Receipt Notes", path: "/goods-receipt-notes" },
      { name: "Deliveries", path: "/deliveries" },
      { name: "Approval Status", path: "/approval-status" },
      { name: "Inventory", path: "/purchase-inventory" },
      { name: "Purchase Reports", path: "/purchase-reports" },
    ],
  },

  {
    icon: <CreditCard className="w-5 h-5" />,
    name: "Invoice",
    subItems: [
      { name: "Purchase Invoices", path: "/purchaseInvoices" },
      { name: "Payment Terms", path: "/paymentTerms" },
      { name: "Journal Entries", path: "/journalEntries" },
      { name: "Invoices", path: "/invoices" },
      { name: "General Accounts", path: "/generalAccounts" },
      { name: "Accounts Payable", path: "/accountsPayable" },
      { name: "Vendor Payments", path: "/vendorPayments" },
      { name: "Tax Records", path: "/taxRecords" },
      { name: "Payment Receipts", path: "/paymentReceipts" },
      { name: "General Ledger", path: "/generalLedger" },
      { name: "Expense / Revenue", path: "/expenseRevenue" },
      { name: "Accounts Receivable", path: "/accountsReceivable" },
      { name: "Tax Report", path: "/taxReport" },
      { name: "Finance Report", path: "/financeReport" },
    ],
  },
  {
    icon: <Truck className="w-5 h-5" />,
    name: "Delivery",
    subItems: [
      { name: "Transporters", path: "/transporter" },
      { name: "Routes", path: "/route" },
      { name: "Vehicles", path: "/vehicle" },
      { name: "Customer Address", path: "/customerAddress" },
      { name: "Schedule", path: "/schedule" },
      { name: "Delivery Note", path: "/delivery-note" },
      { name: "Shipment", path: "/shipment" },
      { name: "Goods Issue", path: "/goodsIssue" },
      { name: "Delivery Order", path: "/deliveryOrder" },
      { name: "Delivery Status", path: "/deliveryStatus" },
    ],
  },

  {
    icon: <Briefcase className="w-5 h-5" />,
    name: "HRMS",
    subItems: [
      { name: "Department", path: "/employeeDepartments" },
      { name: "Compensation", path: "/employeeCompensation" },
      { name: "Records", path: "/employeeRecords" },
      { name: "Salary", path: "/employeeSalary" },
      { name: "Payslips", path: "/employeePayslips" },
      {
        name: "Reports",
        subItems: [
          { name: "Payroll Summary", path: "/payrollSummary" },
          { name: "Department Summary", path: "/departmentSummary" }
        ]
      },
      { name: "Payroll Engine", path: "/payrollEngine" },
      { name: "IT Declaration", path: "/it-declaration" },
      { name: "Salary Structure", path: "/salaryStructure" },
      { name: "Documents", path: "/employeeDocuments" },
      { name: "Exit Approvals", path: "/exitApprovals" },
      { name: "Exit Management", path: "/exit-management" },
    ],
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    name: "Attendance",
    subItems: [
      // 1. Dashboards & Calendars
      { name: "My Leave Calendar", path: "/att_leaveDashboard" },
      { name: "Employee Self Service", path: "/att_selfService" },
      { name: "Manager Leave Dashboard", path: "/att_leaveManagerDashboard", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN", "MANAGER"] },
      { name: "Attendance Tracking", path: "/att_attendanceTracking" },
      { name: "Holiday Calendar", path: "/att_holidayCalendar" },

      // 2. Employee Requests & Punch
      { name: "Attendance Punch", path: "/att_punch" },
      { name: "Leave Requests", path: "/att_leaveRequest" },
      { name: "Attendance Regularization", path: "/att_timesheetManagement" },
      { name: "On-Duty Requests", path: "/att_requests" },

      // 3. Shift & Roster Management
      { name: "Shift Roster & Schedule", path: "/att_shiftSchedule", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN", "MANAGER"] },
      { name: "Shift Master", path: "/att_shift", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN"] },

      // 4. Policy & Configuration
      { name: "Attendance Policy", path: "/att_attendancePolicy", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN"] },
      { name: "Leave Policy Master", path: "/att_leavePolicy", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN"] },

      // 5. Approvals Desk
      { name: "Leave Approvals", path: "/att_attendanceApproval", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN", "MANAGER"] },
      { name: "Regularization Approvals", path: "/att_regularizationApproval", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN", "MANAGER"] },
      { name: "On-Duty Approvals", path: "/att_onDutyApproval", roles: ["SUPER_ADMIN", "SUPER ADMIN", "ADMIN", "MANAGER"] },

      // 6. Reports
      { name: "Attendance Reports", path: "/att_reports" },
    ],
  },
  {
    icon: <UserCircle className="w-5 h-5" />,
    name: "Profile",
    subItems: [
      { name: "My Profile", path: "/profile" },
      { name: "Create User", path: "/role_config" },
      { name: "Role", path: "/rolesPermissions" },
    ],
  },
];

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
    toggleMobileSidebar,
  } = useSidebar();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [tooltipVisible, setTooltipVisible] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  const [openSubSubmenu, setOpenSubSubmenu] = useState<string | null>(null);

  // FIX (#3): default role must carry no special privileges. "Admin" previously
  // meant every user was briefly treated as an admin while the real role loaded,
  // which could flash role-gated nav items (Exit Approvals, Configurations,
  // Attendance policy screens, etc.) before permissions were actually known.
  const [userName, setUserName] = useState<string>("User");
  const [userRole, setUserRole] = useState<string>("");
  const [profileImage, setProfileImage] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  // Tracks the currently-active blob URL so it can be revoked before replacement/unmount
  const profileImageUrlRef = useRef<string | null>(null);

  const isActive = useCallback(
    (path: string) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  );

  // FIX (#1): a parent nav item ("Inventory", "CRM", ...) is only "active" when the
  // current route actually matches one of its children (at any depth) — expanding
  // the submenu no longer counts as "active" on its own.
  const isParentActive = useCallback(
    (nav: NavItem) => {
      if (!nav.subItems) return false;
      return nav.subItems.some((sub) => {
        if (sub.path && isActive(sub.path)) return true;
        if (sub.subItems) {
          return sub.subItems.some((ss) => ss.path && isActive(ss.path));
        }
        return false;
      });
    },
    [isActive]
  );

  const getAuthToken = (): string | null => localStorage.getItem("accessToken");

  const fetchUserData = async () => {
    try {
      setLoadingProfile(true);
      const token = getAuthToken();
      const userId = user?.id || user?.userId;

      if (token && userId) {
        const response = await fetch(`/v1/api/user/getUserById/${userId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const userData = await response.json();
          setUserName(userData.fullName || user?.fullName || "User");
          setUserRole(userData.role || user?.role || "");
        } else {
          setUserName(user?.fullName || "User");
          setUserRole(user?.role || "");
        }
      } else {
        setUserName(user?.fullName || "User");
        setUserRole(user?.role || "");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserName(user?.fullName || "User");
      setUserRole(user?.role || "");
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchUserImage = async () => {
    const userId = user?.id || user?.userId;
    if (!userId) {
      const displayName = user?.fullName || "User";
      setProfileImage(generateInitialsImage(displayName));
      return;
    }

    try {
      const authToken = getAuthToken();
      const response = await fetch(`/v1/api/user/${userId}/image`, {
        method: "GET",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);

        // Revoke the previous blob URL before replacing it to avoid leaking memory
        if (profileImageUrlRef.current) {
          URL.revokeObjectURL(profileImageUrlRef.current);
        }
        profileImageUrlRef.current = imageUrl;
        setProfileImage(imageUrl);
      } else {
        const displayName = user?.fullName || "User";
        setProfileImage(generateInitialsImage(displayName));
      }
    } catch (error) {
      console.error("Error fetching user image:", error);
      const displayName = user?.fullName || "User";
      setProfileImage(generateInitialsImage(displayName));
    }
  };

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
      const newWidth = Math.max(160, Math.min(400, e.clientX));
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
    if (user) {
      fetchUserData();
      fetchUserImage();
    } else {
      setUserName("User");
      setUserRole("");
      setProfileImage(generateInitialsImage("User"));
      setLoadingProfile(false);
    }

    // Cleanup: revoke any outstanding blob URL when user changes or component unmounts
    return () => {
      if (profileImageUrlRef.current) {
        URL.revokeObjectURL(profileImageUrlRef.current);
        profileImageUrlRef.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    let submenuMatched = false;
    navItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem, subIndex) => {
          // Check level 2 items
          if (subItem.path && isActive(subItem.path)) {
            setOpenSubmenu(index);
            // Close sub-submenus if we match a level 2 item
            setOpenSubSubmenu(null);
            submenuMatched = true;
          }
          // Check level 3 items (nested sub-menus)
          if (subItem.subItems) {
            subItem.subItems.forEach((ssItem) => {
              if (ssItem.path && isActive(ssItem.path)) {
                setOpenSubmenu(index);
                setOpenSubSubmenu(`${index}-${subIndex}`);
                submenuMatched = true;
              }
            });
          }
        });
      }
    });
    if (!submenuMatched) {
      setOpenSubmenu(null);
      setOpenSubSubmenu(null);
    }
  }, [location.pathname, isActive]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu(prev => prev === index ? null : index);
    if (openSubmenu !== index) {
      setOpenSubSubmenu(null);
    }
  };

  const handleSubSubmenuToggle = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpenSubSubmenu(prev => prev === key ? null : key);
  };

  const handleTooltipEnter = (index: number, event: React.MouseEvent<HTMLElement>) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
    setTooltipVisible(index);
  };

  const handleTooltipLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(null);
    }, 200);
  };

  // Render menu item with tooltip
  const renderMenuItem = (nav: NavItem, index: number) => {
    const isCollapsed = !isExpanded && !isMobileOpen;

    if (nav.subItems) {
      // FIX (#1): "active" (route match) and "expanded" (submenu open) are now
      // visually distinct states instead of sharing the same highlight class.
      const parentActive = isParentActive(nav);
      const parentExpanded = openSubmenu === index;

      const buttonClass = parentActive
        ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
        : parentExpanded || (isCollapsed && tooltipVisible === index)
        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200";

      return (
        <div key={nav.name} className="relative">
          <button
            onClick={() => handleSubmenuToggle(index)}
            onMouseEnter={(e) => isCollapsed && handleTooltipEnter(index, e)}
            onMouseLeave={handleTooltipLeave}
            className={`
              w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 relative
              ${buttonClass}
              ${isCollapsed ? "justify-center" : ""}
            `}
          >
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0">{nav.icon}</span>
              {(isExpanded || isMobileOpen) && <span className="text-sm">{nav.name}</span>}
            </div>
            {(isExpanded || isMobileOpen) && (
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  parentExpanded ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {(isExpanded || isMobileOpen) && (
            <div
              className={`grid transition-all duration-300 ease-in-out ${parentExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
              <div className="overflow-hidden">
                <div className="ml-9 pl-2 mt-1 space-y-0.5 border-l border-gray-200 dark:border-gray-700">
                {nav.subItems.filter(subItem => {
                  if (!subItem.roles) return true;
                  const currentRole = (user?.role || userRole || "").toUpperCase().replace(/[\s_]+/g, "");
                  if (!currentRole) return false;
                  return subItem.roles.some(r => r.toUpperCase().replace(/[\s_]+/g, "") === currentRole || currentRole === "SUPERADMIN");
                }).map((subItem, subIndex) => {
                  const subKey = `${index}-${subIndex}`;
                  const hasSubSubItems = subItem.subItems && subItem.subItems.length > 0;

                  if (hasSubSubItems) {
                    return (
                      <div key={subItem.name} className="relative mt-0.5">
                        <button
                          onClick={(e) => handleSubSubmenuToggle(subKey, e)}
                          className={`
                            w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md transition-all duration-200
                            ${openSubSubmenu === subKey
                              ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                            }
                          `}
                        >
                          <span>{subItem.name}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openSubSubmenu === subKey ? "rotate-180" : ""}`} />
                        </button>

                        <div
                          className={`grid transition-all duration-300 ease-in-out ${openSubSubmenu === subKey ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-4 pl-2 mt-1 space-y-0.5 border-l border-gray-200 dark:border-gray-700">
                            {subItem.subItems!.map((ssItem) => (
                              <Link
                                key={ssItem.name}
                                to={ssItem.path || "#"}
                                className={`
                                  block px-3 py-1.5 text-xs rounded-md transition-all duration-200
                                  ${isActive(ssItem.path || "")
                                    ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                                  }
                                `}
                              >
                                {ssItem.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={subItem.name}
                      to={subItem.path || "#"}
                      onClick={() => isMobileOpen && toggleMobileSidebar()}
                      className={`
                        block px-3 py-1.5 text-sm rounded-md transition-all duration-200 ease-in-out transform active:scale-95
                        ${isActive(subItem.path || "")
                          ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400 font-semibold shadow-2xs translate-x-0.5 border-l-2 border-cyan-600"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/60 hover:translate-x-0.5 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                        }
                      `}
                    >
                      {subItem.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

    if (nav.path) {
      const linkElement = (
        <Link
          to={nav.path}
          className={`
            flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 relative
            ${
              isActive(nav.path) || (isCollapsed && tooltipVisible === index)
                ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }
            ${isCollapsed ? "justify-center" : ""}
          `}
          onMouseEnter={(e) => isCollapsed && handleTooltipEnter(index, e)}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0">{nav.icon}</span>
            {(isExpanded || isMobileOpen) && <span className="text-sm">{nav.name}</span>}
          </div>
        </Link>
      );

      return <div key={nav.name}>{linkElement}</div>;
    }

    return null;
  };

  const activeTooltipItem = tooltipVisible !== null ? navItems[tooltipVisible] : undefined;

  // FIX (#3): compute admin status only once the real role has loaded, so
  // role-gated items never briefly render for non-admin users while loading.
  const isAdmin =
    !loadingProfile &&
    (userRole === "SUPER_ADMIN" ||
      userRole === "ADMIN" ||
      user?.roles?.includes("SUPER_ADMIN") ||
      user?.roles?.includes("ADMIN")) &&
    user?.userType !== "USER" &&
    user?.userType !== "EMPLOYEE";

  return (
    <>
      {/* Mobile Overlay Handled by Backdrop.tsx */}

      <aside
        style={{
          width: isExpanded || isMobileOpen ? `${sidebarWidth}px` : "60px",
        }}
        className={`
          fixed top-0 left-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          shadow-lg z-[50] flex flex-col
          ${isResizing ? "transition-none select-none" : "transition-all duration-300 ease-in-out"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800">
          <Link to="/" className="flex items-center">
            {isExpanded || isMobileOpen ? (
              <>
                <img className="dark:hidden" src="/images/logo/logo.png" alt="Logo" width={120} height={32} />
                <img
                  className="hidden dark:block"
                  src="/images/logo/logo.png"
                  alt="Logo"
                  width={120}
                  height={32}
                />
              </>
            ) : (
              <img
                src="/images/logo/logo-icon.png"
                alt="Logo"
                width={32}
                height={32}
                className="mx-auto"
              />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 px-2 no-scrollbar">
          <div className="space-y-1">
            {navItems.map((nav, index) => {
              const isAdmin = (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || user?.roles?.includes("SUPER_ADMIN") || user?.roles?.includes("ADMIN")) && user?.userType !== "USER" && user?.userType !== "EMPLOYEE";
              if (nav.name === "HRMS" && nav.subItems) {
                const mappedSubItems = nav.subItems.filter(sub => {
                  if (sub.name === "Exit Approvals" && !isAdmin) {
                    return false;
                  }
                  return true;
                });
                return renderMenuItem({ ...nav, subItems: mappedSubItems }, index);
              }
              if (nav.name === "Profile" && nav.subItems) {
                const mappedSubItems = nav.subItems.filter(sub => {
                  if ((sub.name === "Create User" || sub.name === "Role") && !isAdmin) {
                    return false;
                  }
                  return true;
                });
                return renderMenuItem({ ...nav, subItems: mappedSubItems }, index);
              }
              return renderMenuItem(nav, index);
            })}
          </div>
        </div>

        {/* User Profile */}
        <div className="p-3 mt-auto border-t border-gray-200 dark:border-gray-800">
          <Link
            to="/profile"
            className={`
              flex items-center rounded-lg transition-all duration-200
              ${isExpanded || isMobileOpen ? "gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800" : "justify-center"}
            `}
          >
            {loadingProfile ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ) : profileImage ? (
              <img src={profileImage} alt={userName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                  {getInitials(userName)}
                </span>
              </div>
            )}

            {(isExpanded || isMobileOpen) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {loadingProfile ? "Loading..." : userName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userRole || "—"}</p>
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
            <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 group-hover:bg-cyan-500 rounded transition-colors" />
          </div>
        )}
      </aside>

      {/* Global Tooltip Portal / Hover Submenu */}
      {tooltipVisible !== null && !isExpanded && !isMobileOpen && (
        <div
          className="fixed z-[100] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/80 rounded-xl shadow-xl p-1.5 min-w-[150px] transition-all duration-150 animate-fadeIn"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: "translateY(-50%)",
          }}
          onMouseEnter={() => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
          }}
          onMouseLeave={handleTooltipLeave}
        >
          {activeTooltipItem?.subItems ? (
            <div className="flex flex-col gap-0.5">
              {activeTooltipItem.subItems.map((subItem) => (
                <div key={subItem.name}>
                  {subItem.path ? (
                    <Link
                      to={subItem.path}
                      className={`
                        px-3 py-2 text-sm rounded-lg transition-all duration-200 block whitespace-nowrap text-left
                        ${isActive(subItem.path)
                          ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400 font-semibold"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        }
                      `}
                      onClick={() => setTooltipVisible(null)}
                    >
                      {subItem.name}
                    </Link>
                  ) : (
                    <div className="px-3 py-2 text-sm rounded-lg block whitespace-nowrap text-left text-gray-800 dark:text-gray-200 font-semibold bg-gray-100 dark:bg-gray-800">
                      {subItem.name}
                    </div>
                  )}
                  {subItem.subItems && (
                    <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-gray-200 dark:border-gray-700 pl-2">
                      {subItem.subItems.map((ssItem) => (
                        <Link
                          key={ssItem.name}
                          to={ssItem.path || "#"}
                          className={`
                            px-3 py-1.5 text-xs rounded-lg transition-all duration-200 block whitespace-nowrap text-left
                            ${isActive(ssItem.path || "")
                              ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400 font-semibold"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                            }
                          `}
                          onClick={() => setTooltipVisible(null)}
                        >
                          {ssItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
              {activeTooltipItem?.name}
            </div>
          )}

          {/* Subtle triangle tail connecting to the sidebar */}
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white dark:bg-gray-800 border-l border-b border-gray-100 dark:border-gray-700/80 rotate-45"
            style={{
              left: "0px",
            }}
          />
        </div>
      )}
    </>
  );
};

export default AppSidebar;

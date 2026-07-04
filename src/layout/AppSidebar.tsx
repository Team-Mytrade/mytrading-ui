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
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import { AuthContext } from "../context/AuthContext";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
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
      { name: "Customers", path: "/customer-management" },
      { name: "Key Contacts", path: "/contactPerson" },
      { name: "Leads", path: "/leads" },
      { name: "Deals", path: "/opportunities" },
      { name: "Interactions", path: "/communication-history" },
      { name: "Tasks", path: "/activities" },
    ],
  },
 
  {
    icon: <ShoppingCart className="w-5 h-5" />,
    name: "Sales",
      subItems: [

    { name: "Category", path: "/sales-categories"},
      { name: "Products", path: "/products"},
      { name: "Quotations", path: "/quotationsPage"},
      { name: "Order Items", path: "/sales-order-items" },
      { name: "Orders", path: "/ordersPage" },
      { name: "Channels", path: "/sales-channels" },
      // { name: "Price List / Discounts", path: "/priceList" },
      { name: "Customer", path: "/sales-customer" },
      { name: "Contact Persons", path: "/sales-contact-persons" },
      // { name: "Invoices", path: "/invoicesPage"},

      // { name: "Salesperson", path: "/sales-person"},
      // { name: "Sales Team", path: "/sales-team"},
      // { name: "Payment Terms", path: "/payment-term"},
      // { name: "Delivery Schedule", path: "/delivery-schedule"},

      // { name: "Sales Targets", path: "/salesTargetPage"},
      // { name: "Sales Reports", path: "/salesReportPage"},
    ],
  },
   
  {
    icon: <Package className="w-5 h-5" />,
    name: "Inventory",
    subItems: [
   { name: "Product / SKU ", path: "/product-sku" }, //SKU (Stock Keeping Unit)
      { name: "Warehouse / Location", path: "/warehouse"},
      { name: "Stock Level", path: "/stock-level"},
      { name: "Batch / Serial Number", path: "/batchSerial"},
      { name: "Quality Inspection Record", path: "/qualityInspection" },
      { name: "Stock Movement / Transactions", path: "/transactions" },
      { name: "Salesperson / Sales Team", path: "/salesTargetPage" },
      { name: "Reorder Level", path: "/reorderLevel" },
      { name: "Stock Adjustment", path: "/stockAdjustment" },
    ],
  },
  {
    icon: <FileText className="w-5 h-5" />,
    name: "Purchase",
    subItems: [
      { name: "Vendors", path: "/vendors" },
      { name: "Terms and Conditions", path: "/terms-and-conditions" },
      { name: "Product Categories", path: "/product-categories" },
      { name: "Products", path: "/purchase-products" },
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
      { name: "General Ledger (GL) Entries", path: "/generalLedger" },
      { name: "Expense / Revenue Items", path: "/expense-revenue" },
      { name: "Tax Types", path: "/taxTypes" },
      { name: "Tax Records", path: "/taxRecords" },
      { name: "Payment Terms", path: "/payment-terms" },
      { name: "Invoice / Billing Document", path: "/invoice-billing" }, //SKU (Stock Keeping Unit)
      { name: "Payment Receipt", path: "/payment-receipt" },
      { name: "Accounts Receivable (AR)", path: "/account-receivable" },
      { name: "Accounts Payable (AP)", path: "/accounts-payable" },
      // { name: "Tax Details", path: "/taxDetails" },
      // { name: "Credit Notes / Debit Notes", path: "/credit-debit-notes" },
      // { name: "Payment Invoice", path: "/payment-invoice" },
    ],
  },
   {
    icon: <Truck className="w-5 h-5" />,
    name: "Delivery",
    subItems: [
      { name: "Transporters", path: "/transporter" },
      { name: "Vehicles", path: "/vehicle" },
      { name: "Routes", path: "/route" },
      // { name: "Vehicles", path: "/vechile" },
      { name: "Customer Address", path: "/customerAddress" },
      { name: "Delivery Note", path: "/delivery-note"},
      { name: "Shipment", path: "/shipment"},
      { name: "Delivery Order", path: "/deliveryOrder"},
      { name: "Delivery Status", path: "/deliveryStatus" },
      { name: "Schedule", path: "/schedule" },
      { name: "Goods Issue", path: "/goodsIssue" },
    ],
  },

  
  {
    icon: <Users className="w-5 h-5" />,
    name: "HRMS",
    subItems: [
      { name: "Department", path: "/employeeDepartments"},
      { name: "Compensation", path: "/employeeCompensation"},
      { name: "Records", path: "/employeeRecords"}, //SKU (Stock Keeping Unit)
      { name: "Salary", path: "/employeeSalary"},
      { name: "Payslips", path: "/employeePayroll"},
      { name: "Payroll", path: "/employeePayroll"},

      { name: "Salary Structure", path: "/salaryStructure"},

      // { name: "Attendance Logs", path: "/attendanceLogs"},
      // { name: "Leave Requests / Approvals", path: "/leaveRequests"},
      // { name: "Tax Deductions", path: "/taxDeductions"},
      { name: "Payroll Runs / Payslips", path: "/payrollRuns"},
      // { name: "Benefits / Allowances", path: "/benefits"},
      { name: "Documents", path: "/employeeDocuments"},
    ],
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    name: "Attendance",
    subItems: [
      { name: "Shift", path: "/att_shift" },
      { name: "Shift Schedule", path: "/att_shiftSchedule" },
      { name: "Attendance Record", path: "/att_attendanceRecord" },
      { name: "Attendance Approval", path: "/att_attendanceApproval" },
      { name: "Attendance Violation", path: "/att_attendanceViolation" },
      { name: "Leave Balance", path: "/att_leaveBalance" },
      { name: "Leave Request", path: "/att_leaveRequest" },
      { name: "Leave Type", path: "/att_leaveType" },
      { name: "Overtime", path: "/att_overtimeEntry" },
      { name: "WFH Request", path: "/att_workFromHomeRequests" },
    ],
  },
  {
    icon: <UserCircle className="w-5 h-5" />,
    name: "Profile",
    subItems: [
      { name: "My Profile", path: "/profile" },
      { name: "Configurations", path: "/role_config" },
    ]

  },
];

const getInitials = (fullName: string): string => {
  if (!fullName) return "U";
  const names = fullName.trim().split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

const generateInitialsImage = (fullName: string, size: number = 40): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return "";

  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.4}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const initials = getInitials(fullName);
  ctx.fillText(initials, size / 2, size / 2);

  return canvas.toDataURL('image/png');
};

const AppSidebar: React.FC = () => {
  const {
    isExpanded,
    isMobileOpen,
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    setIsResizing,
  } = useSidebar();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [tooltipVisible, setTooltipVisible] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<number, number>>({});
  const subMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const menuItemRefs = useRef<Record<number, HTMLElement | null>>({});

  const [userName, setUserName] = useState<string>("User");
  const [userRole, setUserRole] = useState<string>("Admin");
  const [profileImage, setProfileImage] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const getAuthToken = (): string | null => localStorage.getItem('accessToken');

  const fetchUserData = async () => {
    try {
      setLoadingProfile(true);
      const token = getAuthToken();
      const userId = user?.id || user?.userId;

      if (token && userId) {
        const response = await fetch(`/v1/api/user/getUserById/${userId}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (response.ok) {
          const userData = await response.json();
          setUserName(userData.fullName || user?.fullName || "User");
          setUserRole(userData.role || user?.role || "Admin");
        } else {
          setUserName(user?.fullName || "User");
          setUserRole(user?.role || "Admin");
        }
      } else {
        setUserName(user?.fullName || "User");
        setUserRole(user?.role || "Admin");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserName(user?.fullName || "User");
      setUserRole(user?.role || "Admin");
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
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (response.ok) {
        const imageBlob = await response.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, [setIsResizing]);

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
      setUserRole("Admin");
      setProfileImage(generateInitialsImage("User"));
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    let submenuMatched = false;
    navItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu(index);
            submenuMatched = true;
          }
        });
      }
    });
    if (!submenuMatched) setOpenSubmenu(null);
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null && subMenuRefs.current[openSubmenu]) {
      setSubMenuHeight(prev => ({
        ...prev,
        [openSubmenu]: subMenuRefs.current[openSubmenu]?.scrollHeight || 0,
      }));
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu(prev => prev === index ? null : index);
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
      return (
        <div key={nav.name} className="relative">
          <button
            ref={(el) => { menuItemRefs.current[index] = el; }}
            onClick={() => handleSubmenuToggle(index)}
            onMouseEnter={(e) => isCollapsed && handleTooltipEnter(index, e)}
            onMouseLeave={handleTooltipLeave}
            className={`
              w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 relative
              ${openSubmenu === index || (isCollapsed && tooltipVisible === index)
                ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              }
              ${isCollapsed ? "justify-center" : ""}
            `}
          >
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0">{nav.icon}</span>
              {(isExpanded || isMobileOpen) && <span className="text-sm">{nav.name}</span>}
            </div>
            {(isExpanded || isMobileOpen) && (
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSubmenu === index ? "rotate-180" : ""}`} />
            )}
          </button>

          {(isExpanded || isMobileOpen) && (
            <div
              ref={(el) => { subMenuRefs.current[index] = el; }}
              className="overflow-hidden transition-all duration-300"
              style={{ height: openSubmenu === index ? `${subMenuHeight[index]}px` : "0px" }}
            >
              <div className="ml-9 pl-2 mt-1 space-y-0.5 border-l border-gray-200 dark:border-gray-700">
                {nav.subItems.map((subItem) => (
                  <Link
                    key={subItem.name}
                    to={subItem.path}
                    className={`
                      block px-3 py-1.5 text-sm rounded-md transition-all duration-200
                      ${isActive(subItem.path)
                        ? "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                      }
                    `}
                  >
                    {subItem.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (nav.path) {
      const linkElement = (
        <Link
          ref={(el) => { menuItemRefs.current[index] = el; }}
          to={nav.path}
          className={`
            flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 relative
            ${isActive(nav.path) || (isCollapsed && tooltipVisible === index)
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

  return (
    <>
      {/* Mobile Overlay Handled by Backdrop.tsx */}

      <aside
        style={{
          width: isExpanded || isMobileOpen ? `${sidebarWidth}px` : "60px",
        }}
        className={`
          fixed top-0 left-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          shadow-lg z-30 flex flex-col
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
                <img
                  className="dark:hidden"
                  src="/images/logo/logo.png"
                  alt="Logo"
                  width={120}
                  height={32}
                />
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
            {navItems.map((nav, index) => renderMenuItem(nav, index))}
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
              <img
                src={profileImage}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover"
              />
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
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {userRole}
                </p>
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
            transform: 'translateY(-50%)',
          }}
          onMouseEnter={() => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
          }}
          onMouseLeave={handleTooltipLeave}
        >
          {navItems[tooltipVisible]?.subItems ? (
            <div className="flex flex-col gap-0.5">
              {navItems[tooltipVisible].subItems.map((subItem) => (
                <Link
                  key={subItem.name}
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
              ))}
            </div>
          ) : (
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
              {navItems[tooltipVisible]?.name}
            </div>
          )}
          
          {/* Subtle triangle tail connecting to the sidebar */}
          <div
            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white dark:bg-gray-800 border-l border-b border-gray-100 dark:border-gray-700/80 rotate-45"
            style={{
              left: '0px',
            }}
          />
        </div>
      )}
    </>
  );
};

export default AppSidebar;

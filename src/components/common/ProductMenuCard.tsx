import React from "react";
import {
  AttendanceIcon,
  DealIcon,
  DeliveryIcon,
  InventoryIcon,
  InvoiceIcon,
  PayrollIcon,
  PurchaseIcon,
  SalesIcon,
  UserCircleIcon
} from "../../icons";
import ProductReportDashboard from "./ProductReportDashboard";

const ProductMenuCard: React.FC = () => {
  const menuItems = [
    {
      href: "/crm_dashboard",
      icon: <DealIcon />,
      title: "CRM",
      description: "Customer Relationship Management",
      color: "blue"
    },
    {
      href: "/sales_dashboard",
      icon: <SalesIcon />,
      title: "Sales",
      description: "Sales Management",
      color: "emerald"
    },
    {
      href: "/inventory_dashboard",
      icon: <InventoryIcon />,
      title: "Inventory",
      description: "Inventory and Quality Management",
      color: "purple"
    },
    {
      href: "/purchase_dashboard",
      icon: <PurchaseIcon />,
      title: "Purchase",
      description: "Purchase / Procurement Management",
      color: "orange"
    },
    {
      href: "/delivery_dashboard",
      icon: <DeliveryIcon />,
      title: "Delivery",
      description: "Delivery & Distribution Management",
      color: "cyan"
    },
    {
      href: "/invoice_dashboard",
      icon: <InvoiceIcon />,
      title: "Invoice",
      description: "Invoice / Finance Management",
      color: "pink"
    },
    {
      href: "/payroll_dashboard",
      icon: <PayrollIcon />,
      title: "HRMS",
      description: "Payroll & HRMS Management",
      color: "indigo"
    },
    {
      href: "/attendance_dashboard",
      icon: <AttendanceIcon />,
      title: "Attendance",
      description: "Attendance Tracking Systems",
      color: "teal"
    },
    {
      href: "/user_dashboard",
      icon: <UserCircleIcon />,
      title: "User Profile",
      description: "User Profile Management",
      color: "rose"
    },
    {
      href: "/products",
      icon: <i className="fa-solid fa-box" />,
      title: "Products",
      description: "View product catalog",
      color: "gray"
    }
  ];

  const colorStyles = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
    purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
    cyan: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100",
    pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
    indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
    teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
    rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
    gray: "bg-gray-50 text-gray-600 group-hover:bg-gray-100",
  };

  return (
    <section className="w-full">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Quick Access</h2>
        <p className="text-sm text-gray-500 mt-0.5">Navigate to different modules of the application</p>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {menuItems.map((item, index) => (
          <a
            key={index}
            href={item.href}
            className="group flex flex-col items-center p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className={`p-3 rounded-xl ${colorStyles[item.color as keyof typeof colorStyles]} transition-colors duration-200`}>
              <span className="flex items-center justify-center w-6 h-6">
                {item.icon}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
              {item.title}
            </h3>
            <p className="text-xs text-gray-500 text-center mt-1 line-clamp-2">
              {item.description}
            </p>
          </a>
        ))}
      </div>

      {/* Product Report Dashboard */}
      <div className="mt-6">
        <ProductReportDashboard />
      </div>
    </section>
  );
};

export default ProductMenuCard;

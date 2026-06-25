import React from "react";
import {
  CalendarCheck,
  Handshake,
  Package,
  ReceiptText,
  ShoppingCart,
  Tag,
  Truck,
  UserCircle,
  Users,
  Warehouse,
} from "lucide-react";
import ProductReportDashboard from "./ProductReportDashboard";

const ProductMenuCard: React.FC = () => {
  const menuItems = [
    {
      href: "/crm_dashboard",
      icon: Handshake,
      title: "CRM",
      description: "Customer Relationship Management",
      color: "blue"
    },
    {
      href: "/sales_dashboard",
      icon: Tag,
      title: "Sales",
      description: "Sales Management",
      color: "emerald"
    },
    {
      href: "/inventory_dashboard",
      icon: Warehouse,
      title: "Inventory",
      description: "Inventory and Quality Management",
      color: "purple"
    },
    {
      href: "/purchase_dashboard",
      icon: ShoppingCart,
      title: "Purchase",
      description: "Purchase / Procurement Management",
      color: "orange"
    },
    {
      href: "/delivery_dashboard",
      icon: Truck,
      title: "Delivery",
      description: "Delivery & Distribution Management",
      color: "cyan"
    },
    {
      href: "/invoice_dashboard",
      icon: ReceiptText,
      title: "Invoice",
      description: "Invoice / Finance Management",
      color: "pink"
    },
    {
      href: "/payroll_dashboard",
      icon: Users,
      title: "HRMS",
      description: "Payroll & HRMS Management",
      color: "indigo"
    },
    {
      href: "/attendance_dashboard",
      icon: CalendarCheck,
      title: "Attendance",
      description: "Attendance Tracking Systems",
      color: "teal"
    },
    {
      href: "/user_dashboard",
      icon: UserCircle,
      title: "User Profile",
      description: "User Profile Management",
      color: "rose"
    },
    {
      href: "/products",
      icon: Package,
      title: "Products",
      description: "View product catalog",
      color: "gray"
    }
  ];

  const colorStyles = {
    blue: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    emerald: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    purple: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    orange: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    cyan: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    pink: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    indigo: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    teal: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    rose: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
    gray: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
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
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <a
              key={index}
              href={item.href}
              className="group flex flex-col items-center p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className={`p-2.5 rounded-lg ${colorStyles[item.color as keyof typeof colorStyles]} transition-colors duration-200`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-gray-500 text-center mt-1 line-clamp-2">
                {item.description}
              </p>
            </a>
          );
        })}
      </div>

      {/* Product Report Dashboard */}
      <div className="mt-6">
        <ProductReportDashboard />
      </div>
    </section>
  );
};

export default ProductMenuCard;

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Receipt,
  CreditCard,
  Building,
  DollarSign,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

// Mock Data
const topInvoices = [
  { id: 1, invoiceNo: "INV-001", customer: "ABC Corp", amount: "$12,500", status: "Paid", dueDate: "2026-05-15" },
  { id: 2, invoiceNo: "INV-002", customer: "XYZ Ltd", amount: "$8,200", status: "Pending", dueDate: "2026-05-20" },
  { id: 3, invoiceNo: "INV-003", customer: "LMN Inc", amount: "$5,800", status: "Overdue", dueDate: "2026-05-10" },
  { id: 4, invoiceNo: "INV-004", customer: "PQR Solutions", amount: "$15,000", status: "Paid", dueDate: "2026-05-18" },
  { id: 5, invoiceNo: "INV-005", customer: "DEF Enterprises", amount: "$3,200", status: "Pending", dueDate: "2026-05-25" },
];

const recentTransactions = [
  { id: 1, date: "2026-05-23", description: "Payment from ABC Corp", amount: "$12,500", type: "Credit", reference: "INV-001" },
  { id: 2, date: "2026-05-22", description: "Supplier Payment", amount: "$5,000", type: "Debit", reference: "PO-045" },
  { id: 3, date: "2026-05-21", description: "Payment from XYZ Ltd", amount: "$8,200", type: "Credit", reference: "INV-002" },
  { id: 4, date: "2026-05-20", description: "Employee Salary", amount: "$25,000", type: "Debit", reference: "SAL-MAY" },
];

// Navigation Modules
const financeModules = [
  { name: "Invoice / Billing", count: 120, icon: Receipt, route: "/invoice-billing", color: "blue" },
  { name: "Payment Receipt", count: 95, icon: CreditCard, route: "/payment-receipt", color: "emerald" },
  { name: "Accounts Receivable", count: 80, icon: Building, route: "/account-receivable", color: "orange" },
  { name: "Accounts Payable", count: 50, icon: DollarSign, route: "/accounts-payable", color: "purple" },
  { name: "General Ledger", count: 300, icon: FileText, route: "/generalLedger", color: "indigo" },
  { name: "Tax Records", count: 40, icon: FileText, route: "/taxRecords", color: "pink" },
  { name: "Expense / Revenue", count: 60, icon: TrendingUp, route: "/expense-revenue", color: "teal" },
];

const kpiItems = [
  { label: "Total Invoices", value: "120", change: "+8%", trend: "up" as const, icon: Receipt, color: "blue" },
  { label: "Total Receipts", value: "95", change: "+5%", trend: "up" as const, icon: CreditCard, color: "emerald" },
  { label: "Outstanding AR", value: "$15.2k", change: "-2%", trend: "down" as const, icon: Building, color: "orange" },
  { label: "Outstanding AP", value: "$7.5k", change: "+3%", trend: "up" as const, icon: DollarSign, color: "purple" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "indigo" | "pink" | "teal" | "red" | "yellow" | "green";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  red: "bg-red-50 text-red-600 group-hover:bg-red-100",
  yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100",
  green: "bg-green-50 text-green-600 group-hover:bg-green-100",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
  red: "bg-red-100 text-red-600",
  yellow: "bg-yellow-100 text-yellow-600",
  green: "bg-green-100 text-green-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Paid": return "bg-green-100 text-green-700";
    case "Pending": return "bg-yellow-100 text-yellow-700";
    case "Overdue": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
};

const getTransactionTypeColor = (type: string) => {
  return type === "Credit" ? "text-emerald-600" : "text-red-600";
};

// Table Columns
const invoiceColumns: ColumnDef<(typeof topInvoices)[number]>[] = [
  {
    key: "invoiceNo",
    label: "Invoice No",
    sortable: true,
    render: (row) => (
      <span className="font-mono text-sm font-medium text-gray-900">{row.invoiceNo}</span>
    ),
  },
  {
    key: "customer",
    label: "Customer",
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700">{row.customer}</span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    render: (row) => (
      <span className="text-sm font-semibold text-gray-900">{row.amount}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}>
        {row.status}
      </span>
    ),
  },
  {
    key: "dueDate",
    label: "Due Date",
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-500">{row.dueDate}</span>
    ),
  },
];

const transactionColumns: ColumnDef<(typeof recentTransactions)[number]>[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-500">{row.date}</span>
    ),
  },
  {
    key: "description",
    label: "Description",
    sortable: true,
    render: (row) => (
      <span className="text-sm text-gray-700">{row.description}</span>
    ),
  },
  {
    key: "reference",
    label: "Reference",
    sortable: true,
    render: (row) => (
      <span className="font-mono text-sm text-gray-500">{row.reference}</span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    render: (row) => (
      <span className={`text-sm font-semibold ${getTransactionTypeColor(row.type)}`}>
        {row.type === "Credit" ? "+" : "-"}{row.amount}
      </span>
    ),
  },
  {
    key: "type",
    label: "Type",
    sortable: true,
    render: (row) => (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        row.type === "Credit" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}>
        {row.type}
      </span>
    ),
  },
];

const FinanceDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Finance Dashboard" description="Finance and accounting overview" />
      <PageBreadcrumb pageTitle="Finance Dashboard" />

      <div className="max-w-7xl mx-auto p-6">


        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {financeModules.map((module) => {
            const Icon = module.icon;
            const colorClass = colorClasses[module.color as ColorKey];
            return (
              <button
                key={module.name}
                onClick={() => navigate(module.route)}
                className="group flex flex-col items-center p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className={`p-2.5 rounded-lg ${colorClass} transition-colors duration-200`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-2 text-xs font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors text-center">
                  {module.name}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">{module.count}</p>
              </button>
            );
          })}
        </div>


        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-blue-700">Revenue Summary</h3>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">$45,200</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-purple-700">Expense Summary</h3>
              <DollarSign className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">$28,500</p>
            <p className="text-xs text-gray-500 mt-1">This month</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">+5%</span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          </div>
        </div>

        {/* Top Invoices Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Top Invoices</h3>
            <p className="text-xs text-gray-500 mt-0.5">Recent invoice activity</p>
          </div>
          <ReusableTable
            data={topInvoices}
            columns={invoiceColumns}
            pageSize={5}
            defaultSortKey="invoiceNo"
            defaultSortOrder="asc"
            onRowClick={(row) => navigate("/invoice-billing")}
          />
        </div>

        {/* Recent Transactions Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest financial activity</p>
          </div>
          <ReusableTable
            data={recentTransactions}
            columns={transactionColumns}
            pageSize={4}
            defaultSortKey="date"
            defaultSortOrder="desc"
          />
        </div>
      </div>
    </>
  );
};

export default FinanceDashboard;
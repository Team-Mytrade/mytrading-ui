import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  EllipsisVerticalIcon,
  DocumentTextIcon,
  CalendarIcon,
  FunnelIcon,
  BuildingOfficeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BanknotesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ToasterService } from "../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/accounts-receivable";
const PAGE_SIZE = 5;

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

interface Invoice {
  id: number;
  invoiceNumber: string;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface AccountsReceivable {
  id: number;
  invoice: Invoice;
  customer: Customer;
  dueDate: string;
  invoiceAmount: number;
  amountPaid: number;
  balance: number;
  accountsReceivableStatus: Status;
}

const AccountsReceivablePage: React.FC = () => {
  const [records, setRecords] = useState<AccountsReceivable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [activeView, setActiveView] = useState<"all" | "overdue" | "customer" | "outstanding">("all");
  const [customerSummary, setCustomerSummary] = useState<{
    totalOutstanding: number;
    totalBalance: number;
    count: number;
  } | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [invoiceId, setInvoiceId] = useState<number | "">("");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [showDiscardPopup, setShowDiscardPopup] = useState(false);

  // Details Modal
  const [selectedRecord, setSelectedRecord] = useState<AccountsReceivable | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // ── API calls (untouched) ──────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [custRes, invRes] = await Promise.all([
          axios.get("/v1/api/invoice/customers"),
          axios.get("/v1/api/invoice/invoices"),
        ]);
        setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
        setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      } catch (err) {
        console.error("Error loading data:", err);
        ToasterService.error("Failed to load customer and invoice data");
      }
    };
    loadData();
  }, []);

  const loadCustomerAR = async () => {
    if (!selectedCustomerId) return;
    try {
      setActiveView("customer");
      setCustomerSummary(null);
      const res = await axios.get(`${BASE_URL}/customer/${selectedCustomerId}`);
      console.debug("Accounts Receivable - customer AR response", {
        customerId: selectedCustomerId,
        status: res.status,
        data: res.data,
      });
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading customer AR:", err);
      ToasterService.error("Failed to load customer receivables");
    }
  };

  const loadCustomerOutstanding = async () => {
    if (!selectedCustomerId) return;
    try {
      setActiveView("outstanding");
      const res = await axios.get(`${BASE_URL}/customer/${selectedCustomerId}/outstanding`);
      console.debug("Accounts Receivable - customer outstanding response", {
        customerId: selectedCustomerId,
        status: res.status,
        data: res.data,
      });
      const arr: AccountsReceivable[] = Array.isArray(res.data) ? res.data : [];
      setRecords(arr);
      const totalOutstanding = arr.reduce((sum, r) => sum + (r.balance ?? 0), 0);
      setCustomerSummary({
        totalOutstanding,
        totalBalance: totalOutstanding,
        count: arr.length,
      });
    } catch (err) {
      console.error("Error loading customer outstanding:", err);
      ToasterService.error("Failed to load customer outstanding details");
    }
  };

  const loadOverdue = async () => {
    try {
      setActiveView("overdue");
      setCustomerSummary(null);
      const res = await axios.get(`${BASE_URL}/overdue`);
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading overdue:", err);
      ToasterService.error("Failed to load overdue receivables");
    }
  };

  const resetView = () => {
    setActiveView("all");
    setRecords([]);
    setCustomerSummary(null);
    setSelectedCustomerId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      invoice: invoices.find((i) => i.id === invoiceId),
      customer: customers.find((c) => c.id === customerId),
      dueDate,
      invoiceAmount,
      amountPaid,
      balance: invoiceAmount - amountPaid,
      accountsReceivableStatus:
        amountPaid === 0
          ? "OPEN"
          : amountPaid < invoiceAmount
          ? "PARTIALLY_PAID"
          : "PAID",
    };
    try {
      await axios.post(BASE_URL, payload);
      ToasterService.success("Receivable created successfully");
      resetForm();
      if (activeView === "overdue") loadOverdue();
      else if (activeView === "customer" && selectedCustomerId) loadCustomerAR();
      else if (activeView === "outstanding" && selectedCustomerId) loadCustomerOutstanding();
    } catch (err) {
      console.error("Error creating receivable:", err);
      ToasterService.error("Failed to create receivable");
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setInvoiceId("");
    setCustomerId("");
    setDueDate("");
    setInvoiceAmount(0);
    setAmountPaid(0);
  };

  const handleViewDetails = (record: AccountsReceivable) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };
  // ────────────────────────────────────────────────────────────────────────

  // Helpers
  const getStatusColor = (status: Status) => {
    switch (status) {
      case "PAID": return "bg-green-100 text-green-800";
      case "PARTIALLY_PAID": return "bg-yellow-100 text-yellow-800";
      case "OPEN": return "bg-blue-100 text-blue-800";
      case "OVERDUE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case "PAID": return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "PARTIALLY_PAID": return <BanknotesIcon className="h-4 w-4 text-yellow-500" />;
      case "OPEN": return <ClockIcon className="h-4 w-4 text-blue-500" />;
      case "OVERDUE": return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default: return <DocumentTextIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  // Status-filtered data passed into ReusableTable
  const hasFormChanges = useMemo(
    () =>
      invoiceId !== "" ||
      customerId !== "" ||
      dueDate !== "" ||
      invoiceAmount > 0 ||
      amountPaid > 0,
    [amountPaid, customerId, dueDate, invoiceAmount, invoiceId]
  );

  const requestCloseForm = () => {
    if (hasFormChanges) {
      setShowDiscardPopup(true);
      return;
    }
    resetForm();
  };

  const statusFiltered = useMemo(
    () =>
      selectedStatus
        ? records.filter((r) => r.accountsReceivableStatus === selectedStatus)
        : records,
    [records, selectedStatus]
  );

  // Stats
  const totalBalance = useMemo(
    () => records.reduce((sum, r) => sum + (r.balance || 0), 0),
    [records]
  );
  const overdueCount = useMemo(
    () => records.filter((r) => r.accountsReceivableStatus === "OVERDUE").length,
    [records]
  );

  // ── Table columns ────────────────────────────────────────────────────────
  const tableColumns: ColumnDef<AccountsReceivable>[] = [
    {
      key: "invoice",
      label: "Invoice",
      sortable: true,
      render: (record) => (
        <div className="flex items-center">
          <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-sm font-medium text-gray-900">
            {record.invoice.invoiceNumber}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (record) => (
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-sm text-gray-900">{record.customer.name}</span>
        </div>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      render: (record) => (
        <div className="flex items-center text-sm text-gray-900">
          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
          {new Date(record.dueDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
      ),
    },
    {
      key: "invoiceAmount",
      label: "Amount",
      sortable: true,
      render: (record) => (
        <div className="text-sm font-medium text-gray-900">
          ${record.invoiceAmount.toFixed(2)}
        </div>
      ),
    },
    {
      key: "amountPaid",
      label: "Paid",
      sortable: true,
      render: (record) => (
        <div className="text-sm text-gray-900">${record.amountPaid.toFixed(2)}</div>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      render: (record) => (
        <div className="text-sm font-medium text-cyan-600">
          ${record.balance.toFixed(2)}
        </div>
      ),
    },
    {
      key: "accountsReceivableStatus",
      label: "Status",
      sortable: true,
      render: (record) => (
        <div className="flex items-center">
          {getStatusIcon(record.accountsReceivableStatus)}
          <span
            className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
              record.accountsReceivableStatus
            )}`}
          >
            {record.accountsReceivableStatus.replace("_", " ")}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      className: "text-right",
      headerClassName: "!text-right pr-8",
      render: (record) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(record);
                    }}
                    className={`${
                      active ? "bg-gray-50" : ""
                    } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                  >
                    <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                    View Details
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
      ),
    },
  ];

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const tableToolbar = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className={`p-2 rounded-lg border ${
          showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"
        }`}
      >
        <FunnelIcon
          className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`}
        />
      </button>
      {!showForm && (
        <AddButton
          label="Add Receivable"
          onClick={() => {
            setShowForm(true);
            setDueDate(new Date().toISOString().split("T")[0]);
          }}
        />
      )}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Accounts Receivable" description="Manage accounts receivable" />
      <PageBreadcrumb pageTitle="Accounts Receivable" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Accounts Receivable</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Track and manage outstanding receivables
              </p>
            </div>
          </div>
        </div>

        {/* Customer Selection Bar */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Customer
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                value={selectedCustomerId}
                onChange={(e) =>
                  setSelectedCustomerId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadCustomerAR}
                disabled={!selectedCustomerId}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="GET /v1/api/invoice/accounts-receivable/customer/{id}"
              >
                Customer AR
              </button>
              <button
                type="button"
                onClick={loadCustomerOutstanding}
                disabled={!selectedCustomerId}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="GET /v1/api/invoice/accounts-receivable/customer/{id}/outstanding"
              >
                Outstanding
              </button>
              <button
                type="button"
                onClick={loadOverdue}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                title="GET /v1/api/invoice/accounts-receivable/overdue"
              >
                Overdue
              </button>
              {activeView !== "all" && (
                <button
                  type="button"
                  onClick={resetView}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          {activeView !== "all" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Current view:</span>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  activeView === "overdue"
                    ? "bg-red-100 text-red-800"
                    : activeView === "customer"
                    ? "bg-cyan-100 text-cyan-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {activeView === "overdue"
                  ? "Overdue"
                  : activeView === "customer"
                  ? "Customer receivables"
                  : "Customer outstanding"}
              </span>
            </div>
          )}
        </div>

        {/* Customer Summary */}
        {customerSummary && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="text-sm font-medium text-purple-800 flex items-center gap-2 mb-3">
              <BanknotesIcon className="h-5 w-5" />
              Customer outstanding summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <p className="text-xs text-gray-500">Total outstanding</p>
                <p className="text-xl font-bold text-purple-600">
                  ${customerSummary.totalOutstanding.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <p className="text-xs text-gray-500">Items</p>
                <p className="text-xl font-bold text-purple-600">{customerSummary.count}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-100">
                <p className="text-xs text-gray-500">Average per item</p>
                <p className="text-xl font-bold text-purple-600">
                  $
                  {(
                    customerSummary.count > 0
                      ? customerSummary.totalOutstanding / customerSummary.count
                      : 0
                  ).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>
              {selectedStatus && (
                <button
                  onClick={() => setSelectedStatus("")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Records"
            value={records.length}
            gradient="from-blue-50 to-white"
            borderColor="border-blue-100"
            labelColor="text-blue-700"
            icon={<DocumentTextIcon className="h-6 w-6 text-blue-600" />}
          />
          <StatsCard
            label="Total Balance"
            value={`$${totalBalance.toFixed(2)}`}
            gradient="from-cyan-50 to-white"
            borderColor="border-cyan-100"
            labelColor="text-cyan-700"
            icon={<BanknotesIcon className="h-6 w-6 text-cyan-600" />}
          />
          <StatsCard
            label="Overdue"
            value={overdueCount}
            gradient="from-red-50 to-white"
            borderColor="border-red-100"
            labelColor="text-red-700"
            icon={<ExclamationTriangleIcon className="h-6 w-6 text-red-600" />}
          />
          <StatsCard
            label="Filtered Results"
            value={statusFiltered.length}
            gradient="from-gray-50 to-white"
            borderColor="border-gray-100"
            labelColor="text-gray-700"
            icon={<CheckCircleIcon className="h-6 w-6 text-gray-500" />}
          />
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  Add Accounts Receivable
                </h3>
                <button
                  onClick={requestCloseForm}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={invoiceId}
                      onChange={(e) => setInvoiceId(Number(e.target.value))}
                      required
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select Invoice</option>
                      {invoices.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.invoiceNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(Number(e.target.value))}
                      required
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select Customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      selected={dueDate ? new Date(dueDate) : null}
                      onChange={(date) =>
                        setDueDate(date ? date.toISOString().split("T")[0] : "")
                      }
                      dateFormat="yyyy-MM-dd"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(parseFloat(e.target.value))}
                      required
                      min="0"
                      step="0.01"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Paid
                    </label>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Balance</p>
                    <p className="text-xl font-bold text-cyan-600">
                      ${(invoiceAmount - amountPaid).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={requestCloseForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    Create Receivable
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<AccountsReceivable>
          data={statusFiltered}
          columns={tableColumns}
          searchable
          searchPlaceholder="Search receivables..."
          searchFields={["accountsReceivableStatus"] as any}
          pageSize={PAGE_SIZE}
          defaultSortKey="dueDate"
          defaultSortOrder="asc"
          toolbar={tableToolbar}
          onRowClick={handleViewDetails}
          emptyState={
            <div className="flex flex-col items-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No receivable records found</p>
              <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
            </div>
          }
        />

        {/* Details Modal */}
        {showDetailsModal && selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  Receivable Details
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex justify-end mb-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      selectedRecord.accountsReceivableStatus
                    )}`}
                  >
                    {getStatusIcon(selectedRecord.accountsReceivableStatus)}
                    <span className="ml-2">
                      {selectedRecord.accountsReceivableStatus.replace("_", " ")}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRecord.invoice.invoiceNumber}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Customer</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedRecord.customer.name}
                    </p>
                  </div>
                </div>
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <h4 className="font-medium text-gray-900">Due Date</h4>
                  </div>
                  <p className="text-gray-900 ml-7">
                    {new Date(selectedRecord.dueDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Invoice Amount</p>
                    <p className="text-xl font-bold text-gray-900">
                      ${selectedRecord.invoiceAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Amount Paid</p>
                    <p className="text-xl font-bold text-green-600">
                      ${selectedRecord.amountPaid.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Balance</p>
                    <p className="text-xl font-bold text-cyan-600">
                      ${selectedRecord.balance.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Payment Status:</span>
                      <span className="font-medium text-gray-900">
                        {selectedRecord.amountPaid === 0
                          ? "No payments received"
                          : selectedRecord.amountPaid < selectedRecord.invoiceAmount
                          ? "Partial payment received"
                          : "Fully paid"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Due Status:</span>
                      <span
                        className={`font-medium ${
                          new Date(selectedRecord.dueDate) < new Date() &&
                          selectedRecord.balance > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {new Date(selectedRecord.dueDate) < new Date() &&
                        selectedRecord.balance > 0
                          ? "Overdue"
                          : "Current"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <DynamicPopup
          isPopupOpen={showDiscardPopup}
          setIsPopupOpen={setShowDiscardPopup}
          icon={<ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          innerText="Discard this receivable form?"
          subText="Your entered values will be cleared."
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          confirmBtnClass="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white"
          onConfirm={() => {
            setShowDiscardPopup(false);
            resetForm();
          }}
          onCancel={() => setShowDiscardPopup(false)}
        />
      </div>
    </>
  );
};

export default AccountsReceivablePage;


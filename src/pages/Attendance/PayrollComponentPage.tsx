import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  UserIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  BanknotesIcon,
  CogIcon,
  EyeIcon,
  CalendarDaysIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee { id: number; firstName: string; lastName: string; }

interface PayrollComponent {
  id: number;
  name: string;
  amount: number;
  type: "EARNING" | "DEDUCTION";
}

interface PayrollRecord {
  id: number;
  employee: Employee;
  payrollMonth: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  finalized: boolean;
  components: PayrollComponent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLOYEE_API = "/v1/api/attendance/employees";
const PAYROLL_API  = "/v1/api/attendance/payroll";

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent";

const fmt = (n: number) => `₹${n.toLocaleString()}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

const PayrollComponentPage: React.FC = () => {
  const [employees, setEmployees]           = useState<Employee[]>([]);
  const [month, setMonth]                   = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
  const [payroll, setPayroll]               = useState<PayrollRecord | null>(null);
  const [payrollsByMonth, setPayrollsByMonth] = useState<PayrollRecord[]>([]);
  const [loading, setLoading]               = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    axios.get<Employee[]>(EMPLOYEE_API)
      .then(res => setEmployees(res.data))
      .catch(err => console.error("Failed to load employees", err));
  }, []);

  const fetchPayroll = async () => {
    if (!selectedEmployee || !month) return;
    setLoading(true);
    try {
      const res = await axios.get<PayrollRecord>(
        `${PAYROLL_API}/employee/${selectedEmployee}?month=${month}`
      );
      setPayroll(res.data);
    } catch (err) {
      console.warn("No payroll found for this employee/month", err);
      setPayroll(null);
    } finally {
      setLoading(false);
    }
  };

  const generatePayroll = async () => {
    if (!selectedEmployee || !month) return;
    setLoading(true);
    try {
      const res = await axios.post<PayrollRecord>(
        `${PAYROLL_API}/generate?employeeId=${selectedEmployee}&month=${month}`
      );
      setPayroll(res.data);
    } catch (err) {
      console.error("Failed to generate payroll", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthPayrolls = async () => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await axios.get<PayrollRecord[]>(`${PAYROLL_API}/month?month=${month}`);
      setPayrollsByMonth(res.data);
    } catch (err) {
      console.error("Failed to load payroll list", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Components table columns ─────────────────────────────────────────────────

  const componentColumns: ColumnDef<PayrollComponent>[] = [
    {
      key: "id", label: "ID",
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "name", label: "Component",
      render: (_, v) => (
        <span className="text-sm font-medium text-gray-900">{String(v)}</span>
      ),
    },
    {
      key: "type", label: "Type",
      render: (_, v) => v === "EARNING"
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><PlusCircleIcon className="h-3 w-3" />Earning</span>
        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><MinusCircleIcon className="h-3 w-3" />Deduction</span>,
    },
    {
      key: "amount", label: "Amount",
      render: (_, v) => {
        const n = Number(v);
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${n >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
            <CurrencyRupeeIcon className="h-3 w-3" />{Math.abs(n).toLocaleString()}
          </span>
        );
      },
    },
  ];

  // ── Month payroll columns ─────────────────────────────────────────────────────

  const monthColumns: ColumnDef<PayrollRecord>[] = [
    {
      key: "employee", label: "Employee", sortable: false,
      render: (row) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {[row.employee?.firstName, row.employee?.lastName].filter(Boolean).join(" ") || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "baseSalary", label: "Base Salary", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <CurrencyRupeeIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm text-gray-700">{Number(v).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: "totalEarnings", label: "Earnings", sortable: true,
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          <PlusCircleIcon className="h-3 w-3" />{Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "totalDeductions", label: "Deductions", sortable: true,
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <MinusCircleIcon className="h-3 w-3" />{Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "netPay", label: "Net Pay", sortable: true,
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <CurrencyRupeeIcon className="h-3 w-3" />{Number(v).toLocaleString()}
        </span>
      ),
    },
  ];

  // ── Payroll summary stats ─────────────────────────────────────────────────────

  const totalNet      = payrollsByMonth.reduce((s, p) => s + (p.netPay || 0), 0);
  const totalEarnings = payrollsByMonth.reduce((s, p) => s + (p.totalEarnings || 0), 0);
  const totalDeduct   = payrollsByMonth.reduce((s, p) => s + (p.totalDeductions || 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageMeta title="Payroll Components" description="Payroll processing page" />
      <PageBreadcrumb pageTitle="Payroll Components" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll Processing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and view employee payroll components</p>
        </div>

        {/* Filter / Action Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <CogIcon className="h-4 w-4 text-gray-400" /> Payroll Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Employee</label>
              <select value={selectedEmployee}
                onChange={e => setSelectedEmployee(Number(e.target.value))}
                className={inputCls}>
                <option value={0}>Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
            <button onClick={fetchPayroll} disabled={!selectedEmployee || !month}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              <EyeIcon className="h-4 w-4" /> View Payroll
            </button>
            <button onClick={generatePayroll} disabled={!selectedEmployee || !month}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              <CogIcon className="h-4 w-4" /> Generate
            </button>
            <button onClick={fetchMonthPayrolls} disabled={!month}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
              <CalendarDaysIcon className="h-4 w-4" /> View Month Payrolls
            </button>
          </div>
        </div>

        {/* Individual Payroll Detail */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            Loading payroll data...
          </div>
        )}

        {!loading && payroll && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Payroll — {payroll.payrollMonth}
                </h2>
                <p className="text-sm text-gray-500">
                  {[payroll.employee?.firstName, payroll.employee?.lastName].filter(Boolean).join(" ")}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${payroll.finalized ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-700"}`}>
                {payroll.finalized ? "Finalized" : "Draft"}
              </span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatsCard label="Base Salary"       value={payroll.baseSalary}      gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
              <StatsCard label="Total Earnings"    value={payroll.totalEarnings}   gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
              <StatsCard label="Total Deductions"  value={payroll.totalDeductions} gradient="from-red-50 to-rose-50"      borderColor="border-red-100"    labelColor="text-red-600" />
              <StatsCard label="Net Pay"           value={payroll.netPay}          gradient="from-blue-50 to-indigo-50"   borderColor="border-blue-100"   labelColor="text-blue-600" />
            </div>

            {/* Components table */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Payroll Components</p>
              <ReusableTable<PayrollComponent>
                data={payroll.components}
                columns={componentColumns}
                loading={false}
                searchable={false}
                pageSize={20}
                defaultSortKey="type"
                defaultSortOrder="asc"
                emptyState={
                  <p className="text-center text-sm text-gray-400 py-4">No components found</p>
                }
              />
            </div>
          </div>
        )}

        {/* Month-wise Payroll List */}
        {payrollsByMonth.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">
                Payrolls for {month}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatsCard label="Total Net Pay"     value={Math.round(totalNet)}      gradient="from-blue-50 to-indigo-50"   borderColor="border-blue-100"   labelColor="text-blue-600" />
              <StatsCard label="Total Earnings"    value={Math.round(totalEarnings)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
              <StatsCard label="Total Deductions"  value={Math.round(totalDeduct)}   gradient="from-red-50 to-rose-50"      borderColor="border-red-100"    labelColor="text-red-600" />
            </div>

            <ReusableTable<PayrollRecord>
              data={payrollsByMonth}
              columns={monthColumns}
              loading={loading}
              searchable
              searchPlaceholder="Search by employee name..."
              searchFields={[]}
              pageSize={10}
              defaultSortKey="netPay"
              defaultSortOrder="desc"
              emptyState={
                <div className="flex flex-col items-center py-4">
                  <BanknotesIcon className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No payroll records for this month</p>
                </div>
              }
            />
          </div>
        )}

        {/* Placeholder when nothing is loaded yet */}
        {!loading && !payroll && payrollsByMonth.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 flex flex-col items-center">
            <BanknotesIcon className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-400 text-sm font-medium">
              Select an employee and month, then click View or Generate
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default PayrollComponentPage;
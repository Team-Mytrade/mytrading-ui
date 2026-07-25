import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { 
  ClockIcon, 
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/StatsCard";
import { AddButton } from "../../components/common/AddButton";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { ToasterService } from "../../Services/ToasterService";
import FilterPopover from "../../components/common/filter";

type TimesheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

interface TimesheetEntry {
  day: string; // "Monday", "Tuesday", etc.
  date: string;
  regularHours: number;
  overtimeHours: number;
  projectOrTask: string;
}

interface Timesheet {
  id?: number;
  employeeId: number;
  employeeName: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  status: TimesheetStatus;
  entries?: TimesheetEntry[];
  submittedDate?: string;
  approverRemarks?: string;
}

const EMPLOYEE_URL = "/v1/api/payroll/employee";
const TIMESHEET_URL = "/v1/api/attendance/timesheets"; // Mock endpoint

const STATUS_STYLES: Record<TimesheetStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border border-gray-200",
  SUBMITTED: "bg-blue-50 text-blue-700 border border-blue-200",
  APPROVED: "bg-green-50 text-green-700 border border-green-200",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
};

const STATUS_ICONS: Record<TimesheetStatus, JSX.Element> = {
  DRAFT: <DocumentTextIcon className="h-3 w-3" />,
  SUBMITTED: <ClockIcon className="h-3 w-3" />,
  APPROVED: <CheckCircleIcon className="h-3 w-3" />,
  REJECTED: <XCircleIcon className="h-3 w-3" />,
};

const TimesheetManagementPage: React.FC = () => {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingTimesheet, setViewingTimesheet] = useState<Timesheet | null>(null);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  
  const [form, setForm] = useState<Partial<Timesheet>>({ status: "DRAFT" });
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [weekStartDate, setWeekStartDate] = useState(new Date().toISOString().split('T')[0]);

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  useEffect(() => {
    loadEmployees();
    loadMockTimesheets();
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${EMPLOYEE_URL}/all`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMockTimesheets = () => {
    setLoading(true);
    setTimeout(() => {
      setTimesheets([
        { 
          id: 1, 
          employeeId: 1, 
          employeeName: "John Doe", 
          weekStartDate: "2026-07-20", 
          weekEndDate: "2026-07-26", 
          totalHours: 40, 
          status: "APPROVED", 
          submittedDate: "2026-07-24",
          entries: [
            { day: "Monday", date: "2026-07-20", regularHours: 8, overtimeHours: 0, projectOrTask: "Frontend Dev" },
            { day: "Tuesday", date: "2026-07-21", regularHours: 8, overtimeHours: 0, projectOrTask: "Frontend Dev" },
            { day: "Wednesday", date: "2026-07-22", regularHours: 8, overtimeHours: 0, projectOrTask: "Code Review" },
            { day: "Thursday", date: "2026-07-23", regularHours: 8, overtimeHours: 0, projectOrTask: "Testing" },
            { day: "Friday", date: "2026-07-24", regularHours: 8, overtimeHours: 0, projectOrTask: "Deployment" },
            { day: "Saturday", date: "2026-07-25", regularHours: 0, overtimeHours: 0, projectOrTask: "Off" },
            { day: "Sunday", date: "2026-07-26", regularHours: 0, overtimeHours: 0, projectOrTask: "Off" },
          ]
        },
        { 
          id: 2, 
          employeeId: 2, 
          employeeName: "Jane Smith", 
          weekStartDate: "2026-07-20", 
          weekEndDate: "2026-07-26", 
          totalHours: 35.5, 
          status: "SUBMITTED", 
          submittedDate: "2026-07-25",
          entries: [
            { day: "Monday", date: "2026-07-20", regularHours: 8, overtimeHours: 0, projectOrTask: "UI Design" },
            { day: "Tuesday", date: "2026-07-21", regularHours: 7.5, overtimeHours: 0, projectOrTask: "UI Design" },
            { day: "Wednesday", date: "2026-07-22", regularHours: 8, overtimeHours: 0, projectOrTask: "Meetings" },
            { day: "Thursday", date: "2026-07-23", regularHours: 8, overtimeHours: 0, projectOrTask: "Research" },
            { day: "Friday", date: "2026-07-24", regularHours: 4, overtimeHours: 0, projectOrTask: "Documentation" },
            { day: "Saturday", date: "2026-07-25", regularHours: 0, overtimeHours: 0, projectOrTask: "Off" },
            { day: "Sunday", date: "2026-07-26", regularHours: 0, overtimeHours: 0, projectOrTask: "Off" },
          ]
        },
        { 
          id: 3, 
          employeeId: 3, 
          employeeName: "Alice Johnson", 
          weekStartDate: "2026-07-20", 
          weekEndDate: "2026-07-26", 
          totalHours: 42, 
          status: "DRAFT",
          entries: [
            { day: "Monday", date: "2026-07-20", regularHours: 8, overtimeHours: 2, projectOrTask: "Backend API" },
            { day: "Tuesday", date: "2026-07-21", regularHours: 8, overtimeHours: 0, projectOrTask: "Backend API" },
            { day: "Wednesday", date: "2026-07-22", regularHours: 8, overtimeHours: 0, projectOrTask: "Database Migration" },
            { day: "Thursday", date: "2026-07-23", regularHours: 8, overtimeHours: 0, projectOrTask: "Bug Fixing" },
            { day: "Friday", date: "2026-07-24", regularHours: 8, overtimeHours: 0, projectOrTask: "Sprint Planning" },
            { day: "Saturday", date: "2026-07-25", regularHours: 0, overtimeHours: 0, projectOrTask: "Off" },
            { day: "Sunday", date: "2026-07-26", regularHours: 0, overtimeHours: 0, projectOrTask: "Off" },
          ]
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ status: "DRAFT" });
    generateWeekEntries(weekStartDate);
    setShowForm(true);
  };

  const openEditForm = (timesheet: Timesheet) => {
    setEditingId(timesheet.id || null);
    setForm({
      id: timesheet.id,
      employeeId: timesheet.employeeId,
      status: timesheet.status,
    });
    setWeekStartDate(timesheet.weekStartDate);
    if (timesheet.entries && timesheet.entries.length > 0) {
      setEntries(timesheet.entries);
    } else {
      generateWeekEntries(timesheet.weekStartDate);
    }
    setShowForm(true);
  };

  const handleView = (timesheet: Timesheet) => {
    setViewingTimesheet(timesheet);
  };

  const handleDelete = (timesheet: Timesheet) => {
    confirm({
      title: "Delete Timesheet",
      message: `Are you sure you want to delete the timesheet for ${timesheet.employeeName} (${timesheet.weekStartDate} to ${timesheet.weekEndDate})?`,
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: () => {
        setTimesheets(prev => prev.filter(t => t.id !== timesheet.id));
        ToasterService.success("Timesheet deleted successfully");
      }
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const generateWeekEntries = (startStr: string) => {
    const start = new Date(startStr);
    const day = start.getDay();
    // Move to Monday if not already
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(start.setDate(diff));
    
    const newEntries: TimesheetEntry[] = [];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      newEntries.push({
        day: days[i],
        date: current.toISOString().split('T')[0],
        regularHours: i < 5 ? 8 : 0, // Default 8 hours for weekdays
        overtimeHours: 0,
        projectOrTask: "General Operations"
      });
    }
    setEntries(newEntries);
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeekStartDate(e.target.value);
    generateWeekEntries(e.target.value);
  };

  const handleEntryChange = (index: number, field: keyof TimesheetEntry, value: any) => {
    const newEntries = [...entries];
    (newEntries[index] as any)[field] = value;
    setEntries(newEntries);
  };

  const calculateTotal = () => {
    return entries.reduce((sum, entry) => sum + Number(entry.regularHours) + Number(entry.overtimeHours), 0);
  };

  const submitForm = (e: React.FormEvent, status: TimesheetStatus = "SUBMITTED") => {
    e.preventDefault();
    if (!form.employeeId) return ToasterService.error("Select an employee");
    
    const emp = employees.find(e => e.id === form.employeeId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : (form.employeeName || "Unknown Employee");

    if (editingId) {
      setTimesheets(prev => prev.map(t => {
        if (t.id === editingId) {
          return {
            ...t,
            employeeId: form.employeeId!,
            employeeName: empName,
            weekStartDate: entries[0]?.date || t.weekStartDate,
            weekEndDate: entries[entries.length - 1]?.date || t.weekEndDate,
            totalHours: calculateTotal(),
            status: status,
            entries: entries,
            submittedDate: status === "SUBMITTED" ? new Date().toISOString().split('T')[0] : t.submittedDate
          };
        }
        return t;
      }));
      ToasterService.success("Timesheet updated successfully!");
    } else {
      const newTimesheet: Timesheet = {
        id: Math.floor(Math.random() * 1000),
        employeeId: form.employeeId!,
        employeeName: empName,
        weekStartDate: entries[0]?.date || weekStartDate,
        weekEndDate: entries[entries.length - 1]?.date || weekStartDate,
        totalHours: calculateTotal(),
        status: status,
        entries: entries,
        submittedDate: status === "SUBMITTED" ? new Date().toISOString().split('T')[0] : undefined
      };
      setTimesheets([newTimesheet, ...timesheets]);
      ToasterService.success(`Timesheet ${status.toLowerCase()} successfully!`);
    }
    resetForm();
  };

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(t => {
      if (selectedEmployeeFilter && t.employeeId.toString() !== selectedEmployeeFilter) return false;
      if (selectedStatusFilter && t.status !== selectedStatusFilter) return false;
      return true;
    });
  }, [timesheets, selectedEmployeeFilter, selectedStatusFilter]);

  const stats = {
    total: timesheets.length,
    draft: timesheets.filter(t => t.status === "DRAFT").length,
    submitted: timesheets.filter(t => t.status === "SUBMITTED").length,
    approved: timesheets.filter(t => t.status === "APPROVED").length,
  };

  const columns: ColumnDef<Timesheet>[] = [
    {
      key: "employeeName", label: "Employee", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-xs shrink-0">
            {row.employeeName.charAt(0)}
          </div>
          <span className="text-sm font-medium text-gray-900">{row.employeeName}</span>
        </div>
      ),
    },
    {
      key: "weekStartDate", label: "Week Period", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{row.weekStartDate} to {row.weekEndDate}</span>
        </div>
      )
    },
    {
      key: "totalHours", label: "Total Hours", sortable: true,
      render: (row) => (
         <span className="font-semibold text-gray-800">{row.totalHours} hrs</span>
      )
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[row.status]}`}>
          {STATUS_ICONS[row.status]}
          {row.status}
        </span>
      )
    },
    {
      key: "submittedDate", label: "Submitted On",
      render: (row) => (
        <span className="text-sm text-gray-500">{row.submittedDate || "—"}</span>
      )
    },
    {
      key: "actions", label: "Actions", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleView(row)}
            title="View Details"
            className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEditForm(row)}
            title="Edit Timesheet"
            className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            title="Delete Timesheet"
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Timesheet Management" description="Manage employee timesheets" />
      <PageBreadcrumb pageTitle="Timesheet Management" />

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {showForm ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg"><ClockIcon className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{editingId ? "Edit Timesheet" : "New Timesheet"}</h3>
                  <p className="text-sm text-gray-500">{editingId ? "Modify logged hours and tasks" : "Log hours for the week"}</p>
                </div>
              </div>
              <button onClick={resetForm} className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 rounded-full transition-colors">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
                   <select 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={form.employeeId || ""}
                      onChange={(e) => setForm({...form, employeeId: Number(e.target.value)})}
                   >
                     <option value="">-- Select Employee --</option>
                     {employees.map(emp => (
                       <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                     ))}
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">Select Week (Pick any day)</label>
                   <input 
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={weekStartDate}
                      onChange={handleWeekChange}
                   />
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-8">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 uppercase font-medium border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Day / Date</th>
                      <th className="px-4 py-3">Project / Task</th>
                      <th className="px-4 py-3 w-32">Regular Hrs</th>
                      <th className="px-4 py-3 w-32">Overtime Hrs</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{entry.day}</div>
                          <div className="text-xs text-gray-500">{entry.date}</div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            className="w-full border-b border-gray-200 px-2 py-1 focus:border-cyan-500 outline-none bg-transparent"
                            value={entry.projectOrTask}
                            onChange={(e) => handleEntryChange(idx, "projectOrTask", e.target.value)}
                            placeholder="e.g. Development"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            min="0" max="24"
                            className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:border-cyan-500 outline-none"
                            value={entry.regularHours}
                            onChange={(e) => handleEntryChange(idx, "regularHours", Number(e.target.value))}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            min="0" max="24"
                            className="w-full border border-gray-200 rounded-md px-3 py-1.5 focus:border-cyan-500 outline-none"
                            value={entry.overtimeHours}
                            onChange={(e) => handleEntryChange(idx, "overtimeHours", Number(e.target.value))}
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800">
                          {Number(entry.regularHours) + Number(entry.overtimeHours)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-bold text-gray-900">
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-right">Total Weekly Hours:</td>
                      <td className="px-4 py-4 text-right text-lg text-cyan-700">{calculateTotal()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
                <button onClick={resetForm} className="px-6 py-2.5 font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={(e) => submitForm(e, "DRAFT")} className="px-6 py-2.5 font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors">
                  Save as Draft
                </button>
                <button onClick={(e) => submitForm(e, "SUBMITTED")} className="px-6 py-2.5 font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors shadow-sm">
                  {editingId ? "Update Timesheet" : "Submit Timesheet"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <StatsCard label="Total Timesheets" value={stats.total} gradient="from-gray-50 to-gray-100" borderColor="border-gray-200" labelColor="text-gray-700" icon={<DocumentTextIcon className="h-6 w-6"/>} />
              <StatsCard label="Drafts" value={stats.draft} gradient="from-blue-50 to-blue-100" borderColor="border-blue-200" labelColor="text-blue-700" icon={<DocumentTextIcon className="h-6 w-6"/>} />
              <StatsCard label="Pending Approval" value={stats.submitted} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-200" labelColor="text-yellow-700" icon={<ClockIcon className="h-6 w-6"/>} />
              <StatsCard label="Approved" value={stats.approved} gradient="from-green-50 to-emerald-50" borderColor="border-green-200" labelColor="text-green-700" icon={<CheckCircleIcon className="h-6 w-6"/>} />
            </div>

            <ReusableTable<Timesheet>
              data={filteredTimesheets}
              columns={columns}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search by employee name..."
              searchFields={["employeeName"]}
              pageSize={10}
              toolbar={
                <div className="flex items-center gap-3">
                  <FilterPopover title="Filter Timesheets" buttonLabel="Filter" showFooter={true} onReset={() => { setSelectedEmployeeFilter(""); setSelectedStatusFilter(""); }}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={selectedStatusFilter} onChange={(e) => setSelectedStatusFilter(e.target.value)}>
                          <option value="">All Statuses</option>
                          <option value="DRAFT">Draft</option>
                          <option value="SUBMITTED">Submitted</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </FilterPopover>
                  <AddButton label="Add Timesheet" onClick={openCreateForm} />
                </div>
              }
              emptyState={
                <div className="text-center py-12">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">No timesheets found.</p>
                </div>
              }
            />
          </>
        )}
      </div>

      {/* Details View Modal */}
      {viewingTimesheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg">
                  <ClockIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Timesheet Details</h3>
                  <p className="text-sm text-gray-500">{viewingTimesheet.employeeName} ({viewingTimesheet.weekStartDate} to {viewingTimesheet.weekEndDate})</p>
                </div>
              </div>
              <button onClick={() => setViewingTimesheet(null)} className="p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 rounded-full transition-colors">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Employee</span>
                  <span className="font-semibold text-gray-800">{viewingTimesheet.employeeName}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Total Hours</span>
                  <span className="font-semibold text-cyan-700">{viewingTimesheet.totalHours} hrs</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Status</span>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[viewingTimesheet.status]}`}>
                    {STATUS_ICONS[viewingTimesheet.status]}
                    {viewingTimesheet.status}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Submitted On</span>
                  <span className="font-medium text-gray-700">{viewingTimesheet.submittedDate || "—"}</span>
                </div>
              </div>

              {viewingTimesheet.entries && viewingTimesheet.entries.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Daily Breakdown</h4>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2">Day / Date</th>
                          <th className="px-3 py-2">Task</th>
                          <th className="px-3 py-2 text-right">Reg. Hrs</th>
                          <th className="px-3 py-2 text-right">OT Hrs</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingTimesheet.entries.map((entry, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2 font-medium text-gray-800">{entry.day} ({entry.date})</td>
                            <td className="px-3 py-2 text-gray-600">{entry.projectOrTask || "—"}</td>
                            <td className="px-3 py-2 text-right">{entry.regularHours}</td>
                            <td className="px-3 py-2 text-right">{entry.overtimeHours}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">{Number(entry.regularHours) + Number(entry.overtimeHours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={() => setViewingTimesheet(null)}
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export default TimesheetManagementPage;

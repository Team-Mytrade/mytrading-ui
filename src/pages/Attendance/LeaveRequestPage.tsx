import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

interface LeaveType {
  id: number;
  name: string;
}

interface LeaveBalance {
  id?: number;
  employeeId: number;
  leaveTypeId: number;
  remaining: number;
}

const EMPLOYEE_URL = "/v1/api/payroll/employee";
const LEAVETYPE_URL = "/v1/api/attendance/leave-types";
const LEAVE_BALANCE_URL = "/v1/api/attendance/leave-balances";
const LEAVE_API_URL = "/v1/api/attendance/leaves";

const LeaveRequestPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | "">("");
  
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayType, setDayType] = useState("Full Day");
  const [leaveTypeId, setLeaveTypeId] = useState<number | "">("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadEmployees();
    loadLeaveTypes();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadLeaveBalances(Number(selectedEmployeeId));
    } else {
      setLeaveBalances([]);
    }
  }, [selectedEmployeeId]);

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${EMPLOYEE_URL}/all`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load employees");
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const res = await axios.get<LeaveType[]>(LEAVETYPE_URL);
      setLeaveTypes(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load leave types");
    }
  };

  const loadLeaveBalances = async (empId: number) => {
    try {
      const res = await axios.get<LeaveBalance[]>(`${LEAVE_BALANCE_URL}/employee/${empId}`);
      setLeaveBalances(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const calculateTotalDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (e < s) return 0;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (dayType === "First half" || dayType === "Second half") {
       diffDays = diffDays > 1 ? diffDays - 0.5 : 0.5; // rudimentary half day logic
    }
    return diffDays;
  };

  const totalDays = calculateTotalDays(fromDate, toDate);

  const handleSubmit = async () => {
    if (!selectedEmployeeId) return ToasterService.error("Please select an employee");
    if (!leaveTypeId) return ToasterService.error("Please select a leave type");
    if (!fromDate || !toDate) return ToasterService.error("Please select dates");
    if (new Date(toDate) < new Date(fromDate)) return ToasterService.error("End date cannot be before start date");
    if (totalDays <= 0) return ToasterService.error("Total days must be greater than 0");

    const employee = employees.find(e => e.id === Number(selectedEmployeeId));
    const leaveTypeObj = leaveTypes.find(lt => lt.id === Number(leaveTypeId));

    const payload = {
      employeeId: employee?.id,
      employeeName: `${employee?.firstName} ${employee?.lastName}`,
      leaveTypeId: leaveTypeObj?.id,
      leaveTypeName: leaveTypeObj?.name,
      startDate: fromDate,
      endDate: toDate,
      totalDays: totalDays,
      reason: comments || dayType,
      status: "PENDING",
      appliedDate: new Date().toISOString().split('T')[0],
      approvedDate: null,
      approverRemarks: null,
    };

    try {
      setIsSubmitting(true);
      await axios.post(`${LEAVE_API_URL}/apply`, payload);
      ToasterService.success("Leave request submitted successfully");
      setComments("");
      setLeaveTypeId("");
      if (selectedEmployeeId) loadLeaveBalances(Number(selectedEmployeeId));
    } catch (err: any) {
      console.error(err);
      ToasterService.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Calendar logic ---
  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const days = daysInMonth(currentMonth, currentYear);
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handleDayClick = (day: number) => {
    // Helper to format date consistently to local YYYY-MM-DD
    const dateObj = new Date(currentYear, currentMonth, day);
    // adjust for timezone offset to get correct YYYY-MM-DD string locally
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - (offset*60*1000));
    const dateStr = localDate.toISOString().split('T')[0];
    
    // If fromDate is not set or if we are resetting, set both to this day
    if (!fromDate || (fromDate && toDate && fromDate !== toDate)) {
      setFromDate(dateStr);
      setToDate(dateStr);
    } else if (new Date(dateStr) >= new Date(fromDate)) {
      // Extend toDate
      setToDate(dateStr);
    } else {
      // If clicked before fromDate, reset fromDate
      setFromDate(dateStr);
      setToDate(dateStr);
    }
  };

  const isDateInRange = (day: number) => {
    if (!fromDate || !toDate) return false;
    const d = new Date(currentYear, currentMonth, day);
    // adjust for tz offset
    const offset = d.getTimezoneOffset();
    const localD = new Date(d.getTime() - (offset*60*1000));
    const str = localD.toISOString().split('T')[0];
    
    return str >= fromDate && str <= toDate;
  };

  const renderCalendarDays = () => {
    const calendarDays = [];
    const prevMonthDays = daysInMonth(currentMonth - 1, currentYear);
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push(
        <div key={`prev-${i}`} className="p-2 text-center text-gray-300 text-sm">
          {prevMonthDays - i}
        </div>
      );
    }
    
    // Current month days
    for (let i = 1; i <= days; i++) {
      // Dummy logic for 'Absent' marks on 1st, 2nd etc if we want, but let's just show range selection clearly
      const inRange = isDateInRange(i);
      
      let className = "p-2 text-center text-sm cursor-pointer rounded-full h-8 w-8 flex items-center justify-center mx-auto transition-colors duration-200 ";
      
      if (inRange) {
        className += "bg-[#316c59] text-white shadow-md hover:bg-[#255243]";
      } else {
        className += "text-gray-700 hover:bg-gray-100 hover:text-[#316c59]";
      }

      calendarDays.push(
        <div key={`current-${i}`} className="flex items-center justify-center py-1">
          <div className={className} onClick={() => handleDayClick(i)}>
            {i}
          </div>
        </div>
      );
    }

    // Next month days
    const totalCells = Math.ceil((days + firstDay) / 7) * 7;
    for (let i = 1; i <= totalCells - (days + firstDay); i++) {
       calendarDays.push(
        <div key={`next-${i}`} className="flex items-center justify-center py-1">
          <div className="p-2 text-center text-gray-300 text-sm">{i}</div>
        </div>
      );
    }

    return calendarDays;
  };

  return (
    <>
      <PageMeta title="Leave Request" description="Timesheet page" />
      <PageBreadcrumb pagetitle="Leave Request" />

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <p className="text-gray-600 text-sm">Select dates and apply for a leave request.</p>
          <div className="flex items-center gap-3">
             <label className="text-sm font-medium text-gray-700">Employee:</label>
             <select 
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
             >
                <option value="">-- Select Employee --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
             </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          
          {/* Left Column: Calendar */}
          <div className="lg:col-span-4 border-r border-gray-200 pr-0 lg:pr-6">
            <div className="flex items-center justify-between mb-6 px-2">
              <button onClick={handlePrevMonth} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-medium text-gray-800">{monthNames[currentMonth]} {currentYear}</h2>
              <button onClick={handleNextMonth} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2 border-b border-gray-200 pb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-8">
              {renderCalendarDays()}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-gray-600 border-t border-gray-200 pt-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-gray-400 rounded-sm"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#316c59] rounded-sm"></div>
                <span>Selected</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 italic">
              Tip: Click on a date to set the start date, and click again on another date to extend the selection.
            </p>
          </div>

          {/* Right Column: Request Form */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="bg-[#e9e3cf] p-4 flex justify-between items-center rounded-lg mb-6 shadow-sm border border-[#d8d2bf]">
              <span className="font-medium text-gray-800">
                Request from <span className="font-bold">{fromDate || "--"}</span> to <span className="font-bold">{toDate || "--"}</span>
              </span>
              <span className="text-gray-700 font-medium bg-white/50 px-3 py-1 rounded-full text-sm">
                {totalDays} {totalDays === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  <span className="text-red-500">*</span> From
                </label>
                <input 
                  type="date"
                  className="w-full border-b border-gray-300 focus:border-cyan-500 pb-1 outline-none bg-transparent text-gray-800 font-medium"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-600 mb-2">
                  <span className="text-red-500">*</span> To
                </label>
                <input 
                  type="date"
                  className="w-full border-b border-gray-300 focus:border-cyan-500 pb-1 outline-none bg-transparent text-gray-800 font-medium"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 mb-8 border-b border-gray-100 pb-8">
              {["Full Day", "First half", "Second half"].map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="dayType" 
                    value={type}
                    checked={dayType === type}
                    onChange={(e) => setDayType(e.target.value)}
                    className="w-4 h-4 text-[#316c59] focus:ring-[#316c59] border-gray-300 cursor-pointer" 
                  />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{type}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-b border-gray-100 pb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="text-red-500">*</span> Type of leaves
                </label>
                <select 
                  className="w-full border-b border-gray-300 focus:border-cyan-500 pb-1 outline-none bg-transparent text-sm text-gray-800"
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">-- Select Type --</option>
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name}</option>
                  ))}
                </select>
                <p className="text-xs text-red-500 mt-1 opacity-75">This field should not be left blank</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Leave balance :</p>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployeeId ? (
                    leaveBalances.length > 0 ? (
                      leaveBalances.map(lb => {
                        const lt = leaveTypes.find(t => t.id === lb.leaveTypeId);
                        return (
                          <span key={lb.id} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 shadow-sm flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                            {lt?.name || 'Unknown'} - {lb.remaining}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-500 italic">No leave balances found.</span>
                    )
                  ) : (
                    <span className="text-xs text-gray-500 italic">Select an employee to view balances.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-grow">
               <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments
                </label>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 p-3 outline-none resize-none text-sm text-gray-800 shadow-sm"
                  rows={3}
                  placeholder="Add any comments or reasons here..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                ></textarea>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button 
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                onClick={() => {
                  setFromDate(new Date().toISOString().split('T')[0]);
                  setToDate(new Date().toISOString().split('T')[0]);
                  setComments("");
                  setLeaveTypeId("");
                }}
              >
                Clear
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#316c59] hover:bg-[#255243] text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                   <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                   </>
                ) : "Submit Request"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default LeaveRequestPage;


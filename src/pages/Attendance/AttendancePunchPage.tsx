import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  LogIn, LogOut, Monitor, MessageSquare, 
  User, Clock, CheckCircle2, Activity, ChevronDown, 
  Layers, CheckCircle, Search, RefreshCw, 
  Zap, Loader2
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import { ToasterService } from '../../Services/ToasterService';

const CHECK_IN_URL = '/v1/api/attendance/records/check-in';
const CHECK_OUT_URL = '/v1/api/attendance/records/check-out';

interface AttendancePayload {
  employeeId: number;
  attendanceSource: string;
  attendanceMode: string;
  deviceId: string;
  deviceName: string;
  location: string;
  latitude: number;
  longitude: number;
  ipAddress: string;
  remarks?: string;
}

interface PunchLogEntry {
  id: number;
  type: 'CHECK_IN' | 'CHECK_OUT';
  employeeId: number;
  employeeName?: string;
  timestamp: string;
  attendanceSource: string;
  attendanceMode: string;
  deviceId: string;
  deviceName: string;
  location: string;
  coordinates: string;
  ipAddress: string;
  remarks: string;
  status: string;
}

interface EmployeeItem {
  id: number;
  name: string;
  code?: string;
  department?: string;
  designation?: string;
}

// Bulletproof helper to extract initials without throwing undefined/null exceptions
const getInitials = (name?: string): string => {
  if (!name) return 'EMP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EMP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const AttendancePunchPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  // Search & Filter for Punch Logs
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterTab, setLogFilterTab] = useState<'ALL' | 'CHECK_IN' | 'CHECK_OUT'>('ALL');

  // Employee Directory state
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Current logged in user
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        const uName = (parsed.fullName || parsed.name || parsed.username || '').trim();
        const isRoy = uName.toLowerCase().includes('roy') || uName.toLowerCase().includes('hamlin');
        const defaultId = isRoy ? 71 : (parsed.employeeId || parsed.id || 71);
        return {
          id: parsed.employeeId ? Number(parsed.employeeId) : defaultId,
          name: uName || 'Roy Hamlin',
          code: parsed.employeeCode || `EMP-${parsed.employeeId || defaultId}`,
          role: parsed.role || 'Employee'
        };
      } catch (e) {}
    }
    return { id: 71, name: 'Roy Hamlin', code: 'EMP-71', role: 'Employee' };
  }, []);

  const [formData, setFormData] = useState<AttendancePayload>({
    employeeId: currentUser.id || 71,
    attendanceSource: 'BIOMETRIC',
    attendanceMode: 'OFFICE',
    deviceId: '124566',
    deviceName: 'HYD_RMZ_12456',
    location: 'HYD',
    latitude: 125.25,
    longitude: 451.2,
    ipAddress: '192.255.26.1',
    remarks: 'Shift Check-In'
  });

  const [punchLogs, setPunchLogs] = useState<PunchLogEntry[]>([]);

// Helper to safely extract string from potentially nested object values (e.g. {id, name})
const extractString = (val: any, fallback: string): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.title || val.departmentName || val.designationName || fallback;
  }
  return String(val);
};

  // Fetch Employee Directory for Auto-Complete & Quick Pick
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await axios.get('/v1/api/payroll/employee/all');
        if (Array.isArray(res.data) && res.data.length > 0) {
          const list: EmployeeItem[] = res.data.map((e: any) => ({
            id: Number(e.id),
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.fullName || `Employee #${e.id}`,
            code: e.employeeCode || `EMP-${e.id}`,
            department: extractString(e.departmentName || e.department, 'Operations'),
            designation: extractString(e.designationName || e.designation, 'Staff')
          }));
          setEmployees(list);
        }
      } catch (e) {
        setEmployees([
          { id: 71, name: 'Roy Hamlin', code: 'EMP-71', department: 'Management', designation: 'General Manager' },
          { id: 12, name: 'John Doe', code: 'EMP-12', department: 'Engineering', designation: 'Senior Developer' },
          { id: 15, name: 'Sarah Connor', code: 'EMP-15', department: 'HR', designation: 'HR Specialist' }
        ]);
      }
    };
    loadEmployees();
  }, []);

  // Selected Employee object
  const selectedEmployee = useMemo(() => {
    if (!formData.employeeId) return null;
    const match = employees.find(e => Number(e.id) === Number(formData.employeeId));
    if (match) return match;
    if (Number(formData.employeeId) === currentUser.id) {
      return {
        id: currentUser.id,
        name: currentUser.name,
        code: currentUser.code,
        department: 'Self',
        designation: currentUser.role
      };
    }
    return {
      id: Number(formData.employeeId),
      name: `Employee #${formData.employeeId}`,
      code: `EMP-${formData.employeeId}`,
      department: 'General Staff',
      designation: 'Employee'
    };
  }, [formData.employeeId, employees, currentUser]);

  // Fetch Saved Attendance Punch Logs from Backend API
  const fetchTodayPunchLogs = useCallback(async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await axios.get('/v1/api/attendance/records', { timeout: 4000 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mappedLogs: PunchLogEntry[] = res.data.map((item: any, index: number) => {
          const empId = Number(item.employeeId || item.empId || 0);
          const empMatch = employees.find(e => e.id === empId);
          return {
            id: item.id || Date.now() + index,
            type: item.checkOutTime ? 'CHECK_OUT' : 'CHECK_IN',
            employeeId: empId,
            employeeName: item.employeeName || (empMatch ? empMatch.name : (empId === currentUser.id ? currentUser.name : `Employee #${empId}`)),
            timestamp: item.checkInTime || item.punchTime || item.createdDate || new Date().toLocaleTimeString(),
            attendanceSource: item.attendanceSource || 'BIOMETRIC',
            attendanceMode: item.attendanceMode || 'OFFICE',
            deviceId: item.deviceId || '124566',
            deviceName: item.deviceName || 'HYD_RMZ_12456',
            location: item.location || 'HYD',
            coordinates: item.latitude ? `${item.latitude}, ${item.longitude}` : '125.25, 451.2',
            ipAddress: item.ipAddress || '192.255.26.1',
            remarks: item.remarks || (item.checkOutTime ? 'Shift Check-Out' : 'Shift Check-In'),
            status: 'Success'
          };
        });
        setPunchLogs(mappedLogs);
      }
    } catch (e) {
      console.warn("Could not fetch today punch logs:", e);
    } finally {
      setIsRefreshingLogs(false);
    }
  }, [employees, currentUser]);

  useEffect(() => {
    fetchTodayPunchLogs();
  }, [fetchTodayPunchLogs]);

  const handleInputChange = (field: keyof AttendancePayload, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePunch = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!formData.employeeId) {
      ToasterService.error('Please select or enter a valid Employee ID');
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = type === 'CHECK_IN' ? CHECK_IN_URL : CHECK_OUT_URL;
      
      const payload: AttendancePayload = {
        employeeId: Number(formData.employeeId),
        attendanceSource: formData.attendanceSource,
        attendanceMode: formData.attendanceMode,
        deviceId: formData.deviceId,
        deviceName: formData.deviceName,
        location: formData.location,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        ipAddress: formData.ipAddress,
        ...(type === 'CHECK_OUT' && formData.remarks ? { remarks: formData.remarks } : {})
      };

      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await axios.post(endpoint, payload, {
        headers,
        timeout: 6000
      });

      const empName = selectedEmployee ? selectedEmployee.name : `Employee #${payload.employeeId}`;

      const newEntry: PunchLogEntry = {
        id: Date.now(),
        type: type,
        employeeId: payload.employeeId,
        employeeName: empName,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        attendanceSource: payload.attendanceSource,
        attendanceMode: payload.attendanceMode,
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        location: payload.location,
        coordinates: `${payload.latitude}, ${payload.longitude}`,
        ipAddress: payload.ipAddress,
        remarks: payload.remarks || (type === 'CHECK_IN' ? 'Shift Check-In' : 'Shift Check-Out'),
        status: 'Success'
      };

      setPunchLogs((prev) => [newEntry, ...prev]);
      fetchTodayPunchLogs();

      ToasterService.success(
        type === 'CHECK_IN' 
          ? `Check-In successfully recorded for ${empName} (#${payload.employeeId})!` 
          : `Check-Out successfully recorded for ${empName} (#${payload.employeeId})!`
      );
    } catch (err: any) {
      console.error(err);
      let rawMsg = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to record attendance.';
      
      if (typeof rawMsg === 'object') {
        rawMsg = JSON.stringify(rawMsg);
      }
      
      let friendlyMsg = String(rawMsg);

      if (friendlyMsg.includes('Employee not found with ID')) {
        const match = friendlyMsg.match(/Employee not found with ID:?\s*(\d+)?/i);
        const empId = match && match[1] ? match[1] : (formData.employeeId || '');
        friendlyMsg = `Employee not found with ID: ${empId}`;
      } else if (friendlyMsg.includes('during [') && friendlyMsg.includes('] to [')) {
        const jsonMatch = friendlyMsg.match(/\{"error":"([^"]+)"\}/) || friendlyMsg.match(/\{'error':'([^']+)'\}/);
        if (jsonMatch && jsonMatch[1]) {
          friendlyMsg = jsonMatch[1];
        } else {
          friendlyMsg = 'Unable to complete attendance punch. Please check the employee details.';
        }
      }

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        friendlyMsg = 'Server connection timed out. Please check backend service state.';
      } else if (err.message === 'Network Error') {
        friendlyMsg = 'Network error connecting to API server.';
      }

      ToasterService.error(friendlyMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick preset remarks
  const presetRemarks = useMemo(() => {
    if (activeTab === 'CHECK_IN') {
      return ['Shift Check-In', 'Regular Office', 'Work From Home', 'Late Arrival', 'Client Visit'];
    }
    return ['Shift Check-Out', 'End of Day', 'Early Departure', 'Half Day Out', 'Field Complete'];
  }, [activeTab]);

  // Filtered Punch Logs
  const filteredPunchLogs = useMemo(() => {
    return punchLogs.filter(log => {
      if (logFilterTab !== 'ALL' && log.type !== logFilterTab) return false;
      if (!logSearchQuery.trim()) return true;
      const q = logSearchQuery.toLowerCase().trim();
      const empIdStr = String(log.employeeId);
      const nameStr = (log.employeeName || '').toLowerCase();
      const remarksStr = (log.remarks || '').toLowerCase();
      return empIdStr.includes(q) || nameStr.includes(q) || remarksStr.includes(q);
    });
  }, [punchLogs, logFilterTab, logSearchQuery]);

  // Session stats
  const totalCount = punchLogs.length;
  const checkInCount = punchLogs.filter(l => l.type === 'CHECK_IN').length;
  const checkOutCount = punchLogs.filter(l => l.type === 'CHECK_OUT').length;

  return (
    <>
      <PageMeta title="Attendance Punch Station" description="Record employee check-in and check-out attendance punches" />
      <PageBreadcrumb pageTitle="Attendance Punch Station" />

      <div className="max-w-7xl mx-auto pb-8 space-y-4 animate-in fade-in duration-200">
        
        {/* ── TOP HERO STATION BANNER ────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-inner shrink-0">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">Attendance Punch Station</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                  Station Online
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-1 flex items-center gap-2.5 flex-wrap">
                <span>Web & Kiosk Attendance Terminal</span>
                <span className="text-slate-500">•</span>
                <span className="text-cyan-200/90 font-mono text-[11px]">Device #{formData.deviceId} ({formData.deviceName})</span>
                <span className="hidden sm:inline text-slate-500">•</span>
                <span className="hidden sm:inline text-slate-300 text-[11px]">Location: {formData.location}</span>
              </p>
            </div>
          </div>

          {/* Live Digital Clock & Shift Tracker */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/80 rounded-xl px-4 py-2 text-right">
              <div className="text-[10.5px] uppercase font-bold text-cyan-300 tracking-wider flex items-center justify-end gap-1.5">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="text-lg sm:text-xl font-mono font-extrabold text-white tracking-wider">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>

        {/* ── 2-COLUMN MAIN WORKSPACE ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT COLUMN: Punch Terminal (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Terminal Main Action Card */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
              
              {/* Step 1: Mode Switcher */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 inline-flex items-center justify-center text-[11px]">1</span>
                    Select Punch Mode
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">Shift Timings: 09:00 AM - 06:00 PM</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CHECK-IN CARD */}
                  <div
                    onClick={() => {
                      setActiveTab('CHECK_IN');
                      handleInputChange('remarks', 'Shift Check-In');
                    }}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-150 flex items-center justify-between select-none ${
                      activeTab === 'CHECK_IN'
                        ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-transform ${
                        activeTab === 'CHECK_IN'
                          ? 'bg-emerald-600 text-white shadow-xs scale-105'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <LogIn className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-extrabold text-slate-900">CHECK-IN</h3>
                          {activeTab === 'CHECK_IN' && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded-full">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Start work shift & record entry</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      activeTab === 'CHECK_IN' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                    }`}>
                      {activeTab === 'CHECK_IN' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>

                  {/* CHECK-OUT CARD */}
                  <div
                    onClick={() => {
                      setActiveTab('CHECK_OUT');
                      handleInputChange('remarks', 'Shift Check-Out');
                    }}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-150 flex items-center justify-between select-none ${
                      activeTab === 'CHECK_OUT'
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-transform ${
                        activeTab === 'CHECK_OUT'
                          ? 'bg-amber-600 text-white shadow-xs scale-105'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <LogOut className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-extrabold text-slate-900">CHECK-OUT</h3>
                          {activeTab === 'CHECK_OUT' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.2 rounded-full">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">End work shift & record exit</p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      activeTab === 'CHECK_OUT' ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                    }`}>
                      {activeTab === 'CHECK_OUT' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Employee Selection & Quick Shortcut */}
              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 inline-flex items-center justify-center text-[11px]">2</span>
                      Employee Identification
                    </span>

                    {/* Quick Punch as Me button */}
                    <button
                      type="button"
                      onClick={() => {
                        handleInputChange('employeeId', currentUser.id);
                        ToasterService.info(`Selected ${currentUser.name} (#${currentUser.id})`);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 active:scale-95 border border-cyan-200/80 rounded-lg transition cursor-pointer"
                      title="Quickly fill logged-in profile"
                    >
                      <Zap className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Punch as Me ({currentUser.name?.split(' ')[0] || 'Me'})</span>
                    </button>
                  </div>

                  {/* Searchable Input + Dropdown */}
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="number"
                          value={formData.employeeId || ''}
                          onChange={(e) => handleInputChange('employeeId', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handlePunch(activeTab);
                            }
                          }}
                          placeholder="Type Employee ID (e.g. 71, 12)..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition"
                        />
                      </div>

                      {/* Quick Select Dropdown Toggle */}
                      <button
                        type="button"
                        onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition cursor-pointer shrink-0"
                      >
                        <span>Select from Directory</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isEmpDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Dropdown Menu */}
                    {isEmpDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-30 p-2 space-y-1.5 animate-in zoom-in-95 duration-100">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            placeholder="Filter by name, ID or department..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                            autoFocus
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1 pt-1">
                          {employees
                            .filter(emp => {
                              if (!employeeSearch.trim()) return true;
                              const q = employeeSearch.toLowerCase().trim();
                              return emp.name.toLowerCase().includes(q) || String(emp.id).includes(q) || (emp.department || '').toLowerCase().includes(q);
                            })
                            .map((emp) => (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  handleInputChange('employeeId', emp.id);
                                  setIsEmpDropdownOpen(false);
                                  setEmployeeSearch('');
                                }}
                                className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                                  Number(formData.employeeId) === emp.id ? 'bg-cyan-50 text-cyan-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold text-[10px]">
                                    {getInitials(emp.name)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-900 block">{emp.name}</span>
                                    <span className="text-[10px] text-slate-400">{emp.department} • {emp.designation}</span>
                                  </div>
                                </div>
                                <span className="font-mono text-cyan-700 text-[11px] font-bold">#{emp.id}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Employee Preview Chip / Card */}
                  {selectedEmployee && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-slate-50 to-cyan-50/40 border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                          {getInitials(selectedEmployee.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{selectedEmployee.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-bold">
                              ID: #{selectedEmployee.id}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-slate-500">
                            {selectedEmployee.department} • {selectedEmployee.designation}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Ready to Punch
                      </span>
                    </div>
                  )}
                </div>

                {/* Step 3: Remarks & Quick Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 inline-flex items-center justify-center text-[11px]">3</span>
                      Punch Remarks / Note (Optional)
                    </span>
                  </div>

                  <div className="relative mb-2">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={formData.remarks || ''}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePunch(activeTab);
                        }
                      }}
                      placeholder="Enter remarks or click a quick preset below..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition"
                    />
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Presets:</span>
                    {presetRemarks.map((remark) => (
                      <button
                        key={remark}
                        type="button"
                        onClick={() => handleInputChange('remarks', remark)}
                        className={`px-2.5 py-0.8 text-[11px] rounded-lg border transition cursor-pointer ${
                          formData.remarks === remark
                            ? 'bg-cyan-600 text-white border-cyan-600 font-bold shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 font-medium'
                        }`}
                      >
                        {remark}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 4: Primary Punch Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handlePunch(activeTab)}
                    disabled={isSubmitting}
                    className={`w-full py-3 px-5 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 text-white shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer ${
                      activeTab === 'CHECK_IN'
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-500/20'
                        : 'bg-gradient-to-r from-amber-500 via-orange-600 to-amber-700 hover:from-amber-600 hover:to-orange-800 shadow-amber-500/20'
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : activeTab === 'CHECK_IN' ? (
                      <LogIn className="w-5 h-5" />
                    ) : (
                      <LogOut className="w-5 h-5" />
                    )}
                    <span>
                      {isSubmitting
                        ? `Recording ${activeTab === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}...`
                        : `Submit ${activeTab === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`}
                    </span>
                  </button>
                </div>

              </div>
            </div>

            {/* Collapsible Device & Geolocation Settings Drawer */}
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-3 space-y-2">
              <div 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between cursor-pointer select-none group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Terminal & Geolocation Parameters</h3>
                    <p className="text-[10px] text-slate-400 leading-tight">Device ID, Geofence coordinates & network metadata</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold group-hover:bg-slate-200 transition-all">
                  <span>{showAdvanced ? 'Hide Parameters' : 'View / Edit Parameters'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : 'rotate-0'}`} />
                </div>
              </div>

              {/* Accordion Container */}
              <div className={`grid transition-all duration-300 ease-in-out ${
                showAdvanced ? 'grid-rows-[1fr] opacity-100 pt-2 border-t border-slate-100' : 'grid-rows-[0fr] opacity-0 pt-0 border-t-0'
              }`}>
                <div className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Attendance Source</label>
                      <input
                        type="text"
                        value={formData.attendanceSource}
                        onChange={(e) => handleInputChange('attendanceSource', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Attendance Mode</label>
                      <input
                        type="text"
                        value={formData.attendanceMode}
                        onChange={(e) => handleInputChange('attendanceMode', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Device ID</label>
                      <input
                        type="text"
                        value={formData.deviceId}
                        onChange={(e) => handleInputChange('deviceId', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Device Name</label>
                      <input
                        type="text"
                        value={formData.deviceName}
                        onChange={(e) => handleInputChange('deviceName', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">IP Address</label>
                      <input
                        type="text"
                        value={formData.ipAddress}
                        onChange={(e) => handleInputChange('ipAddress', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={(e) => handleInputChange('latitude', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={(e) => handleInputChange('longitude', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Recent Session Activity Feed & Metrics (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Session Stats Strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Logs</span>
                <span className="text-base font-extrabold text-slate-900 font-mono">{totalCount}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Check-Ins</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono">{checkInCount}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs text-center">
                <span className="text-[10px] uppercase font-bold text-amber-600 block">Check-Outs</span>
                <span className="text-base font-extrabold text-amber-700 font-mono">{checkOutCount}</span>
              </div>
            </div>

            {/* Activity Stream Card */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 sm:p-5 flex flex-col justify-between">
              <div>
                {/* Stream Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-600" />
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Session Activity Stream</h3>
                      <p className="text-[10px] text-slate-400">Live punches recorded for today</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchTodayPunchLogs()}
                    disabled={isRefreshingLogs}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                    title="Refresh logs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLogs ? 'animate-spin text-cyan-600' : ''}`} />
                  </button>
                </div>

                {/* Search & Filter Tabs */}
                <div className="py-2.5 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Search by Employee ID, Name or note..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5">
                    {(['ALL', 'CHECK_IN', 'CHECK_OUT'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setLogFilterTab(tab)}
                        className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold transition cursor-pointer ${
                          logFilterTab === tab
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab === 'ALL' ? 'All Activity' : tab === 'CHECK_IN' ? 'Check-Ins' : 'Check-Outs'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logs List */}
                {filteredPunchLogs.length === 0 ? (
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 my-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <Activity className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">No punches logged yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-[240px]">
                      {logSearchQuery ? 'No punches match your search filter.' : 'Punches made during this session will stream here in real-time.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto no-scrollbar pr-0.5 pt-1">
                    {filteredPunchLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50/90 transition-all flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold ${
                            log.type === 'CHECK_IN' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.type === 'CHECK_IN' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {log.employeeName || `Employee #${log.employeeId}`}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 font-bold">
                                #{log.employeeId}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                log.type === 'CHECK_IN' 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {log.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5 truncate">
                              <span className="truncate">{log.remarks || 'Standard shift punch'}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px]">{log.location}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-slate-800 block">
                            {log.timestamp}
                          </span>
                          <span className="text-[9.5px] text-emerald-600 font-bold inline-flex items-center gap-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Logged
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    </>
  );
};

export default AttendancePunchPage;

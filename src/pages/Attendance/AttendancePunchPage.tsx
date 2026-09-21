import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  LogIn, LogOut, Monitor, 
  Clock, ChevronDown, Layers, CheckCircle, 
  RefreshCw, Loader2
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
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

// Helper to extract initials safely
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

  // Table Filter Tabs
  const [logFilterTab, setLogFilterTab] = useState<'ALL' | 'CHECK_IN' | 'CHECK_OUT'>('ALL');

  // Employee Directory state
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

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

  // Safe string extractor
  const extractString = (val: any, fallback: string): string => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.name || val.title || val.departmentName || val.designationName || fallback;
    }
    return String(val);
  };

  // Fetch Employee Directory
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
    const targetEmpId = Number(formData.employeeId) || currentUser.id;
    if (!targetEmpId) {
      ToasterService.error('Active employee session not found. Please refresh or log in again.');
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
        remarks: type === 'CHECK_IN' ? 'Shift Check-In' : 'Shift Check-Out'
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

  // Filtered Punch Logs for ReusableTable
  const filteredPunchLogs = useMemo(() => {
    if (logFilterTab === 'ALL') return punchLogs;
    return punchLogs.filter(log => log.type === logFilterTab);
  }, [punchLogs, logFilterTab]);

  // ReusableTable Columns Definition
  const columns = useMemo<ColumnDef<PunchLogEntry>[]>(() => [
    {
      key: 'employeeName',
      label: 'Employee',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-[#222222] border border-cyan-200 dark:border-[#303030] text-cyan-700 dark:text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0">
            {getInitials(row.employeeName)}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {row.employeeName || `Employee #${row.employeeId}`}
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-gray-400">
              ID: #{row.employeeId}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Punch Type',
      sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
          row.type === 'CHECK_IN'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
        }`}>
          {row.type === 'CHECK_IN' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
          {row.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
        </span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Punch Time',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono font-medium text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500" />
          {row.timestamp}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Terminal & Location',
      render: (row) => (
        <div>
          <div className="text-xs text-slate-700 dark:text-gray-300 font-medium">
            {row.location}
          </div>
          <div className="text-[10px] font-mono text-slate-400 dark:text-gray-500">
            {row.deviceName} (#{row.deviceId})
          </div>
        </div>
      ),
    },
    {
      key: 'remarks',
      label: 'Remarks',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-gray-400">
          {row.remarks || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          Recorded
        </span>
      ),
    },
  ], []);

  const totalCount = punchLogs.length;
  const checkInCount = punchLogs.filter(l => l.type === 'CHECK_IN').length;
  const checkOutCount = punchLogs.filter(l => l.type === 'CHECK_OUT').length;

  return (
    <>
      <PageMeta title="Attendance Punch Station" description="Record employee check-in and check-out attendance punches" />
      <PageBreadcrumb pageTitle="Attendance Punch Station" />

      <div className="max-w-7xl mx-auto pb-8 space-y-4 animate-in fade-in duration-200">
        
        {/* ── 1. TOP HEADER: ATTENDANCE PUNCH STATION BANNER ──────────────── */}
        <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/80 dark:border-[#303030] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] flex items-center justify-center text-slate-700 dark:text-gray-200 shadow-2xs shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {selectedEmployee?.name || currentUser.name}
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300 font-semibold border border-slate-200 dark:border-[#303030]">
                  #{currentUser.id}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] text-slate-600 dark:text-gray-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Station Online
                </span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span>Web & Kiosk Terminal</span>
                <span className="text-slate-300 dark:text-gray-600">•</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-gray-300">Device #{formData.deviceId} ({formData.deviceName})</span>
                <span className="hidden sm:inline text-slate-300 dark:text-gray-600">•</span>
                <span className="hidden sm:inline text-slate-500 dark:text-gray-400 text-[11px]">Location: {formData.location}</span>
              </p>
            </div>
          </div>

          {/* Live Digital Clock Card */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-slate-50/80 dark:bg-[#222222] border border-slate-200/80 dark:border-[#303030] rounded-xl px-4 py-2 text-right">
              <div className="text-[11px] font-medium text-slate-500 dark:text-gray-400 tracking-normal flex items-center justify-end gap-1.5">
                <Clock className="w-3 h-3 text-slate-400 dark:text-gray-500" />
                <span>{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="text-base sm:text-lg font-mono font-bold text-slate-900 dark:text-white tracking-tight">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. PUNCH CARD: MINIMAL MODE SELECTOR & PUNCH ACTION ─────────── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] p-4 sm:p-5 space-y-4">
          
          {/* Mode Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CHECK-IN CARD */}
            <div
              onClick={() => setActiveTab('CHECK_IN')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between select-none ${
                activeTab === 'CHECK_IN'
                  ? 'bg-cyan-600 border-cyan-600 text-white shadow-sm ring-2 ring-cyan-500/20'
                  : 'bg-white dark:bg-[#222222] border-slate-200 dark:border-[#303030] hover:border-cyan-500/40 text-slate-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all ${
                  activeTab === 'CHECK_IN'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-[#191919] text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-[#303030]'
                }`}>
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className={`text-xs font-bold tracking-wide ${activeTab === 'CHECK_IN' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      CHECK-IN
                    </h3>
                    {activeTab === 'CHECK_IN' && (
                      <span className="text-[10px] font-bold bg-white/20 text-white border border-white/30 px-1.5 py-0.2 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${activeTab === 'CHECK_IN' ? 'text-cyan-50' : 'text-slate-500 dark:text-gray-400'}`}>
                    Start work shift & record entry
                  </p>
                </div>
              </div>

              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                activeTab === 'CHECK_IN' ? 'border-white bg-white' : 'border-slate-300 dark:border-gray-600'
              }`}>
                {activeTab === 'CHECK_IN' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />}
              </div>
            </div>

            {/* CHECK-OUT CARD */}
            <div
              onClick={() => setActiveTab('CHECK_OUT')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between select-none ${
                activeTab === 'CHECK_OUT'
                  ? 'bg-cyan-600 border-cyan-600 text-white shadow-sm ring-2 ring-cyan-500/20'
                  : 'bg-white dark:bg-[#222222] border-slate-200 dark:border-[#303030] hover:border-cyan-500/40 text-slate-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold transition-all ${
                  activeTab === 'CHECK_OUT'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-[#191919] text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-[#303030]'
                }`}>
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className={`text-xs font-bold tracking-wide ${activeTab === 'CHECK_OUT' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      CHECK-OUT
                    </h3>
                    {activeTab === 'CHECK_OUT' && (
                      <span className="text-[10px] font-bold bg-white/20 text-white border border-white/30 px-1.5 py-0.2 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${activeTab === 'CHECK_OUT' ? 'text-cyan-50' : 'text-slate-500 dark:text-gray-400'}`}>
                    End work shift & record exit
                  </p>
                </div>
              </div>

              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                activeTab === 'CHECK_OUT' ? 'border-white bg-white' : 'border-slate-300 dark:border-gray-600'
              }`}>
                {activeTab === 'CHECK_OUT' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />}
              </div>
            </div>
          </div>

          {/* Primary Cyan Punch Action Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => handlePunch(activeTab)}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : activeTab === 'CHECK_IN' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>
                {isSubmitting
                  ? `Recording ${activeTab === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}...`
                  : `Submit ${activeTab === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`}
              </span>
            </button>
          </div>


        </div>

        {/* ── 3. TERMINAL & GEOLOCATION PARAMETERS (COLLAPSIBLE DRAWER) ───── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] p-4 space-y-2">
          <div 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] flex items-center justify-center text-slate-600 dark:text-gray-300 group-hover:bg-slate-100 dark:group-hover:bg-[#2a2a2a] transition-colors">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Terminal & Geolocation Parameters</h3>
                <p className="text-[11px] text-slate-400 dark:text-gray-500 leading-tight">Device ID, Geofence coordinates & network metadata</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#222222] text-slate-700 dark:text-gray-300 text-xs font-semibold group-hover:bg-slate-100 dark:group-hover:bg-[#2a2a2a] transition-all border border-slate-200/80 dark:border-[#303030]">
              <span>{showAdvanced ? 'Hide Parameters' : 'View / Edit Parameters'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : 'rotate-0'}`} />
            </div>
          </div>

          {/* Collapsible Content */}
          <div className={`grid transition-all duration-300 ease-in-out ${
            showAdvanced ? 'grid-rows-[1fr] opacity-100 pt-3 border-t border-slate-100 dark:border-[#303030]' : 'grid-rows-[0fr] opacity-0 pt-0 border-t-0'
          }`}>
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Attendance Source</label>
                  <input
                    type="text"
                    value={formData.attendanceSource}
                    onChange={(e) => handleInputChange('attendanceSource', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Attendance Mode</label>
                  <input
                    type="text"
                    value={formData.attendanceMode}
                    onChange={(e) => handleInputChange('attendanceMode', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Device ID</label>
                  <input
                    type="text"
                    value={formData.deviceId}
                    onChange={(e) => handleInputChange('deviceId', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Device Name</label>
                  <input
                    type="text"
                    value={formData.deviceName}
                    onChange={(e) => handleInputChange('deviceName', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">IP Address</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => handleInputChange('ipAddress', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleInputChange('latitude', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleInputChange('longitude', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. ATTENDANCE HISTORY TABLE ─────────────────────────────────── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] p-4 sm:p-5 space-y-4">
          
          {/* Table Header with Filters & Refresh */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#303030]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase text-slate-800 dark:text-white tracking-wider">
                  Attendance History
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300 font-semibold border border-slate-200 dark:border-[#303030]">
                  {totalCount} Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">
                Real-time log of recorded shift check-ins and check-outs
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] p-1 rounded-xl border border-slate-200/80 dark:border-[#303030]">
                <button
                  type="button"
                  onClick={() => setLogFilterTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    logFilterTab === 'ALL'
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilterTab('CHECK_IN')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    logFilterTab === 'CHECK_IN'
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Check-Ins ({checkInCount})
                </button>
                <button
                  type="button"
                  onClick={() => setLogFilterTab('CHECK_OUT')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    logFilterTab === 'CHECK_OUT'
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Check-Outs ({checkOutCount})
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => fetchTodayPunchLogs()}
                disabled={isRefreshingLogs}
                className="p-2 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition cursor-pointer disabled:opacity-50"
                title="Refresh history"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingLogs ? 'animate-spin text-cyan-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* ReusableTable */}
          <ReusableTable
            data={filteredPunchLogs}
            columns={columns}
            loading={isRefreshingLogs}
            searchable={true}
            searchPlaceholder="Search employee, remarks, device..."
            pageSize={10}
            defaultSortKey="id"
            defaultSortOrder="desc"
          />

        </div>

      </div>
    </>
  );
};

export default AttendancePunchPage;

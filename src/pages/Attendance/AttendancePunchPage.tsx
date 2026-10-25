import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  LogIn, LogOut, 
  Clock, ChevronDown, Layers, CheckCircle, 
  RefreshCw, Loader2
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { TOOL_BUTTON } from '../Payroll/hrmsUi';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';

const CHECK_IN_URL = '/v1/api/attendance/records/check-in';
const CHECK_OUT_URL = '/v1/api/attendance/records/check-out';

// Stable per-browser id, informational only (the server records IP and user agent itself)
const getBrowserDeviceId = (): string => {
  try {
    let id = localStorage.getItem('punchDeviceId');
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Date.now())).slice(0, 18);
      localStorage.setItem('punchDeviceId', id);
    }
    return id;
  } catch {
    return 'browser';
  }
};

// Current GPS position, or null when unavailable or denied (the server decides if it is required)
const getBrowserPosition = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });

interface AttendancePayload {
  employeeId?: number;
  attendanceSource: string;
  attendanceMode: string;
  deviceId: string;
  deviceName: string;
  location: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  remarks?: string;
}

interface PunchLogEntry {
  id: number;
  type: 'CHECK_IN' | 'CHECK_OUT';
  employeeId?: number;
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

  // Only ever the signed-in employee (see below)
  const employees: EmployeeItem[] = useMemo(() => [], []);

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Current logged in user
  // Own employee identity from the login token (no hard-coded ids)
  const currentUser = useCurrentEmployee();

  const [formData, setFormData] = useState<AttendancePayload>({
    attendanceSource: 'WEB',
    attendanceMode: 'OFFICE',
    deviceId: getBrowserDeviceId(),
    deviceName: navigator.userAgent.slice(0, 120),
    location: '',
    remarks: 'Shift Check-In'
  });

  const [punchLogs, setPunchLogs] = useState<PunchLogEntry[]>([]);

  // Punches are always the signed-in employee's own (the server takes the employee from the token),
  // so no employee directory is loaded; plain employees may not read it anyway

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
      // The signed-in employee's record for today, one log line per recorded punch
      const res = await axios.get('/v1/api/attendance/records/today', { timeout: 4000 });
      const records = Array.isArray(res.data) ? res.data : [];
      const mappedLogs: PunchLogEntry[] = records.flatMap((record: any) =>
        (Array.isArray(record.punches) ? record.punches : []).map((punch: any, index: number) => ({
          id: Number(`${record.id || 0}${index}`) || Date.now() + index,
          type: punch.type === 'OUT' || punch.type === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN',
          employeeId: record.employeeId,
          employeeName: record.employeeName || currentUser.name,
          timestamp: punch.time ? new Date(punch.time).toLocaleTimeString() : '—',
          attendanceSource: punch.source || '—',
          attendanceMode: punch.mode || record.attendanceMode || '—',
          deviceId: '—',
          deviceName: punch.deviceName || '—',
          location: punch.location || '—',
          coordinates: punch.latitude != null ? `${punch.latitude}, ${punch.longitude}` : '—',
          ipAddress: punch.ipAddress || '—',
          remarks: record.remarks || '',
          status: 'Success'
        }))
      );
      setPunchLogs(mappedLogs.reverse());
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
    if (!currentUser.hasEmployee) {
      ToasterService.error('No employee record is linked to your account.');
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = type === 'CHECK_IN' ? CHECK_IN_URL : CHECK_OUT_URL;
      
      const position = await getBrowserPosition();
      const payload: AttendancePayload = {
        attendanceSource: formData.attendanceSource,
        attendanceMode: formData.attendanceMode,
        deviceId: formData.deviceId,
        deviceName: formData.deviceName,
        location: formData.location,
        latitude: position?.latitude,
        longitude: position?.longitude,
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

      const empName = selectedEmployee ? selectedEmployee.name : (currentUser.name || 'Employee');

      const newEntry: PunchLogEntry = {
        id: Date.now(),
        type: type,
        employeeId: currentUser.id,
        employeeName: empName,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        attendanceSource: payload.attendanceSource,
        attendanceMode: payload.attendanceMode,
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        location: payload.location,
        coordinates: position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : '—',
        ipAddress: 'Recorded by server',
        remarks: payload.remarks || (type === 'CHECK_IN' ? 'Shift Check-In' : 'Shift Check-Out'),
        status: 'Success'
      };

      setPunchLogs((prev) => [newEntry, ...prev]);
      fetchTodayPunchLogs();

      ToasterService.success(
        type === 'CHECK_IN' 
          ? `Check-In successfully recorded for ${empName}!` 
          : `Check-Out successfully recorded for ${empName}!`
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
              {row.employeeName || 'Employee'}
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
      <PageBreadcrumb
        pageTitle="Attendance Punch Station"
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-gray-300" title={`Location: ${formData.location}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Online · <span className="font-mono max-w-[120px] truncate" title={`Device #${formData.deviceId} (${formData.deviceName})`}>Device #{formData.deviceId}</span>
            </span>
            <span className={TOOL_BUTTON}>
              <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
            </span>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto pb-2 space-y-3 animate-in fade-in duration-200">

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
              <p className="pb-2 text-[11px] text-slate-500 dark:text-gray-400">
                Your location is read from this device when you punch. IP address and device are recorded by the server.
              </p>
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
                  <select
                    value={formData.attendanceMode}
                    onChange={(e) => handleInputChange('attendanceMode', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-mono text-slate-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  >
                    <option value="OFFICE">Office</option>
                    <option value="WORK_FROM_HOME">Work from home</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ON_DUTY">On duty</option>
                  </select>
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

              {/* Toolbar */}
              <TableToolbar onRefresh={() => fetchTodayPunchLogs()} />
            </div>
          </div>

          {/* ReusableTable */}
          <ReusableTable
            data={filteredPunchLogs}
            columns={columns}
            loading={isRefreshingLogs}
            pageSize={10}
            defaultSortKey="id"
            defaultSortOrder="desc"
            emptyState={<p className="py-6 text-center text-xs text-slate-400 dark:text-gray-500">No punches recorded yet.</p>}
          />

        </div>

      </div>
    </>
  );
};

export default AttendancePunchPage;

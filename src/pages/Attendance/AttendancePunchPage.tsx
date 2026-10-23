import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import axios from 'axios';
import { 
  LogIn, LogOut, Monitor, 
  Clock, CheckCircle, 
  Loader2, MapPin, Wifi,
  Calendar, Settings2, X, RotateCcw, Check, Crosshair,
  Building2, Tag, UserCheck
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';
import { fetchAttendanceEnums, EnumItem } from '../../Services/AttendanceEnumService';
import { AuthContext } from '../../context/AuthContext';

const CHECK_IN_URL = '/v1/api/attendance/records/check-in';
const CHECK_OUT_URL = '/v1/api/attendance/records/check-out';

const DEFAULT_SOURCE_ENUMS: EnumItem[] = [
  { code: 'WEB', label: 'WEB (Web Browser / Self-Service)' },
  { code: 'BIOMETRIC', label: 'BIOMETRIC (Fingerprint / Face)' },
  { code: 'MOBILE_APP', label: 'MOBILE_APP (Mobile Check-In)' },
  { code: 'WFH', label: 'WFH (Work From Home)' },
  { code: 'MANUAL', label: 'MANUAL (Manual Log)' },
  { code: 'SYSTEM', label: 'SYSTEM (Automated System)' },
  { code: 'REGURALIZATION', label: 'REGURALIZATION (Regularization)' },
];

const DEFAULT_MODE_ENUMS: EnumItem[] = [
  { code: 'OFFICE', label: 'OFFICE (On-Premises)' },
  { code: 'WORK_FROM_HOME', label: 'WORK_FROM_HOME (Work From Home)' },
  { code: 'HYBRID', label: 'HYBRID (Flex Attendance)' },
  { code: 'ON_DUTY', label: 'ON_DUTY (Field / Client Visit)' },
  { code: 'LEAVE', label: 'LEAVE (On Leave)' },
];

const QUICK_REMARK_TAGS = ['Regular Shift', 'Client Meeting', 'Late Entry', 'Work From Home', 'Half Day'];

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

interface TerminalConfig {
  attendanceSource: string;
  attendanceMode: string;
  deviceId: string;
  deviceName: string;
  location: string;
  latitude: number;
  longitude: number;
  ipAddress: string;
}

const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  attendanceSource: 'WEB',
  attendanceMode: 'OFFICE',
  deviceId: '124566',
  deviceName: 'HYD_RMZ_12456',
  location: 'HYD',
  latitude: 17.3850,
  longitude: 78.4867,
  ipAddress: '192.168.1.100'
};

const getSavedTerminalConfig = (): TerminalConfig => {
  try {
    const saved = localStorage.getItem('attendance_terminal_config');
    if (saved) {
      return { ...DEFAULT_TERMINAL_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return DEFAULT_TERMINAL_CONFIG;
};

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

interface LoggedInEmployee {
  id: number;
  name: string;
  code: string;
  department: string;
  designation: string;
  email?: string;
  initials: string;
}

// Helper to extract initials safely
const getInitials = (name?: string): string => {
  if (!name) return 'EM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

// Safe string extractor
const extractString = (val: any, fallback: string): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.title || val.departmentName || val.designationName || fallback;
  }
  return String(val);
};

/* ── 1. ISOLATED LIVE CLOCK COMPONENT ─────────────────────────────────────── */
const LiveClock = React.memo(({ location, attendanceMode }: { location: string; attendanceMode: string }) => {
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center py-3 bg-gradient-to-b from-cyan-50/50 via-slate-50 to-slate-100/40 dark:from-[#202020] dark:via-[#1c1c1c] dark:to-[#181818] rounded-2xl border border-cyan-100/80 dark:border-[#2d2d2d] p-4 shadow-2xs transition-all">
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-800 dark:text-cyan-400 mb-1.5">
        <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
        <span>
          {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
      <div className="text-3xl sm:text-4xl font-mono font-extrabold text-slate-900 dark:text-white tracking-tight">
        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      </div>
      <div className="flex items-center justify-center gap-2 mt-2.5 text-[11px] text-slate-500 dark:text-gray-400 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-[#252525] border border-slate-200/60 dark:border-transparent font-medium shadow-2xs">
          <MapPin className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
          {location} Terminal
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold shadow-2xs">
          <Wifi className="w-3 h-3 text-emerald-500" />
          {attendanceMode}
        </span>
      </div>
    </div>
  );
});

/* ── 2. ISOLATED TERMINAL CONFIG MODAL COMPONENT ───────────────────────────── */
interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: TerminalConfig;
  onSave: (config: TerminalConfig) => void;
  sourceOptions: EnumItem[];
  modeOptions: EnumItem[];
}

const TerminalConfigModal = React.memo(({
  isOpen,
  onClose,
  initialConfig,
  onSave,
  sourceOptions,
  modeOptions
}: ConfigModalProps) => {
  const [tempConfig, setTempConfig] = useState<TerminalConfig>(initialConfig);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  useEffect(() => {
    setTempConfig(initialConfig);
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
      ToasterService.error('Geolocation is not supported by your browser');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTempConfig((prev) => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6))
        }));
        setIsDetectingLocation(false);
        ToasterService.success('Coordinates updated from browser GPS');
      },
      (err) => {
        setIsDetectingLocation(false);
        ToasterService.error(`Location detection failed: ${err.message}`);
      },
      { timeout: 8000 }
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#303030] w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-[#262626] flex items-center justify-between bg-slate-50/70 dark:bg-[#202020]/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center shadow-2xs">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Terminal & Geofence Settings
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-gray-400">
                Station hardware ID, IP, location & source parameters
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#282828] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Hardware & Punch Source */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-2.5">
              <Monitor className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Hardware & Mode Parameters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Attendance Source
                </label>
                <select
                  value={tempConfig.attendanceSource}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, attendanceSource: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-medium text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {sourceOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Attendance Mode
                </label>
                <select
                  value={tempConfig.attendanceMode}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, attendanceMode: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-medium text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {modeOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Device ID
                </label>
                <input
                  type="text"
                  value={tempConfig.deviceId}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, deviceId: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 124566"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  value={tempConfig.deviceName}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, deviceName: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. HYD_RMZ_12456"
                />
              </div>
            </div>
          </div>

          {/* Network & Geofence Coordinates */}
          <div className="pt-3 border-t border-slate-100 dark:border-[#262626]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Location & Geofence</span>
              </div>
              <button
                type="button"
                onClick={handleAutoDetectLocation}
                disabled={isDetectingLocation}
                className="text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
              >
                {isDetectingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
                <span>Auto-Detect GPS</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Location Label
                </label>
                <input
                  type="text"
                  value={tempConfig.location}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-medium text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. HYD Terminal"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  value={tempConfig.ipAddress}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, ipAddress: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 192.255.26.1"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={tempConfig.latitude}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={tempConfig.longitude}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:px-6 bg-slate-50 dark:bg-[#202020] border-t border-slate-100 dark:border-[#262626] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setTempConfig({ ...DEFAULT_TERMINAL_CONFIG });
              ToasterService.info('Reset to default station parameters');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-200/60 dark:hover:bg-[#2c2c2c] rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(tempConfig)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-2xs transition cursor-pointer active:scale-98"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── 3. MAIN ATTENDANCE PUNCH PAGE COMPONENT ─────────────────────────────── */
const AttendancePunchPage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  // Table Filter Tabs
  const [logFilterTab, setLogFilterTab] = useState<'ALL' | 'CHECK_IN' | 'CHECK_OUT'>('ALL');

  // Dynamic Enum State for Attendance Source and Mode
  const [sourceOptions, setSourceOptions] = useState<EnumItem[]>(DEFAULT_SOURCE_ENUMS);
  const [modeOptions, setModeOptions] = useState<EnumItem[]>(DEFAULT_MODE_ENUMS);

  // Dynamic Currently Logged In User State
  const [currentUser, setCurrentUser] = useState<LoggedInEmployee>(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        const name = (parsed.fullName || parsed.name || parsed.username || 'System Admin').trim();
        const rawId = parsed.employeeId || parsed.id || parsed.userId || 12;
        const numId = Number(rawId) || 12;
        return {
          id: numId,
          name: name,
          code: parsed.employeeCode || `EMP-${numId}`,
          department: parsed.department || 'Operations',
          designation: parsed.role || parsed.roles?.[0] || 'Administrator',
          email: parsed.email || '',
          initials: getInitials(name)
        };
      } catch (e) {}
    }
    return {
      id: 12,
      name: 'System Admin',
      code: 'EMP-12',
      department: 'Operations',
      designation: 'Administrator',
      email: 'admin@system.com',
      initials: 'SA'
    };
  });

  const [formData, setFormData] = useState<AttendancePayload>(() => {
    const saved = getSavedTerminalConfig();
    return {
      employeeId: currentUser.id || 12,
      ...saved,
      remarks: ''
    };
  });

  const [punchLogs, setPunchLogs] = useState<PunchLogEntry[]>([]);

  // Fetch dynamic enums from GET /v1/api/attendance/enums
  useEffect(() => {
    let isMounted = true;
    const loadEnums = async () => {
      const [sources, modes] = await Promise.all([
        fetchAttendanceEnums('ATTENDANCE_SOURCE', DEFAULT_SOURCE_ENUMS),
        fetchAttendanceEnums('ATTENDANCE_MODE', DEFAULT_MODE_ENUMS)
      ]);
      if (isMounted) {
        setSourceOptions(sources);
        setModeOptions(modes);
      }
    };
    loadEnums();
    return () => { isMounted = false; };
  }, []);

  // Fetch currently logged in user & resolve employee directory record dynamically
  useEffect(() => {
    let isMounted = true;
    const resolveLoggedInEmployee = async () => {
      try {
        const authUser = user || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null);
        const uName = (authUser?.fullName || authUser?.name || authUser?.username || '').trim().toLowerCase();
        const uEmail = (authUser?.email || '').trim().toLowerCase();
        const uId = Number(authUser?.employeeId || authUser?.id || authUser?.userId || 0);

        const res = await axios.get('/v1/api/payroll/employee/all');
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          // Attempt exact matching on email, id, or full name
          const match = res.data.find((e: any) => {
            const eEmail = (e.email || '').trim().toLowerCase();
            const eName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase() || (e.name || '').trim().toLowerCase();
            const eId = Number(e.id || 0);
            const eUserId = Number(e.userId || 0);

            if (uEmail && eEmail === uEmail) return true;
            if (uId > 0 && (eId === uId || eUserId === uId)) return true;
            if (uName && (eName.includes(uName) || uName.includes(eName))) return true;
            return false;
          });

          // Selected employee record
          const selected = match || res.data.find((e: any) => Number(e.id) === 12) || res.data[0];

          if (selected && selected.id) {
            const empName = `${selected.firstName || ''} ${selected.lastName || ''}`.trim() || selected.name || selected.fullName || authUser?.fullName || 'Employee';
            const empCode = selected.employeeCode || `EMP-${selected.id}`;
            const empDept = extractString(selected.departmentName || selected.department, 'Operations');
            const empDesig = extractString(selected.designationName || selected.designation, authUser?.role || 'Staff');
            const empId = Number(selected.id);

            const profile: LoggedInEmployee = {
              id: empId,
              name: empName,
              code: empCode,
              department: empDept,
              designation: empDesig,
              email: selected.email || authUser?.email,
              initials: getInitials(empName)
            };

            setCurrentUser(profile);
            setFormData(prev => ({
              ...prev,
              employeeId: empId
            }));
          }
        }
      } catch (err) {
        console.warn('Could not auto-resolve employee record from directory:', err);
      }
    };

    resolveLoggedInEmployee();
    return () => { isMounted = false; };
  }, [user]);

  // Fetch Saved Attendance Punch Logs from Backend API
  const fetchTodayPunchLogs = useCallback(async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await axios.get('/v1/api/attendance/records', { timeout: 4000 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mappedLogs: PunchLogEntry[] = res.data.map((item: any, index: number) => {
          const empId = Number(item.employeeId || item.empId || 0);
          return {
            id: item.id || Date.now() + index,
            type: item.checkOutTime ? 'CHECK_OUT' : 'CHECK_IN',
            employeeId: empId,
            employeeName: item.employeeName || (empId === currentUser.id ? currentUser.name : `Employee #${empId}`),
            timestamp: item.checkInTime || item.punchTime || item.createdDate || new Date().toLocaleTimeString(),
            attendanceSource: item.attendanceSource || 'WEB_PORTAL',
            attendanceMode: item.attendanceMode || 'OFFICE',
            deviceId: item.deviceId || '124566',
            deviceName: item.deviceName || 'HYD_RMZ_12456',
            location: item.location || 'HYD',
            coordinates: item.latitude ? `${item.latitude}, ${item.longitude}` : '17.3850, 78.4867',
            ipAddress: item.ipAddress || '192.168.1.100',
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
  }, [currentUser.id, currentUser.name]);

  useEffect(() => {
    fetchTodayPunchLogs();
  }, [fetchTodayPunchLogs]);

  const handleInputChange = useCallback((field: keyof AttendancePayload, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleOpenConfig = useCallback(() => {
    setIsConfigModalOpen(true);
  }, []);

  const handleCloseConfig = useCallback(() => {
    setIsConfigModalOpen(false);
  }, []);

  const handleSaveConfig = useCallback((newConfig: TerminalConfig) => {
    try {
      localStorage.setItem('attendance_terminal_config', JSON.stringify(newConfig));
    } catch (e) {}
    setFormData((prev) => ({
      ...prev,
      ...newConfig
    }));
    setIsConfigModalOpen(false);
    ToasterService.success('Station terminal configuration saved successfully');
  }, []);

  // Record Attendance Punch
  const handlePunch = useCallback(async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    const targetEmpId = Number(formData.employeeId) || currentUser.id;
    if (!targetEmpId) {
      ToasterService.error('Active employee session not found. Please refresh or log in again.');
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = type === 'CHECK_IN' ? CHECK_IN_URL : CHECK_OUT_URL;
      
      const punchRemarks = formData.remarks?.trim()
        ? formData.remarks.trim()
        : (type === 'CHECK_IN' ? 'Shift Check-In' : 'Shift Check-Out');

      const payload: any = {
        employeeId: targetEmpId,
        attendanceSource: formData.attendanceSource || 'WEB',
        attendanceMode: formData.attendanceMode || 'OFFICE',
        deviceId: formData.deviceId || 'Browser',
        deviceName: formData.deviceName || 'Terminal',
        location: formData.location || 'Office',
        latitude: Number(formData.latitude) || 17.3850,
        longitude: Number(formData.longitude) || 78.4867,
        ipAddress: formData.ipAddress || '192.168.1.100'
      };

      if (type === 'CHECK_OUT') {
        payload.remarks = punchRemarks;
      }

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

      const newEntry: PunchLogEntry = {
        id: Date.now(),
        type: type,
        employeeId: targetEmpId,
        employeeName: currentUser.name,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        attendanceSource: payload.attendanceSource,
        attendanceMode: payload.attendanceMode,
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        location: payload.location,
        coordinates: `${payload.latitude}, ${payload.longitude}`,
        ipAddress: payload.ipAddress,
        remarks: punchRemarks,
        status: 'Success'
      };

      setPunchLogs((prev) => [newEntry, ...prev]);
      fetchTodayPunchLogs();
      setFormData((prev) => ({ ...prev, remarks: '' }));

      ToasterService.success(
        type === 'CHECK_IN' 
          ? `Check-In successfully recorded for ${currentUser.name}!` 
          : `Check-Out successfully recorded for ${currentUser.name}!`
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
  }, [formData, currentUser, fetchTodayPunchLogs]);

  // Single-pass computation for log statistics
  const logStats = useMemo(() => {
    let checkIn = 0;
    let checkOut = 0;
    for (let i = 0; i < punchLogs.length; i++) {
      if (punchLogs[i].type === 'CHECK_IN') checkIn++;
      else if (punchLogs[i].type === 'CHECK_OUT') checkOut++;
    }
    return {
      total: punchLogs.length,
      checkIn,
      checkOut
    };
  }, [punchLogs]);

  // Filtered Punch Logs for ReusableTable
  const filteredPunchLogs = useMemo(() => {
    if (logFilterTab === 'ALL') return punchLogs;
    return punchLogs.filter(log => log.type === logFilterTab);
  }, [punchLogs, logFilterTab]);

  // Filter logs for the currently logged in employee
  const employeePunches = useMemo(() => {
    return punchLogs.filter(p => Number(p.employeeId) === Number(currentUser.id));
  }, [punchLogs, currentUser.id]);

  const latestEmployeePunch = useMemo(() => {
    return employeePunches.length > 0 ? employeePunches[0] : null;
  }, [employeePunches]);

  const isClockedIn = useMemo(() => {
    return latestEmployeePunch?.type === 'CHECK_IN';
  }, [latestEmployeePunch]);

  // Automatically suggest the next logical punch action
  useEffect(() => {
    if (isClockedIn) {
      setActiveTab('CHECK_OUT');
    } else {
      setActiveTab('CHECK_IN');
    }
  }, [isClockedIn]);

  // ReusableTable Columns Definition
  const columns = useMemo<ColumnDef<PunchLogEntry>[]>(() => [
    {
      key: 'employeeName',
      label: 'Employee',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-[#222222] border border-cyan-200/80 dark:border-[#333333] text-cyan-700 dark:text-cyan-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {getInitials(row.employeeName)}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {row.employeeName || 'Employee'}
            </div>
            <div className="text-[10px] font-mono text-slate-400 dark:text-gray-400">
              #{row.employeeId}
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
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60'
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
          <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          {row.timestamp}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Terminal & Mode',
      render: (row) => (
        <div>
          <div className="text-xs text-slate-700 dark:text-gray-300 font-medium">
            {row.location} Terminal
          </div>
          <div className="text-[10px] font-mono text-slate-400 dark:text-gray-500">
            {row.attendanceMode} • {row.deviceName}
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
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          Verified
        </span>
      ),
    },
  ], []);

  // Modal initial config memo
  const currentTerminalConfig = useMemo<TerminalConfig>(() => ({
    attendanceSource: formData.attendanceSource,
    attendanceMode: formData.attendanceMode,
    deviceId: formData.deviceId,
    deviceName: formData.deviceName,
    location: formData.location,
    latitude: Number(formData.latitude),
    longitude: Number(formData.longitude),
    ipAddress: formData.ipAddress
  }), [
    formData.attendanceSource,
    formData.attendanceMode,
    formData.deviceId,
    formData.deviceName,
    formData.location,
    formData.latitude,
    formData.longitude,
    formData.ipAddress
  ]);

  return (
    <>
      <PageMeta title="Attendance Punch Station" description="Record employee check-in and check-out attendance punches" />
      <PageBreadcrumb pageTitle="Attendance Punch Station" />

      <div className="max-w-7xl mx-auto pb-6 space-y-4 animate-in fade-in duration-200">
        
        {/* ── 1. UNIFIED THEMED HERO BANNER ──────────────────────────────── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-transparent shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
          
          {/* Left: Station Identity & Online Badge */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200/80 dark:border-cyan-800/60 flex items-center justify-center shrink-0 shadow-2xs">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Attendance Punch Station
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Station Online
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                {formData.deviceName} • Device #{formData.deviceId} • {formData.location} Terminal
              </p>
            </div>
          </div>

          {/* Right: Currently Logged In User Profile & Config Action */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap sm:flex-nowrap">
            
            {/* Live User Identity Card */}
            <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-[#222222] px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-transparent shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                {currentUser.initials}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/50">
                    {currentUser.designation}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10.5px] text-slate-400 dark:text-gray-400 font-mono mt-0.5">
                  <span>#{currentUser.code}</span>
                  <span>•</span>
                  <span className="font-sans flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {currentUser.department}
                  </span>
                </div>
              </div>
            </div>

            {/* Station Hardware Config Button */}
            <button
              type="button"
              onClick={handleOpenConfig}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-gray-200 bg-white hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-slate-200/80 dark:border-transparent shadow-2xs transition-all cursor-pointer"
              title="Station Terminal & Geofence Settings"
            >
              <Settings2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Config</span>
            </button>
          </div>
        </div>

        {/* ── 2. TWO-COLUMN BALANCED DASHBOARD ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* ── LEFT COLUMN: PUNCH CONSOLE (5 COLS) ──────────── */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-transparent p-5 space-y-4">
              
              {/* Isolated Live Clock Display */}
              <LiveClock location={formData.location} attendanceMode={formData.attendanceMode} />

              {/* Dynamic Employee Shift Status Banner */}
              <div className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-2xs ${
                isClockedIn 
                  ? 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-800/50' 
                  : 'bg-slate-50 border-slate-200/80 dark:bg-[#222222] dark:border-transparent'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold shadow-2xs ${
                    isClockedIn 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-200 dark:bg-[#2c2c2c] text-slate-600 dark:text-gray-300'
                  }`}>
                    {isClockedIn ? <LogIn className="w-4.5 h-4.5" /> : <LogOut className="w-4.5 h-4.5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500 block">
                      CURRENT SHIFT STATUS
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {isClockedIn 
                        ? `Clocked In (${latestEmployeePunch?.timestamp || 'Active Today'})` 
                        : 'Currently Clocked Out'}
                    </h4>
                  </div>
                </div>

                <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0 border ${
                  isClockedIn 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700' 
                    : 'bg-slate-200/60 text-slate-600 border-slate-300/60 dark:bg-[#2c2c2c] dark:text-gray-300 dark:border-transparent'
                }`}>
                  {isClockedIn ? 'Active On Shift' : 'Off Shift'}
                </span>
              </div>

              {/* Segmented Check-In / Check-Out Mode Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-gray-400 px-0.5">
                  <span>Select Punch Action</span>
                  <span className="text-[10px] text-slate-400">
                    {activeTab === 'CHECK_IN' ? 'Ready to Start Shift' : 'Ready to End Shift'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 dark:bg-[#222222] rounded-xl border border-slate-200/60 dark:border-transparent">
                  <button
                    type="button"
                    onClick={() => setActiveTab('CHECK_IN')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                      activeTab === 'CHECK_IN'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Check-In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('CHECK_OUT')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 ${
                      activeTab === 'CHECK_OUT'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Check-Out</span>
                  </button>
                </div>
              </div>

              {/* Hero Punch Action Button */}
              <div>
                {activeTab === 'CHECK_IN' ? (
                  <button
                    type="button"
                    onClick={() => handlePunch('CHECK_IN')}
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? 'Recording Check-In...' : `Record Check-In for ${currentUser.name}`}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePunch('CHECK_OUT')}
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? 'Recording Check-Out...' : `Record Check-Out for ${currentUser.name}`}</span>
                  </button>
                )}
              </div>

              {/* Optional Punch Remarks Input & Quick Tags */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#262626]">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 block">
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular shift, client meeting, late entry..."
                  value={formData.remarks || ''}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200/80 dark:border-transparent rounded-xl text-slate-800 dark:text-gray-200 placeholder-slate-400 outline-none focus:ring-1 focus:ring-cyan-500"
                />

                {/* Quick Suggestion Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 flex items-center gap-0.5">
                    <Tag className="w-2.5 h-2.5" /> Quick:
                  </span>
                  {QUICK_REMARK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInputChange('remarks', tag)}
                      className="px-2 py-0.5 text-[10.5px] rounded-lg bg-slate-100 dark:bg-[#262626] hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-300 text-slate-600 dark:text-gray-400 transition cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT COLUMN: TODAY'S PUNCH ACTIVITY & AUDIT LOGS (7 COLS) ─ */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-transparent p-5 space-y-4">
              
              {/* Header with Filter Tabs & Refresh Toolbar */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#262626]">
                <div className="shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase text-slate-900 dark:text-white tracking-wider whitespace-nowrap">
                      Today's Punch History
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-[#222222] text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-200/60 dark:border-transparent shrink-0">
                      {logStats.total} Total
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400 dark:text-gray-500 mt-0.5">
                    Live chronological audit of recorded shift entries and exits
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start xl:justify-end min-w-0">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#222222] p-0.5 rounded-xl border border-slate-200/60 dark:border-transparent text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setLogFilterTab('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        logFilterTab === 'ALL'
                          ? 'bg-white dark:bg-[#2c2c2c] text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                      }`}
                    >
                      All ({logStats.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilterTab('CHECK_IN')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        logFilterTab === 'CHECK_IN'
                          ? 'bg-white dark:bg-[#2c2c2c] text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                      }`}
                    >
                      In ({logStats.checkIn})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilterTab('CHECK_OUT')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        logFilterTab === 'CHECK_OUT'
                          ? 'bg-white dark:bg-[#2c2c2c] text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                      }`}
                    >
                      Out ({logStats.checkOut})
                    </button>
                  </div>

                  <div className="shrink-0">
                    <TableToolbar onRefresh={() => fetchTodayPunchLogs()} />
                  </div>
                </div>
              </div>

              {/* Quick Summary Metric Bar */}
              <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200/60 dark:border-transparent text-center">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 block font-sans">Total Logs</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">{logStats.total}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200/60 dark:border-transparent text-center">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 block font-sans">Latest Punch</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs truncate block">
                    {latestEmployeePunch?.timestamp || 'None'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200/60 dark:border-transparent text-center">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 block font-sans">Current State</span>
                  <span className={`font-bold text-xs ${isClockedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-gray-300'}`}>
                    {isClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </span>
                </div>
              </div>

              {/* Table or Empty State */}
              {filteredPunchLogs.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 bg-slate-50/50 dark:bg-[#161616] rounded-2xl border border-dashed border-slate-200 dark:border-[#282828]">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-[#222222] text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-2.5 shadow-2xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-gray-200">
                    No Punches Recorded Today Yet
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1 max-w-xs">
                    Use the console on the left to record shift entries or exits for {currentUser.name}.
                  </p>
                </div>
              ) : (
                <ReusableTable
                  data={filteredPunchLogs}
                  columns={columns}
                  loading={isRefreshingLogs}
                  pageSize={8}
                  defaultSortKey="id"
                  defaultSortOrder="desc"
                />
              )}

            </div>
          </div>

        </div>

      </div>

      {/* ── 3. CONFIGURATION MODAL DIALOG ────────────────────────────────────── */}
      <TerminalConfigModal
        isOpen={isConfigModalOpen}
        onClose={handleCloseConfig}
        initialConfig={currentTerminalConfig}
        onSave={handleSaveConfig}
        sourceOptions={sourceOptions}
        modeOptions={modeOptions}
      />
    </>
  );
};

export default React.memo(AttendancePunchPage);

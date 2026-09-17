import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LogIn, LogOut, ShieldCheck, MapPin, Monitor, Server, 
  Globe, MessageSquare, User, Cpu, Clock, CheckCircle2, 
  Activity, ChevronDown, ChevronUp, Layers, CheckCircle
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

const AttendancePunchPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [formData, setFormData] = useState<AttendancePayload>({
    employeeId: '' as any,
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

  // Fetch Saved Attendance Punch Logs from Backend API
  const fetchTodayPunchLogs = async () => {
    try {
      const res = await axios.get('/v1/api/attendance/records');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mappedLogs: PunchLogEntry[] = res.data.map((item: any, index: number) => ({
          id: item.id || Date.now() + index,
          type: item.checkOutTime ? 'CHECK_OUT' : 'CHECK_IN',
          employeeId: item.employeeId || item.empId || 0,
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
        }));
        setPunchLogs(mappedLogs);
      }
    } catch (e) {
      console.warn("Could not fetch today punch logs:", e);
    }
  };

  useEffect(() => {
    fetchTodayPunchLogs();
  }, []);

  const handleInputChange = (field: keyof AttendancePayload, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePunch = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (!formData.employeeId) {
      ToasterService.error('Please enter a valid Employee ID');
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
        timeout: 5000
      });

      const newEntry: PunchLogEntry = {
        id: Date.now(),
        type: type,
        employeeId: payload.employeeId,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        attendanceSource: payload.attendanceSource,
        attendanceMode: payload.attendanceMode,
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        location: payload.location,
        coordinates: `${payload.latitude}, ${payload.longitude}`,
        ipAddress: payload.ipAddress,
        remarks: payload.remarks || '-',
        status: 'Success'
      };

      setPunchLogs((prev) => [newEntry, ...prev]);
      fetchTodayPunchLogs();

      ToasterService.success(
        type === 'CHECK_IN' 
          ? `Check-In recorded successfully for Employee #${payload.employeeId}` 
          : `Check-Out recorded successfully for Employee #${payload.employeeId}`
      );
    } catch (err: any) {
      console.error(err);
      let rawMsg = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to record attendance.';
      
      if (typeof rawMsg === 'object') {
        rawMsg = JSON.stringify(rawMsg);
      }
      
      let friendlyMsg = String(rawMsg);

      // Clean raw Feign/Spring Exception strings (e.g., "[400] during [GET] ... [{'error':'Employee not found with ID: 85'}]")
      if (friendlyMsg.includes('Employee not found with ID')) {
        const match = friendlyMsg.match(/Employee not found with ID:?\s*(\d+)?/i);
        const empId = match && match[1] ? match[1] : (formData.employeeId || '');
        friendlyMsg = `Employee not found with ID: ${empId}`;
      } else if (friendlyMsg.includes('during [') && friendlyMsg.includes('] to [')) {
        // Extract embedded error message if present
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

  const punchColumns: ColumnDef<PunchLogEntry>[] = [
    {
      key: 'id',
      label: 'Log ID',
      sortable: true,
      render: (row) => <span className="font-mono text-cyan-700 font-bold text-xs">#{row.id.toString().slice(-6)}</span>
    },
    {
      key: 'employeeId',
      label: 'Employee ID',
      sortable: true,
      render: (row) => <span className="font-bold text-slate-800 text-xs font-mono">#{row.employeeId}</span>
    },
    {
      key: 'type',
      label: 'Action',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
            row.type === 'CHECK_IN'
              ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
              : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
          }`}
        >
          {row.type === 'CHECK_IN' ? <LogIn className="w-3.5 h-3.5 text-cyan-600" /> : <LogOut className="w-3.5 h-3.5 text-indigo-600" />}
          {row.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
        </span>
      )
    },
    {
      key: 'timestamp',
      label: 'Recorded Time',
      sortable: true,
      render: (row) => <span className="text-slate-700 font-mono text-xs font-semibold">{row.timestamp}</span>
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Success
        </span>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Attendance Punch Station" description="Record employee check-in and check-out attendance punches" />
      <PageBreadcrumb pageTitle="Attendance Punch Station" />

      <div className="pb-3 animate-in fade-in duration-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          
          {/* LEFT COLUMN: Action Punch Terminal & Parameters */}
          <div className="lg:col-span-7 space-y-2.5">
            
            {/* Punch Action Card */}
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-4 space-y-3">
              
              {/* Action Mode Toggle Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    1. Select Action Mode
                  </label>

                  {/* Live Clock Badge */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                    <span className="text-[10.5px] text-slate-500 font-medium hidden sm:inline">
                      {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="hidden sm:inline text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-mono font-bold text-slate-800">
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Check-In Mode */}
                  <div
                    onClick={() => {
                      setActiveTab('CHECK_IN');
                      handleInputChange('remarks', 'Shift Check-In');
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      activeTab === 'CHECK_IN'
                        ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                        activeTab === 'CHECK_IN' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <LogIn className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold tracking-wide text-slate-900">CHECK-IN</h3>
                        <p className="text-[10px] text-slate-500">Record start of work shift</p>
                      </div>
                    </div>

                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      activeTab === 'CHECK_IN' ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                    }`}>
                      {activeTab === 'CHECK_IN' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  {/* Check-Out Mode */}
                  <div
                    onClick={() => {
                      setActiveTab('CHECK_OUT');
                      handleInputChange('remarks', 'Shift Check-Out');
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      activeTab === 'CHECK_OUT'
                        ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                        activeTab === 'CHECK_OUT' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <LogOut className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold tracking-wide text-slate-900">CHECK-OUT</h3>
                        <p className="text-[10px] text-slate-500">Record end of work shift</p>
                      </div>
                    </div>

                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      activeTab === 'CHECK_OUT' ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
                    }`}>
                      {activeTab === 'CHECK_OUT' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Inputs */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  2. Employee Information
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                  {/* Employee ID */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-cyan-600" /> Employee ID *
                    </label>
                    <input
                      type="number"
                      value={formData.employeeId}
                      onChange={(e) => handleInputChange('employeeId', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePunch(activeTab);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                      placeholder="e.g. 12"
                      required
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-600" /> Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.remarks || ''}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePunch(activeTab);
                        }
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none"
                      placeholder="e.g. Shift Check-In"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Action Button */}
              <div>
                <button
                  type="button"
                  onClick={() => handlePunch(activeTab)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {activeTab === 'CHECK_IN' ? <LogIn className="w-3.5 h-3.5 text-white" /> : <LogOut className="w-3.5 h-3.5 text-white" />}
                  <span className="text-white font-bold text-xs">
                    {isSubmitting
                      ? `Recording ${activeTab === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}...`
                      : `Submit ${activeTab === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}`}
                  </span>
                </button>
              </div>

            </div>

            {/* Collapsible Advanced Parameters */}
            <div className="bg-white rounded-lg shadow-2xs border border-slate-200 p-2 space-y-1.5">
              <div 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between cursor-pointer select-none group"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-200 transition-colors">
                    <Layers className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-bold text-slate-900">Device & Location Parameters</h3>
                    <p className="text-[9px] text-slate-400 leading-tight">Terminal device & geolocation metadata</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold group-hover:bg-slate-200 transition-all">
                  <span>{showAdvanced ? 'Hide' : 'Configure'}</span>
                  <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : 'rotate-0'}`} />
                </div>
              </div>

              {/* Smooth Accordion Container */}
              <div className={`grid transition-all duration-300 ease-in-out ${
                showAdvanced ? 'grid-rows-[1fr] opacity-100 pt-1.5 border-t border-slate-100' : 'grid-rows-[0fr] opacity-0 pt-0 border-t-0'
              }`}>
                <div className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Attendance Source</label>
                      <input
                        type="text"
                        value={formData.attendanceSource}
                        onChange={(e) => handleInputChange('attendanceSource', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Attendance Mode</label>
                      <input
                        type="text"
                        value={formData.attendanceMode}
                        onChange={(e) => handleInputChange('attendanceMode', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Device ID</label>
                      <input
                        type="text"
                        value={formData.deviceId}
                        onChange={(e) => handleInputChange('deviceId', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Device Name</label>
                      <input
                        type="text"
                        value={formData.deviceName}
                        onChange={(e) => handleInputChange('deviceName', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Location</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">IP Address</label>
                      <input
                        type="text"
                        value={formData.ipAddress}
                        onChange={(e) => handleInputChange('ipAddress', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={(e) => handleInputChange('latitude', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>

                    <div>
                      <label className="block text-[9.5px] font-medium text-slate-500 mb-0.5 truncate">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={(e) => handleInputChange('longitude', e.target.value)}
                        className="w-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none h-6"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Recent Session Activity Feed */}
          <div className="lg:col-span-5 bg-white rounded-xl shadow-2xs border border-slate-200 p-3.5 min-h-[300px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-600" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Recent Session Punch Logs</h3>
                    <p className="text-[10px] text-slate-400">Activity logged during current session</p>
                  </div>
                </div>
                <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 bg-cyan-50 text-cyan-800 rounded border border-cyan-200">
                  {punchLogs.length} Records
                </span>
              </div>

              {punchLogs.length === 0 ? (
                <div className="py-12 px-4 text-center flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 my-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                    <Activity className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No punches logged yet</p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-[220px]">Punches made during this session will appear here in real-time.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto no-scrollbar pr-0.5">
                  {punchLogs.map((log) => (
                    <div key={log.id} className="p-2 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${
                          log.type === 'CHECK_IN' ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {log.type === 'CHECK_IN' ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 font-mono">EMP #{log.employeeId}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              log.type === 'CHECK_IN' ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}>
                              {log.type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{log.remarks || 'No remarks'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10.5px] font-mono font-bold text-slate-700 block">{log.timestamp}</span>
                        <span className="text-[9px] text-emerald-600 font-bold inline-flex items-center gap-0.5">
                          <CheckCircle className="w-2.5 h-2.5" /> Success
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
    </>
  );
};

export default AttendancePunchPage;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LogIn, LogOut, Coffee, Utensils, Search, Clock, ShieldCheck } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

const CHECK_IN_URL = '/v1/api/attendance/check-in';
const CHECK_OUT_URL = '/v1/api/attendance/check-out';

const AttendancePunchPage: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeId, setEmployeeId] = useState(1001);
  const [customTime, setCustomTime] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  const [punchLogs, setPunchLogs] = useState<any[]>([
    { id: 1, action: "Shift Check-In", time: "09:05:00 AM", type: "IN", status: "Success" }
  ]);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getFormattedTime = () => {
    if (customTime) {
      const today = new Date().toISOString().split('T')[0];
      return `${today}T${customTime}:00`;
    }
    const iso = new Date().toISOString();
    return iso.substring(0, 19);
  };

  const handlePunch = async (type: 'CHECK_IN' | 'CHECK_OUT' | 'LUNCH_OUT' | 'LUNCH_IN') => {
    try {
      setIsSubmitting(true);
      const punchTime = getFormattedTime();
      const payload = { employeeId: Number(employeeId), punchTime };
      
      const endpoint = (type === 'CHECK_IN' || type === 'LUNCH_IN') ? CHECK_IN_URL : CHECK_OUT_URL;
      await axios.post(endpoint, payload);

      const actionLabels = {
        CHECK_IN: "Shift Check-In",
        LUNCH_OUT: "Lunch Checkout",
        LUNCH_IN: "Lunch Check-In",
        CHECK_OUT: "Final Checkout"
      };

      const isInput = type === 'CHECK_IN' || type === 'LUNCH_IN';

      setPunchLogs(prev => [
        {
          id: Date.now(),
          action: actionLabels[type],
          time: customTime ? customTime : currentTime.toLocaleTimeString(),
          type: isInput ? "IN" : "OUT",
          status: "Success"
        },
        ...prev
      ]);

      const labels = {
        CHECK_IN: "Shift Check-In recorded!",
        LUNCH_OUT: "Lunch Checkout recorded!",
        LUNCH_IN: "Lunch Check-In recorded!",
        CHECK_OUT: "Final Checkout recorded!"
      };

      ToasterService.success(labels[type]);
    } catch (err: any) {
      console.error(err);
      ToasterService.error(err.response?.data?.message || "Failed to record punch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const punchColumns: ColumnDef<any>[] = [
    { key: 'id', label: 'Log ID', sortable: true, render: (row) => <span className="font-mono text-gray-500">#{row.id}</span> },
    { key: 'action', label: 'Action', sortable: true, render: (row) => <span className="font-bold text-gray-800">{row.action}</span> },
    { key: 'time', label: 'Recorded Time', sortable: true, render: (row) => <span className="text-gray-600 font-mono">{row.time}</span> },
    { key: 'type', label: 'Type', sortable: true, render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          row.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {row.type}
        </span>
      ) 
    },
    { key: 'status', label: 'Status', sortable: true, render: () => (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Success
        </span>
      ) 
    },
  ];

  return (
    <>
      <PageMeta
        title="Attendance Punch"
        description="Clock in, clock out, and record meal breaks"
      />
      <PageBreadcrumb pageTitle="Attendance Punch" />

      <div className="max-w-4xl mx-auto pb-8 animate-in fade-in duration-200 mt-1">
        
        {/* Minimal Header & Live Clock Banner */}
        <div className="bg-white rounded-lg shadow-2xs border border-gray-200/80 p-3.5 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8.5 h-8.5 rounded-md bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
              <Clock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-gray-900">Attendance Punch Station</h1>
              <p className="text-[11px] text-gray-500">Quickly record shift check-ins, lunch breaks, and final checkouts</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200/80 text-xs font-mono font-bold text-gray-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Input & Action Station Card */}
        <div className="bg-white rounded-lg shadow-2xs border border-gray-200/80 p-4 mb-4 space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID *</label>
              <input
                type="number"
                value={employeeId}
                onChange={(e) => setEmployeeId(Number(e.target.value))}
                className="w-full py-1.5 px-3 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs font-medium text-gray-800"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">Custom Punch Time (Optional)</label>
                <span className="text-[10px] text-gray-400">Leave blank for live time</span>
              </div>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full py-1.5 px-3 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs font-medium text-gray-800"
              />
            </div>
          </div>

          {/* Punch Actions Grid */}
          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Punch Actions</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* 1. Shift Check-In */}
              <div className="p-3 bg-gray-50/40 rounded-lg border border-gray-200/60 flex items-center justify-between hover:border-emerald-300 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">Shift Check-In</h4>
                    <p className="text-[10px] text-gray-400">Log start of workday</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePunch('CHECK_IN')}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded text-[11px] font-bold transition-all shadow-2xs"
                >
                  Punch IN
                </button>
              </div>

              {/* 2. Lunch Checkout */}
              <div className="p-3 bg-gray-50/40 rounded-lg border border-gray-200/60 flex items-center justify-between hover:border-amber-300 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Utensils className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">Lunch Checkout</h4>
                    <p className="text-[10px] text-gray-400">Log start of meal break</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePunch('LUNCH_OUT')}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80 rounded text-[11px] font-bold transition-all shadow-2xs"
                >
                  Break OUT
                </button>
              </div>

              {/* 3. Lunch Check-In */}
              <div className="p-3 bg-gray-50/40 rounded-lg border border-gray-200/60 flex items-center justify-between hover:border-cyan-300 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">Lunch Check-In</h4>
                    <p className="text-[10px] text-gray-400">Log return from meal break</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePunch('LUNCH_IN')}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200/80 rounded text-[11px] font-bold transition-all shadow-2xs"
                >
                  Break IN
                </button>
              </div>

              {/* 4. Final Checkout */}
              <div className="p-3 bg-gray-50/40 rounded-lg border border-gray-200/60 flex items-center justify-between hover:border-rose-300 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">Final Checkout</h4>
                    <p className="text-[10px] text-gray-400">Log end of workday</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePunch('CHECK_OUT')}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 rounded text-[11px] font-bold transition-all shadow-2xs"
                >
                  Punch OUT
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* Today's Punch Activity Log using Common ReusableTable */}
        <div className="bg-white rounded-lg shadow-2xs border border-gray-200/80 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Today's Punch Activity Log</h3>
          <p className="text-[11px] text-gray-400 mb-3">Real-time punch entries for Employee #{employeeId}</p>
          
          <ReusableTable
            data={punchLogs}
            columns={punchColumns}
            searchable={true}
            searchPlaceholder="Search log..."
            pageSize={5}
            defaultSortKey="id"
            defaultSortOrder="desc"
          />
        </div>

      </div>
    </>
  );
};

export default AttendancePunchPage;

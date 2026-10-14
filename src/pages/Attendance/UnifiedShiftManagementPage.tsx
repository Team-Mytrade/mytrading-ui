import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Layers, Clock, Users, ShieldCheck, Sparkles } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import EmployeeShiftSchedulePage from './EmployeeShiftSchedulePage';
import ShiftPage from './ShiftPage';
import axios from 'axios';

type ShiftTab = 'roster' | 'shifts';

interface UnifiedShiftManagementPageProps {
  defaultTab?: ShiftTab;
}

const UnifiedShiftManagementPage: React.FC<UnifiedShiftManagementPageProps> = ({ defaultTab = 'roster' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<ShiftTab>(() => {
    if (queryTab === 'shifts' || queryTab === 'master') return 'shifts';
    if (queryTab === 'roster' || queryTab === 'schedule') return 'roster';
    return defaultTab;
  });

  // Keep in sync with search params if URL changes externally
  useEffect(() => {
    if (queryTab === 'shifts' || queryTab === 'master') {
      setActiveTab('shifts');
    } else if (queryTab === 'roster' || queryTab === 'schedule') {
      setActiveTab('roster');
    }
  }, [queryTab]);

  const handleTabChange = (tab: ShiftTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Quick summary counts for top executive ribbon
  const [stats, setStats] = useState({
    totalShifts: 0,
    nightShifts: 0,
    totalAssignments: 0,
    loading: false
  });

  useEffect(() => {
    let isMounted = true;
    const fetchQuickMetrics = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true }));
        const [shiftsRes, schedRes] = await Promise.allSettled([
          axios.get('/v1/api/attendance/shifts'),
          axios.get('/v1/api/attendance/shiftShedules/assignments')
        ]);

        let totalShifts = 0;
        let nightShifts = 0;
        let totalAssignments = 0;

        if (shiftsRes.status === 'fulfilled') {
          const shiftData = Array.isArray(shiftsRes.value.data) ? shiftsRes.value.data : [];
          totalShifts = shiftData.length;
          nightShifts = shiftData.filter((s: any) => s.nightShift).length;
        }

        if (schedRes.status === 'fulfilled') {
          const assignData = Array.isArray(schedRes.value.data) ? schedRes.value.data : [];
          totalAssignments = assignData.length;
        }

        if (isMounted) {
          setStats({
            totalShifts,
            nightShifts,
            totalAssignments,
            loading: false
          });
        }
      } catch (err) {
        if (isMounted) {
          setStats(prev => ({ ...prev, loading: false }));
        }
      }
    };

    fetchQuickMetrics();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <PageMeta
        title="Shift & Roster Management | MyTrading"
        description="Unified management for organization shift definitions, rosters, and employee rotational schedules"
      />
      <PageBreadcrumb pageTitle="Shift & Roster Management" />

      <div className="w-full pb-3 animate-in fade-in duration-200 space-y-2.5 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        
        {/* ── 1. UNIFIED HEADER WITH TAB CONTROLS & COMPACT METRICS ── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-xs border border-gray-200/80 dark:border-[#2a2a2a] p-3 sm:p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Title & Description */}
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-[#252525] text-blue-600 dark:text-gray-300 border border-blue-100 dark:border-[#333333]">
                  <Clock className="w-4 h-4" />
                </div>
                <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  Shift & Roster Management
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-[#252525] dark:text-gray-300 border border-emerald-200/60 dark:border-[#333333]">
                  <Sparkles className="w-2.5 h-2.5" /> Unified Hub
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Configure master work timings and assign rotational rosters to staff in one place
              </p>
            </div>

            {/* Segmented Tab Controls */}
            <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 dark:bg-[#222222] rounded-xl border border-gray-200/60 dark:border-[#2e2e2e] shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => handleTabChange('roster')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'roster'
                    ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-xs font-bold border border-gray-200/80 dark:border-[#333333]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-[#282828]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600 dark:text-gray-400" />
                <span>Shift Roster & Schedule</span>
                {stats.totalAssignments > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-50 dark:bg-[#282828] text-blue-700 dark:text-gray-300 border border-blue-200/60 dark:border-[#333333]">
                    {stats.totalAssignments}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('shifts')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'shifts'
                    ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-xs font-bold border border-gray-200/80 dark:border-[#333333]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-[#282828]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-gray-400" />
                <span>Shift Master</span>
                {stats.totalShifts > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-50 dark:bg-[#282828] text-indigo-700 dark:text-gray-300 border border-indigo-200/60 dark:border-[#333333]">
                    {stats.totalShifts}
                  </span>
                )}
              </button>
            </div>

          </div>

          {/* Compact Executive Quick-Insights Bar */}
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-[#282828] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-gray-400" />
                Shift Masters: <strong className="text-gray-900 dark:text-white font-mono">{stats.totalShifts || '—'}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-gray-400" />
                Night Shifts: <strong className="text-gray-900 dark:text-white font-mono">{stats.nightShifts}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                <Users className="w-3.5 h-3.5 text-blue-500 dark:text-gray-400" />
                Active Roster Allocations: <strong className="text-gray-900 dark:text-white font-mono">{stats.totalAssignments || '—'}</strong>
              </span>
            </div>

            <div className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <ShieldCheck className="w-3 h-3 text-emerald-500 dark:text-gray-400" />
              <span>Policy Sync Active</span>
            </div>
          </div>
        </div>

        {/* ── 2. ACTIVE VIEW CONTAINER ── */}
        <div className="w-full">
          {activeTab === 'roster' ? (
            <EmployeeShiftSchedulePage isEmbedded={true} />
          ) : (
            <ShiftPage isEmbedded={true} />
          )}
        </div>

      </div>
    </>
  );
};

export default UnifiedShiftManagementPage;

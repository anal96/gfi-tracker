import { useState, useEffect } from 'react';
import { Users, CheckCircle2, Clock, TrendingUp, Filter, Bell, CalendarDays, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MetricCard } from './MetricCard';

import api from '../services/api';

export interface TeacherProgress {
  id: string;
  teacherName: string;
  subject: string;
  unit: string;
  startedAt: Date;
  completedAt: Date | null;
  totalHours: number;
  status: string;
}

interface AdminDashboardProps {
  user: any;
  isDarkMode?: boolean;
  onNavigate?: (page: string) => void;
}

interface DashboardData {
  metrics: {
    totalTeachers: number;
    completedUnits: number;
    inProgressUnits: number;
    avgHours: string;
  };
  unitLogs: TeacherProgress[];
  delayedUnits: TeacherProgress[];
  filters: {
    teachers: string[];
    subjects: string[];
  };
}

function getAdminDashboardCacheKey(filters: { teacherId: string; subject: string; dateRange: string }) {
  const params = new URLSearchParams(filters).toString();
  return `api_cache_/api/admin/dashboard${params ? `?${params}` : ''}`;
}

function getAdminDashboardFromCache(filters: { teacherId: string; subject: string; dateRange: string }): DashboardData | null {
  try {
    const key = getAdminDashboardCacheKey(filters);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const payload = parsed?.data?.data ?? parsed?.data;
    if (!payload?.metrics) return null;
    const mapLog = (log: any) => ({
      ...log,
      startedAt: new Date(log.startedAt),
      completedAt: log.completedAt ? new Date(log.completedAt) : null
    });
    return {
      ...payload,
      unitLogs: (payload.unitLogs || []).map(mapLog),
      delayedUnits: (payload.delayedUnits || []).map(mapLog)
    };
  } catch {
    return null;
  }
}

const defaultFilters = { teacherId: 'all', subject: 'all', dateRange: 'today' };

export function AdminDashboard({ user, onNavigate }: AdminDashboardProps) {
  const [filters, setFilters] = useState(defaultFilters);
  const [initialCache] = useState(() => getAdminDashboardFromCache(defaultFilters));
  const [data, setData] = useState<DashboardData | null>(initialCache);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingNotificationsCount, setPendingNotificationsCount] = useState(0);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [teacherList, setTeacherList] = useState<Array<{ name: string; subjects?: any[] }>>([]);

  // Load teachers with allocated subjects for filter
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const response = await api.getTeachers();
        if (response?.success && response.data) {
          setTeacherList(response.data);
        }
      } catch (err) {
        console.error('Error loading teachers:', err);
      }
    };
    loadTeachers();
  }, []);

  // When a teacher is selected, show only that teacher's allocated subjects; otherwise show all
  const subjectsForFilter =
    filters.teacherId === 'all'
      ? (data?.filters?.subjects ?? ['all'])
      : (() => {
        const teacher = teacherList.find((t: any) => t.name === filters.teacherId);
        if (!teacher?.subjects?.length) return ['all'];
        const names = teacher.subjects
          .map((s: any) => (typeof s === 'string' ? s : s?.name))
          .filter(Boolean);
        return ['all', ...Array.from(new Set(names))];
      })();

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load notifications count
  useEffect(() => {
    loadNotificationsCount();
  }, []);

  const loadNotificationsCount = async () => {
    try {
      const response = await api.getAdminNotifications();
      if (response && response.success) {
        // Filter for only truly pending items that require admin action
        const pending = (response.data || []).filter((n: any) => n.status === 'pending').length;
        setPendingNotificationsCount(pending);
      }
    } catch (error) {
      console.error('Error loading notifications count:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    try {
      if (!data) setLoading(true);
      setError(null);

      const response = await api.getAdminDashboard(filters);

      if (response && response.success) {
        // Convert date strings to Date objects
        const formattedData = {
          ...response.data,
          unitLogs: response.data.unitLogs.map((log: any) => ({
            ...log,
            startedAt: new Date(log.startedAt),
            completedAt: log.completedAt ? new Date(log.completedAt) : null
          })),
          delayedUnits: response.data.delayedUnits?.map((log: any) => ({
            ...log,
            startedAt: new Date(log.startedAt),
            completedAt: log.completedAt ? new Date(log.completedAt) : null
          })) || []
        };

        setData(formattedData);
      } else {
        setError(response?.message || 'Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error loading admin dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      {/* Header */}
      {/* Header Section */}
      <div className="space-y-4 mb-6 sm:mb-8">
        {/* Top Row: Greeting & Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mt-1">
              Welcome back, {user?.name || 'Admin'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Exam Section Button */}
            <button
              onClick={() => onNavigate?.('exam')}
              className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95 group"
              title="Exam Section"
            >
              <CalendarDays className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => onNavigate?.('notifications')}
              className="relative p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95 group"
              title="Notifications"
            >
              <Bell
                className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                strokeWidth={2.5}
              />
              {pendingNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800">
                  {pendingNotificationsCount > 99 ? '99+' : pendingNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Date & Time Card - Full Width */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-[#1E293B] shadow-lg p-5 border border-gray-200 dark:border-slate-700/50">
          {/* Background Glow Effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-300 dark:border-slate-700/50">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <p className="text-xl sm:text-2xl font-mono font-bold text-gray-900 dark:text-white tracking-tight">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            </div>
          </div>
        </div>
      </div>



      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <MetricCard
          icon={Users}
          title="Total Teachers"
          value={data.metrics.totalTeachers.toString()}
          color="from-blue-500 to-blue-600"
          index={0}
        />

        <MetricCard
          icon={TrendingUp}
          title="Avg Hours Today"
          value={data.metrics.avgHours}
          suffix="h"
          color="from-purple-500 to-pink-600"
          index={3}
        />
      </div>


    </div>
  );
}

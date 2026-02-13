import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle2, PlayCircle, BookOpen, X, Sparkles } from 'lucide-react';
import api from '../services/api';
import { Calendar as UiCalendar } from './ui/calendar';

interface ScheduleEntry {
  subjectName: string;
  batch?: string;
  slotIds: string[];
}

interface CalendarDay {
  date: Date;
  timeSlots: string[];
  scheduleEntries?: ScheduleEntry[];
  completedUnits: number;
  inProgressUnits: number;
  totalUnits: number;
}

interface PlanningItem {
  date: Date;
  hours: number;
  subject: string;
  batch?: string;
  status: 'scheduled' | 'history';
}

interface TeacherCalendarProps {
  user: any;
  subjects: any[];
  isDarkMode?: boolean;
}

export function TeacherCalendar({ user, subjects, isDarkMode = false }: TeacherCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Map<string, CalendarDay>>(new Map());
  const [loading, setLoading] = useState(true);
  // Build planning list from real calendar data (approved/sent timetable from verifier)
  const planningData = useMemo((): PlanningItem[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const items: PlanningItem[] = [];
    calendarData.forEach((day) => {
      if (day.timeSlots.length === 0) return;
      const date = new Date(day.date);
      if (date < monthStart || date > monthEnd) return;
      const dateNorm = new Date(date);
      dateNorm.setHours(0, 0, 0, 0);
      const isPast = dateNorm.getTime() < today.getTime();
      const entries = day.scheduleEntries && day.scheduleEntries.length > 0
        ? day.scheduleEntries
        : [{ subjectName: 'Class', slotIds: day.timeSlots }];
      entries.forEach((entry) => {
        const hours = entry.slotIds?.length ?? 0;
        if (hours === 0) return;
        items.push({
          date,
          hours,
          subject: entry.subjectName || 'Class',
          batch: entry.batch,
          status: isPast ? 'history' : 'scheduled'
        });
      });
    });
    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarData, currentMonth]);

  const scheduledData = planningData.filter(p => p.status === 'scheduled');
  const historyData = planningData.filter(p => p.status === 'history');

  const formatDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    loadCalendarData();
  }, [currentMonth]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const response = await api.getTeacherCalendar(startDate, endDate);

      if (response?.success && response.data) {
        const dataMap = new Map<string, CalendarDay>();

        // Process time slots: show days with scheduled timetable (scheduledSlotIds) or with checked slots
        if (response.data.timeSlots) {
          response.data.timeSlots.forEach((slot: any) => {
            const date = new Date(slot.date);
            const dateKey = formatDateKey(date);
            // Assigned by verifier (teacher clicks to mark done) – use scheduledSlotIds for display
            const scheduledIds = slot.scheduledSlotIds && Array.isArray(slot.scheduledSlotIds) ? slot.scheduledSlotIds : [];
            const checkedSlots = slot.slots
              .filter((s: any) => {
                if (s.status === 'approved' && s.checked) return true;
                if (!s.status && s.checked) return true;
                return false;
              })
              .map((s: any) => s.slotId);
            const displaySlots = scheduledIds.length > 0 ? scheduledIds : checkedSlots;

            if (displaySlots.length > 0) {
              if (!dataMap.has(dateKey)) {
                dataMap.set(dateKey, {
                  date,
                  timeSlots: [],
                  completedUnits: 0,
                  inProgressUnits: 0,
                  totalUnits: 0,
                });
              }

              const day = dataMap.get(dateKey)!;
              day.timeSlots = displaySlots;
              if (slot.scheduleEntries && Array.isArray(slot.scheduleEntries) && slot.scheduleEntries.length > 0) {
                day.scheduleEntries = slot.scheduleEntries.map((e: any) => ({
                  subjectName: e.subjectName ?? '',
                  batch: e.batch,
                  slotIds: Array.isArray(e.slotIds) ? e.slotIds : []
                }));
              }
            }
          });
        }

        // Process unit logs
        if (response.data.unitLogs) {
          response.data.unitLogs.forEach((log: any) => {
            const date = new Date(log.startTime);
            const dateKey = formatDateKey(date);

            if (!dataMap.has(dateKey)) {
              dataMap.set(dateKey, {
                date,
                timeSlots: [],
                completedUnits: 0,
                inProgressUnits: 0,
                totalUnits: 0,
              });
            }

            const day = dataMap.get(dateKey)!;
            day.totalUnits += 1;

            if (log.status === 'completed') {
              day.completedUnits += 1;
            } else if (log.status === 'in-progress') {
              day.inProgressUnits += 1;
            }
          });
        }

        setCalendarData(dataMap);
      }
    } catch (err: any) {
      console.error('Error loading calendar data:', err);
      setCalendarData(new Map());
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getDayData = (date: Date | null): CalendarDay | null => {
    if (!date) return null;
    const key = formatDateKey(date);
    return calendarData.get(key) || null;
  };

  const renderCalendarView = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day

    // Helper to check if a date is in planning data
    const isDateInPlanning = (date: Date): boolean => {
      const dateNormalized = new Date(date);
      dateNormalized.setHours(0, 0, 0, 0);
      return planningData.some(plan => {
        const planDate = new Date(plan.date);
        planDate.setHours(0, 0, 0, 0);
        return planDate.getTime() === dateNormalized.getTime();
      });
    };

    const modifiers = {
      planned: (date: Date) => {
        // Check if it's today first - if so, don't mark as planned (today takes precedence)
        const dateNormalized = new Date(date);
        dateNormalized.setHours(0, 0, 0, 0);
        if (dateNormalized.getTime() === today.getTime()) {
          return false;
        }
        // Show green for days that are in the planning data
        return isDateInPlanning(date);
      },
      today: (date: Date) => {
        const dateNormalized = new Date(date);
        dateNormalized.setHours(0, 0, 0, 0);
        return dateNormalized.getTime() === today.getTime();
      },
    };

    const modifiersStyles = {
      planned: {
        backgroundColor: '#dcfce7', // green-100 (lighter green)
        color: '#166534', // green-800 (dark green text)
        fontWeight: '600',
        borderRadius: '8px'
      },
      today: {
        backgroundColor: '#3b82f6', // blue-500
        color: '#ffffff', // white text
        fontWeight: '700',
        borderRadius: '8px',
        border: '2px solid #1e40af' // blue-800 border for emphasis
      },
    };

    return (
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-6 sm:p-8">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
            </div>
          </div>

          <UiCalendar
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            selected={undefined}
            onSelect={() => { }}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="w-full"
          />
        </div>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Class Schedule
            </h2>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderCalendarView()}
      </motion.div>

      {/* Planning Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-xl p-6 sm:p-8"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
                Planning
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Timetable from approved schedule (calendar and planning below)
              </p>
            </div>
          </div>

          {/* Scheduled Section - from approved timetable (verifier Approve & Send) */}
          {scheduledData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Scheduled (this month)
              </h3>
              <div className="space-y-3">
                {scheduledData.map((plan, index) => (
                  <motion.div
                    key={`scheduled-${plan.date.getTime()}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-700 dark:to-slate-700 border border-purple-200 dark:border-slate-600 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-slate-600">
                        <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-white whitespace-nowrap">
                          {plan.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })} – {plan.hours}{'\u00A0'}hr{plan.hours !== 1 ? 's' : ''}
                        </p>
                        {(plan.subject !== 'Class' || plan.batch) && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            <span className="font-medium">Subject:</span> {plan.subject === 'Class' ? '—' : plan.subject}
                            {plan.batch ? <> · <span className="font-medium">Batch:</span> {plan.batch}</> : null}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold flex-shrink-0 ml-2">
                      Scheduled
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* History Section - past days with timetable */}
          {historyData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                Past
              </h3>
              <div className="space-y-2">
                {historyData.slice(-7).reverse().map((plan, index) => (
                  <div
                    key={`history-${plan.date.getTime()}-${plan.subject}-${index}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {plan.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })} – {plan.hours}{'\u00A0'}hr{plan.hours !== 1 ? 's' : ''}
                      </p>
                      {(plan.subject !== 'Class' || plan.batch) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="font-medium">Subject:</span> {plan.subject === 'Class' ? '—' : plan.subject}
                          {plan.batch ? <> · <span className="font-medium">Batch:</span> {plan.batch}</> : null}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">Done</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Data Message */}
          {scheduledData.length === 0 && historyData.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No timetable for this month. Your schedule will appear here after it is approved and sent.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

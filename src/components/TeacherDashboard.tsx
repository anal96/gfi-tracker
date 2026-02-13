import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Calendar, ListTodo, Target, X, Bell, BookOpen, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TimeSlotSelector } from './TimeSlotSelector';
import { ActiveUnitCard } from './ActiveUnitCard';
import { MetricCard } from './MetricCard';
import api from '../services/api';

// Time slot definitions for labels
const timeSlots = [
  { id: '9-10', label: '9:00 - 10:00', value: 1 },
  { id: '10-11', label: '10:00 - 11:00', value: 1 },
  { id: '11-12', label: '11:00 - 12:00', value: 1 },
  { id: '12-13', label: '12:00 - 13:00', value: 1 },
  { id: '13-14', label: '13:00 - 14:00', value: 1 },
  { id: '14-15', label: '14:00 - 15:00', value: 1 },
  { id: '15-16', label: '15:00 - 16:00', value: 1 },
  { id: '16-17', label: '16:00 - 17:00', value: 1 },
];

export interface Unit {
  id: string;
  name: string;
  status: 'not-started' | 'in-progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
  elapsedTime?: number; // in seconds
  progressDays?: number; // days since start (shows from day 2)
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  units: Unit[];
  batch?: { id: string; name: string; year: string };
}

interface TeacherDashboardProps {
  user: any;
  isDarkMode?: boolean;
  onNavigate: (page: string) => void;
}

const TEACHER_DASHBOARD_CACHE_KEY = 'api_cache_/api/teacher/dashboard';

function getTeacherDashboardFromCache(): { subjects: Subject[]; selectedSlots: string[]; breakDuration: number | null; approvedHours: number | undefined } | null {
  try {
    const raw = localStorage.getItem(TEACHER_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const payload = parsed?.data?.data ?? parsed?.data;
    if (!payload?.subjects) return null;
    const subjects = Array.isArray(payload.subjects) ? payload.subjects : [];
    let selectedSlots: string[] = [];
    let breakDuration: number | null = null;
    let approvedHours: number | undefined = undefined;
    if (payload.timeSlots) {
      if (payload.timeSlots.breakDuration !== undefined) breakDuration = payload.timeSlots.breakDuration;
      if (payload.timeSlots.totalHours !== undefined) approvedHours = payload.timeSlots.totalHours;
      if (payload.timeSlots.slots?.length) {
        selectedSlots = payload.timeSlots.slots
          .filter((s: any) => s.checked === true)
          .map((s: any) => s.slotId);
      }
    }
    return { subjects, selectedSlots, breakDuration, approvedHours };
  } catch {
    return null;
  }
}

export function TeacherDashboard({ user, isDarkMode = false, onNavigate }: TeacherDashboardProps) {
  const [initialCache] = useState(() => getTeacherDashboardFromCache());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [subjects, setSubjects] = useState<Subject[]>(initialCache?.subjects ?? []);
  const [selectedSlots, setSelectedSlots] = useState<string[]>(initialCache?.selectedSlots ?? []);
  const [breakDuration, setBreakDuration] = useState<number | null>(initialCache?.breakDuration ?? null);
  const [approvedHours, setApprovedHours] = useState<number | undefined>(initialCache?.approvedHours ?? undefined);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [pendingNotificationsCount, setPendingNotificationsCount] = useState(0);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('🔔 Modal state changed - showErrorModal:', showErrorModal, 'message:', errorModalMessage);
  }, [showErrorModal, errorModalMessage]);

  // Load dashboard data
  useEffect(() => {
    // Don't load if user is a verifier (they should use VerifierDashboard)
    if (user?.role === 'verifier') {
      return;
    }
    loadDashboardData();
    loadNotificationsCount();
  }, [user]);

  // Load notifications count
  const loadNotificationsCount = async () => {
    try {
      const [notifRes, assignRes] = await Promise.all([
        api.getNotifications(),
        api.getTeacherAssignments()
      ]);

      let count = 0;
      if (notifRes.success) {
        count += (notifRes.data || []).filter((n: any) => n.status === 'pending').length;
      }
      if (assignRes.success) {
        count += (assignRes.data || []).filter((a: any) => a.status === 'admin_approved').length;
      }
      setPendingNotificationsCount(count);
    } catch (error) {
      console.error('Error loading notifications count:', error);
    }
  };

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = async () => {
    try {
      if (!subjects.length) setLoading(true);
      setError(null);
      const response = await api.getTeacherDashboard();

      if (response.success && response.data) {
        setSubjects(response.data.subjects || []);

        // Set selected time slots - ONLY show approved slots
        if (response.data.timeSlots) {
          // Set break duration from backend
          if (response.data.timeSlots.breakDuration !== undefined) {
            setBreakDuration(response.data.timeSlots.breakDuration);
          }

          // Set approved hours from backend
          if (response.data.timeSlots.totalHours !== undefined) {
            setApprovedHours(response.data.timeSlots.totalHours);
          }

          if (response.data.timeSlots.slots) {
            // Get all checked slots from backend
            // IMPORTANT: Deselections are immediate (checked: false in DB), so we only show checked: true slots
            // Selections require approval, but once approved they're also checked: true in DB
            const allCheckedSlots = response.data.timeSlots.slots
              .filter((slot: any) => slot.checked === true)
              .map((slot: any) => slot.slotId);

            // CRITICAL: For display, we show slots that are checked: true in the database
            // This includes:
            // 1. Immediately deselected slots are already checked: false, so they won't be in this array
            // 2. Approved selected slots are checked: true, so they will be shown
            // 3. Pending selected slots are still checked: false in DB, so they won't be shown until approved

            // Optional: Filter out slots with rejected approval (if any)
            try {
              const approvalResponse = await api.getTimeSlotApprovalStatus();
              if (approvalResponse && approvalResponse.success) {
                const approvalStatus = approvalResponse.data;

                // Only exclude slots that are explicitly rejected
                // Keep slots that are:
                // - checked: true in DB (even if no approval record - old data or immediate deselection handling)
                // - checked: true in DB and approved
                // Exclude slots that are checked: true in DB but rejected (shouldn't happen, but safety check)
                const validSlots = allCheckedSlots.filter((slotId: string) => {
                  const status = approvalStatus[slotId];
                  if (!status) {
                    // No approval record - if checked: true in DB, show it (could be old data or immediate operation)
                    // The database is the source of truth for checked state
                    return true;
                  }
                  // If rejected, don't show it (even if checked: true in DB - should be synced)
                  if (status.status === 'rejected') {
                    return false;
                  }
                  // If approved or pending, and checked: true in DB, show it
                  // But pending selections are still checked: false in DB, so won't be in allCheckedSlots
                  return true;
                });

                console.log('📊 Loading dashboard - checked slots from DB:', allCheckedSlots);
                console.log('📊 Loading dashboard - after filtering:', validSlots);
                setSelectedSlots(validSlots);
              } else {
                // If approval status fetch fails, use database state directly (it's the source of truth)
                console.warn('⚠️ Could not fetch approval status, using database state');
                setSelectedSlots(allCheckedSlots);
              }
            } catch (approvalErr) {
              // If approval status fetch fails, use database state directly
              console.warn('⚠️ Error fetching approval status, using database state:', approvalErr);
              setSelectedSlots(allCheckedSlots);
            }
          } else {
            setSelectedSlots([]);
          }
        } else {
          setSelectedSlots([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Find ALL active units from all subjects
  const activeUnits = subjects
    .flatMap(s => s.units
      .filter(u => u.status === 'in-progress')
      .map(u => ({
        ...u,
        subjectName: s.name,
        subjectColor: s.color,
        subjectId: s.id
      }))
    )
    .sort((a, b) => {
      // Sort by startedAt (most recent first)
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeB - timeA;
    });

  // Calculate stats for cards
  const totalUnits = subjects.flatMap(s => s.units).length;
  const completedUnits = subjects.flatMap(s => s.units).filter(u => u.status === 'completed').length;
  const inProgressUnits = subjects.flatMap(s => s.units).filter(u => u.status === 'in-progress').length;
  const pendingUnits = subjects.flatMap(s => s.units).filter(u => u.status === 'not-started').length;

  const handleStartUnit = async (subjectId: string, unitId: string) => {
    console.log('🔄 Starting unit:', unitId);
    try {
      const response = await api.startUnit(unitId);
      console.log('✅ Start unit response:', response);
      if (response && response.success) {
        // Show message that request is pending approval
        if (response.message && response.message.includes('pending')) {
          alert('✅ Unit start request submitted! Waiting for verifier approval.');
        } else {
          console.log('✅ Unit started successfully, reloading dashboard...');
          await loadDashboardData(); // Reload to get updated data
        }
      } else if (response && !response.success) {
        // Handle response with success: false (status 200)
        console.log('❌ Start unit failed (success: false):', response.message);
        const errorMessage = response.message || 'Failed to start unit';
        handleStartUnitError(errorMessage);
      }
    } catch (err: any) {
      console.error('❌ Error starting unit (catch block):', err);
      console.error('Error type:', typeof err);
      console.error('Error message:', err?.message);
      console.error('Error stack:', err?.stack);

      // Handle thrown errors (status 400, 500, etc.)
      const errorMessage = err?.message || err?.toString() || 'Failed to start unit';
      console.log('Processing error message:', errorMessage);
      handleStartUnitError(errorMessage);
    }
  };

  const handleStartUnitError = (errorMessage: string) => {
    console.log('🔍 Processing error:', errorMessage);
    // Check if it's the "another unit in progress" error (case insensitive)
    const lowerMessage = errorMessage.toLowerCase();
    const isInProgressError = lowerMessage.includes('already in progress') ||
      lowerMessage.includes('another unit') ||
      lowerMessage.includes('unit is already');

    console.log('Is in-progress error?', isInProgressError);

    if (isInProgressError) {
      console.log('📢 Showing modal with message:', errorMessage);
      // Update both states synchronously - React will batch these updates
      setErrorModalMessage(errorMessage);
      setShowErrorModal(true);
      console.log('✅ Modal states updated - showErrorModal: true, message set');
    } else {
      console.log('📢 Showing alert for other error');
      // Use alert for other errors
      alert(errorMessage);
    }
  };

  const handleCompleteUnit = async (subjectId: string, unitId: string) => {
    try {
      const response = await api.completeUnit(unitId);
      if (response.success) {
        // Show message that request is pending approval
        if (response.message && response.message.includes('pending')) {
          alert('✅ Unit completion request submitted! Waiting for verifier approval.');
        } else {
          await loadDashboardData(); // Reload to get updated data
        }
      } else {
        alert(response.message || 'Failed to complete unit');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to complete unit');
    }
  };

  const handleUpdateElapsedTime = (subjectId: string, unitId: string, elapsed: number) => {
    // Update local state for live timer display
    setSubjects(prev =>
      prev.map(subject =>
        subject.id === subjectId
          ? {
            ...subject,
            units: subject.units.map(unit =>
              unit.id === unitId ? { ...unit, elapsedTime: elapsed } : unit
            ),
          }
          : subject
      )
    );
  };

  const handleTimeSlotChange = async (slots: string[]) => {
    // Just update local state when slots are being edited
    setSelectedSlots(slots);
  };

  const handleTimeSlotSave = async (slots: string[], breakDuration?: number | null) => {
    // Save only CHANGED slots to backend when "Done" is clicked
    console.log('🔄 handleTimeSlotSave called with slots:', slots);
    console.log('📊 Previous slots (from state - may be stale):', selectedSlots);

    try {
      // CRITICAL: Always fetch fresh state from backend - never trust React state
      // This ensures we compare against what's ACTUALLY saved, not stale state
      let currentSavedSlots: string[] = [];
      try {
        console.log('📡 Fetching current state from backend...');
        const dashboardResponse = await api.getTeacherDashboard();
        if (dashboardResponse.success && dashboardResponse.data?.timeSlots?.slots) {
          // Get ALL checked slots from backend
          const allCheckedSlots = dashboardResponse.data.timeSlots.slots
            .filter((slot: any) => slot.checked === true)
            .map((slot: any) => slot.slotId);
          console.log('📊 All checked slots from backend:', allCheckedSlots);

          // Now filter out pending approvals - only keep actually approved slots


          try {
            const approvalResponse = await api.getTimeSlotApprovalStatus();
            if (approvalResponse && approvalResponse.success) {
              const approvalStatus = approvalResponse.data;
              console.log('📊 Approval status:', approvalStatus);

              // CRITICAL FIX: Use database state as source of truth
              // Slots with checked: true in DB are the baseline (includes approved selections)
              // Slots with checked: false in DB are deselected (including immediate deselections)
              // Only exclude slots that are checked: true in DB but explicitly rejected
              currentSavedSlots = allCheckedSlots.filter((slotId: string) => {
                const status = approvalStatus[slotId];
                if (!status) {
                  // No approval record but checked: true in DB - treat as saved
                  // This could be old data OR an immediate deselection that was then re-selected
                  // Since it's checked: true in DB, it's the current state
                  console.log(`✅ Slot ${slotId} has no approval record but checked: true in DB - treating as saved`);
                  return true;
                }
                // Exclude explicitly rejected slots
                if (status.status === 'rejected') {
                  console.log(`❌ Slot ${slotId} is rejected - NOT treating as saved`);
                  return false;
                }
                // Include approved and pending slots that are checked: true in DB
                // Note: Pending selections are still checked: false in DB, so won't be in allCheckedSlots
                // If a slot is checked: true in DB, it's either approved or old data - both should be counted
                console.log(`✅ Slot ${slotId} is ${status.status} and checked: true in DB - treating as saved`);
                return true;
              });
              console.log('📊 Current saved slots (after filtering by approval status):', currentSavedSlots);
            } else {
              // If approval status fetch fails, use all checked slots (fallback)
              console.warn('⚠️ Could not fetch approval status, using all checked slots');
              currentSavedSlots = allCheckedSlots;
            }
          } catch (approvalErr) {
            console.warn('⚠️ Error fetching approval status, using all checked slots:', approvalErr);
            currentSavedSlots = allCheckedSlots;
          }
        } else {
          console.log('📊 No time slots data in response, starting with empty array');
          currentSavedSlots = [];
        }
      } catch (err) {
        console.error('❌ Could not fetch current state from backend:', err);
        // If we can't fetch, use empty array to be safe (don't use stale state)
        currentSavedSlots = [];
        console.warn('⚠️ Using empty array as baseline to avoid false deselections');
      }

      console.log('🎯 FINAL baseline for comparison:', currentSavedSlots);
      console.log('🎯 User selected slots:', slots);
      console.log('🔍 Comparing:', {
        baseline: currentSavedSlots,
        userSelection: slots,
        baselineCount: currentSavedSlots.length,
        userSelectionCount: slots.length
      });

      // Find slots that changed (were selected but now unselected, or were unselected but now selected)
      const previousSlots = new Set(currentSavedSlots);
      const currentSlots = new Set(slots);
      const changedSlots: Array<{ slotId: string, checked: boolean }> = [];

      // Check for newly selected slots (in current but not in previous)
      slots.forEach(slotId => {
        if (!previousSlots.has(slotId)) {
          console.log(`➕ Slot ${slotId} is newly selected (was NOT in baseline, now in user selection)`);
          changedSlots.push({ slotId, checked: true });
        }
      });

      // Check for newly unselected slots (in previous but not in current)
      // IMPORTANT: Only create deselection requests if the slot was actually saved (not pending)
      // CRITICAL: Always check deselections if baseline exists - this is the key fix
      console.log(`🔍 Checking deselections: baseline has ${currentSavedSlots.length} slots`);
      currentSavedSlots.forEach((slotId: string) => {
        const isInUserSelection = currentSlots.has(slotId);
        console.log(`🔍 Slot ${slotId}: in baseline=${true}, in user selection=${isInUserSelection}`);
        if (!isInUserSelection) {
          console.log(`➖ Slot ${slotId} is newly unselected (was in baseline, NOT in user selection - DESELECTING)`);
          changedSlots.push({ slotId, checked: false });
        }
      });

      if (currentSavedSlots.length === 0) {
        console.log('✅ Baseline is empty - no deselections possible (no slots were saved)');
      }

      // CRITICAL SAFEGUARD: Double-check - if baseline is empty, ensure NO deselection requests exist
      if (currentSavedSlots.length === 0) {
        const deselectionCount = changedSlots.filter(c => c.checked === false).length;
        if (deselectionCount > 0) {
          console.error(`🚨 CRITICAL ERROR: Baseline is empty but ${deselectionCount} deselection request(s) detected!`);
          console.error('🚨 This should NEVER happen. Filtering them out immediately.');
          const onlySelections = changedSlots.filter(c => c.checked === true);
          changedSlots.length = 0;
          changedSlots.push(...onlySelections);
        }
        console.log('✅ Baseline is empty - final result (only selections):', changedSlots);
      }

      console.log('📝 Final changed slots:', changedSlots);

      // Only send approval requests for slots that actually changed
      if (changedSlots.length === 0) {
        // No changes, but still update the UI state
        console.log('ℹ️ No changes detected - slots match saved state');
        setSelectedSlots(slots);
        alert('ℹ️ No changes detected. The selected time slots are already saved. If you want to change them, select different slots and click Done again.');
        return;
      }

      console.log('📝 Changed slots:', changedSlots);

      // Update only the changed slots - backend will handle duplicate prevention
      const results = [];
      for (const { slotId, checked } of changedSlots) {
        try {
          console.log(`📤 Updating slot ${slotId} to checked=${checked}`);
          const result = await api.updateTimeSlot(slotId, checked);
          console.log(`✅ Slot ${slotId} updated:`, {
            success: result?.success,
            message: result?.message,
            data: result?.data,
            isImmediate: result?.data?.immediate === true,
            fullResult: result
          });
          results.push({ slotId, success: true, result, checked });
        } catch (err: any) {
          console.error(`❌ Error updating slot ${slotId}:`, err);
          results.push({ slotId, success: false, error: err.message, checked });
          // Continue with other slots even if one fails
        }
      }

      console.log('📊 All results:', results);

      // Check if any updates failed
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.error('Some slots failed to update:', failed);
        throw new Error(`Failed to update ${failed.length} slot(s): ${failed.map(f => f.slotId).join(', ')}`);
      }

      // Check if requests are pending approval or immediate
      const hasPendingRequests = results.some(r => {
        const message = r.result?.message || '';
        const isImmediate = message.includes('deselected successfully') || r.result?.data?.immediate === true;
        const isPending = !isImmediate && (message.includes('pending') || message.includes('approval'));
        console.log(`🔍 Slot ${r.slotId} check:`, { message, isImmediate, isPending, result: r.result });
        return isPending;
      });

      const hasImmediateChanges = results.some(r => {
        const message = r.result?.message || '';
        const isImmediate = message.includes('deselected successfully') || r.result?.data?.immediate === true;
        return isImmediate;
      });

      console.log('🔍 Has pending requests:', hasPendingRequests);
      console.log('🔍 Has immediate changes:', hasImmediateChanges);

      // CRITICAL: Always reload dashboard AFTER save to get fresh state from database
      // This ensures deselections are immediately reflected (they're checked: false in DB now)
      console.log('🔄 Reloading dashboard after save to get fresh state...');
      await loadDashboardData();
      console.log('✅ Dashboard reloaded - slots should now reflect database state');

      // Wait a tiny bit to ensure state updates are complete
      await new Promise(resolve => setTimeout(resolve, 100));

      if (hasPendingRequests) {
        const changedCount = changedSlots.length;
        const selectedCount = changedSlots.filter(s => s.checked).length;
        const deselectedCount = changedSlots.filter(s => !s.checked).length;

        let message = `✅ ${changedCount} time slot update request(s) submitted!`;
        if (selectedCount > 0 && deselectedCount > 0) {
          message += ` (${selectedCount} selected - pending approval, ${deselectedCount} deselected - saved immediately)`;
        } else if (selectedCount > 0) {
          message += ` (${selectedCount} selected - waiting for verifier approval)`;
        } else if (deselectedCount > 0) {
          message += ` (${deselectedCount} deselected - saved immediately)`;
        }

        alert(message);
      } else {
        // All changes were immediate (deselections)
        console.log('✅ All slots saved successfully (immediate deselections)');
        const deselectedCount = changedSlots.filter(s => !s.checked).length;
        if (deselectedCount > 0) {
          alert(`✅ ${deselectedCount} time slot(s) deselected and saved immediately!`);
        } else {
          alert('✅ Time slots saved successfully!');
        }
      }
    } catch (err: any) {
      console.error('❌ Error saving time slots:', err);
      alert(`❌ Error: ${err.message || 'Failed to save time slots. Please check console for details.'}`);
      throw err; // Re-throw so TimeSlotSelector can handle it
    }
  };

  const teacherName = user?.name || "Teacher";
  const greeting = currentTime.getHours() < 12 ? "Good Morning" : currentTime.getHours() < 18 ? "Good Afternoon" : "Good Evening";

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-32 sm:pb-36 pt-4 sm:pt-6">
      {/* Modern Mobile-First Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-1">
              {greeting}
            </h1>
            <p className="text-sm sm:text-base text-black/70 dark:text-slate-400 font-medium">
              {teacherName}
            </p>
          </div>
          <button
            onClick={() => onNavigate('notifications')}
            className="relative p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200/50 dark:border-blue-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
          >
            <Bell
              className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
              strokeWidth={2.5}
              fill="none"
            />
            {pendingNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingNotificationsCount > 9 ? '9+' : pendingNotificationsCount}
              </span>
            )}
          </button>
        </div>

        {/* Pending Actions Alert - Show prominently if there are assignments needing approval */}


        {/* Date & Time Card - Matches Admin Dashboard */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-[#1E293B] shadow-lg p-5 border border-gray-200 dark:border-slate-700/50">
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
      </motion.div >

      {/* Modern Stats Cards Grid - Mobile Optimized */}
      < motion.div
        initial={{ opacity: 0, y: 20 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 sm:gap-4 mb-6"
      >
        <MetricCard
          icon={ListTodo}
          title="Total Units"
          value={totalUnits.toString()}
          color="from-blue-500 to-blue-600"
          index={0}
        />
        <MetricCard
          icon={CheckCircle2}
          title="Completed"
          value={completedUnits.toString()}
          color="from-emerald-500 to-green-600"
          index={1}
        />
        <MetricCard
          icon={Clock}
          title="Active"
          value={inProgressUnits.toString()}
          color="from-blue-500 to-indigo-600"
          index={2}
        />
        <MetricCard
          icon={Target}
          title="Pending"
          value={pendingUnits.toString()}
          color="from-orange-500 to-red-500"
          index={3}
        />
      </motion.div >

      {/* Active Unit Banner */}
      <AnimatePresence>
        {
          activeUnits.length > 0 && (
            <div className="mb-6">
              {activeUnits.length > 1 && (
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-8 rounded-full bg-blue-500 block"></span>
                    Active Units ({activeUnits.length})
                  </h3>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700 shadow-sm">
                    <button
                      onClick={() => setActiveUnitIndex(prev => (prev === 0 ? activeUnits.length - 1 : prev - 1))}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 min-w-[30px] text-center">
                      {activeUnitIndex + 1} / {activeUnits.length}
                    </span>
                    <button
                      onClick={() => setActiveUnitIndex(prev => (prev === activeUnits.length - 1 ? 0 : prev + 1))}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                {activeUnits.map((activeUnit, index) => (
                  <div
                    key={`${activeUnit.subjectId}-${activeUnit.id}`}
                    style={{
                      display: activeUnits.length > 1 ? (index === activeUnitIndex ? 'block' : 'none') : 'block'
                    }}
                  >
                    <ActiveUnitCard
                      unit={activeUnit}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        }
      </AnimatePresence >

      {/* Time Slot Section - Modern Mobile Card */}
      < motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <TimeSlotSelector
          selectedSlots={selectedSlots}
          onSelectionChange={handleTimeSlotChange}
          onSave={handleTimeSlotSave}
          breakDuration={breakDuration}
          approvedHours={approvedHours}
        />
      </motion.div >

      {/* Error Modal for "Another unit in progress" - Simple guaranteed modal */}
      {
        showErrorModal && (
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={() => {
              setShowErrorModal(false);
              setErrorModalMessage('');
            }}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal Content */}
            <div
              className="relative z-10 bg-white dark:bg-slate-800 border-2 border-orange-400 dark:border-orange-500 shadow-2xl rounded-2xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-transparent dark:bg-orange-900/30 flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white">
                  Cannot Start Unit
                </h3>
              </div>

              {/* Message */}
              <p className="text-black dark:text-gray-200 mb-4 text-base leading-relaxed">
                {errorModalMessage || 'Another unit is already in progress. Please complete it first before starting a new one.'}
              </p>

              {/* Tip Box */}
              <div className="mb-6 p-3 rounded-lg bg-transparent dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>Tip:</strong> Check the "Active" section at the top of your dashboard to see which unit is currently running.
                </p>
              </div>

              {/* Button */}
              <button
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorModalMessage('');
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                OK, Got it
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
}
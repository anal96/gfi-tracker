import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, Lock, Edit, Check, AlertCircle, XCircle } from 'lucide-react';
import api from '../services/api';

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

interface TimeSlotSelectorProps {
  selectedSlots: string[];
  onSelectionChange: (slots: string[]) => void;
  onSave?: (slots: string[], breakDuration?: number | null) => Promise<void>;
  breakDuration?: number | null;
  approvedHours?: number;
  prevDayMissing?: boolean;
  onGoToPreviousDay?: () => void;
  selectedDate?: Date;
}

interface SlotApprovalStatus {
  status: 'pending' | 'approved' | 'rejected';
  approvalId?: string;
  createdAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  requestData?: any;
}

export function TimeSlotSelector({ selectedSlots, onSelectionChange, onSave, breakDuration: initialBreakDuration, approvedHours, prevDayMissing, onGoToPreviousDay, selectedDate }: TimeSlotSelectorProps) {
  // Start LOCKED by default - slots cannot be edited until Edit button is clicked
  // If there are selected slots, they're locked (saved). If empty, still start locked.
  const [isLocked, setIsLocked] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tempSelectedSlots, setTempSelectedSlots] = useState<string[]>(selectedSlots);
  const [breakDuration, setBreakDuration] = useState<number | null>(initialBreakDuration || null);
  const [tempBreakDuration, setTempBreakDuration] = useState<number | null>(initialBreakDuration || null);
  const [breakApprovalStatus, setBreakApprovalStatus] = useState<SlotApprovalStatus | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<Record<string, SlotApprovalStatus>>({});
  const [notifications, setNotifications] = useState<Array<{ slotId: string, message: string, type: 'approved' | 'rejected' | 'info' }>>([]);

  const addNotification = (type: 'approved' | 'rejected' | 'info', message: string, slotId: string = '') => {
    setNotifications(prev => [...prev, { slotId, message, type }]);
  };

  // Load approval status
  useEffect(() => {
    loadApprovalStatus();
    // Poll for approval status updates every 5 seconds
    const interval = setInterval(loadApprovalStatus, 5000);
    return () => clearInterval(interval);
  }, [selectedDate]); // Reload when date changes

  // Initialize break duration from approval status if approved
  useEffect(() => {
    if (breakApprovalStatus?.status === 'approved' && breakApprovalStatus.requestData?.breakDuration !== undefined) {
      setBreakDuration(breakApprovalStatus.requestData.breakDuration);
      if (isLocked) {
        setTempBreakDuration(breakApprovalStatus.requestData.breakDuration);
      }
    }
  }, [breakApprovalStatus, isLocked]);

  const loadApprovalStatus = async () => {
    try {
      const response = await api.getTimeSlotApprovalStatus(selectedDate);
      if (response && response.success) {
        const newStatus = response.data;
        const oldStatus = approvalStatus;

        // Check for new approvals/rejections and show notifications
        Object.keys(newStatus).forEach(slotId => {
          const newStatusItem = newStatus[slotId];
          const oldStatusItem = oldStatus[slotId];

          // Handle break timing separately
          if (slotId === 'break-timing') {
            const oldBreakStatus = breakApprovalStatus;
            setBreakApprovalStatus(newStatusItem);

            // Check for status change
            if (oldBreakStatus?.status === 'pending' && newStatusItem.status !== 'pending') {
              if (newStatusItem.status === 'approved') {
                setNotifications(prev => [...prev, {
                  slotId: 'break-timing',
                  message: `Break timing (${newStatusItem.requestData?.breakDuration || breakDuration} min) has been approved!`,
                  type: 'approved'
                }]);
                // Update break duration from approved request
                if (newStatusItem.requestData?.breakDuration !== undefined) {
                  setBreakDuration(newStatusItem.requestData.breakDuration);
                }
              } else if (newStatusItem.status === 'rejected') {
                setNotifications(prev => [...prev, {
                  slotId: 'break-timing',
                  message: `Break timing was rejected. ${newStatusItem.rejectionReason || ''}`,
                  type: 'rejected'
                }]);
              }
            }
            return;
          }

          // If status changed from pending to approved/rejected
          if (oldStatusItem?.status === 'pending' && newStatusItem.status !== 'pending') {
            if (newStatusItem.status === 'approved') {
              setNotifications(prev => [...prev, {
                slotId,
                message: `Time slot ${timeSlots.find(s => s.id === slotId)?.label} has been approved!`,
                type: 'approved'
              }]);
            } else if (newStatusItem.status === 'rejected') {
              setNotifications(prev => [...prev, {
                slotId,
                message: `Time slot ${timeSlots.find(s => s.id === slotId)?.label} was rejected. ${newStatusItem.rejectionReason || ''}`,
                type: 'rejected'
              }]);
            }
          }
        });

        // Remove break-timing from status map (handled separately)
        const { 'break-timing': breakTimingStatus, ...slotStatusMap } = newStatus;
        setApprovalStatus(slotStatusMap);
      }
    } catch (error) {
      console.error('Error loading approval status:', error);
    }
  };

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  // Sync tempSelectedSlots when selectedSlots prop changes (e.g., on initial load)
  // Only sync when not locked (during editing)
  useEffect(() => {
    if (!isLocked) {
      setTempSelectedSlots(selectedSlots);
    }
  }, [selectedSlots, isLocked]);

  // Initialize tempSelectedSlots on mount
  useEffect(() => {
    if (selectedSlots.length > 0 && tempSelectedSlots.length === 0) {
      setTempSelectedSlots(selectedSlots);
    }
  }, []);

  const toggleSlot = async (slotId: string) => {
    // Prevent changes when locked - user must click Edit first
    if (isLocked) {
      return;
    }

    // Prevent selecting rejected slots (until midnight)
    const slotStatus = approvalStatus[slotId];
    if (slotStatus?.status === 'rejected') {
      const rejectedAt = slotStatus.rejectedAt ? new Date(slotStatus.rejectedAt) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if rejection was today - if so, block until midnight
      if (rejectedAt && rejectedAt >= today && rejectedAt < tomorrow) {
        const hoursUntilMidnight = (tomorrow.getTime() - new Date().getTime()) / (1000 * 60 * 60);
        const minutesUntilMidnight = Math.floor((tomorrow.getTime() - new Date().getTime()) / (1000 * 60));
        alert(`This time slot was rejected today and cannot be selected until midnight.\n\nReason: ${slotStatus.rejectionReason || 'Not provided'}\n\nTime remaining: ${Math.floor(hoursUntilMidnight)}h ${minutesUntilMidnight % 60}m`);
        return;
      }
      // If rejection was before today, allow selection (new day)
    }

    // Check if slot is currently selected - first check tempSelectedSlots, then check approval status
    let isInTempSlots = tempSelectedSlots.includes(slotId);
    let isApprovedAndChecked = slotStatus && slotStatus.status === 'approved' && slotStatus.requestData?.checked === true;
    let isPendingAndChecked = slotStatus && slotStatus.status === 'pending' && slotStatus.requestData?.checked === true;

    // Handle pending request cancellation first (if needed)
    const currentSlotStatus = approvalStatus[slotId];
    if (currentSlotStatus?.status === 'pending' && currentSlotStatus.approvalId) {
      // Cancel the pending request
      console.log(`🔄 Canceling pending request for slot ${slotId}`);
      try {
        await api.cancelApprovalRequest(currentSlotStatus.approvalId);
        console.log(`✅ Pending request canceled for slot ${slotId}`);
        // Reload approval status to reflect the cancellation
        await loadApprovalStatus();
        // Show notification
        addNotification('info', `Pending request for ${timeSlots.find(s => s.id === slotId)?.label || slotId} canceled`, slotId);
      } catch (err: any) {
        console.error(`❌ Error canceling request for slot ${slotId}:`, err);
        alert(err.message || 'Failed to cancel pending request. Please try again.');
        return; // Don't proceed with deselection if cancel fails
      }
    }

    // Use functional setState to handle all state updates atomically
    // This ensures we work with the latest state and handle approved slots correctly
    // CRITICAL: Don't call onSelectionChange inside setState - use useEffect or call it after
    setTempSelectedSlots(prev => {
      const isInPrev = prev.includes(slotId);
      const isApprovedAndChecked = slotStatus && slotStatus.status === 'approved' && slotStatus.requestData?.checked === true;
      const isPendingAndChecked = slotStatus && slotStatus.status === 'pending' && slotStatus.requestData?.checked === true;

      // Determine if slot is currently selected (in tempSelectedSlots OR approved/pending)
      const isCurrentlySelected = isInPrev || isApprovedAndChecked || isPendingAndChecked;

      if (isCurrentlySelected) {
        // Deselecting a slot
        console.log(`➖ Deselecting slot ${slotId}`);
        console.log(`📊 Previous: [${prev.join(', ')}], Is in prev: ${isInPrev}, Is approved: ${isApprovedAndChecked}`);

        // Ensure slot is in array before removing (handles approved slots not yet in tempSelectedSlots)
        let currentSlots = isInPrev ? prev : [...prev, slotId];
        const newSlots = currentSlots.filter(id => id !== slotId);
        console.log(`✅ Slot ${slotId} deselected. New: [${newSlots.join(', ')}]`);

        // Update parent component AFTER state update (using setTimeout to avoid render phase update)
        setTimeout(() => onSelectionChange(newSlots), 0);
        return newSlots;
      } else {
        // Selecting a slot
        console.log(`➕ Selecting slot ${slotId}`);
        const newSlots = [...prev, slotId];
        // Update parent component AFTER state update (using setTimeout to avoid render phase update)
        setTimeout(() => onSelectionChange(newSlots), 0);
        console.log(`✅ Slot ${slotId} selected. New: [${newSlots.join(', ')}]`);
        return newSlots;
      }
    });
  };

  const handleDone = async () => {
    // Prevent double-clicking
    if (isSaving) {
      return;
    }

    // CRITICAL: Allow empty selection - this means deselecting all slots
    // This is valid for immediate deselections (no approval needed)
    // Don't block saving with 0 slots - it's a valid state (all deselected)
    console.log('🔄 handleDone called with slots:', tempSelectedSlots);

    if (isLocked) {
      alert('Please click Edit first to modify time slots.');
      return;
    }

    setIsSaving(true);
    try {
      console.log('🔄 Saving time slots:', tempSelectedSlots);

      // Update the actual selected slots
      onSelectionChange(tempSelectedSlots);

      // Save break timing if it changed (use tempBreakDuration when editing)
      const breakDurationToSave = !isLocked ? tempBreakDuration : breakDuration;
      console.log('💾 Saving break timing - breakDurationToSave:', breakDurationToSave, 'initialBreakDuration:', initialBreakDuration, 'isLocked:', isLocked);

      // Check if break timing changed (including deselection - null is a valid change)
      if (breakDurationToSave !== initialBreakDuration) {
        try {
          console.log('📤 Saving break timing:', breakDurationToSave);
          await api.updateBreakTiming(breakDurationToSave, selectedDate);
          console.log('✅ Break timing saved successfully');
          // Update the actual break duration after successful save
          setBreakDuration(breakDurationToSave);
          // Also update tempBreakDuration to match
          if (!isLocked) {
            setTempBreakDuration(breakDurationToSave);
          }
        } catch (breakError: any) {
          console.error('❌ Error saving break timing:', breakError);
          // Don't throw - allow time slots to save even if break timing fails
          alert(`⚠️ Warning: Break timing could not be saved: ${breakError?.message || 'Unknown error'}`);
        }
      } else {
        console.log('ℹ️ Break timing unchanged, skipping save');
      }

      // If onSave callback is provided, call it to save to backend
      if (onSave) {
        console.log('📤 Calling onSave callback with slots:', tempSelectedSlots);
        console.log('📊 Current tempSelectedSlots count:', tempSelectedSlots.length);
        console.log('📊 Current tempSelectedSlots IDs:', tempSelectedSlots);
        try {
          await onSave(tempSelectedSlots);
          console.log('✅ onSave completed successfully');

          // Lock the slots after saving - cannot change until Edit is clicked
          setIsLocked(true);
          console.log('🔒 Time slots saved and locked');
        } catch (saveError: any) {
          console.error('❌ Error in onSave callback:', saveError);
          throw saveError; // Re-throw to be caught by outer catch
        }
      } else {
        console.warn('⚠️ No onSave callback provided - slots will not be saved to backend');
        // Still lock locally even if no callback
        setIsLocked(true);
        alert('⚠️ Warning: No save handler configured. Changes are only local.');
      }
    } catch (error: any) {
      console.error('❌ Error saving time slots:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`❌ Failed to save time slots: ${errorMessage}\n\nPlease try again.`);
      // Don't lock if save failed
      setIsLocked(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    // Unlock slots - NOW user can edit them (only after clicking Edit)
    setIsLocked(false);

    // CRITICAL: Build a comprehensive list of approved slots from all sources
    // 1. Get approved slots from props (selectedSlots that are approved)
    const approvedSlotsFromProps = selectedSlots.filter(slotId => {
      const status = approvalStatus[slotId];
      // Include if approved or if no status (might be old data)
      return !status || status.status === 'approved';
    });

    // 2. Get all approved slots from approvalStatus (check ALL approval records)
    const approvedSlotsFromStatus = Object.keys(approvalStatus)
      .filter(slotId => {
        const status = approvalStatus[slotId];
        // CRITICAL: Include approved slots that were approved for selection (checked: true)
        // This ensures we get all approved slots even if they're not in selectedSlots prop
        const isApprovedForSelection = status.status === 'approved' &&
          status.requestData?.checked === true;
        return isApprovedForSelection && !approvedSlotsFromProps.includes(slotId);
      });

    // 3. Also check if any slots in selectedSlots have approval status but might be missing from approvalStatus
    // (This handles edge cases where approvalStatus might not be fully loaded)
    const additionalApprovedSlots = selectedSlots.filter(slotId => {
      // If in selectedSlots but not yet checked against approvalStatus, include it
      return !approvalStatus[slotId] && !approvedSlotsFromProps.includes(slotId);
    });

    // Combine all sources and remove duplicates
    const allApprovedSlots = [...new Set([
      ...approvedSlotsFromProps,
      ...approvedSlotsFromStatus,
      ...additionalApprovedSlots
    ])];

    console.log('✏️ Edit clicked - initializing with approved slots:', allApprovedSlots);
    console.log('📊 From props:', approvedSlotsFromProps);
    console.log('📊 From status:', approvedSlotsFromStatus);
    console.log('📊 Additional:', additionalApprovedSlots);
    console.log('📊 Approval status keys:', Object.keys(approvalStatus));
    console.log('📊 Selected slots from props:', selectedSlots);

    // CRITICAL: Always set tempSelectedSlots with ALL approved slots so they can be deselected
    setTempSelectedSlots(allApprovedSlots);
    // Also update the parent component so it knows about the current selections
    onSelectionChange(allApprovedSlots);

    // Initialize temp break duration with current approved break duration (if any)
    // This allows user to deselect break timing when editing
    const currentApprovedBreak = breakApprovalStatus?.status === 'approved'
      ? breakApprovalStatus.requestData?.breakDuration
      : breakDuration;
    setTempBreakDuration(currentApprovedBreak || null);
    console.log('✏️ Edit clicked - initializing break duration:', currentApprovedBreak);
  };

  const currentBreakDuration = !isLocked ? tempBreakDuration : breakDuration;
  const totalHours = tempSelectedSlots.reduce((sum, slotId) => {
    const slot = timeSlots.find(s => s.id === slotId);
    return sum + (slot?.value || 0);
  }, 0) - (currentBreakDuration ? currentBreakDuration / 60 : 0);

  // Display approved hours if available, otherwise calculate from selections
  const displayHours = approvedHours !== undefined ? approvedHours : Math.max(0, totalHours);

  return (
    <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-blue-100 dark:border-blue-700/50 shadow-xl shadow-blue-500/10 card-hover">
      {prevDayMissing && (
        <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border-2 border-red-500 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Action Required
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium">
              Previous work day log is pending! <br />
              <span className="text-sm opacity-80 mt-1 block font-normal">Please complete yesterday's time log to unlock today's schedule.</span>
            </p>
            <button
              onClick={onGoToPreviousDay ? onGoToPreviousDay : () => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-red-500 dark:bg-red-600 text-white font-semibold hover:bg-red-600 dark:hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
            >
              {onGoToPreviousDay ? 'Fill Previous Day' : 'Check Again'}
            </button>
          </div>
        </div>
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-black dark:text-white" />
            <h2 className="text-2xl font-bold text-black dark:text-white">
              Daily Time Slots
            </h2>
            {isLocked && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/30 border border-green-400/50">
                <Lock className="w-4 h-4 text-black dark:text-white" />
                <span className="text-xs font-semibold text-black dark:text-white">Locked</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 dark:from-sky-400 dark:to-blue-500 bg-clip-text text-transparent tabular-nums">
              {displayHours.toFixed(1)}h
            </div>
            <div className="text-sm text-black dark:text-slate-400">Total Hours {approvedHours !== undefined ? '(Approved)' : ''}</div>
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-4 space-y-2">
          {notifications.map((notif, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-3 rounded-lg flex items-center gap-2 ${notif.type === 'approved'
                ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                : notif.type === 'rejected'
                  ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                  : 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                }`}
            >
              {notif.type === 'approved' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : notif.type === 'rejected' ? (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
              <span className={`text-sm font-medium ${notif.type === 'approved'
                ? 'text-green-800 dark:text-green-200'
                : notif.type === 'rejected'
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-blue-800 dark:text-blue-200'
                }`}>
                {notif.message}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 mb-8">
          {timeSlots.map((slot, index) => {
            const slotStatus = approvalStatus[slot.id];
            const isPending = slotStatus?.status === 'pending';
            const isRejected = slotStatus?.status === 'rejected';
            const isApproved = slotStatus?.status === 'approved';

            // Show as selected based on mode:
            // - When EDITING (not locked): Only use tempSelectedSlots (user can toggle)
            // - When LOCKED (view mode): Show approved slots even if not in tempSelectedSlots
            const shouldShowSelected = isLocked
              ? (tempSelectedSlots.includes(slot.id) ||
                (slotStatus && isApproved && slotStatus.requestData?.checked) ||
                (slotStatus && isPending && slotStatus.requestData?.checked))
              : tempSelectedSlots.includes(slot.id); // During editing, ONLY use tempSelectedSlots
            const isSelected = shouldShowSelected;

            // Check if rejected slot is from today (block until midnight)
            let isRejectedBlocked = false;
            if (isRejected && slotStatus?.rejectedAt) {
              const rejectedAt = new Date(slotStatus.rejectedAt);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              // Block if rejected today
              isRejectedBlocked = rejectedAt >= today && rejectedAt < tomorrow;
            }

            const isDisabled = isLocked || isRejectedBlocked;

            return (
              <motion.button
                key={slot.id}
                onClick={() => toggleSlot(slot.id)}
                disabled={isDisabled}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={!isDisabled ? { scale: 1.03 } : {}}
                whileTap={!isDisabled ? { scale: 0.97 } : {}}
                className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${isDisabled
                  ? 'cursor-not-allowed opacity-75'
                  : 'cursor-pointer'
                  } ${isRejected
                    ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600'
                    : isPending
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600'
                      : isApproved && isSelected
                        ? 'bg-gradient-to-br from-green-500/30 via-green-600/25 to-emerald-500/20 dark:from-green-500/40 dark:via-green-600/35 dark:to-emerald-500/30 border-green-400 dark:border-green-500 shadow-xl shadow-green-500/30 transform scale-105'
                        : isSelected
                          ? 'bg-gradient-to-br from-blue-500/30 via-blue-600/25 to-purple-500/20 dark:from-blue-500/40 dark:via-blue-600/35 dark:to-purple-500/30 border-blue-400 dark:border-blue-500 shadow-xl shadow-blue-500/30 transform scale-105'
                          : 'bg-slate-50 dark:bg-slate-700 border-blue-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:scale-102'
                  }`}
              >
                {/* Checkbox indicator */}
                <div className="flex items-center justify-center mb-2">
                  <motion.div
                    animate={{
                      scale: isSelected ? 1 : 0.8,
                      opacity: isSelected ? 1 : 0.4,
                    }}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isSelected
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400'
                      : 'bg-transparent dark:bg-slate-600 border-blue-200 dark:border-slate-500'
                      }`}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </motion.div>
                </div>

                {/* Time label */}
                <div className={`text-sm font-semibold text-center ${isRejected ? 'text-red-700 dark:text-red-300' :
                  isPending ? 'text-yellow-700 dark:text-yellow-300' :
                    isApproved && isSelected ? 'text-green-700 dark:text-green-300' :
                      'text-black dark:text-white'
                  }`}>
                  {slot.label}
                </div>

                {/* Status badge */}
                {slotStatus && (
                  <div className="absolute top-1 right-1">
                    {isPending && (
                      <div className="px-1.5 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
                        ⏳
                      </div>
                    )}
                    {isApproved && (
                      <div className="px-1.5 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                        ✓
                      </div>
                    )}
                    {isRejected && (
                      <div className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        ✗
                      </div>
                    )}
                  </div>
                )}

                {/* Glow effect when selected */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/20 to-blue-500/20 blur-xl -z-10"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Break Timing Section */}
        <div className={`mb-6 p-4 rounded-xl border-2 transition-all ${breakApprovalStatus?.status === 'pending'
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600'
          : breakApprovalStatus?.status === 'approved' && breakDuration
            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600'
            : breakApprovalStatus?.status === 'rejected'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
              : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
          }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-black dark:text-white" />
              <h3 className="text-lg font-semibold text-black dark:text-white">Break Timing</h3>
              {breakApprovalStatus && (
                <div className="flex items-center gap-2">
                  {breakApprovalStatus.status === 'pending' && (
                    <div className="px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
                      ⏳ Pending
                    </div>
                  )}
                  {breakApprovalStatus.status === 'approved' && (
                    <div className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                      ✓ Approved
                    </div>
                  )}
                  {breakApprovalStatus.status === 'rejected' && (
                    <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                      ✗ Rejected
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-sm font-medium text-black dark:text-white whitespace-nowrap">
              Break Duration:
            </label>
            <div className="flex flex-col gap-2 flex-grow max-w-sm">
              <div className="flex items-center gap-3 w-full">
                {/* Slider for quick selection */}
                <div className="relative flex-grow h-6 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="5"
                    value={!isLocked
                      ? (tempBreakDuration || 0)
                      : breakApprovalStatus?.status === 'pending' && breakApprovalStatus.requestData?.breakDuration
                        ? breakApprovalStatus.requestData.breakDuration
                        : breakDuration || 0}
                    onChange={(e) => {
                      if (!isLocked) {
                        setTempBreakDuration(parseInt(e.target.value, 10) || null);
                      }
                    }}
                    disabled={isLocked}
                    className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isLocked
                      ? 'bg-gray-200 dark:bg-gray-700'
                      : 'bg-blue-100 dark:bg-blue-900/30 accent-blue-600'
                      }`}
                  />
                </div>

                {/* Number Input for precise entry */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="300"
                    value={!isLocked
                      ? (tempBreakDuration !== null ? tempBreakDuration : '')
                      : breakApprovalStatus?.status === 'pending' && breakApprovalStatus.requestData?.breakDuration
                        ? breakApprovalStatus.requestData.breakDuration
                        : (breakDuration !== null ? breakDuration : '')}
                    onChange={(e) => {
                      if (!isLocked) {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        setTempBreakDuration(val);
                      }
                    }}
                    disabled={isLocked}
                    placeholder="0"
                    className={`w-16 px-2 py-1.5 text-center text-sm font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isLocked
                      ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 opacity-70 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-700 text-black dark:text-white border-blue-200 dark:border-slate-600 hover:border-blue-300'
                      } ${breakApprovalStatus?.status === 'pending'
                        ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10'
                        : breakApprovalStatus?.status === 'approved' && breakDuration
                          ? 'border-green-400'
                          : breakApprovalStatus?.status === 'rejected'
                            ? 'border-red-400'
                            : ''
                      }`}
                  />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">min</span>
                </div>
              </div>
            </div>
            {(() => {
              const displayBreakDuration = !isLocked
                ? tempBreakDuration
                : breakApprovalStatus?.status === 'pending' && breakApprovalStatus.requestData?.breakDuration
                  ? breakApprovalStatus.requestData.breakDuration
                  : breakDuration;

              return displayBreakDuration && (
                <div className={`text-sm font-medium ${breakApprovalStatus?.status === 'approved'
                  ? 'text-green-700 dark:text-green-300'
                  : breakApprovalStatus?.status === 'pending'
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-gray-600 dark:text-gray-400'
                  }`}>
                  {breakApprovalStatus?.status === 'pending' && breakApprovalStatus.requestData?.breakDuration
                    ? `${breakApprovalStatus.requestData.breakDuration} min break (pending approval)`
                    : `${displayBreakDuration} min break ${breakApprovalStatus?.status === 'approved' ? '(approved)' : ''}`} will be deducted from total hours
                </div>
              );
            })()}
          </div>
        </div>

        {/* Helper message */}
        {isLocked && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <span className="font-semibold">Tip:</span> Click <span className="font-bold">Edit</span> to modify your time slots and break timing, then click <span className="font-bold">Done</span> to save.
            </p>
          </div>
        )}

        {/* Action Buttons - Edit and Done buttons perfectly aligned */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-blue-200/30 dark:border-blue-700/30">
          {/* Edit Button - Only enabled when locked */}
          <motion.button
            onClick={handleEdit}
            disabled={!isLocked}
            whileHover={isLocked ? { scale: 1.02 } : {}}
            whileTap={isLocked ? { scale: 0.98 } : {}}
            className={`flex items-center justify-center gap-2 px-6 min-w-[120px] h-12 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 ${!isLocked
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-xl hover:from-blue-600 hover:to-blue-700'
              }`}
            title={isLocked ? 'Click to edit time slots' : 'Time slots are being edited'}
          >
            <Edit className="w-4 h-4 flex-shrink-0" />
            <span className="leading-none">Edit</span>
          </motion.button>

          {/* Done Button - Enabled when not locked (allows deselection of all slots) */}
          <motion.button
            onClick={handleDone}
            disabled={isLocked || isSaving}
            whileHover={!isLocked && !isSaving ? { scale: 1.02 } : {}}
            whileTap={!isLocked && !isSaving ? { scale: 0.98 } : {}}
            className={`flex items-center justify-center gap-2 px-6 min-w-[120px] h-12 rounded-xl font-semibold text-sm shadow-lg transition-all duration-300 ${isLocked || isSaving
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:shadow-xl border-2 border-green-400'
              }`}
            title={
              isLocked
                ? 'Click Edit first to modify time slots'
                : 'Save time slot selections'
            }
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="leading-none">Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 flex-shrink-0" />
                <span className="leading-none">Done</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
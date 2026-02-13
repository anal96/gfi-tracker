import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle, Calendar, Check, X, History, Bell, Trash2 } from 'lucide-react';
import api from '../services/api';
import { AssignmentRequestHistory } from './AssignmentRequestHistory';
interface Notification {
  _id: string;
  type: 'unit-complete' | 'time-slot' | 'subject-assign' | 'unit-start';
  status: 'pending' | 'approved' | 'rejected' | 'admin_approved';
  requestData: any;
  requestedBy?: { _id: string; name: string; email: string };
  rejectionReason?: string;
  approvedBy?: { _id: string; name: string; email: string };
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface NotificationsPageProps {
  user: any;
  onBack: () => void;
  isDarkMode?: boolean;
}

export function NotificationsPage({ user, onBack, isDarkMode = false }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'time-slot' | 'unit-start' | 'unit-complete'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [activeView, setActiveView] = useState<'notifications' | 'history'>('notifications');
  const [historyCount, setHistoryCount] = useState(0);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this notification?')) return;

    try {
      const res = await api.deleteNotification(id);
      if (res.success) {
        setNotifications(prev => prev.filter(n => n._id !== id));
      } else {
        alert(res.message || 'Failed to delete notification');
      }
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      alert('Failed to delete notification');
    }
  };

  useEffect(() => {
    loadNotifications(true);
  }, [user?.role]);

  // ... existing loadNotifications ...

  // ... existing handlers ...

  const loadNotifications = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const role = user?.role;
      if (role === 'admin') {
        const res = await api.getAdminNotifications(forceRefresh);
        if (res.success) setNotifications(res.data || []);
      } else if (role === 'verifier') {
        const [approvalsRes, historyRes] = await Promise.all([
          api.getVerifierApprovals({ status: 'all' }), // Get ALL approvals to show as notifications
          api.getVerifierAssignments('all', true)
        ]);

        if (approvalsRes.success) {
          // Filter out assignment requests (subject-assign) as per user request
          // Show all other types (unit-start, unit-complete, time-slot) regardless of status
          const filtered = (approvalsRes.data || []).filter((n: Notification) => n.type !== 'subject-assign');
          setNotifications(filtered);
        }
        if (historyRes.success && Array.isArray(historyRes.data)) setHistoryCount(historyRes.data.length);
      } else {
        const [notifRes, assignRes] = await Promise.all([
          api.getNotifications(),
          api.getTeacherAssignments()
        ]);
        const list: Notification[] = notifRes.success ? (notifRes.data || []) : [];
        const assignments = assignRes.success ? (assignRes.data || []) : [];
        const assignmentNotifications = assignments
          .filter((a: any) => a.status === 'admin_approved' || a.status === 'approved')
          .map((a: any) => ({
            _id: a._id,
            type: 'subject-assign' as const,
            status: a.status as 'admin_approved' | 'approved',
            requestData: {
              assignmentId: a._id,
              subjectName: a.subject?.name,
              fromTeacherName: a.fromTeacher?.name,
              toTeacherName: a.toTeacher?.name,
              reason: a.reason,
              verifierName: a.requestedBy?.name
            },
            createdAt: a.createdAt,
            requestedBy: a.requestedBy,
            approvedAt: a.approvedAt
          }));

        const combined = [...assignmentNotifications, ...list].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(combined);
      }
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminApprove = async (assignmentId: string) => {
    try {
      setActionLoading(assignmentId);
      const res = await api.approveAssignment(assignmentId);
      if (res.success) await loadNotifications(true);
      else alert(res.message || 'Failed to approve');
    } catch (e: any) {
      alert(e.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdminReject = async (assignmentId: string, reason: string) => {
    if (!reason.trim()) {
      alert('Please enter a rejection reason');
      return;
    }
    try {
      setActionLoading(assignmentId);
      const res = await api.rejectAssignment(assignmentId, reason);
      if (res.success) {
        setRejectReason(prev => ({ ...prev, [assignmentId]: '' }));
        await loadNotifications(true);
      } else alert(res.message || 'Failed to reject');
    } catch (e: any) {
      alert(e.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeacherApprove = async (assignmentId: string) => {
    try {
      setActionLoading(assignmentId);
      const res = await api.approveTeacherAssignment(assignmentId);
      if (res.success) await loadNotifications(true);
      else alert(res.message || 'Failed to accept');
    } catch (e: any) {
      alert(e.message || 'Failed to accept');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTeacherReject = async (assignmentId: string, reason: string) => {
    if (!reason.trim()) {
      alert('Please enter a reason');
      return;
    }
    try {
      setActionLoading(assignmentId);
      const res = await api.rejectTeacherAssignment(assignmentId, reason);
      if (res.success) {
        setRejectReason(prev => ({ ...prev, [assignmentId]: '' }));
        await loadNotifications(true);
      } else alert(res.message || 'Failed to reject');
    } catch (e: any) {
      alert(e.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'unit-start':
        return 'Unit Start Request';
      case 'unit-complete':
        return 'Unit Completion Request';
      case 'time-slot':
        return 'Time Slot Request';
      case 'subject-assign':
        return 'Subject Assignment';
      default:
        return type;
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    const { type, status, requestData } = notification;

    if (type === 'unit-start' || type === 'unit-complete') {
      const unitName = requestData?.unitName || 'Unit';
      const subjectName = requestData?.subjectName || 'Subject';
      const teacherName = notification.requestedBy?.name || 'Teacher';

      // Simplified message for verifier as per request - just notify
      if (user?.role === 'verifier') {
        return `${teacherName} ${type === 'unit-start' ? 'started' : 'completed'} unit "${unitName}" in ${subjectName}`;
      }

      if (status === 'pending') {
        return `${type === 'unit-start' ? 'Start' : 'Complete'} unit "${unitName}" in ${subjectName}`;
      } else if (status === 'approved') {
        return `✅ ${type === 'unit-start' ? 'Started' : 'Completed'} unit "${unitName}" in ${subjectName}`;
      } else {
        return `❌ ${type === 'unit-start' ? 'Start' : 'Completion'} request for "${unitName}" in ${subjectName} was rejected`;
      }
    } else if (type === 'time-slot') {
      const slotLabel = requestData?.label || requestData?.slotId || 'Time Slot';
      const teacherName = notification.requestedBy?.name || 'Teacher';
      const isBreak = requestData?.isBreak;
      const breakDuration = requestData?.breakDuration;

      // Simplified message for verifier as per request - just notify
      if (user?.role === 'verifier') {
        if (isBreak) {
          return `${teacherName} updated break time to ${breakDuration} mins`;
        }
        return `${teacherName} requested time slot "${slotLabel}"`;
      }

      if (status === 'pending') {
        return `Select time slot "${slotLabel}"`;
      } else if (status === 'approved') {
        return `✅ Time slot "${slotLabel}" approved`;
      } else {
        return `❌ Time slot "${slotLabel}" request was rejected`;
      }
    } else if (type === 'subject-assign') {
      const subjectName = requestData?.subjectName || 'Subject';
      const verifierName = requestData?.verifierName || (notification.requestedBy?.name) || 'Verifier';
      const toName = requestData?.toTeacherName || '—';

      if (status === 'pending' || status === 'admin_approved') {
        if (user?.role === 'admin') {
          return status === 'admin_approved'
            ? `Subject assignment "${subjectName}" (Approved by you, waiting for teacher)`
            : `Subject "${subjectName}": ${verifierName} requests assign to ${toName}`;
        }
        return status === 'admin_approved'
          ? `Subject assignment for you: "${subjectName}" (admin approved – accept or reject)`
          : `Subject "${subjectName}": ${verifierName} requests assign to ${toName}`;
      } else if (status === 'approved') {
        return `✅ Subject assignment for "${subjectName}" approved`;
      } else {
        return `❌ Subject assignment for "${subjectName}" was rejected`;
      }
    }

    return 'Notification';
  };

  // Debug logging
  useEffect(() => {
    if (user?.role === 'admin') {
      console.log('🔍 Admin Notifications:', notifications.length);
      notifications.forEach(n => {
        console.log(` - ID: ${n._id}, Status: ${n.status}, Type: ${n.type}`);
      });
    }
  }, [notifications, user]);

  const statusForFilter = (n: Notification) => {
    // Robust status check (case insensitive)
    const s = (n.status || 'pending').toLowerCase();

    // 1. Rejected is always rejected
    if (s === 'rejected') return 'rejected';

    // 2. Approved is always approved (fully complete)
    if (s === 'approved') return 'approved';

    // 3. Admin Approved (Intermediate state)
    if (s === 'admin_approved') {
      // For Admin: clearly approved by me -> Approved
      if (user?.role === 'admin') return 'approved';
      // For Teachers: waiting for me -> Pending
      return 'pending';
    }

    // 4. Default pending
    return 'pending';
  };

  const filteredNotifications = notifications.filter(notif => {
    // Verifier sees everything in the list(since tabs are hidden and API returns relevant pending items)
    if (user?.role === 'verifier') {
      if (typeFilter === 'all') return true;
      if (typeFilter === 'time-slot') return notif.type === 'time-slot';
      if (typeFilter === 'unit-start') return notif.type === 'unit-start';
      if (typeFilter === 'unit-complete') return notif.type === 'unit-complete';
      return true;
    }

    // Default filter logic (pending, approved, rejected)
    return statusForFilter(notif) === filter;
  });

  const pendingCount = notifications.filter(n => statusForFilter(n) === 'pending').length;
  const approvedCount = notifications.filter(n => statusForFilter(n) === 'approved').length;
  const rejectedCount = notifications.filter(n => statusForFilter(n) === 'rejected').length;

  const isAdminPendingAssignment = (n: Notification) =>
    user?.role === 'admin' && n.type === 'subject-assign' && n.status === 'pending' && n.requestData?.assignmentId;
  const isTeacherPendingAssignment = (n: Notification) =>
    user?.role === 'teacher' && n.type === 'subject-assign' && n.status === 'admin_approved' && n.requestData?.assignmentId;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-32 sm:pb-36 pt-4 sm:pt-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-32 sm:pb-36 pt-4 sm:pt-6">
      {/* Header with Back Button */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-blue-200/50 dark:border-blue-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft
              className="w-5 h-5 text-gray-800 dark:text-white"
              strokeWidth={2.5}
              fill="none"
            />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">Notifications</h1>
            <p className="text-sm sm:text-base text-black/70 dark:text-slate-400">View all your approval requests</p>
          </div>
        </div>

      </motion.div>

      {/* View Tabs - Only show for verifiers who have multiple views */}
      {user?.role === 'verifier' && (
        <div className="flex p-1 mb-6 bg-gray-100 dark:bg-slate-700/50 rounded-xl w-fit">
          <button
            onClick={() => setActiveView('notifications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeView === 'notifications'
              ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs">
              {notifications.length}
            </span>
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeView === 'history'
              ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            <History className="w-4 h-4" />
            Assignment History
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs text-blue-600 dark:text-blue-400">
              {historyCount}
            </span>
          </button>
        </div>
      )}

      {/* Notifications View */}
      {
        activeView === 'notifications' && (
          <>
            {/* Verifier Type Filters */}
            {user?.role === 'verifier' && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${typeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter('time-slot')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${typeFilter === 'time-slot'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Time Slot / Break
                </button>
                <button
                  onClick={() => setTypeFilter('unit-start')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${typeFilter === 'unit-start'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Unit Start
                </button>
                <button
                  onClick={() => setTypeFilter('unit-complete')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${typeFilter === 'unit-complete'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Unit Complete
                </button>
              </div>
            )}

            {/* Filter Tabs - Hide for Verifier as they only see pending here */}
            {user?.role !== 'verifier' && (
              <div className="flex gap-2 mb-4 overflow-x-auto">
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${filter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-black dark:text-white border border-gray-200 dark:border-slate-700'
                    }`}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${filter === 'approved'
                    ? 'bg-green-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-black dark:text-white border border-gray-200 dark:border-slate-700'
                    }`}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-colors ${filter === 'rejected'
                    ? 'bg-red-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-black dark:text-white border border-gray-200 dark:border-slate-700'
                    }`}
                >
                  Rejected ({rejectedCount})
                </button>
              </div>
            )}


            {/* Notifications List */}
            <div className="space-y-4">
              {
                filteredNotifications.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200/40 dark:border-blue-700/40 shadow-lg p-8 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4" strokeWidth={2.5} fill="none" style={{ stroke: '#6b7280' }} />
                    <p className="text-gray-500 dark:text-gray-400">
                      {`No ${filter} notifications found.`}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notification, index) => (
                    <motion.div
                      key={notification._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-white dark:bg-slate-800 rounded-2xl border-2 shadow-lg p-4 sm:p-6 ${statusForFilter(notification) === 'pending'
                        ? 'border-yellow-300 dark:border-yellow-700'
                        : statusForFilter(notification) === 'approved'
                          ? 'border-green-300 dark:border-green-700'
                          : 'border-red-300 dark:border-red-700'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className={`p-3 rounded-xl flex-shrink-0 ${statusForFilter(notification) === 'pending'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : statusForFilter(notification) === 'approved'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                          }`}>
                          {user?.role === 'verifier' ? (
                            <Bell
                              className="w-6 h-6"
                              strokeWidth={2.5}
                              style={{ color: '#3b82f6', stroke: '#3b82f6' }}
                            />
                          ) : statusForFilter(notification) === 'pending' ? (
                            <Clock
                              className="w-6 h-6"
                              strokeWidth={2.5}
                              style={{ color: '#ca8a04', stroke: '#ca8a04' }}
                            />
                          ) : statusForFilter(notification) === 'approved' ? (
                            <CheckCircle2
                              className="w-6 h-6"
                              strokeWidth={2.5}
                              style={{ color: '#15803d', stroke: '#15803d' }}
                            />
                          ) : (
                            <XCircle
                              className="w-6 h-6"
                              strokeWidth={2.5}
                              style={{ color: '#dc2626', stroke: '#dc2626' }}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {user?.role !== 'verifier' && (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusForFilter(notification) === 'pending'
                                    ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                                    : statusForFilter(notification) === 'approved'
                                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                      : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                    }`}>
                                    {notification.status === 'admin_approved'
                                      ? (user?.role === 'admin' ? 'APPROVED' : 'PENDING')
                                      : notification.status.toUpperCase()}
                                  </span>
                                )}
                                {user?.role !== 'verifier' && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {getNotificationTypeLabel(notification.type)}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-black dark:text-white mb-1">
                                {getNotificationMessage(notification)}
                              </h3>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" strokeWidth={2.5} fill="none" style={{ stroke: '#374151' }} />
                              <span>
                                Requested: {new Date(notification.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            {notification.type === 'subject-assign' && notification.requestData && (
                              <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 space-y-1">
                                <p className="text-sm font-medium text-black dark:text-white">
                                  <span className="text-gray-500 dark:text-gray-400">From verifier:</span>{' '}
                                  {notification.requestData?.verifierName || (notification.requestedBy?.name) || '—'}
                                </p>
                                <p className="text-sm font-medium text-black dark:text-white">
                                  <span className="text-gray-500 dark:text-gray-400">Assign to teacher:</span>{' '}
                                  {notification.requestData.toTeacherName || '—'}
                                </p>
                                {notification.requestData.reason && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Reason:</span>{' '}
                                    {notification.requestData.reason}
                                  </p>
                                )}
                              </div>
                            )}

                            {notification.status === 'approved' && notification.approvedAt && user?.role !== 'verifier' && (
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                <CheckCircle2
                                  className="w-4 h-4"
                                  strokeWidth={2.5}
                                  style={{ color: '#15803d', stroke: '#15803d' }}
                                />
                                <span>
                                  Approved: {new Date(notification.approvedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {notification.approvedBy && (
                                  <span className="ml-2">by {notification.approvedBy.name}</span>
                                )}
                              </div>
                            )}

                            {notification.status === 'rejected' && notification.rejectedAt && (
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                                <XCircle
                                  className="w-4 h-4"
                                  strokeWidth={2.5}
                                  style={{ color: '#dc2626', stroke: '#dc2626' }}
                                />
                                <span>
                                  Rejected: {new Date(notification.rejectedAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}

                            {notification.status === 'rejected' && notification.rejectionReason && (
                              <div className="mt-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                <p className="text-sm text-red-800 dark:text-red-200">
                                  <strong>Reason:</strong> {notification.rejectionReason}
                                </p>
                              </div>
                            )}

                            {/* Admin: Approve/Reject assignment request */}
                            {isAdminPendingAssignment(notification) && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-end">
                                <input
                                  type="text"
                                  placeholder="Rejection reason (if rejecting)"
                                  value={rejectReason[notification.requestData.assignmentId] || ''}
                                  onChange={e => setRejectReason(prev => ({ ...prev, [notification.requestData.assignmentId]: e.target.value }))}
                                  className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-black dark:text-white text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    disabled={!!actionLoading}
                                    onClick={() => handleAdminApprove(notification.requestData.assignmentId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {actionLoading === notification.requestData.assignmentId ? (
                                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    Approve
                                  </button>
                                  <button
                                    disabled={!!actionLoading || !(rejectReason[notification.requestData.assignmentId] || '').trim()}
                                    onClick={() => handleAdminReject(notification.requestData.assignmentId, rejectReason[notification.requestData.assignmentId] || '')}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Teacher: Approve/Reject assignment (after admin approved) */}
                            {isTeacherPendingAssignment(notification) && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-end">
                                <input
                                  type="text"
                                  placeholder="Reason (if rejecting)"
                                  value={rejectReason[notification.requestData.assignmentId] || ''}
                                  onChange={e => setRejectReason(prev => ({ ...prev, [notification.requestData.assignmentId]: e.target.value }))}
                                  className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-black dark:text-white text-sm"
                                />
                                <div className="flex gap-2">
                                  <button
                                    disabled={!!actionLoading}
                                    onClick={() => handleTeacherApprove(notification.requestData.assignmentId)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {actionLoading === notification.requestData.assignmentId ? (
                                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                    Accept
                                  </button>
                                  <button
                                    disabled={!!actionLoading || !(rejectReason[notification.requestData.assignmentId] || '').trim()}
                                    onClick={() => handleTeacherReject(notification.requestData.assignmentId, rejectReason[notification.requestData.assignmentId] || '')}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Delete Button for Verifier */}
                        {user?.role === 'verifier' && (
                          <button
                            onClick={(e) => handleDelete(notification._id, e)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete Notification"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))
                )
              }
            </div>
          </>
        )
      }

      {/* History View */}
      {
        activeView === 'history' && (
          <AssignmentRequestHistory user={user} />
        )
      }
    </div>
  );
}

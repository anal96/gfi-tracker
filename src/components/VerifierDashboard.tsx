import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, Filter, Eye, Check, X, Users, Calendar, Bell, CalendarDays, ChevronDown, ChevronUp, History } from 'lucide-react';
import { motion } from 'motion/react';
import { MetricCard } from './MetricCard';
import { SubjectAssignSection } from './SubjectAssignSection';

import { TimeTableImport } from './TimeTableImport';
import api from '../services/api';

interface Approval {
  _id: string;
  type: 'unit-complete' | 'unit-start' | 'time-slot' | 'subject-assign' | 'break-timing';
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: {
    _id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  requestData: any;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface VerifierDashboardProps {
  user: any;
  isDarkMode?: boolean;
  defaultTab?: 'approvals' | 'assign';
  showApprovalsContent?: boolean; // If false, hide stats, filters, and approvals list
  isHomePage?: boolean; // If true, show metric cards
  onNavigate?: (page: string) => void;
}

interface DashboardData {
  pendingApprovals: Approval[];
  recentApprovals: Approval[];
  stats: {
    pending: number;
    today: number;
    approvedToday: number;
    rejectedToday: number;
    totalPending: number;
    notificationsCount?: number;
    unitStartRequests?: number;
    timeSlotRequests?: number;
  };
}

import { useDashboard } from '../context/DashboardContext';

export function VerifierDashboard({ user, isDarkMode = false, defaultTab = 'approvals', showApprovalsContent = true, isHomePage = false, onNavigate }: VerifierDashboardProps) {
  // Use Global Context for Data (WhatsApp-style instant navigation)
  const { data, loading, error, refreshDashboard, updateOptimistic } = useDashboard();

  // Local UI state only
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'unit-complete' | 'unit-start' | 'time-slot' | 'subject-assign'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  // On home page, default to 'assign' tab (Time Table), on approval page default to 'approvals'
  const initialTab = !showApprovalsContent ? 'assign' : (defaultTab || 'approvals');
  const [activeTab, setActiveTab] = useState<'approvals' | 'assign'>(initialTab);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());

  const toggleTeacherGroup = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  // Sync activeTab when defaultTab or showApprovalsContent prop changes
  useEffect(() => {
    if (!showApprovalsContent) {
      setActiveTab('assign');
    } else {
      setActiveTab(defaultTab || 'approvals');
    }
  }, [defaultTab, showApprovalsContent]);

  // Live clock for greeting card
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Refresh data when component mounts (silently updates context)
  useEffect(() => {
    refreshDashboard();
  }, []);

  const handleApprove = async (approvalId: string) => {
    try {
      // Optimistic UI update: Remove item immediately
      if (data) {
        updateOptimistic({
          pendingApprovals: data.pendingApprovals.filter(a => a._id !== approvalId),
          stats: {
            ...data.stats,
            pending: data.stats.pending - 1,
            approvedToday: data.stats.approvedToday + 1
          }
        });
      }

      const response = await api.approveRequest(approvalId);
      if (!response.success) {
        // Revert on failure
        refreshDashboard();
      }
    } catch (err: any) {
      console.error(err);
      refreshDashboard();
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;
    try {
      // Optimistic UI update
      if (data) {
        updateOptimistic({
          pendingApprovals: data.pendingApprovals.filter(a => a._id !== selectedApproval._id),
          stats: {
            ...data.stats,
            pending: data.stats.pending - 1,
            rejectedToday: data.stats.rejectedToday + 1
          }
        });
      }

      await api.rejectRequest(selectedApproval._id, rejectionReason);

      setShowRejectDialog(false);
      setSelectedApproval(null);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
      refreshDashboard();
    }
  };

  const handleUnitClick = (teacherId: string) => {
    if (!teacherId) return;

    // Find the element
    const element = document.getElementById(`teacher-group-${teacherId}`);

    if (element) {
      // Expand if collapsed
      if (!expandedTeachers.has(teacherId)) {
        toggleTeacherGroup(teacherId);
      }

      // Scroll into view
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional: Highlight effect could be added here
      }, 100);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'unit-complete': return 'Unit Completion';
      case 'unit-start': return 'Start Unit';
      case 'time-slot': return 'Time Slot';
      case 'subject-assign': return 'Subject Assignment';
      case 'break-timing': return 'Break Timing';
      default: return type;
    }
  };

  const getTimeSlotLabel = (slotId: string) => {
    const slotMap: Record<string, string> = {
      '9-10': '9:00 - 10:00',
      '10-11': '10:00 - 11:00',
      '11-12': '11:00 - 12:00',
      '12-13': '12:00 - 13:00',
      '13-14': '13:00 - 14:00',
      '14-15': '14:00 - 15:00',
      '15-16': '15:00 - 16:00',
      '16-17': '16:00 - 17:00'
    };
    return slotMap[slotId] || slotId;
  };

  const formatRequestDetails = (approval: Approval) => {
    if (approval.type === 'time-slot') {
      const slotId = approval.requestData?.slotId;
      const checked = approval.requestData?.checked;
      const date = approval.requestData?.date ? new Date(approval.requestData.date).toLocaleDateString() : 'Today';
      return {
        title: `Time Slot: ${getTimeSlotLabel(slotId)}`,
        action: checked ? 'Select' : 'Deselect',
        date: date
      };
    } else if (approval.type === 'unit-complete') {
      const unitName = approval.requestData?.unitName;
      const subjectName = approval.requestData?.subjectName;
      return {
        title: `Complete Unit: ${unitName || 'Unknown Unit'}`,
        action: `Mark unit "${unitName || 'Unknown'}" as completed ${subjectName ? `(${subjectName})` : ''}`,
        date: new Date(approval.createdAt).toLocaleDateString() + ' ' + new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } else if (approval.type === 'unit-start') {
      const unitName = approval.requestData?.unitName;
      const subjectName = approval.requestData?.subjectName;
      return {
        title: `Start Unit: ${unitName || 'Unknown Unit'}`,
        action: `Start working on "${unitName || 'Unknown'}" ${subjectName ? `(${subjectName})` : ''}`,
        date: new Date(approval.createdAt).toLocaleDateString() + ' ' + new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } else if (approval.type === 'subject-assign') {
      return {
        title: `Assign Subject`,
        action: `Assign subject to teacher`,
        date: ''
      };
    } else if (approval.type === 'break-timing') {
      const duration = approval.requestData?.breakDuration;
      const date = approval.requestData?.date ? new Date(approval.requestData.date).toLocaleDateString() : 'Today';
      return {
        title: `Break Timing`,
        action: duration ? `Set break to ${duration} minutes` : 'Remove break',
        date: date
      };
    }
    return { title: getTypeLabel(approval.type), action: '', date: '' };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'approved': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'rejected': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredApprovals = () => {
    if (!data) return [];

    let approvals: Approval[] = [];

    // Safely access arrays with defaults
    let pending = data.pendingApprovals || [];
    let recent = data.recentApprovals || [];

    // Filter history to only show requests processed by the current user
    if (user?._id) {
      recent = recent.filter(a => {
        let actor = a.approvedBy;
        if (!actor && (a as any).rejectedBy) {
          actor = (a as any).rejectedBy;
        }

        if (actor) {
          const actorId = typeof actor === 'string' ? actor : actor._id;
          if (actorId === user._id) return true;
        }

        return false;
      });
    }

    // EXCLUDE requests I initiated (e.g. Subject Assignments I requested)
    // The dashboard is for approving OTHERS' requests, not seeing my own status (which is in History)
    if (user?._id) {
      pending = pending.filter(a => {
        const requesterId = typeof a.requestedBy === 'string' ? a.requestedBy : a.requestedBy?._id;
        return requesterId !== user._id;
      });
      recent = recent.filter(a => {
        const requesterId = typeof a.requestedBy === 'string' ? a.requestedBy : a.requestedBy?._id;
        return requesterId !== user._id;
      });
    }

    approvals = filter === 'all'
      ? [...pending, ...recent]
      : filter === 'pending'
        ? pending
        : recent.filter(a => a.status === filter);

    if (typeFilter !== 'all') {
      approvals = approvals.filter(a => a.type === typeFilter);
    }

    // Remove duplicates - for time-slot type, keep only the latest request per slotId+date+checked combination
    const seen = new Map<string, Approval>();
    approvals.forEach(approval => {
      if (approval.type === 'time-slot') {
        const requesterId = typeof approval.requestedBy === 'string' ? approval.requestedBy : approval.requestedBy?._id || 'unknown';
        const key = `${approval.requestData?.slotId}-${approval.requestData?.date}-${approval.requestData?.checked}-${approval.status}-${requesterId}`;
        const existing = seen.get(key);
        if (!existing || new Date(approval.createdAt) > new Date(existing.createdAt)) {
          seen.set(key, approval);
        }
      } else {
        // For other types, use approval ID
        const key = approval._id;
        if (!seen.has(key)) {
          seen.set(key, approval);
        }
      }
    });

    return Array.from(seen.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  // Safe stats object: merge with defaults so cached/partial data never leaves .pending undefined
  const defaultStats = { pending: 0, approvedToday: 0, rejectedToday: 0, totalPending: 0 };
  const rawStats: any = data?.stats && typeof data.stats === 'object' ? data.stats : {};
  const safeStats = {
    ...defaultStats,
    ...rawStats,
    pending: Number(rawStats.pending) || 0,
    approvedToday: Number(rawStats.approvedToday) || 0,
    rejectedToday: Number(rawStats.rejectedToday) || 0,
    totalPending: Number(rawStats.totalPending) || 0,
    notificationsCount: Number(rawStats.notificationsCount) || 0
  };

  const approvals = data ? filteredApprovals() : [];





  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      {/* Greeting Card - Only show on home page */}
      {/* Modern Mobile-First Header - Matched to Teacher Dashboard */}
      {isHomePage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-1">
                {getGreeting()}
              </h1>
              <p className="text-sm sm:text-base text-black/70 dark:text-slate-400 font-medium">
                {user?.name || 'Verifier'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate?.('exam')}
                className="relative p-2 h-[42px] sm:h-[50px] flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-blue-200/50 dark:border-blue-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
              >
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                <span className="hidden sm:inline font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  2024-25
                </span>
              </button>
              <button
                onClick={() => onNavigate?.('notifications')}
                className="relative p-3 rounded-xl bg-white dark:bg-slate-800 border border-blue-200/50 dark:border-blue-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
                title="Notifications & History"
              >
                <div className="flex gap-1 justify-center items-center">
                  <Bell
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                    strokeWidth={2.5}
                    fill="none"
                  />
                  <div className="w-[1px] h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                  <History
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                    strokeWidth={2.5}
                  />
                </div>
                {safeStats.notificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800">
                    {safeStats.notificationsCount > 99 ? '99+' : safeStats.notificationsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

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

          {/* Action Required Box */}
          {safeStats.totalPending > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20 cursor-pointer group"
              onClick={() => onNavigate?.('subjects')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-0.5">Action Required</h3>
                    <p className="text-blue-100 font-medium">
                      You have {safeStats.totalPending} pending request{safeStats.totalPending !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors">
                  <ChevronDown className="w-5 h-5 -rotate-90" />
                </div>
              </div>
            </motion.div>
          )}

        </motion.div>
      )}

      {/* Header */}
      {/* Header Title - Only show on non-home pages */}
      {!isHomePage && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">Verifier Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and approve requests from teachers and admins</p>


        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Tabs - Only show on assign page, not on home page */}
      {!showApprovalsContent && !isHomePage && (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('assign')}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'assign'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <Users className="w-4 h-4" />
              Assign Subjects
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'approvals'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <Calendar className="w-4 h-4" />
              Time Table
            </button>
          </div>
        </div>
      )}

      {loading && showApprovalsContent && activeTab === 'approvals' && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Stats Cards - Show on home page */}
      {isHomePage && data && (
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6"
        >
          <MetricCard
            title="Pending Requests"
            value={String(safeStats.pending)}
            icon={Clock}
            color="from-yellow-500 to-orange-500"
            index={0}
          />
          <MetricCard
            title="Approved Today"
            value={String(safeStats.approvedToday)}
            icon={CheckCircle2}
            color="from-emerald-500 to-green-600"
            index={1}
          />
          <MetricCard
            title="Rejected Today"
            value={String(safeStats.rejectedToday)}
            icon={XCircle}
            color="from-red-500 to-pink-600"
            index={2}
          />
          <MetricCard
            title="Total Pending"
            value={String(safeStats.totalPending)}
            icon={AlertCircle}
            color="from-blue-500 to-indigo-600"
            index={3}
          />
        </div>
      )}

      {/* Assign Tab Content - Show SubjectAssignSection only on assign page, not home page */}
      {activeTab === 'assign' && !showApprovalsContent && !isHomePage && (
        <SubjectAssignSection user={user} />
      )}



      {/* Time Table Tab Content - Import from Excel with preview; no edits without Approve & Send */}
      {activeTab === 'approvals' && !showApprovalsContent && !isHomePage && (
        <div className="max-w-4xl mx-auto">
          <TimeTableImport />
        </div>
      )}

      {/* Approvals Tab Content - Only show on approval page */}
      {showApprovalsContent && activeTab === 'approvals' && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-4 items-center justify-start">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Status:</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Type:</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="time-slot">Time Slot</option>
                  <option value="break-timing">Break Timing</option>
                  <option value="unit-start">Start Unit</option>
                  <option value="unit-complete">Complete Unit</option>
                  <option value="subject-assign">Subject Assignment</option>
                </select>
              </div>
            </div>
          </div>

          {/* Approvals List */}
          <div className="space-y-4">
            {approvals.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">
                  {filter === 'pending'
                    ? 'No pending approvals. All requests have been processed.'
                    : 'No approvals found'}
                </p>
              </div>
            ) : (
              (() => {
                // Split approvals into grouped (Time/Break) and individual (Others)
                const shouldGroup = (type: string) => ['time-slot', 'break-timing'].includes(type);

                const otherApprovals = approvals.filter(a => !shouldGroup(a.type));
                const groupedApprovals = approvals.filter(a => shouldGroup(a.type));

                // Group by teacher
                const groups = groupedApprovals.reduce((acc, curr) => {
                  const teacherId = curr.requestedBy?._id || 'unknown';
                  const teacherName = curr.requestedBy?.name || 'Unknown Teacher';
                  const teacherEmail = curr.requestedBy?.email || 'No email';
                  const teacherAvatar = curr.requestedBy?.avatar;

                  if (!acc[teacherId]) {
                    acc[teacherId] = {
                      teacherName,
                      teacherEmail,
                      teacherAvatar,
                      requests: []
                    };
                  }
                  acc[teacherId].requests.push(curr);
                  return acc;
                }, {} as Record<string, { teacherName: string, teacherEmail: string, teacherAvatar?: string, requests: Approval[] }>);

                return (
                  <>
                    {/* Render Grouped Approvals as Accordions */}
                    {Object.entries(groups).map(([teacherId, group]) => (
                      <div key={teacherId} id={`teacher-group-${teacherId}`} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                          onClick={() => toggleTeacherGroup(teacherId)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {group.teacherAvatar && group.teacherAvatar.length > 0 ? (
                              <img
                                src={group.teacherAvatar}
                                alt={group.teacherName}
                                className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 border-2 border-white dark:border-slate-700 shadow-sm">
                                {group.teacherName !== 'Unknown Teacher' ? (
                                  <span className="font-bold text-sm">{group.teacherName.charAt(0).toUpperCase()}</span>
                                ) : (
                                  <Users className="w-5 h-5" />
                                )}
                              </div>
                            )}
                            <div className="text-left">
                              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                {group.teacherName}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {group.requests.length} Request{group.requests.length !== 1 ? 's' : ''} • {group.teacherEmail}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                              {group.requests.slice(0, 3).map((r, i) => (
                                <div key={r._id} className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-xs font-bold text-white ${r.type === 'time-slot' ? 'bg-blue-500' : 'bg-orange-500'
                                  }`} style={{ zIndex: 3 - i }}>
                                  {r.type === 'time-slot' ? <Clock className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                </div>
                              ))}
                              {group.requests.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                  +{group.requests.length - 3}
                                </div>
                              )}
                            </div>
                            {expandedTeachers.has(teacherId) ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {expandedTeachers.has(teacherId) && (
                          <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                            {group.requests.map(approval => (
                              <motion.div
                                key={approval._id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`group p-4 transition-all hover:bg-gray-50 dark:hover:bg-slate-700/50 ${approval.status === 'pending' ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-800/50'
                                  }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  {/* Left Section: Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1.5">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${approval.type === 'break-timing'
                                        ? 'bg-orange-50 border-orange-100 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300'
                                        : 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                                        }`}>
                                        {approval.type === 'break-timing' ? 'Break' : 'Slot'}
                                      </span>
                                      <span className="text-xs text-gray-400 font-medium">
                                        {formatRequestDetails(approval).date} • {new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {approval.type === 'time-slot' ? (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                          <span className={`font-semibold ${formatRequestDetails(approval).action === 'Select' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {formatRequestDetails(approval).action}
                                          </span>
                                          <span className="mx-1.5 text-gray-300 dark:text-gray-600">|</span>
                                          <span className="font-bold text-gray-900 dark:text-white">
                                            {getTimeSlotLabel(approval.requestData?.slotId)}
                                          </span>
                                        </p>
                                      ) : (
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                          {formatRequestDetails(approval).action}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Section: Actions/Status */}
                                  <div className="flex items-center justify-end shrink-0">
                                    {approval.status === 'pending' ? (
                                      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedApproval(approval);
                                            setShowRejectDialog(true);
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors dark:text-red-400 dark:bg-red-900/10 dark:hover:bg-red-900/30 dark:border-red-900/30"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApprove(approval._id);
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all"
                                        >
                                          Approve
                                        </button>
                                      </div>
                                    ) : (
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(approval.status)}`}>
                                        {approval.status === 'approved' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                        {approval.status.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Render Other Request Types (Individual Cards) */}
                    {otherApprovals.map((approval) => (
                      <motion.div
                        key={approval._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all ${approval.status === 'pending'
                          ? 'border-l-4 border-l-yellow-400'
                          : approval.status === 'approved'
                            ? 'border-l-4 border-l-green-500'
                            : 'border-l-4 border-l-red-500'
                          }`}
                      >
                        <div className="p-4 sm:p-5">
                          {/* Header: Type and Status */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-lg ${approval.type === 'subject-assign'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                }`}>
                                <Filter className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                                  {getTypeLabel(approval.type)}
                                </h3>

                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(approval.status)}`}>
                              {approval.status.toUpperCase()}
                            </span>
                          </div>

                          {/* Main Content Body */}
                          <div className="mb-5 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/30">
                                <div className="p-2 bg-white dark:bg-slate-600 rounded-full shadow-sm">
                                  <Users className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Requested by</p>
                                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {approval.requestedBy?.name ?? 'Unknown'}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {approval.requestedBy?.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/30">
                                <div className="p-2 bg-white dark:bg-slate-600 rounded-full shadow-sm">
                                  <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Requested at</p>
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    {new Date(approval.createdAt).toLocaleDateString()}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {(approval.status === 'approved' || approval.status === 'rejected') && (
                              <div className={`p-3 rounded-lg border ${approval.status === 'approved' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                                <p className={`text-sm font-medium ${approval.status === 'approved' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                  {approval.status === 'approved' ? 'Approved' : 'Rejected'} by <span className="font-bold">{approval.approvedBy?.name || (approval as any).rejectedBy?.name || 'Admin'}</span> at {formatDate(approval.approvedAt || approval.rejectedAt || '')}
                                </p>
                                {approval.rejectionReason && (
                                  <p className="text-sm mt-1 text-red-700 dark:text-red-300">
                                    Reason: <span className="font-bold">{approval.rejectionReason}</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Actions Footer */}
                          {approval.status === 'pending' && (
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                              <button
                                onClick={() => {
                                  setSelectedApproval(approval);
                                  setShowRejectDialog(true);
                                }}
                                className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 dark:bg-slate-800 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to APPROVE this ${getTypeLabel(approval.type)} request?`)) {
                                    handleApprove(approval._id);
                                  }
                                }}
                                className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2 transform active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Approve Request
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </>
                );
              })()
            )}
          </div>

          {/* Active Units (In Progress) Section - Shows started units */}
          {(data?.inProgressUnits?.length || 0) > 0 && (
            <div className="mt-8 mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Active Units (In Progress)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data!.inProgressUnits!.map((unit: any) => (
                  <div
                    key={unit.id}
                    onClick={() => handleUnitClick(unit.teacherId)}
                    className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${unit.subjectColor || 'from-blue-500 to-indigo-600'} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                        {unit.subject?.substring(0, 1) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1" title={unit.unit}>{unit.unit}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1" title={unit.subject}>{unit.subject}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Teacher</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate max-w-[120px]" title={unit.teacherName}>{unit.teacherName}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Started</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {new Date(unit.startedAt).toLocaleDateString()} • {new Date(unit.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Duration</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {unit.totalHours ? Number(unit.totalHours).toFixed(1) : '0.0'} hrs
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )
      }

      {/* Reject Dialog */}
      {
        showRejectDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold mb-4 text-black dark:text-white">Reject Request</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Please provide a reason for rejecting this request:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 mb-4"
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRejectDialog(false);
                    setRejectionReason('');
                    setSelectedApproval(null);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Reject Request
                </button>
              </div>
            </motion.div>
          </div>
        )
      }
    </div >
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { History, CheckCircle2, Trash2 } from 'lucide-react';
import api from '../services/api';

interface Assignment {
  _id: string;
  fromTeacher: { _id: string; name: string; email: string } | null;
  toTeacher: { _id: string; name: string; email: string };
  subject: { _id: string; name: string };
  remainingUnits: Array<{ _id: string; name: string; order: number }>;
  reason: string;
  status: 'pending' | 'admin_approved' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface AssignmentRequestHistoryProps {
  user: any;
}

export function AssignmentRequestHistory({ user }: AssignmentRequestHistoryProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      // Force fresh fetch to ensure immediate visibility of new assignments
      const res = await api.getVerifierAssignments('all', true);
      if (res?.success && Array.isArray(res.data)) {
        const sorted = [...res.data].sort(
          (a: Assignment, b: Assignment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAssignments(sorted);
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error('Error loading assignment history:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = assignments.filter((a) => {
    if (filter === 'pending') return a.status === 'pending' || a.status === 'admin_approved';
    return a.status === filter;
  });

  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Delete this assignment request? This cannot be undone.')) return;
    try {
      setDeletingId(assignmentId);
      const res = await api.deleteVerifierAssignment(assignmentId);
      if (res?.success) {
        setAssignments((prev) => prev.filter((a) => a._id !== assignmentId));
      } else {
        alert(res?.message || 'Failed to delete');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const is404 = err?.status === 404 || msg.includes('404') || msg.toLowerCase().includes('not found');
      // If 404 (not found or route missing), remove from list so UI stays in sync
      if (is404) {
        setAssignments((prev) => prev.filter((a) => a._id !== assignmentId));
      } else {
        alert(msg || 'Failed to delete');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            Assignment Request History {filtered.length > 0 && <span>({filtered.length})</span>}
          </h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-black dark:text-white text-sm"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No assignment requests found.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((assignment) => (
              <div
                key={assignment._id}
                className={`p-4 rounded-xl border-2 ${assignment.status === 'pending' || assignment.status === 'admin_approved'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                  : assignment.status === 'approved'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                  }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${assignment.status === 'pending' || assignment.status === 'admin_approved'
                          ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                          : assignment.status === 'approved'
                            ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                            : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                          }`}
                      >
                        {assignment.status === 'admin_approved' ? 'ADMIN APPROVED' : assignment.status === 'pending' ? 'WAITING ADMIN' : assignment.status === 'approved' ? 'TEACHER ACCEPTED' : 'REJECTED'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                        {new Date(assignment.createdAt).toLocaleDateString()}
                        {assignment.createdAt && (
                          <span className="ml-2">
                            {new Date(assignment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {assignment.fromTeacher && (
                        <div className="text-sm">
                          <span className="font-semibold text-black dark:text-white">From Teacher:</span>{' '}
                          <span className="text-gray-700 dark:text-gray-300">
                            {`${assignment.fromTeacher.name} (${assignment.fromTeacher.email})`}
                          </span>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="font-semibold text-black dark:text-white">To Teacher:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">
                          {assignment.toTeacher?.name || 'Unknown'} ({assignment.toTeacher?.email || 'N/A'})
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold text-black dark:text-white">Subject:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">
                          {assignment.subject?.name || 'Unknown Subject'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold text-black dark:text-white">Note/Comment:</span>{' '}
                        <span className="text-gray-700 dark:text-gray-300">{assignment.reason}</span>
                      </div>
                      {assignment.remainingUnits && assignment.remainingUnits.length > 0 && (
                        <div className="text-sm mt-2">
                          <span className="font-semibold text-black dark:text-white">Remaining Units:</span>{' '}
                          <span className="text-gray-700 dark:text-gray-300">
                            {assignment.remainingUnits.map((u) => u.name).join(', ')}
                          </span>
                        </div>
                      )}
                      {assignment.status === 'rejected' && assignment.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <span className="font-semibold text-red-800 dark:text-red-200">Rejection Reason:</span>{' '}
                          <span className="text-red-700 dark:text-red-300">{assignment.rejectionReason}</span>
                        </div>
                      )}
                      {assignment.status === 'admin_approved' && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                          <strong>Step 1 Complete:</strong> Approved by Admin.
                          <br />
                          <strong>Step 2 Pending:</strong> Waiting for Teacher to accept.
                        </div>
                      )}
                      {assignment.status === 'approved' && assignment.approvedAt && (
                        <div className="text-xs text-green-600 dark:text-green-400 mt-2 flex flex-col gap-1 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Process Complete</span>
                          </div>
                          <span className="opacity-80">Approved by Admin & Accepted by Teacher on {new Date(assignment.approvedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(assignment._id)}
                    disabled={deletingId === assignment._id}
                    className="flex-shrink-0 p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Delete"
                  >
                    {deletingId === assignment._id ? (
                      <span className="inline-block w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

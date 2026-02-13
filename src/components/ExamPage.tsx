import { useState, useEffect } from 'react';
import { ChevronLeft, BookOpen, Layers, CheckCircle2, Circle, AlertCircle, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import api from '../services/api';

interface ExamPageProps {
    user: any;
    isDarkMode?: boolean;
    onBack: () => void;
}

interface Batch {
    _id: string;
    name: string;
    year: string;
}

interface Subject {
    _id: string;
    name: string;
    color: string;
    teacher?: {
        name: string;
        email: string;
    };
}

interface Unit {
    _id: string;
    name: string;
    order: number;
    isCompleted: boolean;
    isExamFinished: boolean;
    completedAt?: string;
    taughtBy?: {
        name: string;
    };
}

export function ExamPage({ user, isDarkMode = false, onBack }: ExamPageProps) {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);

    const [selectedBatchId, setSelectedBatchId] = useState<string>('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isAdmin = user?.role === 'admin';

    // Load batches on mount
    useEffect(() => {
        loadBatches();
    }, []);

    // Load subjects when batch changes
    useEffect(() => {
        if (selectedBatchId) {
            loadSubjects(selectedBatchId);
        } else {
            setSubjects([]);
            setSelectedSubjectId('');
        }
    }, [selectedBatchId]);

    // Load units when subject changes
    useEffect(() => {
        if (selectedSubjectId) {
            loadUnits(selectedSubjectId);
        } else {
            setUnits([]);
        }
    }, [selectedSubjectId]);

    const loadBatches = async () => {
        try {
            setLoading(true);
            const response = await api.getExamBatches();
            if (response.success) {
                setBatches(response.data);
            } else {
                setError(response.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load batches');
        } finally {
            setLoading(false);
        }
    };

    const loadSubjects = async (batchId: string) => {
        try {
            setLoading(true);
            const response = await api.getExamSubjects(batchId);
            if (response.success) {
                setSubjects(response.data);
            } else {
                setError(response.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load subjects');
        } finally {
            setLoading(false);
        }
    };

    const loadUnits = async (subjectId: string) => {
        try {
            setLoading(true);
            const response = await api.getExamUnits(subjectId);
            if (response.success) {
                setUnits(response.data);
            } else {
                setError(response.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load units');
        } finally {
            setLoading(false);
        }
    };

    const handleExamToggle = async (unitId: string, currentStatus: boolean, isCompleted: boolean) => {
        const newStatus = !currentStatus;

        // Prevent marking as finished if teaching is not completed
        // But allow unmarking (undoing) even if teaching is not completed (to fix bad state)
        if (newStatus === true && !isCompleted) {
            alert("This unit is not completed yet. Teaching must be completed before the exam can be finished.");
            return;
        }

        try {
            // 1. Optimistic UI update
            setUnits(prev => prev.map(u =>
                u._id === unitId ? { ...u, isExamFinished: newStatus } : u
            ));

            // 2. Call API
            const response = await api.toggleExamStatus(unitId, newStatus);

            if (response.success) {
                // Keep optimistic state.
            } else {
                // 3. Revert on failure
                console.error('Failed to toggle exam status:', response.message);
                setUnits(prev => prev.map(u =>
                    u._id === unitId ? { ...u, isExamFinished: currentStatus } : u
                ));
                alert(response.message || 'Failed to update status');
            }
        } catch (err: any) {
            // 4. Revert on network error
            console.error('Error toggling exam status:', err);
            setUnits(prev => prev.map(u =>
                u._id === unitId ? { ...u, isExamFinished: currentStatus } : u
            ));
            alert('Network error: Failed to save status');
        }
    };

    const handleDeleteBatch = async () => {
        if (!selectedBatchId) return;

        // Find batch name for confirmation
        const batch = batches.find(b => b._id === selectedBatchId);
        if (!window.confirm(`Are you sure you want to delete the batch "${batch?.name}"?`)) return;

        try {
            setLoading(true);
            const res = await api.deleteExamBatch(selectedBatchId);
            if (res.success) {
                setSelectedBatchId('');
                setSelectedSubjectId('');
                setUnits([]);
                await loadBatches();
            } else {
                alert(res.message || 'Failed to delete batch');
            }
        } catch (err: any) {
            console.error('Error deleting batch:', err);
            alert(err.message || 'Failed to delete batch');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Exam Management</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Track exam completion status for units</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-500" />
                        Select Batch
                    </label>
                    <div className="flex gap-2">
                        <select
                            value={selectedBatchId}
                            onChange={(e) => {
                                setSelectedBatchId(e.target.value);
                                setSelectedSubjectId('');
                                setUnits([]);
                            }}
                            className="flex-1 p-2.5 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        >
                            <option value="">-- Choose a Batch --</option>
                            {batches.map(batch => (
                                <option key={batch._id} value={batch._id}>
                                    {batch.name} ({batch.year})
                                </option>
                            ))}
                        </select>
                        {selectedBatchId && (user?.role === 'verifier' || user?.role === 'admin') && (
                            <button
                                onClick={handleDeleteBatch}
                                className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
                                title="Delete Batch"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        Select Subject
                    </label>
                    <select
                        value={selectedSubjectId}
                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                        disabled={!selectedBatchId}
                        className={`w-full p-2.5 rounded-lg border text-gray-900 dark:text-white outline-none transition-all ${!selectedBatchId
                            ? 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                            : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500'
                            }`}
                    >
                        <option value="">-- Choose a Subject --</option>
                        {subjects.map(subject => (
                            <option key={subject._id} value={subject._id}>
                                {subject.name} {subject.teacher ? `(${subject.teacher.name})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Units List */}
            {selectedSubjectId && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-700/30">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Units</h3>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {units.length > 0 ? (
                            units.map((unit) => (
                                <div key={unit._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                                                {unit.order || '#'}
                                            </span>
                                            <h4 className="font-medium text-gray-900 dark:text-white">{unit.name}</h4>
                                        </div>
                                        {unit.taughtBy ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 ml-9">
                                                Completed by {unit.taughtBy.name} on {new Date(unit.completedAt!).toLocaleDateString()}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-orange-500 dark:text-orange-400 ml-9 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Teaching not completed
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {(() => {
                                            // Debugging: Log user role and unit status if verification fails
                                            // console.log('Checking edit permission:', { role: user?.role, unitId: unit._id, isCompleted: unit.isCompleted, isExamFinished: unit.isExamFinished });

                                            const isVerifier = (user?.role || '').toLowerCase() === 'verifier';
                                            // Only Verifier can edit. Admin is read-only.
                                            // Allow edit if Unit is completed OR Exam is already finished (to allow undo)
                                            const canEdit = isVerifier && (unit.isCompleted || unit.isExamFinished);
                                            return (
                                                <label className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${canEdit ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} select-none ${unit.isCompleted
                                                    ? unit.isExamFinished
                                                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                                                    : unit.isExamFinished
                                                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' // Bad state feedback
                                                        : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-gray-700'
                                                    }`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={unit.isExamFinished}
                                                        onChange={() => canEdit && handleExamToggle(unit._id, unit.isExamFinished, unit.isCompleted)}
                                                        disabled={!canEdit}
                                                        className="mr-2 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                                    />
                                                    <span className={`text-sm font-medium ${unit.isExamFinished
                                                        ? 'text-green-700 dark:text-green-300'
                                                        : 'text-gray-700 dark:text-gray-300'
                                                        }`}>
                                                        {unit.isExamFinished ? 'Exam Finished' : 'Exam Not Finished'}
                                                    </span>
                                                </label>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                {loading ? 'Loading units...' : 'No units found for this subject'}
                            </div>
                        )}
                    </div>
                </motion.div>
            )
            }
        </div >
    );
}

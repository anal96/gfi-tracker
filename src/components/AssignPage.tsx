import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { SubjectUnitCard } from './SubjectUnitCard';
import { ActiveUnitCard } from './ActiveUnitCard';
import { BatchManagement } from './BatchManagement';
import api from '../services/api';

export interface Unit {
  id: string;
  name: string;
  status: 'not-started' | 'in-progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
  elapsedTime?: number; // in seconds
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  units: Unit[];
}

interface AssignPageProps {
  user: any;
  isDarkMode?: boolean;
}

export function AssignPage({ user, isDarkMode = false }: AssignPageProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ subjectId: string; unitId: string } | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState<string | null>(null);
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);

  // Load dashboard data
  useEffect(() => {
    // Don't load if user is a verifier (they should use VerifierDashboard)
    if (user?.role === 'verifier') {
      return;
    }
    loadDashboardData();
  }, [user, selectedBatch]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // If no batch is selected, don't load subjects
      if (!selectedBatch) {
        setSubjects([]);
        setSelectedBatchName(null);
        setLoading(false);
        return;
      }

      // Load batch name for display
      try {
        const batchesResponse = await api.getBatches();
        if (batchesResponse.success) {
          const batch = batchesResponse.data?.find((b: any) => b._id === selectedBatch);
          setSelectedBatchName(batch ? `${batch.name} ${batch.year}` : null);
        }
      } catch (err) {
        console.error('Error loading batch name:', err);
      }

      // Call API to get subjects filtered by batch
      const response = await api.getTeacherDashboard(selectedBatch);

      if (response.success && response.data) {
        setSubjects(response.data.subjects || []);
      } else {
        setError(response.message || 'Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Find ALL active units from all subjects
  const activeUnitsData = (() => {
    const activeUnits: Array<{
      unit: any;
      subject: any;
    }> = [];

    for (const subject of subjects) {
      const activeUnitsInSubject = subject.units.filter(u => u.status === 'in-progress');
      for (const unit of activeUnitsInSubject) {
        activeUnits.push({
          unit: {
            ...unit,
            subjectName: subject.name,
            subjectColor: subject.color
          },
          subject
        });
      }
    }

    // Sort by startedAt (most recent first)
    activeUnits.sort((a, b) => {
      const timeA = a.unit.startedAt ? new Date(a.unit.startedAt).getTime() : 0;
      const timeB = b.unit.startedAt ? new Date(b.unit.startedAt).getTime() : 0;
      return timeB - timeA; // Most recent first
    });

    return activeUnits;
  })();

  // Calculate stats
  const totalUnits = subjects.flatMap(s => s.units).length;
  const completedUnits = subjects.flatMap(s => s.units).filter(u => u.status === 'completed').length;
  const inProgressUnits = subjects.flatMap(s => s.units).filter(u => u.status === 'in-progress').length;
  const pendingUnits = subjects.flatMap(s => s.units).filter(u => u.status === 'not-started').length;

  const handleStartUnit = async (subjectId: string, unitId: string) => {
    // Check if another unit in the SAME subject is already in progress
    const currentSubject = subjects.find(s => s.id === subjectId);
    const hasActiveUnitInSameSubject = currentSubject?.units.some(u =>
      u.id !== unitId && u.status === 'in-progress'
    );

    if (hasActiveUnitInSameSubject) {
      const activeUnitName = currentSubject?.units.find(u => u.status === 'in-progress')?.name || 'another unit';
      setErrorModalMessage(`Another unit (${activeUnitName}) in ${currentSubject?.name} is already in progress. Please complete it first before starting a new one.`);
      setShowErrorModal(true);
      return;
    }

    try {
      const response = await api.startUnit(unitId);
      if (response.success) {
        await loadDashboardData(); // Reload to get updated data
      } else {
        alert(response.message || 'Failed to start unit');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start unit');
    }
  };

  const handleCompleteUnit = (subjectId: string, unitId: string) => {
    // Show confirmation modal first
    setPendingComplete({ subjectId, unitId });
    setShowCompleteConfirm(true);
  };

  const confirmCompleteUnit = async () => {
    if (!pendingComplete) return;

    try {
      const response = await api.completeUnit(pendingComplete.unitId);
      if (response.success) {
        alert('✅ Unit completed successfully!');
        await loadDashboardData(); // Reload to get updated data
      } else {
        alert(response.message || 'Failed to complete unit');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to complete unit');
    } finally {
      setShowCompleteConfirm(false);
      setPendingComplete(null);
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

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-32 sm:pb-36 pt-4 sm:pt-6">
      {/* Batch Management Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <BatchManagement
          selectedBatch={selectedBatch}
          onBatchChange={setSelectedBatch}
          user={user}
        />
      </motion.div>

      {/* Active Unit Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        {activeUnitsData.length > 0 && (
          <div className="mb-6">
            {activeUnitsData.length > 1 && (
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-8 rounded-full bg-blue-500 block"></span>
                  Active Units ({activeUnitsData.length})
                </h3>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-slate-700 shadow-sm">
                  <button
                    onClick={() => setActiveUnitIndex(prev => (prev === 0 ? activeUnitsData.length - 1 : prev - 1))}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 min-w-[30px] text-center">
                    {activeUnitIndex + 1} / {activeUnitsData.length}
                  </span>
                  <button
                    onClick={() => setActiveUnitIndex(prev => (prev === activeUnitsData.length - 1 ? 0 : prev + 1))}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              {activeUnitsData.map((activeUnitData, index) => (
                <div
                  key={`${activeUnitData.subject.id}-${activeUnitData.unit.id}`}
                  style={{
                    display: activeUnitsData.length > 1 ? (index === activeUnitIndex ? 'block' : 'none') : 'block'
                  }}
                >
                  <ActiveUnitCard
                    unit={activeUnitData.unit}
                  />
                </div>
              ))}
            </div>

            {activeUnitsData.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-2">
                {activeUnitsData.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveUnitIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${idx === activeUnitIndex
                      ? 'bg-blue-600 w-4'
                      : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Subjects & Units Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white">
            My Subjects
            {selectedBatchName && (
              <span className="text-sm font-normal text-black/70 dark:text-slate-400 ml-2">
                (Filtered by: {selectedBatchName})
              </span>
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-6">
          {subjects.map((subject, index) => (
            <SubjectUnitCard
              key={subject.id}
              subject={subject}
              onStartUnit={(unitId) => handleStartUnit(subject.id, unitId)}
              onCompleteUnit={(unitId) => handleCompleteUnit(subject.id, unitId)}
              onUpdateElapsed={(unitId, elapsed) => handleUpdateElapsedTime(subject.id, unitId, elapsed)}
              index={index}
            />
          ))}
        </div>

        {subjects.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {selectedBatch
                ? 'No subjects found for the selected batch.'
                : 'Please select a batch to view subjects.'}
            </p>
          </div>
        )}
      </motion.div>

      {/* Error Modal for "Another unit in progress" */}
      {showErrorModal && (
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
                <strong>Tip:</strong> Check the "Active" section at the top to see which unit is currently running.
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
      )}

      {/* Complete Unit Confirmation Modal */}
      {showCompleteConfirm && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={() => {
            setShowCompleteConfirm(false);
            setPendingComplete(null);
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Content */}
          <div
            className="relative z-10 bg-white dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-500 shadow-2xl rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-black dark:text-white">
                Complete Unit?
              </h3>
            </div>

            {/* Message */}
            <p className="text-black dark:text-gray-200 mb-6 text-base leading-relaxed">
              Are you sure you want to complete this unit? This action cannot be undone.
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCompleteConfirm(false);
                  setPendingComplete(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-black dark:text-white font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmCompleteUnit}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold transition-all shadow-lg hover:shadow-xl"
              >
                Yes, Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

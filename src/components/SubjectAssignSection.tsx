import { useState, useEffect } from 'react';
import { Users, UserCheck, AlertCircle, CheckCircle2, XCircle, ArrowRight, Loader2, Check, Clock, Circle, ChevronDown, Plus, Pencil, BookOpen, Trash2, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';

interface Teacher {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  incompleteSubjects?: Array<{
    subjectId: string;
    subjectName: string;
    totalUnits: number;
    completedUnits: number;
    incompleteUnits: number;
    remainingUnits: Array<{ id: string; name: string; order: number }>;
  }>;
  totalSubjects?: number;
  totalUnits?: number;
  completedUnits?: number;
  inProgressUnits?: number;
  pendingUnits?: number;
  workloadPercentage?: number;
}

interface SubjectAssignSectionProps {
  user: any;
}

export function SubjectAssignSection({ user }: SubjectAssignSectionProps) {
  const [teachersIncomplete, setTeachersIncomplete] = useState<Teacher[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<Array<{ _id: string; name: string; teacher?: { _id: string; name: string; email?: string } | null; batch?: { _id: string; name: string; year?: string } | null; hasPendingAssignment?: boolean; pendingAssignmentDetails?: any }>>([]);
  const [batches, setBatches] = useState<Array<{ _id: string; name: string; year?: string }>>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReplacementMode, setIsReplacementMode] = useState(false);
  const [selectedFromTeacher, setSelectedFromTeacher] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedToTeacher, setSelectedToTeacher] = useState<string>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Unit Selection State
  interface UnitOption {
    _id: string;
    name: string;
    order: number;
    status: 'completed' | 'in-progress' | 'not-started';
  }
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);

  // Add Batch
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newBatchYear, setNewBatchYear] = useState(new Date().getFullYear().toString());
  const [newBatchTeacherIds, setNewBatchTeacherIds] = useState<string[]>([]);
  const [addBatchSubmitting, setAddBatchSubmitting] = useState(false);
  const [allTeachersForBatch, setAllTeachersForBatch] = useState<Teacher[]>([]);

  // Edit Batch
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [editBatchName, setEditBatchName] = useState('');
  const [editBatchYear, setEditBatchYear] = useState('');
  const [editBatchTeacherIds, setEditBatchTeacherIds] = useState<string[]>([]);
  const [editBatchSubmitting, setEditBatchSubmitting] = useState(false);

  // Add Subject
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectUnits, setNewSubjectUnits] = useState<string[]>(['']);
  const [addSubjectSubmitting, setAddSubjectSubmitting] = useState(false);

  // Add Batch - Subject creation (New)
  const [newBatchSubjects, setNewBatchSubjects] = useState<Array<{ name: string; units: string[]; isOpen?: boolean }>>([{ name: '', units: [], isOpen: true }]);

  useEffect(() => {
    if (selectedSubject) {
      fetchUnits();
    } else {
      setAvailableUnits([]);
      setSelectedUnits([]);
    }
  }, [selectedSubject, isReplacementMode ? selectedFromTeacher : null]); // Refetch if teacher changes in replacement mode

  const fetchUnits = async () => {
    setLoadingUnits(true);
    try {
      // In replacement mode, check status against the 'from' teacher
      const teacherId = isReplacementMode ? selectedFromTeacher : null;
      const response = await api.getSubjectUnits(selectedSubject, teacherId as any);
      if (response && response.success) {
        setAvailableUnits(response.data);
        // By default, select all "not started" or "in-progress" units?
        // Or let user select manually. User said "add dropdown for units".
        // Usually assignments are for remaining work.
        // If Replacement Mode, maybe pre-select incomplete ones?
        if (isReplacementMode && response.data) {
          const incompleteIds = response.data
            .filter((u: UnitOption) => u.status !== 'completed')
            .map((u: UnitOption) => u._id);
          setSelectedUnits(incompleteIds);
        } else {
          setSelectedUnits([]);
        }
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setLoadingUnits(false);
    }
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnits(prev =>
      prev.includes(unitId)
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
    setShowUnitDropdown(false); // Auto-close dropdown after selecting a unit
  };

  const handleSelectAll = () => {
    if (selectedUnits.length === availableUnits.length) {
      setSelectedUnits([]);
    } else {
      setSelectedUnits(availableUnits.map(u => u._id));
    }
    setShowUnitDropdown(false); // Auto-close dropdown after select/deselect all
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    fetchSubjectsByBatch();
    fetchTeachersByBatch();
  }, [selectedBatch]);

  useEffect(() => {
    if (showAddBatch || showEditBatch) {
      api.getAvailableTeachers(null).then((res: any) => {
        if (res?.success && res.data) setAllTeachersForBatch(res.data);
        else setAllTeachersForBatch([]);
      }).catch(() => setAllTeachersForBatch([]));
    }
  }, [showAddBatch, showEditBatch]);

  const fetchSubjectsByBatch = async () => {
    try {
      const res = await api.getVerifierSubjects(selectedBatch || null);
      if (res?.success && res.data) setAllSubjects(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAllSubjects([]);
    }
  };

  const fetchTeachersByBatch = async () => {
    try {
      const batchId = selectedBatch || null;
      const [incompleteRes, availableRes] = await Promise.all([
        api.getTeachersWithIncompleteSubjects(batchId),
        api.getAvailableTeachers(null)
      ]);
      if (incompleteRes?.success && incompleteRes.data) setTeachersIncomplete(incompleteRes.data);
      else setTeachersIncomplete([]);
      if (availableRes?.success && availableRes.data) setAvailableTeachers(availableRes.data);
      else setAvailableTeachers([]);
    } catch {
      setTeachersIncomplete([]);
      setAvailableTeachers([]);
    }
  };

  const handleAddBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newBatchName.trim()) {
      alert('Batch name is required');
      return;
    }
    try {
      setAddBatchSubmitting(true);
      const res = await api.createBatch(newBatchName.trim(), newBatchYear, '', [], newBatchTeacherIds);
      if (res?.success && res.data) {
        const newId = res.data._id;

        // Create Subject if provided
        // Create Subjects
        if (newBatchSubjects.length > 0) {
          try {
            for (const subject of newBatchSubjects) {
              if (subject.name.trim()) {
                const unitNames = subject.units.filter(u => u && u.trim());
                await api.createSubject(subject.name.trim(), null, newId, unitNames);
              }
            }
          } catch (err) {
            console.error('Failed to create subjects for batch:', err);
            alert('Batch created, but some subjects failed to create.');
          }
        }

        setShowAddBatch(false);
        setNewBatchName('');
        setNewBatchYear(new Date().getFullYear().toString());
        setNewBatchTeacherIds([]);
        setNewBatchSubjects([{ name: '', units: [], isOpen: true }]);

        api.getExamBatches({ cacheMaxAge: 0 }).then((r: any) => {
          if (r?.success && r.data) setBatches(Array.isArray(r.data) ? r.data : []);
        }).catch(() => { });
        setSelectedBatch(newId);
        fetchSubjectsByBatch();
        fetchTeachersByBatch();
        alert('Batch created successfully.');
      } else {
        alert(res?.message || 'Failed to create batch');
      }
    } catch (err: any) {
      if (err?.message === 'Batch with this name already exists') {
        alert('A batch with this name already exists. Please choose a different name.');
      } else {
        alert(err?.message || 'Failed to create batch');
      }
    } finally {
      setAddBatchSubmitting(false);
    }
  };

  const toggleBatchTeacher = (teacherId: string) => {
    setNewBatchTeacherIds(prev =>
      prev.includes(teacherId) ? prev.filter(id => id !== teacherId) : [...prev, teacherId]
    );
  };

  const openEditBatch = async () => {
    if (!selectedBatch) return;
    setShowAddBatch(false);
    try {
      const res = await api.getBatch(selectedBatch);
      if (res?.success && res.data) {
        const b = res.data;
        setEditBatchName(b.name || '');
        setEditBatchYear(b.year || new Date().getFullYear().toString());
        setEditBatchTeacherIds(Array.isArray(b.teachers) ? b.teachers.map((t: any) => t._id).filter(Boolean) : []);
        setShowEditBatch(true);
      }
    } catch {
      // Batch may have been deleted (e.g. 404) – clear selection and refresh list (bypass cache)
      setSelectedBatch('');
      setShowEditBatch(false);
      api.getExamBatches({ cacheMaxAge: 0 }).then((r: any) => { if (r?.success && r.data) setBatches(Array.isArray(r.data) ? r.data : []); }).catch(() => { });
      fetchSubjectsByBatch();
      fetchTeachersByBatch();
      alert('This batch could not be loaded (it may have been deleted). The list has been refreshed.');
    }
  };

  const handleEditBatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedBatch) return;
    if (!editBatchName.trim()) {
      alert('Batch name is required');
      return;
    }
    try {
      setEditBatchSubmitting(true);
      const res = await api.updateBatch(selectedBatch, editBatchName.trim(), editBatchYear, undefined, undefined, editBatchTeacherIds);
      if (res?.success && res.data) {
        setBatches(prev => prev.map(b => b._id === selectedBatch ? { ...b, name: editBatchName.trim(), year: editBatchYear } : b));
        setShowEditBatch(false);
        api.getExamBatches({ cacheMaxAge: 0 }).then((r: any) => { if (r?.success && r.data) setBatches(Array.isArray(r.data) ? r.data : []); }).catch(() => { });
        fetchSubjectsByBatch();
        fetchTeachersByBatch();
        alert('Batch updated.');
      } else {
        alert(res?.message || 'Failed to update batch');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update batch');
    } finally {
      setEditBatchSubmitting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    const batch = batches.find(b => b._id === selectedBatch);
    if (!window.confirm(`Are you sure you want to delete the batch "${batch?.name}"?`)) return;

    try {
      setEditBatchSubmitting(true);
      const res = await api.deleteExamBatch(selectedBatch);
      if (res?.success) {
        setSelectedBatch('');
        setShowEditBatch(false);
        // Refresh batches
        api.getExamBatches({ cacheMaxAge: 0 }).then((r: any) => { if (r?.success && r.data) setBatches(Array.isArray(r.data) ? r.data : []); }).catch(() => { });
        fetchSubjectsByBatch(); // Should clear subjects since no batch selected
        fetchTeachersByBatch();
        alert('Batch deleted successfully.');
      } else {
        alert(res?.message || 'Failed to delete batch');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete batch');
    } finally {
      setEditBatchSubmitting(false);
    }
  };

  const toggleEditBatchTeacher = (teacherId: string) => {
    setEditBatchTeacherIds(prev =>
      prev.includes(teacherId) ? prev.filter(id => id !== teacherId) : [...prev, teacherId]
    );
  };

  const handleAddSubject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubjectName.trim()) {
      alert('Subject name is required');
      return;
    }
    const unitNames = newSubjectUnits.filter(u => u && u.trim());
    try {
      setAddSubjectSubmitting(true);
      const res = await api.createSubject(newSubjectName.trim(), null, null, unitNames);
      if (res?.success && res.data) {
        setShowAddSubject(false);
        setNewSubjectName('');
        setNewSubjectUnits(['']);
        await fetchSubjectsByBatch();
        setSelectedSubject(res.data._id);
        alert(`Subject "${newSubjectName.trim()}" created with ${unitNames.length} unit(s).`);
      } else {
        alert(res?.message || 'Failed to create subject');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create subject');
    } finally {
      setAddSubjectSubmitting(false);
    }
  };

  const addSubjectUnitRow = () => {
    setNewSubjectUnits(prev => [...prev, '']);
  };

  const updateSubjectUnit = (index: number, value: string) => {
    setNewSubjectUnits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeSubjectUnitRow = (index: number) => {
    setNewSubjectUnits(prev => prev.filter((_, i) => i !== index));
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [batchesRes, subjectsRes, incompleteRes, availableRes] = await Promise.all([
        api.getExamBatches().catch(() => ({ success: false, data: [] })),
        api.getVerifierSubjects(null),
        api.getTeachersWithIncompleteSubjects(null),
        api.getAvailableTeachers(null)
      ]);

      if (batchesRes?.success && batchesRes.data) setBatches(Array.isArray(batchesRes.data) ? batchesRes.data : []);
      if (subjectsRes?.success && subjectsRes.data) setAllSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
      if (incompleteRes?.success && incompleteRes.data) setTeachersIncomplete(incompleteRes.data);
      else setTeachersIncomplete([]);
      if (availableRes?.success && availableRes.data) setAvailableTeachers(availableRes.data);
      else setAvailableTeachers([]);
    } catch (err: any) {
      console.error('Error loading assignment data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation based on mode
    if (isReplacementMode) {
      if (!selectedFromTeacher || !selectedSubject || !selectedToTeacher || !reason.trim()) {
        alert('Please fill in all fields');
        return;
      }
    } else {
      if (!selectedSubject || !selectedToTeacher) {
        alert('Please fill in all required fields');
        return;
      }
    }

    try {
      setSubmitting(true);
      // For normal mode, use empty string or null for fromTeacherId
      const fromTeacherId = isReplacementMode ? selectedFromTeacher : null;
      const reasonText = isReplacementMode ? reason : 'Normal assignment';

      const response = await api.createAssignmentRequest(
        fromTeacherId,
        selectedToTeacher,
        selectedSubject,
        reasonText,
        selectedUnits,
        selectedBatch || null
      );

      if (response?.success) {
        alert('✅ Assignment request created! Waiting for admin approval.');
        // Reset form
        setSelectedFromTeacher('');
        setSelectedSubject('');
        setSelectedToTeacher('');
        setSelectedBatch('');
        setReason('');
        // Reload data to show new assignment
        await loadData();
      } else {
        const msg = response?.message || response?.error || 'Failed to create assignment request';
        alert(msg);
      }
    } catch (err: any) {
      console.error('Create assignment request error:', err);
      const msg = err?.message || err?.response?.data?.message || 'Failed to create assignment request';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTeacherData = teachersIncomplete.find(t => t.teacherId === selectedFromTeacher);
  const availableSubjects = selectedTeacherData?.incompleteSubjects || [];

  // In normal mode, exclude the subject's current teacher from "Assign to" (can't assign to same person)
  const teachersForAssignTo = availableTeachers;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            {isReplacementMode ? (
              <>
                <p className="font-semibold mb-1">Replacement mode (teacher leaving / handover):</p>
                <p>1. Select the teacher who has incomplete subjects</p>
                <p>2. Choose the subject to assign</p>
                <p>3. Select the teacher who will take over</p>
                <p>4. Add a note (reason) for admin</p>
                <p>5. Request goes to admin, then to the new teacher for approval</p>
              </>
            ) : (
              <>
                <p className="font-semibold mb-1">Normal mode – move subject to another teacher:</p>
                <p>1. Select the subject (you’ll see who has it now)</p>
                <p>2. Select the teacher who should receive the subject</p>
                <p>3. Request goes to admin, then to that teacher for approval</p>
              </>
            )}
            <p className="mt-2 font-semibold">If admin or teacher rejects, it will appear in your rejected list below.</p>
          </div>
        </div>
      </div>

      {/* Assignment Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-lg"
      >
        <div className="flex items-center justify-end mb-4">
          {/* Replacement Toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold transition-colors duration-200 ${isReplacementMode ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Replacement Mode
            </span>
            <button
              type="button"
              onClick={() => {
                setIsReplacementMode(!isReplacementMode);
                // Reset form when toggling
                setSelectedFromTeacher('');
                setSelectedSubject('');
                setSelectedToTeacher('');
                setSelectedBatch('');
                setReason('');
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isReplacementMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              role="switch"
              aria-checked={isReplacementMode}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isReplacementMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Batch (optional) – filter subjects by batch + Add new batch */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-semibold text-black dark:text-white">
                <span className="flex items-center gap-2">Batch</span>
              </label>
              <div className="flex items-center gap-2">
                {selectedBatch && (
                  <button
                    type="button"
                    onClick={openEditBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit batch
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setShowAddBatch(prev => !prev); setShowEditBatch(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Batch & Subjects
                </button>
              </div>
            </div>
            {showAddBatch && (
              <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 space-y-3">
                <h4 className="text-sm font-semibold text-black dark:text-white">New batch</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                    <input
                      type="text"
                      value={newBatchName}
                      onChange={e => setNewBatchName(e.target.value)}
                      placeholder="e.g. Batch A"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Year</label>
                    <input
                      type="text"
                      value={newBatchYear}
                      onChange={e => setNewBatchYear(e.target.value)}
                      placeholder="e.g. 2024"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white text-sm"
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-slate-600 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-bold text-gray-900 dark:text-gray-100">Subjects</h5>
                      <button
                        type="button"
                        onClick={() => setNewBatchSubjects([...newBatchSubjects, { name: '', units: [], isOpen: true }])}
                        className="text-xs flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        <Plus className="w-3 h-3" />
                        Add Subject
                      </button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                      {newBatchSubjects.map((subject, index) => (
                        <div key={index} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden">
                          {/* Subject Header / Inputs */}
                          <div className="p-3">
                            <div className="flex gap-2 items-start">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...newBatchSubjects];
                                  updated[index].isOpen = !updated[index].isOpen;
                                  setNewBatchSubjects(updated);
                                }}
                                className="mt-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${subject.isOpen ? 'rotate-90' : ''}`} />
                              </button>
                              <div className="flex-1">
                                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Subject Name</label>
                                <input
                                  type="text"
                                  value={subject.name}
                                  onChange={(e) => {
                                    const updated = [...newBatchSubjects];
                                    updated[index].name = e.target.value;
                                    setNewBatchSubjects(updated);
                                  }}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={`Subject ${index + 1} Name`}
                                />
                              </div>
                              {newBatchSubjects.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = newBatchSubjects.filter((_, i) => i !== index);
                                    setNewBatchSubjects(updated);
                                  }}
                                  className="mt-6 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Units Section (Accordion Content) */}
                          <AnimatePresence>
                            {subject.isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50"
                              >
                                <div className="p-3 pl-10 space-y-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Units</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...newBatchSubjects];
                                        updated[index].units.push('');
                                        setNewBatchSubjects(updated);
                                      }}
                                      className="text-xs flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Add Unit
                                    </button>
                                  </div>
                                  {subject.units.map((unit, unitIndex) => (
                                    <div key={unitIndex} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={unit}
                                        onChange={(e) => {
                                          const updated = [...newBatchSubjects];
                                          updated[index].units[unitIndex] = e.target.value;
                                          setNewBatchSubjects(updated);
                                        }}
                                        className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder={`Unit ${unitIndex + 1}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...newBatchSubjects];
                                          updated[index].units = updated[index].units.filter((_, i) => i !== unitIndex);
                                          setNewBatchSubjects(updated);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                  {subject.units.length === 0 && (
                                    <div className="text-center py-2">
                                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">No units added yet</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}

                      {newBatchSubjects.length === 0 && (
                        <div className="text-center py-6 bg-gray-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700">
                          <p className="text-sm text-gray-500 dark:text-gray-400">No subjects added</p>
                          <button
                            type="button"
                            onClick={() => setNewBatchSubjects([{ name: '', units: [], isOpen: true }])}
                            className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Add one
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>


                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddBatch}
                    disabled={addBatchSubmitting || !newBatchName.trim()}
                    className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {addBatchSubmitting ? 'Creating…' : 'Create batch'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddBatch(false); setNewBatchName(''); setNewBatchTeacherIds([]); }}
                    className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-slate-600 text-black dark:text-white text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {showEditBatch && selectedBatch && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-3">
                <h4 className="text-sm font-semibold text-black dark:text-white">Edit batch</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                    <input
                      type="text"
                      value={editBatchName}
                      onChange={e => setEditBatchName(e.target.value)}
                      placeholder="e.g. Batch A"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Year</label>
                    <input
                      type="text"
                      value={editBatchYear}
                      onChange={e => setEditBatchYear(e.target.value)}
                      placeholder="e.g. 2024"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleEditBatch}
                      disabled={editBatchSubmitting || !editBatchName.trim()}
                      className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {editBatchSubmitting ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditBatch(false)}
                      className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-slate-600 text-black dark:text-white text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteBatch}
                      disabled={editBatchSubmitting}
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-sm font-medium transition-colors ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            <select
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setSelectedSubject('');
                setSelectedFromTeacher('');
                setSelectedToTeacher('');
              }}
              className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select batch...</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}{b.year ? ` (${b.year})` : ''}
                </option>
              ))}
            </select>
            {selectedBatch && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Subject, Assign-to teacher, and (in replacement mode) From teacher are filtered to this batch only.
              </p>
            )}
          </div>

          {/* Replacement Mode: Show Teacher with Incomplete Subject */}
          {
            isReplacementMode && (
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Teacher *
                  </span>
                </label>
                <select
                  value={selectedFromTeacher}
                  onChange={(e) => {
                    setSelectedFromTeacher(e.target.value);
                    setSelectedSubject(''); // Reset subject when teacher changes
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={isReplacementMode}
                >
                  <option value="">Select teacher...</option>
                  {teachersIncomplete.map((teacher) => (
                    <option key={teacher.teacherId} value={teacher.teacherId}>
                      👤 {teacher.teacherName} ({teacher.teacherEmail})
                    </option>
                  ))}
                </select>
                {selectedFromTeacher && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Selected: {teachersIncomplete.find(t => t.teacherId === selectedFromTeacher)?.teacherName}
                    </p>
                  </div>
                )}
              </div>
            )
          }

          {/* Replacement Mode: Show Incomplete Units Info */}
          {
            isReplacementMode && selectedFromTeacher && (
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                  Incomplete
                </label>
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  {(() => {
                    const teacher = teachersIncomplete.find(t => t.teacherId === selectedFromTeacher);
                    if (!teacher || !teacher.incompleteSubjects || teacher.incompleteSubjects.length === 0) {
                      return <p className="text-sm text-gray-600 dark:text-gray-400">No incomplete subjects</p>;
                    }
                    return (
                      <div className="space-y-2">
                        {teacher.incompleteSubjects.map((subject) => (
                          <div key={subject.subjectId} className="text-sm">
                            <span className="font-semibold text-black dark:text-white">{subject.subjectName}:</span>{' '}
                            <span className="text-orange-600 dark:text-orange-400">{subject.incompleteUnits} units remaining</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )
          }

          {/* Subject Selection - Different based on mode */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-semibold text-black dark:text-white">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {isReplacementMode ? 'Select Subject *' : 'Subject *'}
                </span>
              </label>

            </div>
            {isReplacementMode ? (
              // Replacement mode: Show subjects from selected teacher's incomplete subjects
              selectedFromTeacher ? (
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select subject...</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject.subjectId} value={subject.subjectId}>
                      📚 {subject.subjectName} ({subject.incompleteUnits} units remaining)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400">
                  Please select a teacher first
                </div>
              )
            ) : (
              // Normal mode: Show all subjects (with current teacher in option)
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select subject...</option>
                {allSubjects.map((subject) => (
                  <option key={subject._id} value={subject._id} className={subject.hasPendingAssignment ? 'text-orange-600 font-medium' : ''}>
                    📚 {subject.name}
                    {subject.teacher?.name ? ` (currently: ${subject.teacher.name})` : ''}
                    {subject.hasPendingAssignment ? ' (⚠️ Has Pending Request)' : ''}
                  </option>
                ))}
              </select>
            )}

            {selectedSubject && isReplacementMode && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                {(() => {
                  const subject = availableSubjects.find(s => s.subjectId === selectedSubject);
                  return subject ? (
                    <div className="text-sm">
                      <p className="font-semibold text-green-800 dark:text-green-200 mb-1">
                        📚 {subject.subjectName}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Total:</span>{' '}
                          <span className="font-semibold text-black dark:text-white">{subject.totalUnits}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Completed:</span>{' '}
                          <span className="font-semibold text-green-600 dark:text-green-400">{subject.completedUnits}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Remaining:</span>{' '}
                          <span className="font-semibold text-orange-600 dark:text-orange-400">{subject.incompleteUnits}</span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Warning for Pending Assignment */}
            {selectedSubject && (() => {
              const subject = allSubjects.find(s => s._id === selectedSubject);
              if (subject?.hasPendingAssignment) {
                const details = subject.pendingAssignmentDetails;
                return (
                  <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                    <div className="text-sm text-orange-800 dark:text-orange-200">
                      <p className="font-bold">Pending Assignment Request Exists</p>
                      <p>This subject already has a pending assignment request associated with its current teacher.</p>
                      {details && (
                        <div className="mt-1 text-xs opacity-90">
                          Requested by: {typeof details.requestedBy === 'object' ? details.requestedBy.name : 'Unknown'}<br />
                          Date: {new Date(details.createdAt).toLocaleDateString()}
                        </div>
                      )}
                      <p className="mt-1 font-medium">Please wait for Admin approval or rejection before making a new request.</p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Unit Selection Dropdown */}
          {
            selectedSubject && (
              <div className="relative">
                <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Select Units
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="text-black dark:text-gray-200">
                    {loadingUnits
                      ? 'Loading units...'
                      : selectedUnits.length > 0
                        ? `${selectedUnits.length} Unit${selectedUnits.length !== 1 ? 's' : ''} Selected`
                        : 'Select units to assign...'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showUnitDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showUnitDropdown && !loadingUnits && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 z-10">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 pl-2">
                        {availableUnits.length} Units Available
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-xs text-blue-600 dark:text-blue-400 font-semibold px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      >
                        {selectedUnits.length === availableUnits.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="p-2 space-y-1">
                      {availableUnits.map(unit => (
                        <div
                          key={unit._id}
                          onClick={() => toggleUnit(unit._id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedUnits.includes(unit._id)
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedUnits.includes(unit._id)
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-gray-300 dark:border-gray-500'
                              }`}>
                              {selectedUnits.includes(unit._id) && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className={`text-sm font-medium ${selectedUnits.includes(unit._id) ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                              {unit.name}
                            </span>
                          </div>

                          {/* Status Indicator */}
                          <div className="flex items-center gap-1.5 ml-2">
                            {unit.status === 'completed' && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                <CheckCircle2 className="w-3 h-3" /> DONE
                              </span>
                            )}
                            {unit.status === 'in-progress' && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <Clock className="w-3 h-3" /> PENDING
                              </span>
                            )}
                            {unit.status === 'not-started' && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                <Circle className="w-3 h-3" /> TO DO
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          }


          {/* To Teacher */}
          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-2">
              <span className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                {isReplacementMode ? 'Assign To (Available Teacher) *' : 'Assign To *'}
              </span>
            </label>
            <select
              value={selectedToTeacher}
              onChange={(e) => setSelectedToTeacher(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select teacher...</option>
              {teachersForAssignTo.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  👤 {teacher.teacherName} ({teacher.teacherEmail}) -
                  Workload: {teacher.workloadPercentage}%
                  ({teacher.totalUnits || 0} units, {teacher.pendingUnits || 0} pending)
                </option>
              ))}
            </select>

            {selectedToTeacher && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Selected: {teachersForAssignTo.find(t => t.teacherId === selectedToTeacher)?.teacherName ?? availableTeachers.find(t => t.teacherId === selectedToTeacher)?.teacherName}
                </p>
              </div>
            )}
          </div>

          {/* Note/Comment - Only show in replacement mode */}
          {
            isReplacementMode && (
              <div>
                <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                  Comment/Note *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Emergency leave, Medical leave, Teacher on leave, etc."
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  required={isReplacementMode}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This note will be sent to admin for review
                </p>
              </div>
            )
          }

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || (!isReplacementMode && allSubjects.find(s => s._id === selectedSubject)?.hasPendingAssignment)}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Assignment Request'
            )}
          </button>
        </form >
      </motion.div >

      {/* Teachers with Incomplete Subjects */}
      < motion.div
        initial={{ opacity: 0, y: 20 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-200 dark:border-slate-700 shadow-lg"
      >
        <h3 className="text-xl font-bold text-black dark:text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-500" />
          Teachers with Incomplete Subjects
        </h3>

        {
          teachersIncomplete.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No teachers with incomplete subjects found.</p>
          ) : (
            <div className="space-y-4">
              {teachersIncomplete.map((teacher) => (
                <details
                  key={teacher.teacherId}
                  className="group border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-700/30 overflow-hidden open:ring-2 open:ring-blue-500/20 dark:open:ring-blue-400/20 transition-all"
                >
                  <summary className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-slate-700/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                        {teacher.teacherName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                          {teacher.teacherName}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {teacher.incompleteSubjects?.length || 0} incomplete subjects
                        </p>
                      </div>
                    </div>
                    <div className="transform group-open:rotate-180 transition-transform duration-200">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </summary>

                  <div className="p-4 pt-2 border-t border-gray-100 dark:border-slate-700 space-y-3">
                    {teacher.incompleteSubjects?.map((subject) => (
                      <div
                        key={subject.subjectId}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-black dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            {subject.subjectName}
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            {subject.incompleteUnits} Units Pending
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                            style={{ width: `${(subject.completedUnits / subject.totalUnits) * 100}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>{subject.completedUnits} / {subject.totalUnits} Completed</span>
                          <span>{Math.round((subject.completedUnits / subject.totalUnits) * 100)}%</span>
                        </div>

                        {/* Remaining Units List */}
                        {subject.remainingUnits && subject.remainingUnits.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Pending Units:</p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {subject.remainingUnits.map(unit => (
                                <li key={unit.id} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                                  {unit.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )
        }
      </motion.div >

      {/* Add Subject Modal - Renders in overlay to avoid form/disabled issues */}
      <AnimatePresence>
        {
          showAddSubject && !isReplacementMode && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => { setShowAddSubject(false); setNewSubjectName(''); setNewSubjectUnits(['']); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => { setShowAddSubject(false); setNewSubjectName(''); setNewSubjectUnits(['']); }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-bold text-black dark:text-white mb-4 pr-8">Add new subject</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject name *</label>
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={e => setNewSubjectName(e.target.value)}
                      placeholder="e.g. Mathematics"
                      autoComplete="off"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Units</label>
                      <button
                        type="button"
                        onClick={addSubjectUnitRow}
                        className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        + Add unit
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {newSubjectUnits.map((unitName, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={unitName}
                            onChange={e => updateSubjectUnit(idx, e.target.value)}
                            placeholder={`Unit ${idx + 1} name`}
                            autoComplete="off"
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubjectUnitRow(idx)}
                            disabled={newSubjectUnits.length <= 1}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Add unit names (e.g. Algebra, Calculus).</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      disabled={addSubjectSubmitting || !newSubjectName.trim()}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {addSubjectSubmitting ? 'Creating…' : 'Create subject'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddSubject(false); setNewSubjectName(''); setNewSubjectUnits(['']); }}
                      className="px-4 py-2.5 rounded-xl bg-gray-200 dark:bg-slate-600 text-black dark:text-white font-medium hover:bg-gray-300 dark:hover:bg-slate-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )
        }
      </AnimatePresence >
    </div >
  );
}

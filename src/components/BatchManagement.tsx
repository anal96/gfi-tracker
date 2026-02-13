import { useState, useEffect } from 'react';
import { Users, ChevronDown, Plus, Edit2, Trash2, X, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';

interface Batch {
  _id: string;
  name: string;
  year: string;
  description?: string;
  studentCount: number;
  students?: Array<{ _id: string; name: string; email: string }>;
  subjects?: string[];
}

interface BatchManagementProps {
  selectedBatch: string | null;
  onBatchChange: (batchId: string | null) => void;
  user: any;
  allowedBatchIds?: string[];
}

export function BatchManagement({ selectedBatch, onBatchChange, user, allowedBatchIds }: BatchManagementProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [isExpanded, setIsExpanded] = useState(false); // Closed by default as requested
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    description: ''
  });
  const [subjects, setSubjects] = useState<Array<{ name: string; units: string[]; isOpen?: boolean }>>([{ name: '', units: [], isOpen: true }]);
  const [searchQuery, setSearchQuery] = useState('');

  // Static batch data with subjects
  const staticBatches: Batch[] = [
    {
      _id: 'static-bca',
      name: 'BCA',
      year: '2024',
      description: 'Bachelor of Computer Applications',
      studentCount: 45,
      subjects: ['Mathematics', 'Programming in C', 'Data Structures', 'Database Management', 'Web Development', 'Software Engineering']
    },
    {
      _id: 'static-bcom',
      name: 'BCOM',
      year: '2024',
      description: 'Bachelor of Commerce',
      studentCount: 60,
      subjects: ['Accounting', 'Business Economics', 'Financial Management', 'Marketing', 'Business Law', 'Statistics']
    },
    {
      _id: 'static-ca',
      name: 'CA',
      year: '2024',
      description: 'Chartered Accountancy',
      studentCount: 30,
      subjects: ['Financial Accounting', 'Cost Accounting', 'Auditing', 'Taxation', 'Corporate Law', 'Economics']
    }
  ];

  useEffect(() => {
    loadBatches();
  }, [JSON.stringify(allowedBatchIds)]);

  // Effect to handle external batch selection changes if needed
  // useEffect(() => {
  //   if (selectedBatch) setIsExpanded(false);
  // }, [selectedBatch]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const response = await api.getBatches();
      let apiBatches: Batch[] = [];

      if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
        apiBatches = response.data;
      }

      // Use API batches (even if empty)
      if (true) {
        // Use API batches, but add static batch subjects info if batch names match
        const enrichedBatches = apiBatches.map(apiBatch => {
          // Find matching static batch by name
          const staticBatch = staticBatches.find(sb =>
            sb.name.toLowerCase() === apiBatch.name.toLowerCase() &&
            sb.year === apiBatch.year
          );

          // If found, add subjects info to the API batch
          if (staticBatch && staticBatch.subjects) {
            return {
              ...apiBatch,
              subjects: staticBatch.subjects
            };
          }
          return apiBatch;
        });

        if (allowedBatchIds) {
          setBatches(enrichedBatches.filter(b => allowedBatchIds.includes(b._id)));
        } else {
          setBatches(enrichedBatches);
        }
      }
    } catch (error: any) {
      console.error('Error loading batches:', error);
      // Use static data on error
      setBatches(staticBatches);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.createBatch(
        formData.name,
        formData.year,
        formData.description
      );
      if (response.success) {
        const newBatchId = response.data?._id;

        // Create subjects sequentially
        if (newBatchId && subjects.length > 0) {
          try {
            for (const subject of subjects) {
              if (subject.name.trim()) {
                // Pass units to the createSubject API
                await api.createSubject(
                  subject.name,
                  null,
                  newBatchId,
                  subject.units.filter(u => u.trim())
                );
              }
            }
          } catch (subjectError) {
            console.error('Error creating subjects:', subjectError);
            alert('Batch created, but some subjects failed to create.');
          }
        }

        await loadBatches();
        setShowCreateModal(false);
        setFormData({ name: '', year: new Date().getFullYear().toString(), description: '' });
        setSubjects([{ name: '', units: [], isOpen: true }]); // Reset subjects

        // Select the newly created batch
        if (newBatchId) {
          onBatchChange(newBatchId);
          setIsExpanded(false); // Collapse after selection
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to create batch');
    }
  };

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    try {
      const response = await api.updateBatch(
        editingBatch._id,
        formData.name,
        formData.year,
        formData.description,
        editingBatch.students?.map(s => s._id) || []
      );
      if (response.success) {
        await loadBatches();
        setShowEditModal(false);
        setEditingBatch(null);
        setFormData({ name: '', year: new Date().getFullYear().toString(), description: '' });
      }
    } catch (error: any) {
      alert(error.message || 'Failed to update batch');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this batch? This will remove batch assignments from all students and subjects.')) {
      return;
    }
    try {
      const response = await api.deleteBatch(batchId);
      if (response.success) {
        await loadBatches();
        if (selectedBatch === batchId) {
          onBatchChange(null);
          setIsExpanded(true); // Expand if selected batch is deleted
        }
      }
    } catch (error: any) {
      if (error?.message?.includes('not found') || error?.message?.includes('404')) {
        await loadBatches();
        if (selectedBatch === batchId) {
          onBatchChange(null);
          setIsExpanded(true);
        }
        alert('Batch was already deleted. List refreshed.');
      } else {
        alert(error.message || 'Failed to delete batch');
      }
    }
  };

  const selectedBatchData = batches.find(b => b._id === selectedBatch);
  const filteredBatches = batches.filter(batch =>
    batch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    batch.year.toString().includes(searchQuery)
  );
  const canManageBatches = user?.role === 'admin' || user?.role === 'verifier';

  return (
    <div className="mb-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200/40 dark:border-blue-700/40 shadow-lg p-4 sm:p-6 transition-all duration-300">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 flex-1 text-left group"
          >
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 group-hover:bg-purple-500/30 transition-colors">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white flex items-center gap-2">
                Batch Management
                <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
              </h3>
              <p className="text-xs sm:text-sm text-black/70 dark:text-gray-400">
                {selectedBatchData ? `Selected: ${selectedBatchData.name} ${selectedBatchData.year}` : 'Select a batch to manage'}
              </p>
            </div>
          </button>


        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pb-2">
                {/* Search Bar */}
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search batches..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black dark:text-white"
                    />
                  </div>
                  {canManageBatches && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors text-sm font-bold shadow-sm hover:shadow-md whitespace-nowrap"
                    >
                      <Plus className="w-5 h-5" />
                      Add Batch
                    </button>
                  )}
                </div>

                {/* Batches List */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredBatches.length > 0 ? (
                    filteredBatches.map((batch) => (
                      <div
                        key={batch._id}
                        onClick={() => {
                          onBatchChange(selectedBatch === batch._id ? null : batch._id);
                          // Optional: collapse on selection
                          if (selectedBatch !== batch._id) {
                            // setIsExpanded(false); // Maybe keep open? Or collapse? User probably wants to see result.
                            // Let's keep it open or let user close it. 
                            // Wait, user said "batchs want closed accordion".
                            // Maybe better to auto-close on selection?
                            setIsExpanded(false);
                          }
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group 
                          ${selectedBatch === batch._id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
                            : 'bg-white dark:bg-slate-800/50 border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-black dark:text-white truncate">
                              {batch.name}
                            </h4>
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                              {batch.year}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {batch.subjects ? `${batch.subjects.length} Subjects` : '0 Subjects'}
                          </p>
                          {batch.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                              {batch.description}
                            </p>
                          )}
                        </div>

                        {canManageBatches && (
                          <div className="flex items-center gap-2 pl-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBatch(batch);
                                setFormData({
                                  name: batch.name,
                                  year: batch.year,
                                  description: batch.description || ''
                                });
                                setShowEditModal(true);
                              }}
                              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                              title="Edit Batch"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBatch(batch._id);
                              }}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Delete Batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">No batches found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Batch Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-black dark:text-white">Create New Batch</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Batch Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="e.g., Morning Batch"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Year *
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    placeholder="e.g., 2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>

                {/* Subjects Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-black dark:text-white">
                      Subjects
                    </label>
                    <button
                      type="button"
                      onClick={() => setSubjects([...subjects, { name: '', units: [], isOpen: true }])}
                      className="text-xs flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Subject
                    </button>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                    {subjects.map((subject, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-slate-700/30 rounded-xl border border-gray-200 dark:border-slate-600 overflow-hidden">
                        {/* Subject Header / Inputs */}
                        <div className="p-3">
                          <div className="flex gap-2 items-start">
                            <button
                              type="button"
                              onClick={() => {
                                const newSubjects = [...subjects];
                                newSubjects[index].isOpen = !newSubjects[index].isOpen;
                                setSubjects(newSubjects);
                              }}
                              className="mt-3 p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                            >
                              <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${subject.isOpen ? 'rotate-90' : ''}`} />
                            </button>
                            <div className="flex-1">
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 block">Subject Name</label>
                              <input
                                type="text"
                                value={subject.name}
                                onChange={(e) => {
                                  const newSubjects = [...subjects];
                                  newSubjects[index].name = e.target.value;
                                  setSubjects(newSubjects);
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={`Subject ${index + 1} Name`}
                              />
                            </div>
                            {subjects.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newSubjects = subjects.filter((_, i) => i !== index);
                                  setSubjects(newSubjects);
                                }}
                                className="mt-6 p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
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
                              className="border-t border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50"
                            >
                              <div className="p-3 pl-10 space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Units</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSubjects = [...subjects];
                                      newSubjects[index].units.push('');
                                      setSubjects(newSubjects);
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
                                        const newSubjects = [...subjects];
                                        newSubjects[index].units[unitIndex] = e.target.value;
                                        setSubjects(newSubjects);
                                      }}
                                      className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder={`Unit ${unitIndex + 1}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newSubjects = [...subjects];
                                        newSubjects[index].units = newSubjects[index].units.filter((_, i) => i !== unitIndex);
                                        setSubjects(newSubjects);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
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

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setSubjects([...subjects, { name: '', units: [], isOpen: true }])}
                        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Add Another Subject</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-700 text-black dark:text-white font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                  >
                    Create Batch
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Batch Modal */}
      <AnimatePresence>
        {showEditModal && editingBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-black dark:text-white">Edit Batch</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingBatch(null);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleEditBatch} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Batch Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Year *
                  </label>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black dark:text-white mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 border-2 border-gray-300 dark:border-slate-600 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingBatch(null);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-700 text-black dark:text-white font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                  >
                    Update
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

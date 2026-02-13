import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Filter, BookOpen, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProgressVisualization } from './ProgressVisualization';
import { TeacherProgressTable } from './TeacherProgressTable';
import { SubjectUnitCard } from './SubjectUnitCard';
import { BatchManagement } from './BatchManagement';
import { TeacherProgress } from './AdminDashboard';
import { Subject, Unit } from './TeacherDashboard';
import api from '../services/api';

interface ProgressPageProps {
  user: any;
}

export function ProgressPage({ user }: ProgressPageProps) {
  const [data, setData] = useState<TeacherProgress[]>([]);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [teachers, setTeachers] = useState<string[]>(['all']);
  const [subjects, setSubjects] = useState<string[]>(['all']);

  // My Subjects state
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>('all');
  const [selectedBatchName, setSelectedBatchName] = useState<string | null>(null);
  const [allowedBatchIds, setAllowedBatchIds] = useState<string[] | undefined>(undefined);

  // Load progress data
  useEffect(() => {
    loadProgressData();
  }, [selectedTeacher, selectedSubject, dateRange]);

  // Load my subjects
  useEffect(() => {
    loadMySubjects();
  }, [selectedBatch]);

  // Load allowed batches for teacher
  useEffect(() => {
    const loadAllowedBatches = async () => {
      if (user?.role === 'teacher') {
        try {
          const response = await api.getTeacherDashboard();
          if (response.success && response.data?.subjects) {
            const subjects = response.data.subjects;
            const batchIds = subjects
              .map((s: any) => s.batch?.id)
              .filter((id: string) => id);
            const uniqueBatchIds = [...new Set(batchIds)];
            setAllowedBatchIds(uniqueBatchIds as string[]);
          }
        } catch (err) {
          console.error('Error loading allowed batches:', err);
        }
      }
    };
    loadAllowedBatches();
  }, [user]);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (selectedTeacher !== 'all') filters.teacherId = selectedTeacher;
      if (selectedSubject !== 'all') filters.subject = selectedSubject;
      if (dateRange !== 'all') filters.dateRange = dateRange;

      const [dashboardResponse, progressResponse] = await Promise.all([
        api.getAdminDashboard(filters),
        api.getAdminProgress(filters)
      ]);

      if (dashboardResponse.success) {
        const formattedData = dashboardResponse.data.unitLogs.map((item: any) => ({
          id: item.id,
          teacherName: item.teacherName,
          subject: item.subject,
          unit: item.unit,
          startedAt: new Date(item.startedAt),
          completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
          totalHours: item.totalHours,
          status: item.status
        }));

        setData(formattedData);

        if (dashboardResponse.data.filters) {
          setTeachers(dashboardResponse.data.filters.teachers || ['all']);
          setSubjects(dashboardResponse.data.filters.subjects || ['all']);
        }
      }

      if (progressResponse.success) {
        setProgressData(progressResponse.data || []);
      }
    } catch (error: any) {
      console.error('Error loading progress data:', error);
      alert(error.message || 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  const loadMySubjects = async () => {
    try {
      setSubjectsLoading(true);

      // Load batch name for display
      if (selectedBatch && selectedBatch !== 'all') {
        try {
          const batchesResponse = await api.getBatches();
          if (batchesResponse.success) {
            const batch = batchesResponse.data?.find((b: any) => b._id === selectedBatch);
            setSelectedBatchName(batch ? `${batch.name} ${batch.year}` : null);
          }
        } catch (err) {
          console.error('Error loading batch name:', err);
        }
      } else {
        setSelectedBatchName(null);
      }

      const response = await api.getTeacherDashboard(selectedBatch === 'all' ? null : selectedBatch);

      if (response.success && response.data) {
        setMySubjects(response.data.subjects || []);
      }
    } catch (err: any) {
      console.error('Error loading subjects:', err);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const handleStartUnit = async (subjectId: string, unitId: string) => {
    try {
      const response = await api.startUnit(unitId);
      if (response && response.success) {
        if (response.message && response.message.includes('pending')) {
          alert('✅ Unit start request submitted! Waiting for verifier approval.');
        } else {
          await loadMySubjects();
        }
      } else if (response && !response.success) {
        alert(response.message || 'Failed to start unit');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start unit');
    }
  };

  const handleCompleteUnit = async (subjectId: string, unitId: string) => {
    try {
      const response = await api.completeUnit(unitId);
      if (response.success) {
        if (response.message && response.message.includes('pending')) {
          alert('✅ Unit completion request submitted! Waiting for verifier approval.');
        } else {
          await loadMySubjects();
        }
      } else {
        alert(response.message || 'Failed to complete unit');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to complete unit');
    }
  };

  const handleUpdateElapsedTime = (subjectId: string, unitId: string, elapsed: number) => {
    setMySubjects(prev =>
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

  // Filter data
  const filteredData = data.filter(item => {
    const teacherMatch = selectedTeacher === 'all' || item.teacherName === selectedTeacher;
    const subjectMatch = selectedSubject === 'all' || item.subject === selectedSubject;
    return teacherMatch && subjectMatch;
  });

  const handleDownloadExcel = () => {
    // Format data for Excel
    const dataToExport = filteredData.map(item => ({
      Teacher: item.teacherName,
      Subject: item.subject,
      Unit: item.unit,
      Status: item.status,
      'Started': new Date(item.startedAt).toLocaleDateString(),
      'Completed': item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-',
      'Hours': Number((item.totalHours || 0).toFixed(2))
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Progress Report");
    XLSX.writeFile(wb, "progress_report.xlsx");
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Progress Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    // Prepare table data
    const tableData = filteredData.map(item => [
      item.teacherName,
      item.subject,
      item.unit,
      item.status,
      new Date(item.startedAt).toLocaleDateString(),
      item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-',
      (item.totalHours || 0).toFixed(2)
    ]);

    // Generate table
    autoTable(doc, {
      head: [['Teacher', 'Subject', 'Unit', 'Status', 'Started', 'Completed', 'Hours']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 133, 244] }
    });

    doc.save("progress_report.pdf");
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pt-20">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pb-6 sm:pb-8 pt-4 sm:pt-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 sm:mb-8 lg:mb-10"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">
              Progress Overview
            </h1>
            <p className="text-sm sm:text-base text-black/70 font-medium">
              Track and analyze teacher progress across all subjects
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all active:scale-95 font-medium text-sm"
              title="Download Excel Report"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-all active:scale-95 font-medium text-sm"
              title="Download PDF Report"
            >
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-100 rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 border-2 border-gray-200 shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Filter className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-black">Filters</h2>
              <p className="text-xs sm:text-sm text-black/70">Filter progress data by teacher, subject, and date range</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Teacher Filter */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-black mb-2 sm:mb-2.5">
                Teacher
              </label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 border-2 border-gray-300 text-black text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 shadow-sm"
              >
                {teachers.map(teacher => (
                  <option key={teacher} value={teacher} className="bg-gray-100 text-black">
                    {teacher === 'all' ? 'All Teachers' : teacher}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-black mb-2 sm:mb-2.5">
                Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 border-2 border-gray-300 text-black text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 shadow-sm"
              >
                {subjects.map(subject => (
                  <option key={subject} value={subject} className="bg-gray-100 text-black">
                    {subject === 'all' ? 'All Subjects' : subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm font-semibold text-black mb-2 sm:mb-2.5">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 border-2 border-gray-300 text-black text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400 shadow-sm"
              >
                <option value="7days" className="bg-gray-100 text-black">Last 7 Days</option>
                <option value="30days" className="bg-gray-100 text-black">Last 30 Days</option>
                <option value="90days" className="bg-gray-100 text-black">Last 90 Days</option>
                <option value="all" className="bg-gray-100 text-black">All Time</option>
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Progress Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 sm:mb-8 lg:mb-10"
      >
        <ProgressVisualization data={progressData} />
      </motion.div>

      {/* Teacher Progress Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 sm:mb-8 lg:mb-10"
      >
        <TeacherProgressTable data={filteredData} />
      </motion.div>

      {/* My Subjects Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <div className="mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-black flex items-center gap-2">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            My Subjects
            {selectedBatchName && (
              <span className="text-sm font-normal text-black/70 dark:text-gray-400">
                (Filtered by: {selectedBatchName})
              </span>
            )}
          </h2>
        </div>

        {subjectsLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mySubjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-blue-200/40 dark:border-blue-700/40 shadow-lg p-6 sm:p-8 text-center">
            <p className="text-black/70 dark:text-gray-400">
              {selectedBatch && selectedBatch !== 'all'
                ? 'No subjects found for the selected batch.'
                : 'No subjects assigned yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {mySubjects.map((subject, index) => (
              <SubjectUnitCard
                key={subject.id}
                subject={subject}
                onStartUnit={(unitId) => {
                  handleStartUnit(subject.id, unitId);
                }}
                onCompleteUnit={(unitId) => {
                  handleCompleteUnit(subject.id, unitId);
                }}
                onUpdateElapsed={(unitId, elapsed) => {
                  handleUpdateElapsedTime(subject.id, unitId, elapsed);
                }}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Batch Management Section - At the bottom of My Subjects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <BatchManagement
            selectedBatch={selectedBatch}
            onBatchChange={setSelectedBatch}
            user={user}
            allowedBatchIds={user?.role === 'teacher' ? allowedBatchIds : undefined}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

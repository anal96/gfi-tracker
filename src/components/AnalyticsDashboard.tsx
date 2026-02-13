import { useState, useEffect } from 'react';
import { BarChart3, Filter, CheckCircle2, AlertCircle, Clock, TrendingUp, ChevronDown, ChevronUp, LayoutDashboard, PieChart, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressVisualization } from './ProgressVisualization';
import { MetricCard } from './MetricCard';
import { AnalyticsGraphs } from './AnalyticsGraphs';
import api from '../services/api';

interface AnalyticsDashboardProps {
  user: any;
  isDarkMode?: boolean;
}

interface SubjectData {
  subject: string;
  total: number;
  completed: number;
  inProgress: number;
  delayed: number;
  totalHours: number;
  avgHours: number;
}

export function AnalyticsDashboard({ user }: AnalyticsDashboardProps) {
  const [data, setData] = useState<SubjectData[]>([]);
  const [detailedData, setDetailedData] = useState<any[]>([]); // Store detailed logs for export
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    teacherId: 'all',
    subject: 'all',
    dateRange: 'today'
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(true); // Default open in overview
  const [teachers, setTeachers] = useState<string[]>([]);
  const [teacherList, setTeacherList] = useState<Array<{ name: string; subjects?: any[] }>>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'graphs'>('overview');

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    loadAnalyticsData();
  }, [filters]);

  const loadTeachers = async () => {
    try {
      const response = await api.getTeachers();
      if (response && response.success) {
        const list = response.data || [];
        setTeacherList(list);
        const teacherNames = list.map((t: any) => t.name);
        setTeachers(['all', ...teacherNames]);

        const subjectSet = new Set<string>();
        list.forEach((teacher: any) => {
          if (teacher.subjects && Array.isArray(teacher.subjects)) {
            teacher.subjects.forEach((subj: any) => {
              if (typeof subj === 'string') subjectSet.add(subj);
              else if (subj && subj.name) subjectSet.add(subj.name);
            });
          }
        });
        setAllSubjects(['all', ...Array.from(subjectSet)]);
      }
    } catch (err) {
      console.error('Error loading teachers:', err);
    }
  };

  // When a teacher is selected, show only that teacher's subjects (deduplicated); otherwise show all subjects
  const subjectsForFilter = filters.teacherId === 'all'
    ? allSubjects
    : (() => {
      const teacher = teacherList.find((t: any) => t.name === filters.teacherId);
      if (!teacher || !teacher.subjects?.length) return ['all'];
      const names = teacher.subjects.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
      const unique = Array.from(new Set(names));
      return ['all', ...unique];
    })();

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both aggregated stats and detailed logs
      const [progressResponse, dashboardResponse] = await Promise.all([
        api.getAdminProgress({
          ...filters,
          groupBy: filters.subject !== 'all' ? 'teacher' : 'subject'
        }),
        api.getAdminDashboard(filters)
      ]);

      if (progressResponse && progressResponse.success) {
        setData(progressResponse.data || []);
      } else {
        setError(progressResponse?.message || 'Failed to load analytics data');
      }

      if (dashboardResponse && dashboardResponse.success) {
        // Map unit logs for easier export
        const logs = dashboardResponse.data.unitLogs.map((item: any) => ({
          teacherName: item.teacherName,
          subject: item.subject,
          unit: item.unit,
          status: item.status,
          startedAt: new Date(item.startedAt),
          completedAt: item.completedAt ? new Date(item.completedAt) : null,
          totalHours: item.totalHours
        }));
        setDetailedData(logs);
      }
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!detailedData.length) {
      alert('No data available to export');
      return;
    }
    const dataToExport = detailedData.map(item => ({
      Teacher: item.teacherName,
      Subject: item.subject,
      Unit: item.unit,
      Status: item.status,
      'Started': item.startedAt.toLocaleDateString(),
      'Completed': item.completedAt ? item.completedAt.toLocaleDateString() : '-',
      'Hours': Number((item.totalHours || 0).toFixed(2))
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detailed Report");
    XLSX.writeFile(wb, "analytics_report.xlsx");
  };

  const handleDownloadPDF = () => {
    if (!detailedData.length) {
      alert('No data available to export');
      return;
    }
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Analytics Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Filters: ${filters.teacherId} | ${filters.subject} | ${filters.dateRange}`, 14, 34);

    // Prepare table data
    const tableData = detailedData.map(item => [
      item.teacherName,
      item.subject,
      item.unit,
      item.status,
      item.startedAt.toLocaleDateString(),
      item.completedAt ? item.completedAt.toLocaleDateString() : '-',
      (item.totalHours || 0).toFixed(2)
    ]);

    autoTable(doc, {
      head: [['Teacher', 'Subject', 'Unit', 'Status', 'Started', 'Completed', 'Hours']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 133, 244] }
    });

    doc.save("analytics_report.pdf");
  };

  // Calculate aggregate metrics
  const aggregateMetrics = data.reduce(
    (acc, subject) => ({
      total: acc.total + subject.total,
      completed: acc.completed + subject.completed,
      inProgress: acc.inProgress + subject.inProgress,
      delayed: acc.delayed + subject.delayed,
      totalHours: acc.totalHours + subject.totalHours
    }),
    { total: 0, completed: 0, inProgress: 0, delayed: 0, totalHours: 0 }
  );

  const avgHours = aggregateMetrics.total > 0
    ? aggregateMetrics.totalHours / aggregateMetrics.total
    : 0;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-2">
          Subject-wise progress and completion analytics
        </p>
        {/* Active filter result */}
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Showing: {filters.teacherId === 'all' ? 'All Teachers' : filters.teacherId} • {filters.subject === 'all' ? 'All Subjects' : filters.subject}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={handleDownloadExcel}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all active:scale-95 font-medium text-sm"
          disabled={loading || detailedData.length === 0}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel</span>
        </button>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-all active:scale-95 font-medium text-sm"
          disabled={loading || detailedData.length === 0}
        >
          <FileText className="w-4 h-4" />
          <span>Export PDF</span>
        </button>
      </div>

      {/* Filters Accordion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 bg-white dark:bg-gradient-to-br dark:from-slate-800 dark:via-blue-900 dark:to-indigo-900 rounded-2xl border border-gray-200 dark:border-slate-700/50 shadow-xl overflow-hidden"
      >
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="w-full flex items-center justify-between p-4 sm:p-6 text-left"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-700 dark:text-white" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
          </div>
          {isFiltersOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-600 dark:text-white/70" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600 dark:text-white/70" />
          )}
        </button>

        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="p-4 sm:p-6 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-gray-200 dark:border-white/10 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/90 mb-2">
                    Teacher
                  </label>
                  <select
                    value={filters.teacherId}
                    onChange={(e) => {
                      const newTeacher = e.target.value;
                      const newSubjectList = newTeacher === 'all'
                        ? allSubjects
                        : (() => {
                          const t = teacherList.find((x: any) => x.name === newTeacher);
                          if (!t?.subjects?.length) return ['all'];
                          return ['all', ...t.subjects.map((s: any) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)];
                        })();
                      const subjectValid = filters.subject === 'all' || newSubjectList.includes(filters.subject);
                      setFilters({
                        ...filters,
                        teacherId: newTeacher,
                        subject: subjectValid ? filters.subject : 'all'
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-100/95 backdrop-blur-sm border-2 border-gray-300 dark:border-white/60 text-gray-900 dark:text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400"
                  >
                    {teachers.map((teacher) => (
                      <option key={teacher} value={teacher}>
                        {teacher === 'all' ? 'All Teachers' : teacher}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/90 mb-2">
                    Subject
                  </label>
                  <select
                    value={filters.subject}
                    onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-100/95 backdrop-blur-sm border-2 border-gray-300 dark:border-white/60 text-gray-900 dark:text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400"
                  >
                    {subjectsForFilter.map((subject, idx) => (
                      <option key={`${subject}-${idx}`} value={subject}>
                        {subject === 'all' ? 'All Subjects' : subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white/90 mb-2">
                    Date Range
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-100/95 backdrop-blur-sm border-2 border-gray-300 dark:border-white/60 text-gray-900 dark:text-black text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="30days">Last 30 Days</option>
                    <option value="90days">Last 90 Days</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mobile-style Segmented Tabs */}
      <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl flex items-center mb-6 relative">
        <button
          onClick={() => setActiveTab('overview')}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${activeTab === 'overview'
            ? 'text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Overview
          {activeTab === 'overview' && (
            <motion.div
              layoutId="activeTabBg"
              className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg -z-10 shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab('graphs')}
          className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${activeTab === 'graphs'
            ? 'text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
          <PieChart className="w-4 h-4" />
          Analytics
          {activeTab === 'graphs' && (
            <motion.div
              layoutId="activeTabBg"
              className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg -z-10 shadow-sm"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Aggregate Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              <MetricCard
                icon={BarChart3}
                title="Total Units"
                value={aggregateMetrics.total.toString()}
                color="from-blue-500 to-blue-600"
                index={0}
              />
              <MetricCard
                icon={CheckCircle2}
                title="Completed"
                value={aggregateMetrics.completed.toString()}
                color="from-emerald-500 to-green-600"
                index={1}
              />
              <MetricCard
                icon={Clock}
                title="In Progress"
                value={aggregateMetrics.inProgress.toString()}
                color="from-blue-500 to-indigo-600"
                index={2}
              />
              <MetricCard
                icon={AlertCircle}
                title="Delayed"
                value={aggregateMetrics.delayed.toString()}
                color="from-red-500 to-orange-600"
                index={3}
              />
              <MetricCard
                icon={TrendingUp}
                title="Avg Hours"
                value={avgHours.toFixed(1)}
                suffix="h"
                color="from-purple-500 to-pink-600"
                index={4}
              />
            </div>


          </motion.div>
        ) : (
          <motion.div
            key="graphs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {data.length > 0 ? (
              <AnalyticsGraphs
                data={data}
                mode={filters.subject !== 'all' ? 'teacher' : 'subject'}
              />
            ) : (
              <div className="text-center py-20 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">No data available for visualization</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

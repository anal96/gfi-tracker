import { motion } from 'motion/react';
import { BarChart3 } from 'lucide-react';

interface ProgressVisualizationProps {
  data: Array<{
    subject: string;
    total: number;
    completed: number;
    inProgress: number;
    delayed: number;
    totalHours: number;
    avgHours: number;
  }>;
  removeWrapper?: boolean;
}

export function ProgressVisualization({ data, removeWrapper = false }: ProgressVisualizationProps) {
  const subjectData = data || [];

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      'Mathematics': 'from-blue-500 to-blue-600',
      'Physics': 'from-blue-600 to-blue-700',
      'Chemistry': 'from-blue-500 to-blue-700',
      'Biology': 'from-blue-600 to-blue-800',
      'History': 'from-blue-500 to-blue-600',
    };
    return colors[subject] || 'from-blue-500 to-blue-600';
  };

  const Container = removeWrapper ? 'div' : 'div';
  const containerClasses = removeWrapper
    ? "space-y-6"
    : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-700/50 shadow-2xl relative overflow-hidden";

  return (
    <Container className={containerClasses}>
      {!removeWrapper && (
        <>
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

          <div className="relative z-10 flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Progress Overview
              </h2>
              <p className="text-sm sm:text-base text-slate-400 font-medium">
                Subject-wise unit tracking and completion rates
              </p>
            </div>
          </div>
        </>
      )}

      <div className={removeWrapper ? "" : "space-y-6 relative z-10"}>
        {subjectData.map((subject, index) => {
          const completionRate = (subject.completed / subject.total) * 100;

          return (
            <motion.div
              key={subject.subject}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group bg-gray-50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-gray-200 dark:border-slate-700 hover:border-blue-500/30 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-slate-800/80 shadow-lg hover:shadow-blue-900/10"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getSubjectColor(subject.subject)} flex items-center justify-center shadow-lg ring-1 ring-gray-200 dark:ring-white/10 group-hover:scale-105 transition-transform duration-300`}>
                    <span className="text-white font-bold text-xl">
                      {subject.subject.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg tracking-tight mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-200 transition-colors">
                      {subject.subject}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                      <span className="bg-gray-200 dark:bg-slate-700/50 px-2 py-0.5 rounded text-xs font-medium border border-gray-300 dark:border-slate-600/50 text-gray-700 dark:text-slate-300">
                        {subject.total} Units
                      </span>
                      <span>•</span>
                      <span>{subject.avgHours.toFixed(1)} hrs/unit</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                    {completionRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-slate-400 font-medium uppercase tracking-wider">
                    Completion
                  </div>
                </div>
              </div>

              {/* Enhanced Progress Bar */}
              <div className="relative h-4 bg-gray-200 dark:bg-slate-700/50 rounded-full overflow-hidden mb-6 ring-1 ring-gray-200 dark:ring-white/5">
                {/* Completed */}
                {subject.completed > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(subject.completed / subject.total) * 100}%` }}
                    transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  />
                )}
                {/* In Progress */}
                {subject.inProgress > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(subject.inProgress / subject.total) * 100}%`,
                      left: `${(subject.completed / subject.total) * 100}%`
                    }}
                    transition={{ duration: 1, delay: index * 0.1 + 0.2, ease: "easeOut" }}
                    className="absolute top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                  />
                )}
                {/* Delayed */}
                {subject.delayed > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(subject.delayed / subject.total) * 100}%`,
                      left: `${((subject.completed + subject.inProgress) / subject.total) * 100}%`
                    }}
                    transition={{ duration: 1, delay: index * 0.1 + 0.4, ease: "easeOut" }}
                    className="absolute top-0 h-full bg-gradient-to-r from-amber-500 to-red-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  />
                )}
              </div>

              {/* Modern Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">
                    Done
                  </div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {subject.completed}
                  </div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">
                    Active
                  </div>
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {subject.inProgress}
                  </div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mb-1">
                    Delayed
                  </div>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {subject.delayed}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {subjectData.length === 0 && (
          <div className="text-center py-20 bg-gray-50 dark:bg-slate-800/30 rounded-2xl border border-gray-200 dark:border-slate-700/50 border-dashed">
            <div className="text-gray-400 dark:text-slate-600 mb-4">
              <BarChart3 className="w-16 h-16 mx-auto opacity-50" />
            </div>
            <p className="text-gray-500 dark:text-slate-400 font-medium">
              No data available for visualization
            </p>
          </div>
        )}
      </div>
    </Container>
  );
}
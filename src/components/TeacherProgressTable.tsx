import { motion } from 'motion/react';
import { CheckCircle, Clock, AlertCircle, Search } from 'lucide-react';
import { TeacherProgress } from './AdminDashboard';
import { useState } from 'react';

interface TeacherProgressTableProps {
  data: TeacherProgress[];
}

export function TeacherProgressTable({ data }: TeacherProgressTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = data.filter(item =>
    item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/30 border border-emerald-400/50">
            <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700 flex-shrink-0" />
            <span className="text-xs font-semibold text-black">Completed</span>
          </div>
        );
      case 'in-progress':
        return (
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-500/30 border border-blue-400/50">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-700 flex-shrink-0" />
            <span className="text-xs font-semibold text-black">In Progress</span>
          </div>
        );
      case 'delayed':
        return (
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-red-500/30 border border-red-400/50">
            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-700 flex-shrink-0" />
            <span className="text-xs font-semibold text-black">Delayed</span>
          </div>
        );
      default:
        return null;
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-slate-700/50 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-5 mb-5 sm:mb-6 lg:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Teacher Progress
        </h2>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/50 z-10 pointer-events-none" />
          <input
            type="text"
            placeholder="Search teachers, subjects, or units..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-gray-100/95 backdrop-blur-sm border-2 border-white/60 shadow-lg text-black text-sm sm:text-base placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 hover:border-white/80 transition-all duration-200"
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-3 sm:space-y-4">
        {filteredData.length > 0 ? (
          filteredData.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-slate-700/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-600/50 shadow-lg"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1 truncate">
                    {item.teacherName}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 mb-1">
                    {item.subject}
                  </p>
                  <p className="text-xs text-white/70 truncate">
                    {item.unit}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(item.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-600/50">
                <div>
                  <p className="text-xs text-white/60 mb-1">Started</p>
                  <p className="text-xs sm:text-sm font-medium text-white">
                    {formatDateShort(item.startedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-1">Hours</p>
                  <p className="text-xs sm:text-sm font-semibold text-white tabular-nums">
                    {item.totalHours.toFixed(1)}h
                  </p>
                </div>
                {item.completedAt && (
                  <div className="col-span-2">
                    <p className="text-xs text-white/60 mb-1">Completed</p>
                    <p className="text-xs sm:text-sm font-medium text-white">
                      {formatDateShort(item.completedAt)}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-white text-sm sm:text-base">
              No data found matching your criteria
            </p>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="min-w-full inline-block align-middle">
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Teacher
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Subject
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Unit
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Started
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Completed
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Hours
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredData.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm font-medium text-white">
                      {item.teacherName}
                    </td>
                    <td className="px-4 py-4 text-sm text-white/90">
                      {item.subject}
                    </td>
                    <td className="px-4 py-4 text-sm text-white/90 max-w-xs">
                      <div className="truncate">{item.unit}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-white/90">
                      {formatDateTime(item.startedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-white/90">
                      {item.completedAt ? formatDateTime(item.completedAt) : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {item.totalHours.toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(item.status)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredData.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white text-sm sm:text-base">
                  No data found matching your criteria
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 sm:mt-5 lg:mt-6 pt-4 sm:pt-5 border-t border-slate-700">
        <p className="text-xs sm:text-sm text-white/70 text-center">
          Showing {filteredData.length} of {data.length} records
        </p>
      </div>
    </div>
  );
}
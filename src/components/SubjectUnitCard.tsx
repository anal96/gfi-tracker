import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, PlayCircle, CheckCircle, Clock, Circle } from 'lucide-react';
import { Subject, Unit } from './TeacherDashboard';

interface SubjectUnitCardProps {
  subject: Subject;
  onStartUnit: (unitId: string) => void;
  onCompleteUnit: (unitId: string) => void;
  onUpdateElapsed: (unitId: string, elapsed: number) => void;
  index: number;
}

export function SubjectUnitCard({ subject, onStartUnit, onCompleteUnit, onUpdateElapsed, index }: SubjectUnitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const completedCount = subject.units.filter(u => u.status === 'completed').length;
  const inProgressCount = subject.units.filter(u => u.status === 'in-progress').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 100 }}
      className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl border border-blue-200/40 dark:border-blue-700/40 shadow-lg hover:shadow-xl transition-all duration-300"
    >

      {/* Subject Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-blue-800/20 transition-colors duration-200 rounded-2xl"
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${subject.color} flex items-center justify-center shadow-md overflow-hidden flex-shrink-0`}
          >
            <span className="relative text-black font-bold text-lg sm:text-xl z-10">
              {subject.name.charAt(0)}
            </span>
          </motion.div>
          <div className="text-left flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-black dark:text-white truncate">
              {subject.name}
            </h3>
            <p className="text-xs sm:text-sm text-black/70 dark:text-slate-400 font-medium">
              {completedCount}/{subject.units.length} completed
              {inProgressCount > 0 && (
                <span className="ml-2">
                  • {inProgressCount} active
                </span>
              )}
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-5 h-5 text-black dark:text-white" />
        </motion.div>
      </button>

      {/* Units List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
              {subject.units.map((unit, unitIndex) => (
                <UnitItem
                  key={unit.id}
                  unit={unit}
                  subjectColor={subject.color}
                  onStart={() => onStartUnit(unit.id)}
                  onComplete={() => onCompleteUnit(unit.id)}
                  onUpdateElapsed={(elapsed) => onUpdateElapsed(unit.id, elapsed)}
                  index={unitIndex}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface UnitItemProps {
  unit: Unit;
  subjectColor: string;
  onStart: () => void;
  onComplete: () => void;
  onUpdateElapsed: (elapsed: number) => void;
  index: number;
}

function UnitItem({ unit, subjectColor, onStart, onComplete, onUpdateElapsed, index }: UnitItemProps) {
  const [elapsed, setElapsed] = useState(unit.elapsedTime || 0);

  useEffect(() => {
    if (unit.status === 'in-progress') {
      const interval = setInterval(() => {
        setElapsed(prev => {
          const newElapsed = prev + 1;
          onUpdateElapsed(newElapsed);
          return newElapsed;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [unit.status, onUpdateElapsed]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressBar = () => {
    let progress = 0;
    let color = '';
    let bgColor = '';

    if (unit.status === 'completed') {
      progress = 100;
      color = 'bg-green-600';
      bgColor = 'bg-green-100';
    } else if (unit.status === 'in-progress') {
      if (unit.progressDays !== undefined && unit.progressDays >= 1) {
        // Day 2 onwards: 50% orange
        progress = 50;
        color = 'bg-orange-500';
        bgColor = 'bg-orange-100';
      } else {
        // Day 1 (just started): 15% red
        progress = 15;
        color = 'bg-red-600';
        bgColor = 'bg-red-100';
      }
    } else {
      // Not started: 0%
      progress = 0;
      color = 'bg-gray-400';
      bgColor = 'bg-gray-200';
    }

    // Determine colors based on status
    let fillColor = '#9ca3af'; // gray default
    let trackColor = '#e5e7eb'; // light gray default

    if (unit.status === 'completed') {
      fillColor = '#16a34a'; // green-600
      trackColor = '#dcfce7'; // green-100
    } else if (unit.status === 'in-progress') {
      if (unit.progressDays !== undefined && unit.progressDays >= 1) {
        fillColor = '#f97316'; // orange-500
        trackColor = '#ffedd5'; // orange-100
      } else {
        fillColor = '#dc2626'; // red-600
        trackColor = '#fee2e2'; // red-100
      }
    }

    return (
      <div className="w-full mb-3">
        <div
          className="h-5 rounded-full overflow-hidden border-2 border-gray-400 shadow-inner"
          style={{ backgroundColor: trackColor }}
        >
          {progress > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: fillColor }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs font-semibold text-black dark:text-gray-300">
            {unit.status === 'completed' ? 'Completed' :
              unit.status === 'in-progress' ? (unit.progressDays !== undefined && unit.progressDays >= 1 ? 'In Progress' : 'Started') :
                'Not Started'}
          </span>
          <span className="text-xs font-bold text-black dark:text-white">
            {progress}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
      className="p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-700 border border-blue-200/50 dark:border-slate-600 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-black dark:text-white mb-3 text-sm sm:text-base line-clamp-2">
            {unit.name}
          </h4>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        {getProgressBar()}
      </div>

      {/* Progress Indicator - Shows from day 2 onwards */}
      {unit.status === 'in-progress' && unit.progressDays !== undefined && unit.progressDays >= 1 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-3"
        >
          <div className="p-3 rounded-lg bg-gradient-to-r from-yellow-400/20 to-amber-400/20 border border-yellow-400/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 font-medium">Progress:</span>
              <span className="text-sm sm:text-base font-bold text-yellow-800 dark:text-yellow-200">
                Day {unit.progressDays + 1}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Completed Info */}
      {unit.status === 'completed' && unit.completedAt && unit.startedAt && (
        <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-emerald-500/15 to-green-500/15 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-400/40 dark:border-emerald-700/40">
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-black/80 dark:text-gray-300 font-medium">Started:</span>
              <span className="font-semibold text-black dark:text-white text-right">
                {new Date(unit.startedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-black/80 dark:text-gray-300 font-medium">Completed:</span>
              <span className="font-semibold text-black dark:text-white text-right">
                {new Date(unit.completedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons - Modern Mobile Design */}
      <div className="flex gap-2">
        {unit.status === 'not-started' && (
          <motion.button
            onClick={onStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className={`flex-1 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg bg-gradient-to-r ${subjectColor} text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2`}
          >
            <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Start</span>
          </motion.button>
        )}

        {unit.status === 'in-progress' && (
          <motion.button
            onClick={onComplete}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="flex-1 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Complete</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
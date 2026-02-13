import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Clock } from 'lucide-react';

interface ActiveUnitCardProps {
  unit: {
    id: string;
    name: string;
    startedAt?: Date;
    elapsedTime?: number;
    subjectName: string;
    subjectColor: string;
  };
}

export function ActiveUnitCard({ unit }: ActiveUnitCardProps) {
  const [elapsed, setElapsed] = useState(unit.elapsedTime || 0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync elapsed time with parent component removed to prevent render loop
  // The card manages its own display timer locally

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: secs.toString().padStart(2, '0'),
    };
  };

  const time = formatTime(elapsed);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 120 }}
      className="mb-6"
    >
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-blue-100 dark:border-blue-800/50 shadow-xl shadow-blue-500/10 overflow-hidden">

        <div className="relative z-10">
          {/* Header - Mobile Optimized */}
          <div className="flex items-center gap-3 mb-5">
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30"
            >
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" fill="currentColor" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl sm:text-2xl font-bold text-black dark:text-white">
                Active Unit
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 font-medium">
                New unit started in <span className="font-bold text-black dark:text-white">{unit.subjectName}</span>
              </p>
            </div>
          </div>

          {/* Content Grid - Mobile First */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-5">
            {/* Unit Info */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600/50">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${unit.subjectColor} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <span className="text-white font-bold text-base sm:text-lg">
                    {unit.subjectName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-1 font-medium">
                    Subject: <span className="font-bold text-black dark:text-white">{unit.subjectName}</span>
                  </p>
                  <h4 className="font-bold text-black dark:text-white text-sm sm:text-base leading-tight line-clamp-2">
                    {unit.name}
                  </h4>
                </div>
              </div>
            </div>

            {/* Started Time */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 font-medium">Started At</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-black dark:text-white">
                {unit.startedAt ? new Date(unit.startedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }) : '-'}
              </p>
              <p className="text-xs sm:text-sm text-gray-400 dark:text-slate-500">
                {unit.startedAt ? new Date(unit.startedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
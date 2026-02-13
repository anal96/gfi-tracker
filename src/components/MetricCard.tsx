import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  suffix?: string;
  color: string;
  index: number;
}

export function MetricCard({ icon: Icon, title, value, suffix, color, index }: MetricCardProps) {
  // Determine card background color - use color prop first, then map by title
  let cardBgClass = 'bg-gradient-to-br from-blue-500 to-blue-600';

  if (color && color.includes('from-') && color.includes('to-')) {
    // Use provided color gradient
    cardBgClass = `bg-gradient-to-br ${color}`;
  } else {
    // Color mapping based on card purpose - match the image design
    if (title.toLowerCase().includes('completed') || title.toLowerCase().includes('done') || title.toLowerCase().includes('approved')) {
      cardBgClass = 'bg-gradient-to-br from-emerald-500 to-green-600';
    } else if (title.toLowerCase().includes('pending') || title.toLowerCase().includes('todo')) {
      cardBgClass = 'bg-gradient-to-br from-yellow-500 to-orange-500';
    } else if (title.toLowerCase().includes('rejected')) {
      cardBgClass = 'bg-gradient-to-br from-red-500 to-rose-600';
    } else if (title.toLowerCase().includes('progress') || title.toLowerCase().includes('active')) {
      cardBgClass = 'bg-gradient-to-br from-blue-500 to-indigo-600';
    } else if (title.toLowerCase().includes('total')) {
      cardBgClass = 'bg-gradient-to-br from-blue-500 to-cyan-600';
    }
  }

  // Get short label for top right (last word of title)
  const shortLabel = title.split(' ').slice(-1)[0];

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 sm:p-6 shadow-xl hover:shadow-2xl border border-blue-100 dark:border-blue-800/50 relative overflow-hidden transition-all duration-300 group`}
    >
      <div className="relative z-10 flex flex-col h-full min-h-[130px] sm:min-h-[140px]">
        <div className="flex items-start justify-between mb-4">
          <div className={`${cardBgClass} w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md flex-shrink-0`}>
            <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-right">
            {title.toLowerCase().includes('today') ? (
              <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
                <p className="text-xs font-bold text-black dark:text-slate-300 uppercase tracking-wider">
                  Today
                </p>
              </div>
            ) : (
              <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
                <p className="text-xs font-bold text-black dark:text-slate-300 uppercase tracking-wider">
                  {shortLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-end mt-auto">
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl sm:text-5xl font-extrabold text-black dark:text-white tabular-nums z-20 relative">
              {value}
            </span>
            {suffix && (
              <span className="text-lg sm:text-xl font-bold text-black dark:text-slate-400 z-20 relative">
                {suffix}
              </span>
            )}
          </div>
          <p className="text-sm sm:text-base font-bold text-black dark:text-slate-400 mt-1 z-20 relative">
            {title}
          </p>
        </div>
      </div>
    </div>
  );
}

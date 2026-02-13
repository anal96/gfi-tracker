
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'motion/react';
import { PieChart as PieChartIcon, BarChart as BarChartIcon } from 'lucide-react';

interface SubjectData {
    name?: string;
    subject: string;
    total: number;
    completed: number;
    inProgress: number;
    delayed: number;
    totalHours: number;
    avgHours: number;
}

interface AnalyticsGraphsProps {
    data: SubjectData[];
    mode?: 'subject' | 'teacher';
}

const COLORS = {
    completed: '#10B981', // emerald-500
    inProgress: '#3B82F6', // blue-500
    delayed: '#F59E0B',    // amber-500
    total: '#64748B',      // slate-500
};

export function AnalyticsGraphs({ data, mode = 'subject' }: AnalyticsGraphsProps) {
    // Aggregate data for Pie Chart
    const aggregateData = data.reduce(
        (acc, item) => ({
            completed: acc.completed + item.completed,
            inProgress: acc.inProgress + item.inProgress,
            delayed: acc.delayed + item.delayed,
        }),
        { completed: 0, inProgress: 0, delayed: 0 }
    );

    const pieData = [
        { name: 'Completed', value: aggregateData.completed, color: COLORS.completed },
        { name: 'On Track', value: aggregateData.inProgress, color: COLORS.inProgress },
        { name: 'Delayed (>12h)', value: aggregateData.delayed, color: COLORS.delayed },
    ].filter(item => item.value > 0);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
                    <p className="font-bold text-white mb-2">
                        <span className="text-slate-400 font-normal mr-1">
                            {mode === 'teacher' ? 'Teacher:' : 'Subject:'}
                        </span>
                        {label || 'Unknown'}
                    </p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-slate-300">{entry.name}:</span>
                            <span className="font-mono font-medium text-white">{entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-5 mb-24">
            {/* Pie Chart Card - "Overall Status" */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-5 border border-slate-800 shadow-xl"
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <PieChartIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Overall Status</h2>
                            <p className="text-[10px] font-medium text-slate-400">All Units</p>
                        </div>
                    </div>
                </div>

                <div className="relative h-[200px] flex items-center justify-center">
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={4}
                                    dataKey="value"
                                    cornerRadius={4}
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            style={{ filter: `drop-shadow(0px 0px 6px ${entry.color}40)` }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-slate-500 font-medium text-sm">No data available</div>
                    )}

                    {/* Ring Content */}
                    {pieData.length > 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-white tracking-tighter shadow-black drop-shadow-lg">
                                {aggregateData.completed + aggregateData.inProgress + aggregateData.delayed}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Total</span>
                        </div>
                    )}
                </div>

                {/* Custom Legend Pills */}
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {pieData.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-slate-800/50 px-2.5 py-1 rounded-full border border-slate-700/50">
                            <div className="w-2 h-2 rounded-full shadow-[0_0_6px]" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                            <span className="text-[10px] font-medium text-slate-300">{item.name}</span>
                            <span className="text-[10px] font-bold text-white ml-0.5">{item.value}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Bar Chart Card - "Performance" */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-5 border border-slate-800 shadow-xl"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                            <BarChartIcon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">
                                {mode === 'teacher' ? 'Teacher Report' : 'Subject Report'}
                            </h2>
                            <p className="text-[10px] font-medium text-slate-400">
                                Breakdown ({mode === 'teacher' ? 'By Teacher' : 'By Subject'})
                            </p>
                        </div>
                    </div>
                </div>

                <div className="w-full" style={{ height: Math.max(300, data.length * 60) }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            barSize={12}
                            barGap={-12}
                        >
                            <XAxis type="number" hide domain={[0, 'dataMax']} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                interval={0}
                                tick={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 500 }}
                                tickLine={false}
                                axisLine={false}
                            />


                            {/* Background Track */}
                            <Bar dataKey="total" stackId="bg" fill="#1e293b" radius={[6, 6, 6, 6]} isAnimationActive={false} />

                            {/* Actual Data */}
                            <Bar dataKey="completed" name="Completed" stackId="a" fill={COLORS.completed} radius={[0, 0, 0, 0]} />
                            <Bar dataKey="inProgress" name="On Track" stackId="a" fill={COLORS.inProgress} />
                            <Bar dataKey="delayed" name="Delayed (>12h)" stackId="a" fill={COLORS.delayed} radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-4 text-[11px] text-slate-400 font-medium px-4">
                    <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Completed
                    </span>
                    <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> On Track
                    </span>
                    <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> Delayed
                    </span>
                </div>
            </motion.div>
        </div>
    );
}

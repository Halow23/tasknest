import { Progress } from '@/components/ui/progress';
import { columns, type TaskSummary } from './types';

type AnalyticsData = { completionRate: number; total: number; byStatus: Record<TaskSummary['status'], number> } | undefined;

export function AnalyticsView({ analytics, tasks }: { analytics: AnalyticsData; tasks: TaskSummary[] }) {
  const total = analytics?.total ?? tasks.length;
  const done = analytics?.byStatus.done ?? tasks.filter(task => task.status === 'done').length;
  return <div className="flex-1 overflow-auto p-5 lg:p-7"><h2 className="font-['DM_Serif_Display'] text-3xl">Momentum, not meetings.</h2><p className="mt-1 text-sm text-[#718A9A]">Live project flow from your team’s current work.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><section className="rounded-2xl border border-[#E2EBF0] bg-white p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8296A4]">Completion rate</p><p className="mt-2 font-['DM_Serif_Display'] text-5xl">{analytics?.completionRate ?? 0}%</p><p className="mt-2 text-xs text-[#718A9A]">{done} of {total} tasks are complete.</p></section><section className="rounded-2xl border border-[#E2EBF0] bg-white p-5"><h3 className="text-sm font-extrabold">Workflow balance</h3><div className="mt-5 space-y-4">{columns.map(column => { const amount = analytics?.byStatus[column.id] ?? 0; return <div key={column.id}><div className="mb-1.5 flex justify-between text-xs font-bold text-[#718491]"><span>{column.title}</span><span>{amount}</span></div><Progress value={total ? Math.round((amount / total) * 100) : 0} className="h-2" /></div>; })}</div></section></div></div>
}

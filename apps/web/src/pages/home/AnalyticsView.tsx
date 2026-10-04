import { Progress } from '@/components/ui/progress';
import { columns, type TaskSummary } from './types';

type AnalyticsData = { completionRate: number; total: number; byStatus: Record<TaskSummary['status'], number> } | undefined;

export function AnalyticsView({ analytics, tasks }: { analytics: AnalyticsData; tasks: TaskSummary[] }) {
  const total = analytics?.total ?? tasks.length;
  const done = analytics?.byStatus.done ?? tasks.filter(task => task.status === 'done').length;
  return <div className="flex-1 overflow-auto p-5 lg:p-7"><h2 className="text-tn-title-2 font-medium text-foreground">Momentum, not meetings.</h2><p className="mt-1 text-tn-body text-tn-text-secondary">Live project flow from your team’s current work.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><section className="rounded-2xl border border-border bg-card p-5"><p className="text-tn-caption-1 font-medium uppercase tracking-[0.12em] text-tn-text-secondary">Completion rate</p><p className="mt-2 text-tn-title-2 font-medium text-foreground">{analytics?.completionRate ?? 0}%</p><p className="mt-2 text-tn-body-2 text-tn-text-secondary">{done} of {total} tasks are complete.</p></section><section className="rounded-2xl border border-border bg-card p-5"><h3 className="text-tn-body font-medium text-foreground">Workflow balance</h3><div className="mt-5 space-y-4">{columns.map(column => { const amount = analytics?.byStatus[column.id] ?? 0; return <div key={column.id}><div className="mb-1.5 flex justify-between text-tn-body-2 font-medium text-tn-text-secondary"><span>{column.title}</span><span>{amount}</span></div><Progress value={total ? Math.round((amount / total) * 100) : 0} className="h-2" /></div>; })}</div></section></div></div>
}

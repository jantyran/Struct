'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TODO_PRIORITY_LABELS, TODO_STATUS_LABELS, type TodoPriority, type TodoStatus } from '@/types';
import { withBasePath } from '@/lib/paths';

type CountRow<T extends string> = { [K in T]: string } & { count: number };
type NumericCountRow<T extends string> = { [K in T]: number } & { count: number };

interface ReportData {
  range: string;
  start: string | null;
  task_summary: {
    assigned_total: number;
    assigned_open: number;
    assigned_completed: number;
    assigned_overdue: number;
    completed_by_me: number;
    created_by_me: number;
    completed_on_time: number;
    completed_late: number;
    avg_completion_days: number | null;
  };
  status_breakdown: Array<CountRow<'status'>>;
  priority_breakdown: Array<CountRow<'priority'>>;
  monthly_completed: Array<CountRow<'month'>>;
  monthly_created: Array<CountRow<'month'>>;
  completion_histogram: Array<CountRow<'bucket'>>;
  weekday_heatmap: Array<NumericCountRow<'weekday' | 'hour'>>;
  project_task_load: Array<{ project_id: string; project_name: string; open_count: number; completed_count: number; overdue_count: number }>;
  cycle_scatter: Array<{
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    created_at: string;
    completed_at: string;
    due_date: string;
    completion_days: number;
    late_days: number | null;
  }>;
  project_status_breakdown: Array<CountRow<'status'>>;
  recent_completed_tasks: Array<{
    id: string;
    project_id: string;
    project_name: string;
    title: string;
    priority: TodoPriority;
    due_date: string;
    completed_at: string;
  }>;
  project_summary: {
    involved_total: number;
    owned_total: number;
    primary_total: number;
    completed_total: number;
    active_total: number;
    draft_total: number;
  };
  recent_completed_projects: Array<{ id: string; name: string; type: string; completed_at: string }>;
}

const RANGE_OPTIONS = [
  { value: '30', label: '30日' },
  { value: '90', label: '90日' },
  { value: '180', label: '180日' },
  { value: '365', label: '1年' },
  { value: 'all', label: '全期間' },
];

const STATUS_COLORS: Record<string, string> = { todo: '#94a3b8', in_progress: '#3b82f6', done: '#10b981', draft: '#94a3b8', active: '#14b8a6', completed: '#10b981', archived: '#64748b' };
const PRIORITY_COLORS: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const HISTOGRAM_ORDER = ['当日', '1-2日', '3-6日', '7-13日', '14-29日', '30日+'];
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ja-JP');
}

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function maxCount(rows: Array<{ count: number }>) {
  return Math.max(...rows.map((row) => row.count), 1);
}

function EmptyChart({ label = '対象データがありません' }: { label?: string }) {
  return <div className="h-48 rounded-2xl bg-slate-50 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>{label}</div>;
}

function Section({ title, note, children, wide = false }: { title: string; note?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`card p-5 ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="mb-4">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {note && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

function FunnelChart({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.label}>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>{index + 1}. {row.label}</span>
            <span>{row.value}</span>
          </div>
          <div className="h-9 rounded-xl bg-slate-100 overflow-hidden">
            <div className="h-full rounded-xl flex items-center justify-end pr-3 text-xs font-semibold text-white" style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 8 : 0)}%`, background: row.color }}>
              {pct(row.value, max)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ rows, labels }: { rows: Array<{ key: string; count: number; color: string }>; labels: Record<string, string> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyChart />;
  let acc = 0;
  const gradient = rows.map((row) => {
    const start = (acc / total) * 100;
    acc += row.count;
    const end = (acc / total) * 100;
    return `${row.color} ${start}% ${end}%`;
  }).join(', ');
  return (
    <div className="flex items-center gap-5">
      <div className="w-40 h-40 rounded-full shrink-0 relative" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-8 rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>total</span>
        </div>
      </div>
      <div className="space-y-2 flex-1 min-w-0">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 min-w-0"><i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />{labels[row.key] ?? row.key}</span>
            <span className="font-semibold">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyBars({ rows }: { rows: Array<{ month: string; created: number; completed: number }> }) {
  if (!rows.length) return <EmptyChart />;
  const max = Math.max(...rows.flatMap((row) => [row.created, row.completed]), 1);
  return (
    <div className="h-64 flex items-end gap-3 overflow-x-auto pb-2">
      {rows.map((row) => (
        <div key={row.month} className="flex flex-col items-center gap-2 min-w-12 flex-1">
          <div className="h-48 flex items-end gap-1 w-full justify-center">
            <div title={`作成 ${row.created}`} className="w-4 rounded-t-lg bg-cyan-400" style={{ height: `${Math.max((row.created / max) * 100, row.created ? 4 : 0)}%` }} />
            <div title={`完了 ${row.completed}`} className="w-4 rounded-t-lg bg-emerald-400" style={{ height: `${Math.max((row.completed / max) * 100, row.completed ? 4 : 0)}%` }} />
          </div>
          <span className="text-[0.625rem] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{row.month.slice(2)}</span>
        </div>
      ))}
    </div>
  );
}

function Histogram({ rows }: { rows: Array<{ bucket: string; count: number }> }) {
  const ordered = HISTOGRAM_ORDER.map((bucket) => ({ bucket, count: rows.find((row) => row.bucket === bucket)?.count ?? 0 }));
  const max = maxCount(ordered);
  return (
    <div className="space-y-2">
      {ordered.map((row) => (
        <div key={row.bucket} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>{row.bucket}</span>
          <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
          <span className="text-right font-semibold">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ rows }: { rows: Array<{ weekday: number; hour: number; count: number }> }) {
  const max = maxCount(rows);
  const value = (weekday: number, hour: number) => rows.find((row) => row.weekday === weekday && Math.floor(row.hour / 3) * 3 === hour)?.count ?? 0;
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1 min-w-[28rem]" style={{ gridTemplateColumns: '2rem repeat(8, minmax(0, 1fr))' }}>
        <div />
        {HOURS.map((hour) => <div key={hour} className="text-[0.625rem] text-center" style={{ color: 'var(--text-muted)' }}>{hour}</div>)}
        {WEEKDAYS.map((day, weekday) => (
          <div key={day} className="contents">
            <div className="text-xs flex items-center" style={{ color: 'var(--text-muted)' }}>{day}</div>
            {HOURS.map((hour) => {
              const count = value(weekday, hour);
              const opacity = count ? 0.16 + (count / max) * 0.84 : 0.04;
              return <div key={`${day}-${hour}`} title={`${day} ${hour}:00台 ${count}件`} className="h-8 rounded-lg border" style={{ background: `rgba(15,154,177,${opacity})`, borderColor: 'rgba(216,231,239,0.8)' }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Scatter({ rows }: { rows: ReportData['cycle_scatter'] }) {
  if (!rows.length) return <EmptyChart />;
  const maxX = Math.max(...rows.map((row) => row.completion_days), 1);
  const minY = Math.min(...rows.map((row) => row.late_days ?? 0), -1);
  const maxY = Math.max(...rows.map((row) => row.late_days ?? 0), 1);
  const spanY = Math.max(maxY - minY, 1);
  return (
    <div className="relative h-64 rounded-2xl bg-slate-50 border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="absolute left-4 right-4 top-1/2 border-t border-dashed border-slate-300" />
      {rows.map((row) => {
        const x = 4 + (row.completion_days / maxX) * 90;
        const y = 92 - (((row.late_days ?? 0) - minY) / spanY) * 84;
        const late = (row.late_days ?? 0) > 0;
        return (
          <Link key={row.id} href={withBasePath(`/projects/${row.project_id}?tab=todos&todo=${encodeURIComponent(row.id)}`)} title={`${row.title} / 完了 ${row.completion_days}日 / 遅延 ${row.late_days ?? 0}日`} className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm hover:scale-150 transition-transform" style={{ left: `${x}%`, top: `${y}%`, background: late ? '#ef4444' : '#10b981' }} />
        );
      })}
      <span className="absolute left-3 bottom-2 text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>完了までの日数 →</span>
      <span className="absolute right-3 top-2 text-[0.625rem] text-red-500">遅延</span>
      <span className="absolute right-3 bottom-2 text-[0.625rem] text-emerald-600">前倒し/期限内</span>
    </div>
  );
}

function ProjectLoad({ rows }: { rows: ReportData['project_task_load'] }) {
  if (!rows.length) return <EmptyChart />;
  const max = Math.max(...rows.map((row) => row.open_count + row.completed_count), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const total = row.open_count + row.completed_count;
        return (
          <div key={row.project_id} className="grid grid-cols-[minmax(7rem,1fr)_2fr_3rem] items-center gap-3 text-sm">
            <Link href={withBasePath(`/projects/${row.project_id}`)} className="truncate font-medium hover:underline">{row.project_name}</Link>
            <div className="h-5 rounded-full bg-slate-100 overflow-hidden flex">
              <div title={`未完了 ${row.open_count}`} className="h-full bg-blue-400" style={{ width: `${(row.open_count / max) * 100}%` }} />
              <div title={`完了 ${row.completed_count}`} className="h-full bg-emerald-400" style={{ width: `${(row.completed_count / max) * 100}%` }} />
              {row.overdue_count > 0 && <div title={`期限切れ ${row.overdue_count}`} className="h-full bg-red-400" style={{ width: `${Math.max((row.overdue_count / max) * 100, 3)}%` }} />}
            </div>
            <span className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>{total}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MyReportPage() {
  const router = useRouter();
  const [range, setRange] = useState('180');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(withBasePath(`/api/my-report?range=${range}`));
    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [range, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthlyRows = useMemo(() => {
    const months = new Set([
      ...(data?.monthly_created ?? []).map((row) => row.month),
      ...(data?.monthly_completed ?? []).map((row) => row.month),
    ]);
    return Array.from(months).sort().map((month) => ({
      month,
      created: data?.monthly_created.find((row) => row.month === month)?.count ?? 0,
      completed: data?.monthly_completed.find((row) => row.month === month)?.count ?? 0,
    }));
  }, [data]);

  const summary = data?.task_summary;
  const project = data?.project_summary;
  const onTimeRate = summary ? pct(summary.completed_on_time, summary.completed_on_time + summary.completed_late) : 0;
  const statusRows = (data?.status_breakdown ?? []).map((row) => ({ key: row.status, count: row.count, color: STATUS_COLORS[row.status] ?? '#94a3b8' }));
  const priorityRows = (data?.priority_breakdown ?? []).map((row) => ({ key: row.priority, count: row.count, color: PRIORITY_COLORS[row.priority] ?? '#94a3b8' }));
  const projectStatusRows = (data?.project_status_breakdown ?? []).map((row) => ({ key: row.status, count: row.count, color: STATUS_COLORS[row.status] ?? '#94a3b8' }));

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>実行レポート</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            実行量、完了速度、期限遵守、作業時間帯、案件別負荷をグラフで確認します。
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgba(241,250,252,0.8)', border: '1px solid var(--border)' }}>
          {RANGE_OPTIONS.map((option) => (
            <button key={option.value} onClick={() => setRange(option.value)} className="text-xs px-3 py-1 rounded-lg transition-colors" style={range === option.value ? { backgroundColor: 'white', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-muted)' }}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data || !summary || !project ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>レポートを読み込み中...</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: '担当完了', value: summary.assigned_completed, sub: `未完了 ${summary.assigned_open} 件` },
              { label: '期限遵守率', value: `${onTimeRate}%`, sub: `遅延完了 ${summary.completed_late} 件` },
              { label: '平均完了日数', value: summary.avg_completion_days ?? '-', sub: '作成から完了まで' },
              { label: '期限切れ', value: summary.assigned_overdue, sub: '未完了タスク' },
            ].map((card) => (
              <div key={card.label} className="card p-4 border-l-4" style={{ borderLeftColor: card.label === '期限切れ' && Number(card.value) > 0 ? '#ef4444' : 'var(--accent)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="text-2xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{card.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="実行ファネル" note="担当になったタスクが、完了・期限内完了までどれだけ進んだか">
              <FunnelChart rows={[
                { label: '担当タスク', value: summary.assigned_total, color: '#0f9ab1' },
                { label: '完了', value: summary.assigned_completed, color: '#10b981' },
                { label: '期限内完了', value: summary.completed_on_time, color: '#22c55e' },
              ]} />
            </Section>
            <Section title="担当タスクの状態" note="円グラフで現在の詰まりを確認">
              <DonutChart rows={statusRows} labels={TODO_STATUS_LABELS} />
            </Section>
            <Section title="未完了の優先度" note="赤/橙が多いほど短期の圧が高い">
              <DonutChart rows={priorityRows} labels={TODO_PRIORITY_LABELS} />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="月別 作成/完了チャート" note="青が作成、緑が完了。完了が作成を下回る月は積み残しが増えています" wide>
              <MonthlyBars rows={monthlyRows} />
            </Section>
            <Section title="完了までの日数ヒストグラム" note="タスクがどのくらいの期間で閉じられているか">
              <Histogram rows={data.completion_histogram} />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="曜日×時間 ヒートマップ" note="完了操作が集中する時間帯。濃いセルほど多い" wide>
              <Heatmap rows={data.weekday_heatmap} />
            </Section>
            <Section title="関与プロジェクトの状態" note="自分が関係する案件の現在地">
              <DonutChart rows={projectStatusRows} labels={{ draft: '下書き', active: 'アクティブ', completed: '完了', archived: 'アーカイブ' }} />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="案件別タスク負荷" note="青=未完了、緑=完了、赤=期限切れ。上位10件">
              <ProjectLoad rows={data.project_task_load} />
            </Section>
            <Section title="完了速度 × 遅延 散布図" note="右ほど時間がかかり、上ほど期限超過。点をクリックするとタスクへ移動">
              <Scatter rows={data.cycle_scatter} />
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="最近完了したタスク">
              <div className="space-y-2">
                {data.recent_completed_tasks.length === 0 ? <EmptyChart /> : data.recent_completed_tasks.slice(0, 8).map((todo) => (
                  <Link key={todo.id} href={withBasePath(`/projects/${todo.project_id}?tab=todos&todo=${encodeURIComponent(todo.id)}`)} className="block rounded-xl border px-3 py-2 hover:bg-slate-50" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm font-medium truncate">{todo.title}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{todo.project_name} · 完了 {formatDate(todo.completed_at)}</p>
                  </Link>
                ))}
              </div>
            </Section>
            <Section title="最近完了したプロジェクト">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>関与</p><p className="text-xl font-bold">{project.involved_total}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>主担当</p><p className="text-xl font-bold">{project.primary_total}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs" style={{ color: 'var(--text-muted)' }}>完了</p><p className="text-xl font-bold">{project.completed_total}</p></div>
              </div>
              <div className="space-y-2">
                {data.recent_completed_projects.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>完了プロジェクトはまだありません。</p> : data.recent_completed_projects.map((item) => (
                  <Link key={item.id} href={withBasePath(`/projects/${item.id}`)} className="flex justify-between gap-3 rounded-xl border px-3 py-2 hover:bg-slate-50" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{formatDate(item.completed_at)}</span>
                  </Link>
                ))}
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

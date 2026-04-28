'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TODO_PRIORITY_LABELS, TODO_STATUS_LABELS, type TodoPriority, type TodoStatus } from '@/types';
import { withBasePath } from '@/lib/paths';

type CountRow<T extends string> = { [K in T]: string } & { count: number };
type NumericCountRow<T extends string> = { [K in T]: number } & { count: number };

interface TaskSummary {
  assigned_total: number;
  assigned_open: number;
  assigned_completed: number;
  assigned_overdue: number;
  completed_by_me: number;
  created_by_me: number;
  completed_on_time: number;
  completed_late: number;
  avg_completion_days: number | null;
}

interface ReportData {
  range: string;
  start: string | null;
  task_summary: TaskSummary;
  prev_task_summary: TaskSummary | null;
  status_breakdown: Array<CountRow<'status'>>;
  priority_breakdown: Array<CountRow<'priority'>>;
  monthly_completed: Array<CountRow<'month'>>;
  monthly_created: Array<CountRow<'month'>>;
  weekly_completed: Array<{ week: string; count: number }>;
  weekly_created: Array<{ week: string; count: number }>;
  completion_histogram: Array<CountRow<'bucket'>>;
  weekday_heatmap: Array<NumericCountRow<'weekday' | 'hour'>>;
  project_task_load: Array<{ project_id: string; project_name: string; open_count: number; completed_count: number; overdue_count: number }>;
  cycle_scatter: Array<{
    id: string; project_id: string; project_name: string; title: string;
    created_at: string; completed_at: string; due_date: string;
    completion_days: number; late_days: number | null;
  }>;
  project_status_breakdown: Array<CountRow<'status'>>;
  recent_completed_tasks: Array<{ id: string; project_id: string; project_name: string; title: string; priority: TodoPriority; due_date: string; completed_at: string }>;
  project_summary: { involved_total: number; owned_total: number; primary_total: number; completed_total: number; active_total: number; draft_total: number };
  recent_completed_projects: Array<{ id: string; name: string; type: string; completed_at: string }>;
  daily_completions: Array<{ day: string; count: number }>;
  tag_breakdown: Array<{ tag: string; count: number }>;
  streaks: { best_streak: number; current_streak: number };
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
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i); // 0〜23（1時間刻み）
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ja-JP');
}

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function maxCount(rows: Array<{ count: number }>) {
  return Math.max(...rows.map((r) => r.count), 1);
}

function deltaLabel(current: number, prev: number) {
  const d = current - prev;
  return { label: d >= 0 ? `+${d}` : `${d}`, positive: d >= 0 };
}

function EmptyChart({ label = '対象データがありません' }: { label?: string }) {
  return (
    <div className="h-44 rounded-2xl bg-slate-50 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
      {label}
    </div>
  );
}

// ──────────────────────────────────────────
// Section
// ──────────────────────────────────────────
function Section({ title, note, children, wide = false, id, headerRight }: {
  title: string; note?: string; children: React.ReactNode;
  wide?: boolean; id?: string; headerRight?: React.ReactNode;
}) {
  return (
    <section id={id} className={`card p-5 ${wide ? 'lg:col-span-2' : ''}`}>
      <div className={`mb-4 ${headerRight ? 'flex items-start justify-between gap-3' : ''}`}>
        <div className="min-w-0">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {note && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{note}</p>}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {children}
    </section>
  );
}

// ──────────────────────────────────────────
// ハイライトバー
// ──────────────────────────────────────────
function HighlightBar({ summary, streaks, range }: { summary: TaskSummary; streaks: ReportData['streaks']; range: string }) {
  const onTimeRate = pct(summary.completed_on_time, summary.completed_on_time + summary.completed_late);
  const isCelebration = summary.assigned_completed >= 5 || onTimeRate >= 80 || streaks.current_streak >= 3;

  const rangeLabel: Record<string, string> = { '30': '30日間', '90': '90日間', '180': '180日間', '365': '1年間', all: 'この期間' };

  const highlights = [
    streaks.current_streak >= 2 && { icon: '🔥', label: `${streaks.current_streak}日連続`, sub: '継続中', color: '#f97316' },
    streaks.best_streak >= 2 && { icon: '⚡', label: `最長${streaks.best_streak}日`, sub: 'ベストストリーク', color: '#eab308' },
    summary.assigned_completed > 0 && { icon: '✓', label: `${summary.assigned_completed}件完了`, sub: rangeLabel[range] ?? 'この期間', color: '#10b981' },
    onTimeRate > 0 && { icon: '🎯', label: `${onTimeRate}%`, sub: '期限遵守率', color: onTimeRate >= 80 ? '#10b981' : onTimeRate >= 60 ? '#eab308' : '#ef4444' },
  ].filter(Boolean) as Array<{ icon: string; label: string; sub: string; color: string }>;

  if (highlights.length === 0) return null;

  return (
    <div
      className={`card p-4 ${isCelebration ? 'border-l-4' : ''}`}
      style={isCelebration ? { borderLeftColor: '#10b981', background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, white 60%)' } : undefined}
    >
      {isCelebration && (
        <p className="text-xs font-semibold mb-3" style={{ color: '#059669' }}>この期間の実行サマリー</p>
      )}
      <div className="flex flex-wrap gap-6">
        {highlights.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xl leading-none">{h.icon}</span>
            <div>
              <p className="text-base font-bold leading-tight" style={{ color: h.color }}>{h.label}</p>
              <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>{h.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// KPIカード（前期比）
// ──────────────────────────────────────────
function KpiCard({ label, value, sub, prev, accentRed = false }: {
  label: string; value: string | number; sub?: string; prev?: number; accentRed?: boolean;
}) {
  const numVal = typeof value === 'number' ? value : parseFloat(String(value));
  const hasDelta = prev !== undefined && !isNaN(numVal) && !isNaN(prev);
  const d = hasDelta ? deltaLabel(numVal, prev!) : null;

  return (
    <div className="card p-4 border-l-4" style={{ borderLeftColor: accentRed && Number(value) > 0 ? '#ef4444' : 'var(--accent)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      {d && (
        <p className="text-[0.625rem] mt-1.5 font-semibold" style={{ color: d.positive ? '#10b981' : '#ef4444' }}>
          {d.label} vs 前期
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 年間カレンダーグラフ
// ──────────────────────────────────────────
function CalendarGraph({ rows }: { rows: Array<{ day: string; count: number }> }) {
  const dayMap = useMemo(() => new Map(rows.map(r => [r.day, r.count])), [rows]);
  const max = useMemo(() => Math.max(...rows.map(r => r.count), 1), [rows]);
  const totalThisYear = rows.reduce((s, r) => s + r.count, 0);

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() - start.getDay()); // rewind to Sunday

    const ws: Array<Array<string | null>> = [];
    const d = new Date(start);
    while (d <= today) {
      const week: Array<string | null> = [];
      for (let di = 0; di < 7; di++) {
        week.push(d <= today ? d.toISOString().slice(0, 10) : null);
        d.setDate(d.getDate() + 1);
      }
      ws.push(week);
    }

    const ml: Array<{ wi: number; label: string }> = [];
    ws.forEach((week, wi) => {
      for (const day of week) {
        if (day?.endsWith('-01')) {
          ml.push({ wi, label: MONTH_NAMES[parseInt(day.slice(5, 7)) - 1] });
        }
      }
    });
    return { weeks: ws, monthLabels: ml };
  }, []);

  function cellColor(count: number) {
    if (count === 0) return 'rgba(15,154,177,0.07)';
    return `rgba(15,154,177,${0.18 + Math.min(count / max, 1) * 0.82})`;
  }

  if (rows.length === 0) return <EmptyChart label="まだ完了記録がありません" />;

  const WEEKDAY_LABELS = ['日', '', '火', '', '木', '', '土'];

  return (
    <div className="space-y-2">
      {/* 統計 + 凡例 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>過去1年: {totalThisYear}件完了</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>少</span>
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <div key={t} className="rounded-sm border" style={{ width: 12, height: 12, background: cellColor(t * max), borderColor: 'rgba(200,220,230,0.5)' }} />
          ))}
          <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>多</span>
        </div>
      </div>

      {/* カレンダーグリッド — flex: 1 でコンテナ幅いっぱいに展開 */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 420 }}>
          {/* 月ラベル行（曜日列と同じ構造で揃える） */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
            <div style={{ width: 20, flexShrink: 0 }} />
            {weeks.map((_, wi) => {
              const ml = monthLabels.find(m => m.wi === wi);
              return (
                <div key={wi} style={{ flex: 1, minWidth: 8, overflow: 'visible', whiteSpace: 'nowrap' }}>
                  {ml && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{ml.label}</span>}
                </div>
              );
            })}
          </div>

          {/* 7行（曜日）× N列（週）。セルは flex:1 で自動的に横幅を埋める */}
          {WEEKDAY_LABELS.map((label, di) => (
            <div key={di} style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
              {/* 曜日ラベル */}
              <div style={{ width: 20, flexShrink: 0, fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 3 }}>
                {label}
              </div>
              {/* 週セル */}
              {weeks.map((week, wi) => {
                const day = week[di];
                const count = day ? (dayMap.get(day) ?? 0) : 0;
                return (
                  <div
                    key={wi}
                    title={day ? `${day}: ${count}件` : ''}
                    style={{
                      flex: 1,
                      minWidth: 8,
                      aspectRatio: '1',     // 正方形セル（幅に合わせて高さも決まる）
                      borderRadius: 2,
                      background: day ? cellColor(count) : 'transparent',
                      border: day ? '1px solid rgba(200,220,230,0.4)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 作成/完了チャート（週・月切り替え）
// ──────────────────────────────────────────
type ActivityView = 'weekly' | 'monthly';

function ActivityBars({ rows, view }: { rows: Array<{ period: string; created: number; completed: number }>; view: ActivityView }) {
  if (!rows.length) return <EmptyChart />;
  const max = Math.max(...rows.flatMap(r => [r.created, r.completed]), 1);

  function formatLabel(period: string) {
    if (view === 'weekly') {
      const parts = period.split('-');
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }
    const parts = period.split('-');
    return `${parseInt(parts[1])}月`;
  }

  return (
    <div>
      <div className="flex gap-4 mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded bg-cyan-400 inline-block" />作成</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" />完了</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1.5 pb-1" style={{ minWidth: rows.length > 20 ? rows.length * 26 : undefined, height: 200 }}>
          {rows.map((row) => (
            <div key={row.period} className="flex flex-col items-center gap-1 flex-1 min-w-[22px]">
              <div className="flex items-end gap-0.5 flex-1 w-full justify-center">
                <div
                  title={`作成 ${row.created}`}
                  className="rounded-t transition-all"
                  style={{ width: '45%', background: '#67e8f9', height: `${Math.max((row.created / max) * 150, row.created ? 3 : 0)}px` }}
                />
                <div
                  title={`完了 ${row.completed}`}
                  className="rounded-t transition-all"
                  style={{ width: '45%', background: '#34d399', height: `${Math.max((row.completed / max) * 150, row.completed ? 3 : 0)}px` }}
                />
              </div>
              <span className="text-[0.5rem] whitespace-nowrap leading-none" style={{ color: 'var(--text-muted)' }}>
                {formatLabel(row.period)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// ファネル
// ──────────────────────────────────────────
function FunnelChart({ rows }: { rows: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.label}>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            <span>{i + 1}. {row.label}</span><span>{row.value}</span>
          </div>
          <div className="h-8 rounded-xl bg-slate-100 overflow-hidden">
            <div className="h-full rounded-xl flex items-center justify-end pr-3 text-xs font-semibold text-white" style={{ width: `${Math.max((row.value / max) * 100, row.value > 0 ? 8 : 0)}%`, background: row.color }}>
              {pct(row.value, max)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// ドーナツ
// ──────────────────────────────────────────
function DonutChart({ rows, labels }: { rows: Array<{ key: string; count: number; color: string }>; labels: Record<string, string> }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) return <EmptyChart />;
  let acc = 0;
  const gradient = rows.map(r => {
    const start = (acc / total) * 100;
    acc += r.count;
    return `${r.color} ${start}% ${(acc / total) * 100}%`;
  }).join(', ');
  return (
    <div className="flex items-center gap-5">
      <div className="w-36 h-36 rounded-full shrink-0 relative" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-7 rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-xl font-bold">{total}</span>
          <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>total</span>
        </div>
      </div>
      <div className="space-y-1.5 flex-1 min-w-0">
        {rows.map(r => (
          <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
              <i className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
              {labels[r.key] ?? r.key}
            </span>
            <span className="font-semibold shrink-0">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// ヒストグラム
// ──────────────────────────────────────────
function Histogram({ rows }: { rows: Array<{ bucket: string; count: number }> }) {
  const ordered = HISTOGRAM_ORDER.map(bucket => ({ bucket, count: rows.find(r => r.bucket === bucket)?.count ?? 0 }));
  const max = maxCount(ordered);
  return (
    <div className="space-y-2">
      {ordered.map(r => (
        <div key={r.bucket} className="grid items-center gap-3" style={{ gridTemplateColumns: '4rem 1fr 2rem' }}>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{r.bucket}</span>
          <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="text-right text-sm font-semibold">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// ヒートマップ（インサイト文付き）
// ──────────────────────────────────────────
function Heatmap({ rows }: { rows: Array<{ weekday: number; hour: number; count: number }> }) {
  const max = maxCount(rows);
  // 1時間刻みで完全一致
  const value = (weekday: number, hour: number) =>
    rows.find(r => r.weekday === weekday && r.hour === hour)?.count ?? 0;

  const insight = useMemo(() => {
    if (!rows.length) return null;
    const peak = rows.reduce((best, r) => r.count > best.count ? r : best, rows[0]);
    const weekdayTotals = WEEKDAYS.map((_, i) =>
      rows.filter(r => r.weekday === i).reduce((s, r) => s + r.count, 0));
    const bestDayIdx = weekdayTotals.indexOf(Math.max(...weekdayTotals));
    return `最多完了: ${WEEKDAYS[peak.weekday]}曜日 ${peak.hour}時台（${peak.count}件）。最も活発: ${WEEKDAYS[bestDayIdx]}曜日。`;
  }, [rows]);

  const LABEL_W = 24; // 曜日ラベル列幅（px）
  const CELL_H = 30; // セル高さ固定（px）。幅は flex:1 で自動

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div style={{ minWidth: 420 }}>
          {/* 時間ラベル行（曜日列と同じ構造で揃える） */}
          <div style={{ display: 'flex', gap: 1, marginBottom: 4 }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} /> {/* 曜日列スペーサー */}
            {ALL_HOURS.map(h => (
              <div
                key={h}
                style={{
                  flex: 1, minWidth: 10,
                  textAlign: 'center',
                  fontSize: 9,
                  lineHeight: 1,
                  // 3時間ごとにラベル表示、それ以外は透明（整列キープ）
                  color: h % 3 === 0 ? 'var(--text-muted)' : 'transparent',
                  userSelect: 'none',
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* 曜日 × 24時間グリッド。各セルが flex:1 でコンテナ幅を等分 */}
          {WEEKDAYS.map((day, weekday) => (
            <div key={day} style={{ display: 'flex', gap: 1, marginBottom: 1 }}>
              <div style={{ width: LABEL_W, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                {day}
              </div>
              {ALL_HOURS.map(h => {
                const count = value(weekday, h);
                const opacity = count ? 0.18 + (count / max) * 0.82 : 0.05;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}時台: ${count}件`}
                    style={{
                      flex: 1,
                      minWidth: 10,
                      height: CELL_H,
                      borderRadius: 3,
                      background: `rgba(15,154,177,${opacity})`,
                      border: '1px solid rgba(216,231,239,0.7)',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {insight && (
        <p className="text-xs rounded-xl px-3 py-2 bg-slate-50 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {insight}
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 散布図（overflow: hidden + センタリング修正）
// ──────────────────────────────────────────
function Scatter({ rows }: { rows: ReportData['cycle_scatter'] }) {
  const [tooltip, setTooltip] = useState<{ task: typeof rows[0]; x: number; y: number } | null>(null);

  if (!rows.length) return <EmptyChart />;

  const maxX = Math.max(...rows.map(r => r.completion_days), 1);
  const minY = Math.min(...rows.map(r => r.late_days ?? 0), 0);
  const maxY = Math.max(...rows.map(r => r.late_days ?? 0), 0);
  // 上下に少しマージンを加えてデータが端にへばりつかないようにする
  const yPad = Math.max((maxY - minY) * 0.12, 0.5);
  const yLo = minY - yPad;
  const yHi = maxY + yPad;
  const spanY = yHi - yLo;

  // 描画領域: 左8% 右8% 上8% 下14%（軸ラベル分）のパディング
  const PAD_L = 8, PAD_R = 8, PAD_T = 8, PAD_B = 14;
  const toX = (days: number) => PAD_L + (days / maxX) * (100 - PAD_L - PAD_R);
  const toY = (ld: number | null) => PAD_T + (1 - ((ld ?? 0) - yLo) / spanY) * (100 - PAD_T - PAD_B);

  // ゼロライン（late_days = 0）のy位置
  const zeroLineY = toY(0);

  return (
    <div className="space-y-2">
      {/* 凡例 */}
      <div className="flex items-center gap-5 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f87171' }} />遅延あり
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#34d399' }} />期限内・前倒し
        </span>
        <span className="ml-auto text-[0.5625rem]">ホバーで詳細 / クリックでタスク</span>
      </div>

      {/* チャート本体 — overflow: hidden でドットが枠外に出ない */}
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{ height: 260, borderColor: 'var(--border)', background: '#f8fafc' }}
      >
        {/* 背景グリッド（薄い縦線） */}
        {[0.25, 0.5, 0.75].map(t => (
          <div key={t} className="absolute top-0 bottom-0 border-l border-dashed"
            style={{ left: `${PAD_L + t * (100 - PAD_L - PAD_R)}%`, borderColor: 'rgba(203,213,225,0.6)' }} />
        ))}

        {/* ゼロライン（期限ライン） */}
        <div
          className="absolute left-0 right-0 border-t border-dashed"
          style={{ top: `${zeroLineY}%`, borderColor: 'rgba(100,116,139,0.4)' }}
        />
        <span
          className="absolute text-[0.5rem] font-medium px-1 rounded"
          style={{
            left: `${PAD_L}%`, top: `${zeroLineY}%`,
            transform: 'translateY(-110%)',
            color: 'var(--text-muted)',
            background: '#f8fafc',
          }}
        >
          期限ライン
        </span>

        {/* ドット — translate(-50%,-50%) でセンタリング */}
        {rows.map(row => {
          const cx = toX(row.completion_days);
          const cy = toY(row.late_days);
          const late = (row.late_days ?? 0) > 0;
          return (
            <Link
              key={row.id}
              href={withBasePath(`/projects/${row.project_id}?tab=todos&todo=${encodeURIComponent(row.id)}`)}
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-[2] hover:z-10"
              style={{
                left: `${cx}%`,
                top: `${cy}%`,
                transform: 'translate(-50%, -50%)',
                background: late ? '#f87171' : '#34d399',
              }}
              onMouseEnter={e => {
                const r = e.currentTarget.getBoundingClientRect();
                setTooltip({ task: row, x: r.right + 10, y: r.top });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}

        {/* 軸ラベル */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-3 pointer-events-none">
          <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>← 短期完了</span>
          <span className="text-[0.5625rem]" style={{ color: 'var(--text-muted)' }}>長期完了 →</span>
        </div>
        <div className="absolute top-2 right-3 pointer-events-none">
          <span className="text-[0.5625rem] font-medium" style={{ color: '#f87171' }}>遅延 ↑</span>
        </div>
        <div className="absolute pointer-events-none" style={{ bottom: `${100 - zeroLineY + 2}%`, right: '0.75rem' }}>
          <span className="text-[0.5625rem] font-medium" style={{ color: '#34d399' }}>前倒し ↓</span>
        </div>
      </div>

      {/* ホバーツールチップ */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-white border rounded-xl shadow-xl px-3 py-2.5"
          style={{ left: tooltip.x, top: tooltip.y, borderColor: 'var(--border)', maxWidth: 240, transform: 'translateY(-50%)' }}
        >
          <p className="text-sm font-semibold leading-snug truncate">{tooltip.task.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tooltip.task.project_name}</p>
          <div className="flex gap-3 mt-1.5 text-xs">
            <span>完了: <b>{tooltip.task.completion_days}日</b></span>
            {tooltip.task.late_days !== null && (
              <span style={{ color: tooltip.task.late_days > 0 ? '#f87171' : '#34d399' }}>
                {tooltip.task.late_days > 0
                  ? `遅延 ${tooltip.task.late_days}日`
                  : `前倒し ${Math.abs(tooltip.task.late_days)}日`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 案件別負荷
// ──────────────────────────────────────────
function ProjectLoad({ rows }: { rows: ReportData['project_task_load'] }) {
  if (!rows.length) return <EmptyChart />;
  const max = Math.max(...rows.map(r => r.open_count + r.completed_count), 1);
  return (
    <div className="space-y-3">
      {rows.map(row => {
        const total = row.open_count + row.completed_count;
        return (
          <div key={row.project_id} className="grid items-center gap-3" style={{ gridTemplateColumns: 'minmax(6rem,1fr) 2fr 2.5rem' }}>
            <Link href={withBasePath(`/projects/${row.project_id}`)} className="truncate text-sm font-medium hover:underline">{row.project_name}</Link>
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

// ──────────────────────────────────────────
// タグ別集計
// ──────────────────────────────────────────
function TagBreakdown({ rows }: { rows: Array<{ tag: string; count: number }> }) {
  if (!rows.length) return (
    <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
      タグがまだ付いていません。タスク編集画面からラベル（例: 設計・確認・執筆）を追加するとここに集計が表示されます。
    </div>
  );
  const max = rows[0].count;
  const TAG_COLORS = ['#0f9ab1', '#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#eab308', '#ef4444'];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.tag} className="grid items-center gap-3" style={{ gridTemplateColumns: '6rem 1fr 2.5rem' }}>
          <span className="truncate text-sm font-medium" title={row.tag}>{row.tag}</span>
          <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(row.count / max) * 100}%`, background: TAG_COLORS[i % TAG_COLORS.length] }} />
          </div>
          <span className="text-right text-sm font-semibold">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// 切り替えトグル（小）
// ──────────────────────────────────────────
function MiniToggle<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex p-0.5 rounded-lg" style={{ background: 'rgba(200,215,222,0.3)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="text-xs px-2.5 py-1 rounded-md transition-colors"
          style={value === opt.value
            ? { background: 'white', color: 'var(--accent)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
            : { color: 'var(--text-muted)' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────
export default function MyReportPage() {
  const router = useRouter();
  const [range, setRange] = useState('180');
  const [chartView, setChartView] = useState<ActivityView>('weekly');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(withBasePath(`/api/my-report?range=${range}`));
    if (res.status === 401) { router.push(withBasePath('/login')); return; }
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [range, router]);

  useEffect(() => { void load(); }, [load]);

  const weeklyRows = useMemo(() => {
    const weeks = new Set([
      ...(data?.weekly_created ?? []).map(r => r.week),
      ...(data?.weekly_completed ?? []).map(r => r.week),
    ]);
    return Array.from(weeks).sort().map(week => ({
      period: week,
      created: data?.weekly_created.find(r => r.week === week)?.count ?? 0,
      completed: data?.weekly_completed.find(r => r.week === week)?.count ?? 0,
    }));
  }, [data]);

  const monthlyRows = useMemo(() => {
    const months = new Set([
      ...(data?.monthly_created ?? []).map(r => r.month),
      ...(data?.monthly_completed ?? []).map(r => r.month),
    ]);
    return Array.from(months).sort().map(month => ({
      period: month,
      created: data?.monthly_created.find(r => r.month === month)?.count ?? 0,
      completed: data?.monthly_completed.find(r => r.month === month)?.count ?? 0,
    }));
  }, [data]);

  const summary = data?.task_summary;
  const prevSummary = data?.prev_task_summary;
  const project = data?.project_summary;
  const onTimeRate = summary ? pct(summary.completed_on_time, summary.completed_on_time + summary.completed_late) : 0;
  const prevOnTimeRate = prevSummary ? pct(prevSummary.completed_on_time, prevSummary.completed_on_time + prevSummary.completed_late) : undefined;
  const statusRows = (data?.status_breakdown ?? []).map(r => ({ key: r.status, count: r.count, color: STATUS_COLORS[r.status] ?? '#94a3b8' }));
  const priorityRows = (data?.priority_breakdown ?? []).map(r => ({ key: r.priority, count: r.count, color: PRIORITY_COLORS[r.priority] ?? '#94a3b8' }));
  const projectStatusRows = (data?.project_status_breakdown ?? []).map(r => ({ key: r.status, count: r.count, color: STATUS_COLORS[r.status] ?? '#94a3b8' }));

  const activityRows = chartView === 'weekly' ? weeklyRows : monthlyRows;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>実行レポート</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            実行量・完了速度・期限遵守・作業時間帯・成長の軌跡を振り返ります。
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgba(241,250,252,0.8)', border: '1px solid var(--border)' }}>
          {RANGE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setRange(opt.value)} className="text-xs px-3 py-1 rounded-lg transition-colors"
              style={range === opt.value ? { backgroundColor: 'white', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-muted)' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data || !summary || !project ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>レポートを読み込み中...</div>
      ) : (
        <>
          {/* ハイライト */}
          <HighlightBar summary={summary} streaks={data.streaks} range={range} />

          {/* KPIカード */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="担当完了" value={summary.assigned_completed} sub={`未完了 ${summary.assigned_open} 件`} prev={prevSummary?.assigned_completed} />
            <KpiCard label="期限遵守率" value={`${onTimeRate}%`} sub={`遅延完了 ${summary.completed_late} 件`} prev={prevOnTimeRate} />
            <KpiCard label="平均完了日数" value={summary.avg_completion_days ?? '-'} sub="作成から完了まで" prev={prevSummary?.avg_completion_days ?? undefined} />
            <KpiCard label="期限切れ" value={summary.assigned_overdue} sub="未完了タスク" accentRed />
          </div>

          {/* 年間カレンダー */}
          <Section title="年間アクティビティ" note="過去1年間の日別完了数。色が濃いほど多い" id="calendar">
            <CalendarGraph rows={data.daily_completions} />
          </Section>

          {/* ファネル + ドーナツ */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="実行ファネル" note="担当タスクが完了・期限内完了までどれだけ進んだか">
              <FunnelChart rows={[
                { label: '担当タスク', value: summary.assigned_total, color: '#0f9ab1' },
                { label: '完了', value: summary.assigned_completed, color: '#10b981' },
                { label: '期限内完了', value: summary.completed_on_time, color: '#22c55e' },
              ]} />
            </Section>
            <Section title="担当タスクの状態">
              <DonutChart rows={statusRows} labels={TODO_STATUS_LABELS} />
            </Section>
            <Section title="未完了の優先度" note="赤/橙が多いほど短期の圧が高い">
              <DonutChart rows={priorityRows} labels={TODO_PRIORITY_LABELS} />
            </Section>
          </div>

          {/* 作成/完了チャート + ヒストグラム */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Section
              title="作成 / 完了チャート"
              note={chartView === 'weekly' ? '週ごとの作成（青）と完了（緑）の推移' : '月ごとの作成（青）と完了（緑）の推移。完了が作成を下回る月は積み残しが増えています'}
              wide
              id="activity"
              headerRight={
                <MiniToggle
                  options={[{ value: 'weekly' as ActivityView, label: '週' }, { value: 'monthly' as ActivityView, label: '月' }]}
                  value={chartView}
                  onChange={setChartView}
                />
              }
            >
              <ActivityBars rows={activityRows} view={chartView} />
            </Section>
            <Section title="完了までの日数" note="タスクがどのくらいの期間で閉じられているか">
              <Histogram rows={data.completion_histogram} />
            </Section>
          </div>

          {/* ヒートマップ + プロジェクト状態 */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="曜日×時間 ヒートマップ" note="完了操作が集中する時間帯。最も活発なパターンを自動検出" wide id="heatmap">
              <Heatmap rows={data.weekday_heatmap} />
            </Section>
            <Section title="関与プロジェクトの状態">
              <DonutChart rows={projectStatusRows} labels={{ draft: '下書き', active: 'アクティブ', completed: '完了', archived: 'アーカイブ' }} />
            </Section>
          </div>

          {/* 案件別負荷 + 散布図 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="案件別タスク負荷" note="青=未完了・緑=完了・赤=期限切れ。上位10件">
              <ProjectLoad rows={data.project_task_load} />
            </Section>
            <Section title="完了速度 × 遅延 散布図" note="右ほど時間がかかり・上ほど期限超過。点にホバーで詳細・クリックでタスクへ移動">
              <Scatter rows={data.cycle_scatter} />
            </Section>
          </div>

          {/* タグ別集計 */}
          <Section title="タグ別作業分類" note="タスクに付けたタグで得意分野・作業種別を把握できます" id="tags">
            <TagBreakdown rows={data.tag_breakdown} />
          </Section>

          {/* 最近完了リスト */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="最近完了したタスク">
              <div className="space-y-1.5">
                {data.recent_completed_tasks.length === 0 ? <EmptyChart /> : data.recent_completed_tasks.slice(0, 8).map(todo => (
                  <Link key={todo.id} href={withBasePath(`/projects/${todo.project_id}?tab=todos&todo=${encodeURIComponent(todo.id)}`)}
                    className="flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{todo.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{todo.project_name}</p>
                    </div>
                    <span className="text-xs shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{formatDate(todo.completed_at)}</span>
                  </Link>
                ))}
              </div>
            </Section>
            <Section title="プロジェクトサマリー">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: '関与', value: project.involved_total },
                  { label: '主担当', value: project.primary_total },
                  { label: '完了', value: project.completed_total },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="text-xl font-bold mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                {data.recent_completed_projects.length === 0
                  ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>完了プロジェクトはまだありません。</p>
                  : data.recent_completed_projects.map(item => (
                    <Link key={item.id} href={withBasePath(`/projects/${item.id}`)}
                      className="flex justify-between gap-3 rounded-xl border px-3 py-2.5 hover:bg-slate-50 transition-colors" style={{ borderColor: 'var(--border)' }}>
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

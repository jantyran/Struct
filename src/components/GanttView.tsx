'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Todo, TodoStatus, TodoPriority } from '@/types';
import { TODO_STATUS_LABELS, TODO_PRIORITY_COLORS } from '@/types';
import { useAuth } from '@/components/AuthContext';
import { userDisplayName, isOverdue, PriorityBadge } from '@/components/TodoTab';

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(s: string): string {
  return s ? s.slice(0, 10) : '';
}

// ──────────────────────────────────────────
// ガントビュー（ドラッグ対応）
// ──────────────────────────────────────────
const GANTT_ROW_H = 50;        // 2行ラベル用に高く
const GANTT_LABEL_W = 220;
const GANTT_MONTH_H = 22;      // 月ヘッダー行
const GANTT_DAY_H = 26;        // 日付ヘッダー行
const GANTT_HEADER_H = GANTT_MONTH_H + GANTT_DAY_H;
const RESIZE_HANDLE_PX = 10;

// スケール別定数
const SCALE_DAY_W = 40;          // 日モード: 1日の幅(px)
const SCALE_WEEK5_WEEKDAY_W = 22; // 週5日モード: 平日1日幅
const SCALE_WEEK5_WEEKEND_W = 5;  // 週5日モード: 週末1日幅
const SCALE_WEEK_W = 84;         // 週モード: 1週間の幅

export type GanttScale = 'day' | 'week5' | 'week';
export const GANTT_SCALE_LABELS: Record<GanttScale, string> = {
  day: '1日',
  week5: '週5日',
  week: '1週間',
};

// ステータス別バー色
const GANTT_STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',        // slate-400
  in_progress: '#3b82f6', // blue-500
  done: '#10b981',        // emerald-500
};

interface GanttDragState {
  type: 'move' | 'resize_start' | 'resize_end';
  todoId: string;
  startClientX: number;
  origStart: string;
  origEnd: string;
}

interface GanttOverride {
  todoId: string;
  start_date: string;
  due_date: string;
}

interface GanttCreateState {
  startX: number;
  currentX: number;
}

export default function GanttView({
  todos, onOpen, onUpdate, onCreate, canEdit, scale, onScaleChange, hideScaleUI = false, onExpand,
}: {
  todos: Todo[];
  onOpen: (todo: Todo) => void;
  onUpdate: (id: string, data: Partial<Todo>) => void;
  onCreate: (data: Partial<Todo>) => Promise<void> | void;
  canEdit: boolean;
  scale: GanttScale;
  onScaleChange: (s: GanttScale) => void;
  hideScaleUI?: boolean;
  onExpand?: () => void;
}) {
  const { user } = useAuth();
  const [dragState, setDragState] = useState<GanttDragState | null>(null);
  const [override, setOverride] = useState<GanttOverride | null>(null);
  const [createState, setCreateState] = useState<GanttCreateState | null>(null);
  const [ganttDropTarget, setGanttDropTarget] = useState(false);
  const [laneHoverX, setLaneHoverX] = useState<number | null>(null);
  const [barContainerWidth, setBarContainerWidth] = useState(800);
  const svgRef = useRef<SVGSVGElement>(null);
  const barContainerRef = useRef<HTMLDivElement>(null);
  const ganttFontScale =
    user?.settings?.text_size === 'xsmall' ? 0.84
      : user?.settings?.text_size === 'small' ? 0.92
      : user?.settings?.text_size === 'large' ? 1.14
      : user?.settings?.text_size === 'xlarge' ? 1.28
      : 1;
  const scaleFont = (size: number) => Math.round(size * ganttFontScale * 10) / 10;

  useEffect(() => {
    const el = barContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setBarContainerWidth(Math.floor(entries[0].contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const datedTodos = useMemo(
    () => todos.filter(t => t.start_date || t.due_date),
    [todos]
  );
  const unscheduledTodos = useMemo(
    () => todos.filter(t => !t.start_date && !t.due_date),
    [todos]
  );

  // 日付範囲
  const { minDateBase, maxDateBase, totalDays } = useMemo(() => {
    if (datedTodos.length === 0) {
      const today = new Date();
      const min = new Date(today);
      const max = new Date(today);
      min.setDate(min.getDate() - 7);
      max.setDate(max.getDate() + 7);
      return {
        minDateBase: min,
        maxDateBase: max,
        totalDays: 15,
      };
    }
    const dates = datedTodos.flatMap(t => [t.start_date, t.due_date].filter(Boolean) as string[]);
    const min = new Date(dates.reduce((a, b) => a < b ? a : b));
    const max = new Date(dates.reduce((a, b) => a > b ? a : b));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 4);
    return {
      minDateBase: min,
      maxDateBase: max,
      totalDays: Math.max(1, Math.ceil((max.getTime() - min.getTime()) / 86400000)),
    };
  }, [datedTodos]);

  // スケール別 x座標計算（バーSVG: x=0 が minDateBase）
  function dateToX(dateStr: string): number {
    const diffDays = Math.floor((new Date(dateStr).getTime() - minDateBase.getTime()) / 86400000);
    if (scale === 'day') return diffDays * SCALE_DAY_W;
    if (scale === 'week') return (diffDays / 7) * SCALE_WEEK_W;
    // week5: 各日を平日/週末の幅で積算
    let x = 0;
    for (let d = 0; d < diffDays; d++) {
      const dow = new Date(minDateBase.getTime() + d * 86400000).getDay();
      x += (dow === 0 || dow === 6) ? SCALE_WEEK5_WEEKEND_W : SCALE_WEEK5_WEEKDAY_W;
    }
    return x;
  }

  function xToDeltaDays(deltaX: number): number {
    if (scale === 'day') return Math.round(deltaX / SCALE_DAY_W);
    if (scale === 'week') return Math.round(deltaX / (SCALE_WEEK_W / 7));
    const avgW = (5 * SCALE_WEEK5_WEEKDAY_W + 2 * SCALE_WEEK5_WEEKEND_W) / 7;
    return Math.round(deltaX / avgW);
  }

  function xToDateString(rawX: number): string {
    const x = Math.max(0, rawX);
    if (scale === 'day') {
      return addDays(minDateBase.toISOString().slice(0, 10), Math.max(0, Math.floor(x / SCALE_DAY_W)));
    }
    if (scale === 'week') {
      return addDays(minDateBase.toISOString().slice(0, 10), Math.max(0, Math.floor(x / (SCALE_WEEK_W / 7))));
    }
    // week5: まず既知の日付範囲内で探索
    let accumulated = 0;
    for (let d = 0; d < totalDays; d++) {
      const dow = new Date(minDateBase.getTime() + d * 86400000).getDay();
      const width = (dow === 0 || dow === 6) ? SCALE_WEEK5_WEEKEND_W : SCALE_WEEK5_WEEKDAY_W;
      if (x < accumulated + width) {
        return addDays(minDateBase.toISOString().slice(0, 10), d);
      }
      accumulated += width;
    }
    // 日付範囲外: 平均幅で外挿
    const avgW = (5 * SCALE_WEEK5_WEEKDAY_W + 2 * SCALE_WEEK5_WEEKEND_W) / 7;
    const extraDays = Math.max(0, Math.floor((x - accumulated) / avgW));
    return addDays(minDateBase.toISOString().slice(0, 10), totalDays + extraDays);
  }

  // barSvgWidth: maxDateBase の x座標（日付範囲のみ）
  const barSvgWidth = useMemo(() => Math.max(100, dateToX(maxDateBase.toISOString().slice(0, 10))), [maxDateBase, scale]);
  // effectiveSvgWidth: コンテナ幅まで拡張して右余白を埋める
  const effectiveSvgWidth = useMemo(() => Math.max(barSvgWidth, barContainerWidth), [barSvgWidth, barContainerWidth]);
  const contentRowCount = useMemo(
    () => (datedTodos.length === 0 ? (canEdit ? 4 : 3) : datedTodos.length + (canEdit ? 1 : 0) + 0.5),
    [canEdit, datedTodos.length]
  );
  const svgHeight = useMemo(
    () => GANTT_HEADER_H + contentRowCount * GANTT_ROW_H,
    [contentRowCount]
  );
  // 新規タスクレーンのy: 空状態のときは最下部に配置して空メッセージと重ならないようにする
  const newTaskLaneY = useMemo(
    () => datedTodos.length === 0 ? svgHeight - GANTT_ROW_H : GANTT_HEADER_H + datedTodos.length * GANTT_ROW_H,
    [datedTodos.length, svgHeight]
  );

  // 月ヘッダー
  const months = useMemo(() => {
    const values: { label: string; x: number; width: number }[] = [];
    let cur = new Date(minDateBase);
    while (cur < maxDateBase) {
      const monthStart = new Date(cur);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const monthEnd = nextMonth < maxDateBase ? nextMonth : maxDateBase;
      const x = dateToX(monthStart.toISOString().slice(0, 10));
      const w = dateToX(monthEnd.toISOString().slice(0, 10)) - x;
      values.push({ label: `${cur.getFullYear()}/${cur.getMonth() + 1}`, x, width: w });
      cur = nextMonth;
    }
    return values;
  }, [minDateBase, maxDateBase, scale]);

  // 日付ティック（スケール対応）
  type DayTick = { label: string; x: number; width: number; isWeekend: boolean };
  const dayTicks = useMemo(() => {
    const values: DayTick[] = [];
    if (scale === 'day') {
      for (let d = 0; d < totalDays; d++) {
        const date = new Date(minDateBase.getTime() + d * 86400000);
        const dow = date.getDay();
        values.push({
          label: String(date.getDate()),
          x: d * SCALE_DAY_W,
          width: SCALE_DAY_W,
          isWeekend: dow === 0 || dow === 6,
        });
      }
    } else if (scale === 'week5') {
      for (let d = 0; d < totalDays; d++) {
        const date = new Date(minDateBase.getTime() + d * 86400000);
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        const w = isWeekend ? SCALE_WEEK5_WEEKEND_W : SCALE_WEEK5_WEEKDAY_W;
        values.push({
          label: isWeekend ? '' : String(date.getDate()),
          x: dateToX(date.toISOString().slice(0, 10)),
          width: w,
          isWeekend,
        });
      }
    } else {
      for (let d = 0; d < totalDays; d += 7) {
        const date = new Date(minDateBase.getTime() + d * 86400000);
        values.push({
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          x: d * (SCALE_WEEK_W / 7),
          width: SCALE_WEEK_W,
          isWeekend: false,
        });
      }
    }
    return values;
  }, [minDateBase, totalDays, scale]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayX = useMemo(() => dateToX(todayStr), [todayStr, scale, minDateBase]);

  function handleBarMouseDown(e: React.MouseEvent, todo: Todo, type: 'move' | 'resize_start' | 'resize_end') {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      type,
      todoId: todo.id,
      startClientX: e.clientX,
      origStart: todo.start_date || todo.due_date || todayStr,
      origEnd: todo.due_date || todo.start_date || todayStr,
    });
    setOverride({ todoId: todo.id, start_date: todo.start_date || todo.due_date || '', due_date: todo.due_date || todo.start_date || '' });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (createState) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      setCreateState((current) => current ? { ...current, currentX: e.clientX - svgRect.left } : null);
      return;
    }

    if (!dragState) return;
    const deltaX = e.clientX - dragState.startClientX;
    const deltaDays = xToDeltaDays(deltaX);
    if (deltaDays === 0) return;
    if (dragState.type === 'move') {
      setOverride({
        todoId: dragState.todoId,
        start_date: dragState.origStart ? addDays(dragState.origStart, deltaDays) : '',
        due_date: dragState.origEnd ? addDays(dragState.origEnd, deltaDays) : '',
      });
    } else if (dragState.type === 'resize_end') {
      const newEnd = dragState.origEnd ? addDays(dragState.origEnd, deltaDays) : '';
      const minEnd = dragState.origStart || '';
      setOverride({
        todoId: dragState.todoId,
        start_date: dragState.origStart || '',
        due_date: newEnd >= minEnd ? newEnd : minEnd,
      });
    } else {
      const newStart = dragState.origStart ? addDays(dragState.origStart, deltaDays) : '';
      const maxStart = dragState.origEnd || '';
      setOverride({
        todoId: dragState.todoId,
        start_date: newStart <= maxStart ? newStart : maxStart,
        due_date: dragState.origEnd || '',
      });
    }
  }

  async function handleMouseUp() {
    if (createState) {
      const left = Math.min(createState.startX, createState.currentX);
      const right = Math.max(createState.startX, createState.currentX);
      const startDate = xToDateString(left);
      const endDate = xToDateString(Math.max(left + minBarW, right));
      setCreateState(null);
      await onCreate({
        start_date: startDate,
        due_date: endDate,
      });
      return;
    }

    if (!dragState || !override) { setDragState(null); setOverride(null); return; }
    const { todoId, origStart, origEnd } = dragState;
    if (override.start_date !== origStart || override.due_date !== origEnd) {
      onUpdate(todoId, { start_date: override.start_date, due_date: override.due_date });
    }
    setDragState(null);
    setOverride(null);
  }

  function getBarDates(todo: Todo): { start: string; end: string } {
    if (override && override.todoId === todo.id) {
      return { start: override.start_date || override.due_date, end: override.due_date || override.start_date };
    }
    return { start: todo.start_date || todo.due_date || '', end: todo.due_date || todo.start_date || '' };
  }

  // バーの最小幅（1日分のpx）
  const minBarW = scale === 'day' ? SCALE_DAY_W : scale === 'week' ? SCALE_WEEK_W / 7 : SCALE_WEEK5_WEEKDAY_W;

  if (datedTodos.length === 0) {
    // 未スケジュールから配置できるように、空でもガント本体は表示する
  }

  return (
    <div>
      {unscheduledTodos.length > 0 && (
        <div className="mb-3 rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0', borderLeftColor: '#f59e0b', borderLeftWidth: 4 }}>
          <div className="px-4 py-2 flex items-center justify-between gap-3" style={{ backgroundColor: 'rgba(255,251,235,0.8)', borderBottom: '1px solid #fde68a' }}>
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="6.5" stroke="#d97706" strokeWidth="1.5" />
                <path d="M8 5v3.5l2 1.5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>未スケジュール</p>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#fcd34d', color: '#78350f' }}>
                {unscheduledTodos.length}
              </span>
            </div>
            <p className="text-xs" style={{ color: '#b45309' }}>
              ガント上へドラッグ → 日程設定
            </p>
          </div>
          <div className="px-4 py-2.5 flex flex-wrap gap-2" style={{ backgroundColor: 'rgba(255,251,235,0.3)' }}>
            {unscheduledTodos.map((todo) => (
              <div
                key={todo.id}
                draggable={canEdit}
                onDragStart={(event) => {
                  event.dataTransfer.setData('unscheduledTodoId', todo.id);
                  event.dataTransfer.setData('text/plain', `unscheduled:${todo.id}`);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-shadow hover:shadow-sm active:opacity-70"
                style={{
                  borderColor: '#e2e8f0',
                  backgroundColor: 'white',
                  color: 'var(--text-primary)',
                  cursor: canEdit ? 'grab' : 'default',
                }}
              >
                {canEdit && (
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ opacity: 0.25, flexShrink: 0 }}>
                    <circle cx="2" cy="2" r="1.5" fill="#64748b" />
                    <circle cx="6" cy="2" r="1.5" fill="#64748b" />
                    <circle cx="2" cy="6" r="1.5" fill="#64748b" />
                    <circle cx="6" cy="6" r="1.5" fill="#64748b" />
                    <circle cx="2" cy="10" r="1.5" fill="#64748b" />
                    <circle cx="6" cy="10" r="1.5" fill="#64748b" />
                  </svg>
                )}
                <span className="font-medium">{todo.title}</span>
                <PriorityBadge priority={todo.priority} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* スケール切替（フルスクリーン時はサイドバーに移動するため非表示） */}
      {!hideScaleUI && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>表示単位:</span>
          {(Object.keys(GANTT_SCALE_LABELS) as GanttScale[]).map(s => (
            <button key={s} onClick={() => onScaleChange(s)}
              className={`tab-btn text-xs py-1 ${scale === s ? 'active' : ''}`}>
              {GANTT_SCALE_LABELS[s]}
            </button>
          ))}
          {onExpand && (
            <button onClick={onExpand}
              className="ml-2 text-xs px-2.5 py-1 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              ⛶ 拡大
            </button>
          )}
        </div>
      )}

      {/* チャート本体 */}
      <div className="max-w-full overflow-hidden" style={{ cursor: dragState ? (dragState.type === 'move' ? 'grabbing' : 'ew-resize') : 'default' }}>
        <div className="flex min-w-0 max-w-full" style={{ userSelect: 'none' }}>

          {/* ──── 左: ラベル列（固定） ──── */}
          <div style={{ width: GANTT_LABEL_W, flexShrink: 0, borderRight: '1px solid #cbd5e1' }}>
            <svg width={GANTT_LABEL_W} height={svgHeight} style={{ display: 'block' }}>
              <rect x={0} y={0} width={GANTT_LABEL_W} height={GANTT_MONTH_H} fill="#f1f5f9" />
              <text x={10} y={GANTT_MONTH_H * 0.72} fontSize={scaleFont(11)} fill="#475569" fontWeight={600}>タスク</text>
              <rect x={0} y={GANTT_MONTH_H} width={GANTT_LABEL_W} height={GANTT_DAY_H} fill="#f8fafc" />
              <line x1={0} y1={GANTT_MONTH_H} x2={GANTT_LABEL_W} y2={GANTT_MONTH_H} stroke="#cbd5e1" strokeWidth={0.5} />
              <line x1={0} y1={GANTT_HEADER_H} x2={GANTT_LABEL_W} y2={GANTT_HEADER_H} stroke="#cbd5e1" strokeWidth={1} />
              {datedTodos.length === 0 && (
                <g>
                  <rect x={0} y={GANTT_HEADER_H} width={GANTT_LABEL_W} height={svgHeight - GANTT_HEADER_H}
                    fill="#f8fafc" />
                  <text x={10} y={GANTT_HEADER_H + 26} fontSize={scaleFont(11)} fill="#64748b" fontWeight={600}>
                    日程未設定
                  </text>
                  <text x={10} y={GANTT_HEADER_H + 42} fontSize={scaleFont(10)} fill="#94a3b8">
                    右へドラッグして配置
                  </text>
                </g>
              )}
              {datedTodos.map((todo, i) => {
                const y = GANTT_HEADER_H + i * GANTT_ROW_H;
                const priorityColor = TODO_PRIORITY_COLORS[todo.priority];
                const isDone = todo.status === 'done';
                const isOverdueBar = isOverdue(todo.due_date, todo.status);
                const assigneeName = todo.assignee ? userDisplayName(todo.assignee) : null;
                return (
                  <g key={todo.id}>
                    <rect x={0} y={y} width={GANTT_LABEL_W} height={GANTT_ROW_H}
                      fill={i % 2 === 0 ? 'white' : '#fafafa'} />
                    <line x1={0} y1={y + GANTT_ROW_H} x2={GANTT_LABEL_W} y2={y + GANTT_ROW_H}
                      stroke="#f1f5f9" strokeWidth={0.5} />
                    <rect x={0} y={y + 6} width={3} height={GANTT_ROW_H - 12} rx={1.5}
                      fill={priorityColor} opacity={0.8} />
                    <text x={10} y={y + GANTT_ROW_H * 0.4} fontSize={scaleFont(12)}
                      fill={isDone ? '#9ca3af' : isOverdueBar ? '#ef4444' : '#1e293b'}
                      style={{ textDecoration: isDone ? 'line-through' : 'none', pointerEvents: 'none' }}>
                      {todo.title.length > 24 ? `${todo.title.slice(0, 24)}…` : todo.title}
                    </text>
                    {assigneeName && (
                      <text x={10} y={y + GANTT_ROW_H * 0.72} fontSize={scaleFont(9.5)} fill="#94a3b8"
                        style={{ pointerEvents: 'none' }}>
                        {assigneeName.length > 22 ? `${assigneeName.slice(0, 22)}…` : assigneeName}
                      </text>
                    )}
                    <rect x={0} y={y} width={GANTT_LABEL_W} height={GANTT_ROW_H} fill="transparent"
                      style={{ cursor: 'pointer' }} onDoubleClick={() => onOpen(todo)} />
                  </g>
                );
              })}
              {canEdit && (
                <g>
                  {(() => {
                    const y = newTaskLaneY;
                    return (
                      <>
                        <rect x={0} y={y} width={GANTT_LABEL_W} height={GANTT_ROW_H} fill="#f8fafc" />
                        <line x1={0} y1={y} x2={GANTT_LABEL_W} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 3" />
                        <line x1={0} y1={y + GANTT_ROW_H} x2={GANTT_LABEL_W} y2={y + GANTT_ROW_H}
                          stroke="#e2e8f0" strokeWidth={1} />
                        <text x={10} y={y + GANTT_ROW_H * 0.55} fontSize={scaleFont(11)} fill="#64748b" fontWeight={500}>
                          ＋ 新規タスク
                        </text>
                        <text x={10} y={y + GANTT_ROW_H * 0.8} fontSize={scaleFont(9)} fill="#94a3b8">
                          右をドラッグして期間設定
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>
          </div>

          {/* ──── 右: バー列（横スクロール） ──── */}
          <div className="overflow-x-auto overflow-y-hidden flex-1 min-w-0 max-w-full" ref={barContainerRef}>
            <svg
              ref={svgRef}
              width={effectiveSvgWidth}
              height={svgHeight}
              style={{ minWidth: effectiveSvgWidth, display: 'block' }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDragOver={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDragEnter={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                setGanttDropTarget(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setGanttDropTarget(false);
                }
              }}
              onDrop={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                setGanttDropTarget(false);
                const explicitTodoId = event.dataTransfer.getData('unscheduledTodoId');
                const plainText = event.dataTransfer.getData('text/plain');
                const todoId = explicitTodoId || (plainText.startsWith('unscheduled:') ? plainText.slice('unscheduled:'.length) : '');
                if (!todoId) return;
                const rect = svgRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = event.clientX - rect.left;
                const date = xToDateString(x);
                onUpdate(todoId, { start_date: date, due_date: date });
              }}
            >
              <defs>
                <pattern id="newTaskLaneDots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                  <rect width="16" height="16" fill="#f8fafc" />
                  <circle cx="3" cy="3" r="1.2" fill="#cbd5e1" />
                  <circle cx="11" cy="11" r="1.2" fill="#cbd5e1" />
                </pattern>
              </defs>
              <rect width={effectiveSvgWidth} height={svgHeight} fill="white" />

              {/* 月ヘッダー */}
              {months.map((m, i) => (
                <g key={i}>
                  <rect x={m.x} y={0} width={m.width} height={GANTT_MONTH_H}
                    fill={i % 2 === 0 ? '#f1f5f9' : '#e8edf2'} />
                  <text x={m.x + 8} y={GANTT_MONTH_H * 0.72} fontSize={scaleFont(11)} fill="#475569" fontWeight={600}>
                    {m.label}
                  </text>
                  <line x1={m.x} y1={0} x2={m.x} y2={GANTT_MONTH_H} stroke="#cbd5e1" strokeWidth={0.5} />
                </g>
              ))}
              {/* 日付範囲外の右余白ヘッダー */}
              {effectiveSvgWidth > barSvgWidth && (
                <rect x={barSvgWidth} y={0} width={effectiveSvgWidth - barSvgWidth} height={GANTT_HEADER_H} fill="#f1f5f9" />
              )}

              {/* 日付ヘッダー */}
              <rect x={0} y={GANTT_MONTH_H} width={effectiveSvgWidth} height={GANTT_DAY_H} fill="#f8fafc" />
              {dayTicks.map((tick, i) => (
                <g key={i}>
                  {tick.isWeekend && (
                    <rect x={tick.x} y={GANTT_MONTH_H} width={tick.width} height={GANTT_DAY_H} fill="#f0f4f8" />
                  )}
                  {tick.label && (
                    <text x={tick.x + tick.width / 2} y={GANTT_MONTH_H + GANTT_DAY_H * 0.68}
                      textAnchor="middle" fontSize={scaleFont(10)}
                      fill={tick.isWeekend ? '#94a3b8' : '#64748b'}>
                      {tick.label}
                    </text>
                  )}
                  <line x1={tick.x} y1={GANTT_MONTH_H} x2={tick.x} y2={GANTT_HEADER_H} stroke="#e2e8f0" strokeWidth={0.5} />
                </g>
              ))}

              {/* ヘッダー区切り線 */}
              <line x1={0} y1={GANTT_MONTH_H} x2={effectiveSvgWidth} y2={GANTT_MONTH_H} stroke="#cbd5e1" strokeWidth={0.5} />
              <line x1={0} y1={GANTT_HEADER_H} x2={effectiveSvgWidth} y2={GANTT_HEADER_H} stroke="#cbd5e1" strokeWidth={1} />

              {/* 週末ハイライト（縦帯） */}
              {dayTicks.filter(t => t.isWeekend).map((tick, i) => (
                <rect key={i} x={tick.x} y={GANTT_HEADER_H} width={tick.width}
                  height={svgHeight - GANTT_HEADER_H} fill="#f8fafc" />
              ))}

              {/* 縦グリッド */}
              {dayTicks.map((tick, i) => (
                <line key={i} x1={tick.x} y1={GANTT_HEADER_H} x2={tick.x} y2={svgHeight}
                  stroke="#e2e8f0" strokeWidth={0.5} />
              ))}

              {/* 今日のライン */}
              {todayX >= 0 && todayX <= barSvgWidth && (
                <>
                  <rect x={todayX - 1} y={GANTT_HEADER_H} width={2} height={svgHeight - GANTT_HEADER_H}
                    fill="#ef4444" opacity={0.5} />
                  <circle cx={todayX} cy={GANTT_HEADER_H} r={4} fill="#ef4444" opacity={0.8} />
                  <text x={todayX + 5} y={GANTT_HEADER_H - 4} fontSize={scaleFont(9)} fill="#ef4444" fontWeight={600}>今日</text>
                </>
              )}

              {/* バー行 */}
              {datedTodos.map((todo, i) => {
                const y = GANTT_HEADER_H + i * GANTT_ROW_H;
                const { start, end } = getBarDates(todo);
                if (!start || !end) return null;
                const x1 = dateToX(start);
                const x2 = Math.max(x1 + minBarW, dateToX(end));
                const barColor = GANTT_STATUS_COLORS[todo.status] ?? '#94a3b8';
                const isDone = todo.status === 'done';
                const isDragging = dragState?.todoId === todo.id;

                return (
                  <g key={todo.id}>
                    <rect x={0} y={y} width={barSvgWidth} height={GANTT_ROW_H}
                      fill={i % 2 === 0 ? 'white' : '#fafafa'} />
                    <line x1={0} y1={y + GANTT_ROW_H} x2={barSvgWidth} y2={y + GANTT_ROW_H}
                      stroke="#f1f5f9" strokeWidth={0.5} />
                    <rect x={x1} y={y + 10} width={x2 - x1} height={GANTT_ROW_H - 20}
                      rx={5} fill={barColor}
                      opacity={isDone ? 0.4 : isDragging ? 1 : 0.85}
                      stroke={isDragging ? barColor : 'transparent'} strokeWidth={2}
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                      onMouseDown={e => handleBarMouseDown(e, todo, 'move')}
                      onDoubleClick={() => onOpen(todo)}
                    />
                    {!isDone && (
                      <>
                        <rect x={x1} y={y + 10}
                          width={RESIZE_HANDLE_PX} height={GANTT_ROW_H - 20}
                          rx={4} fill="white" opacity={0.4}
                          style={{ cursor: 'ew-resize' }}
                          onMouseDown={e => handleBarMouseDown(e, todo, 'resize_start')}
                        />
                        <rect x={x2 - RESIZE_HANDLE_PX} y={y + 10}
                          width={RESIZE_HANDLE_PX} height={GANTT_ROW_H - 20}
                          rx={4} fill="white" opacity={0.4}
                          style={{ cursor: 'ew-resize' }}
                          onMouseDown={e => handleBarMouseDown(e, todo, 'resize_end')}
                        />
                      </>
                    )}
                    {(x2 - x1) > 48 && (
                      <text x={x1 + 7} y={y + GANTT_ROW_H * 0.61} fontSize={scaleFont(9.5)} fill="white"
                        style={{ pointerEvents: 'none' }}>
                        {TODO_STATUS_LABELS[todo.status]}
                      </text>
                    )}
                    {isDragging && override && (
                      <text x={x1} y={y + 8} fontSize={scaleFont(9)} fill={barColor} fontWeight={700}
                        style={{ pointerEvents: 'none' }}>
                        {override.start_date} → {override.due_date}
                      </text>
                    )}
                  </g>
                );
              })}

              {datedTodos.length === 0 && (() => {
                const emptyH = newTaskLaneY - GANTT_HEADER_H - 12;
                const cx = effectiveSvgWidth / 2;
                return (
                  <g>
                    <rect
                      x={12}
                      y={GANTT_HEADER_H + 8}
                      width={Math.max(120, effectiveSvgWidth - 24)}
                      height={Math.max(40, emptyH)}
                      rx={10}
                      fill={ganttDropTarget ? 'rgba(15,154,177,0.07)' : '#f8fafc'}
                      stroke={ganttDropTarget ? '#0f9ab1' : '#cbd5e1'}
                      strokeDasharray="6 4"
                      strokeWidth={ganttDropTarget ? 1.5 : 1}
                    />
                    <g transform={`translate(${cx - 10}, ${GANTT_HEADER_H + 18})`} opacity={ganttDropTarget ? 1 : 0.4}>
                      <rect width={20} height={20} rx={10} fill={ganttDropTarget ? '#0f9ab1' : '#94a3b8'} />
                      <path d="M10 6v8M6 11l4 4 4-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </g>
                    <text
                      x={cx}
                      y={GANTT_HEADER_H + 52}
                      textAnchor="middle"
                      fontSize={scaleFont(12)}
                      fill={ganttDropTarget ? '#0f9ab1' : '#64748b'}
                      fontWeight={600}
                    >
                      {ganttDropTarget ? 'ここにドロップして日程を設定' : '日程付きタスクがまだありません'}
                    </text>
                    {!ganttDropTarget && (
                      <text
                        x={cx}
                        y={GANTT_HEADER_H + 70}
                        textAnchor="middle"
                        fontSize={scaleFont(10)}
                        fill="#94a3b8"
                      >
                        上の「未スケジュール」エリアからドラッグして配置できます
                      </text>
                    )}
                  </g>
                );
              })()}

              {canEdit && (
                <g>
                  {(() => {
                    const y = newTaskLaneY;
                    const laneX = createState ? Math.min(createState.startX, createState.currentX) : 0;
                    const laneW = createState ? Math.max(minBarW, Math.abs(createState.currentX - createState.startX)) : 0;
                    return (
                      <>
                        {/* レーン背景: ホバー時に少し明るく */}
                        <rect x={0} y={y} width={effectiveSvgWidth} height={GANTT_ROW_H}
                          fill={laneHoverX !== null && !createState ? '#f1f5f9' : 'url(#newTaskLaneDots)'} />
                        <line x1={0} y1={y} x2={effectiveSvgWidth} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 3" />
                        <line x1={0} y1={y + GANTT_ROW_H} x2={effectiveSvgWidth} y2={y + GANTT_ROW_H} stroke="#e2e8f0" strokeWidth={1} />

                        {/* インタラクション透明レイヤー */}
                        <rect
                          x={0} y={y} width={effectiveSvgWidth} height={GANTT_ROW_H}
                          fill="transparent"
                          style={{ cursor: 'crosshair' }}
                          onMouseMove={(event) => {
                            if (createState) return;
                            const r = svgRef.current?.getBoundingClientRect();
                            if (!r) return;
                            setLaneHoverX(event.clientX - r.left);
                          }}
                          onMouseLeave={() => setLaneHoverX(null)}
                          onMouseDown={(event) => {
                            const rect = svgRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            const startX = event.clientX - rect.left;
                            setCreateState({ startX, currentX: startX });
                          }}
                        />

                        {/* ホバー時: カーソル追従ガイドライン + 日付ラベル */}
                        {laneHoverX !== null && !createState && (() => {
                          const hx = laneHoverX;
                          const dateLabel = xToDateString(hx).slice(5); // MM-DD
                          const labelW = 44;
                          const labelX = Math.min(hx - labelW / 2, effectiveSvgWidth - labelW - 4);
                          return (
                            <g style={{ pointerEvents: 'none' }}>
                              {/* 縦ガイドライン */}
                              <line x1={hx} y1={y} x2={hx} y2={y + GANTT_ROW_H}
                                stroke="#94a3b8" strokeWidth={1} opacity={0.7} />
                              {/* 上端ノッチ */}
                              <circle cx={hx} cy={y} r={2.5} fill="#94a3b8" opacity={0.7} />
                              {/* 日付ラベル */}
                              <rect x={labelX} y={y + 9} width={labelW} height={16} rx={3}
                                fill="#475569" opacity={0.85} />
                              <text x={labelX + labelW / 2} y={y + 20}
                                textAnchor="middle" fontSize={scaleFont(9.5)} fill="white" fontWeight={600}
                                style={{ pointerEvents: 'none' }}>
                                {dateLabel}
                              </text>
                            </g>
                          );
                        })()}

                        {/* ドラッグ中のプレビューバー */}
                        {createState && (
                          <g style={{ pointerEvents: 'none' }}>
                            <rect x={laneX} y={y + 9} width={laneW} height={GANTT_ROW_H - 18}
                              rx={4} fill="#64748b" opacity={0.12}
                              stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
                            {(() => {
                              const startLabel = xToDateString(laneX).slice(5);
                              const endLabel = xToDateString(laneX + laneW).slice(5);
                              return (
                                <>
                                  <rect x={laneX} y={y + 9} width={44} height={16} rx={3}
                                    fill="#475569" opacity={0.85} />
                                  <text x={laneX + 22} y={y + 20}
                                    textAnchor="middle" fontSize={scaleFont(9.5)} fill="white" fontWeight={600}>
                                    {startLabel}
                                  </text>
                                  {laneW > 60 && (
                                    <>
                                      <rect x={laneX + laneW - 44} y={y + 9} width={44} height={16} rx={3}
                                        fill="#475569" opacity={0.85} />
                                      <text x={laneX + laneW - 22} y={y + 20}
                                        textAnchor="middle" fontSize={scaleFont(9.5)} fill="white" fontWeight={600}>
                                        {endLabel}
                                      </text>
                                    </>
                                  )}
                                </>
                              );
                            })()}
                          </g>
                        )}

                        {/* 非ホバー時のヒントテキスト */}
                        {laneHoverX === null && !createState && (
                          <text x={effectiveSvgWidth / 2} y={y + GANTT_ROW_H * 0.65}
                            textAnchor="middle" fontSize={scaleFont(10)} fill="#94a3b8"
                            style={{ pointerEvents: 'none' }}>
                            ＋ ここをドラッグして期間付きタスクを作成
                          </text>
                        )}
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* ──── フッター（スクロール非依存） ──── */}
        <div className="flex items-center justify-between mt-2 px-1 flex-wrap gap-2">
          <p className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
            バー中央をドラッグ: 期間移動 ／ 右端をドラッグ: 期日変更 ／ 未スケジュールからドラッグ: 日付付与 ／ 最下段をドラッグ: 新規タスク作成
          </p>
          <div className="flex items-center gap-3">
            {(['todo', 'in_progress', 'done'] as const).map(s => (
              <div key={s} className="flex items-center gap-1">
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: GANTT_STATUS_COLORS[s], opacity: 0.85, flexShrink: 0 }} />
                <span className="text-[0.625rem]" style={{ color: '#64748b' }}>{TODO_STATUS_LABELS[s]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div style={{ width: 3, height: 10, borderRadius: 2, backgroundColor: '#3b82f6', flexShrink: 0 }} />
              <span className="text-[0.625rem]" style={{ color: '#64748b' }}>優先度</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



'use client';
import { useState, useCallback } from 'react';
import type { Todo, TodoStatus, TodoPriority, ProjectUser, ProjectPhase } from '@/types';
import { TODO_STATUS_LABELS, TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS } from '@/types';
import { withBasePath } from '@/lib/paths';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────
const STATUS_ORDER: TodoStatus[] = ['todo', 'in_progress', 'done'];
const STATUS_COLUMN_COLORS: Record<TodoStatus, string> = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  done: '#10b981',
};

// ──────────────────────────────────────────
// 小ユーティリティ
// ──────────────────────────────────────────
function userDisplayName(user: { email: string; name?: string | null } | null | undefined): string {
  if (!user) return '未割当';
  return user.name?.trim() || user.email;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

function isOverdue(dueDate: string, status: TodoStatus): boolean {
  if (!dueDate || status === 'done') return false;
  return new Date(dueDate) < new Date();
}

// ──────────────────────────────────────────
// 優先度バッジ
// ──────────────────────────────────────────
function PriorityBadge({ priority }: { priority: TodoPriority }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: `${TODO_PRIORITY_COLORS[priority]}20`, color: TODO_PRIORITY_COLORS[priority] }}
    >
      {TODO_PRIORITY_LABELS[priority]}
    </span>
  );
}

// ──────────────────────────────────────────
// Todo 作成/編集フォーム
// ──────────────────────────────────────────
interface TodoFormProps {
  initial?: Partial<Todo>;
  assignableUsers: ProjectUser[];
  phases: ProjectPhase[];
  onSave: (data: Partial<Todo>) => void;
  onCancel: () => void;
  saveLabel?: string;
}

function TodoForm({ initial, assignableUsers, phases, onSave, onCancel, saveLabel = '保存' }: TodoFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<TodoStatus>(initial?.status ?? 'todo');
  const [priority, setPriority] = useState<TodoPriority>(initial?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(initial?.assignee_id ?? '');
  const [phaseKey, setPhaseKey] = useState(initial?.phase_key ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '');

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description,
      status,
      priority,
      assignee_id: assigneeId || null,
      phase_key: phaseKey,
      start_date: startDate,
      due_date: dueDate,
    });
  }

  const selectCls = 'field-input text-sm';
  const labelCls = 'text-xs font-medium mb-1 block';

  return (
    <div className="space-y-3">
      <input
        className="field-input text-sm font-semibold"
        placeholder="タスク名（必須）"
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="field-input text-sm resize-none"
        placeholder="説明（任意）"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>ステータス</label>
          <select className={selectCls} value={status} onChange={e => setStatus(e.target.value as TodoStatus)}>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{TODO_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>優先度</label>
          <select className={selectCls} value={priority} onChange={e => setPriority(e.target.value as TodoPriority)}>
            {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => (
              <option key={p} value={p}>{TODO_PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>担当者</label>
          <select className={selectCls} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">未割当</option>
            {assignableUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>
            ))}
          </select>
        </div>
        {phases.length > 0 && (
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>フェーズ</label>
            <select className={selectCls} value={phaseKey} onChange={e => setPhaseKey(e.target.value)}>
              <option value="">未設定</option>
              {phases.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>開始日</label>
          <input type="date" className={selectCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-muted)' }}>期日</label>
          <input type="date" className={selectCls} value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">キャンセル</button>
        <button onClick={handleSave} disabled={!title.trim()} className="btn-primary text-sm">{saveLabel}</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// リストビュー: 1行
// ──────────────────────────────────────────
function TodoRow({
  todo,
  assignableUsers,
  phases,
  depth,
  onStatusChange,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  todo: Todo;
  assignableUsers: ProjectUser[];
  phases: ProjectPhase[];
  depth: number;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (parentId: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const overdue = isOverdue(todo.due_date, todo.status);

  return (
    <div
      className="flex items-start gap-3 py-2 px-3 rounded-xl transition-colors hover:bg-gray-50 group"
      style={{ paddingLeft: depth > 0 ? `${12 + depth * 20}px` : undefined }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* チェックボックス */}
      <button
        className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
        style={{
          borderColor: todo.status === 'done' ? '#10b981' : 'var(--border)',
          backgroundColor: todo.status === 'done' ? '#10b981' : 'white',
        }}
        onClick={() => onStatusChange(todo.id, todo.status === 'done' ? 'todo' : 'done')}
        title={todo.status === 'done' ? '未着手に戻す' : '完了にする'}
      >
        {todo.status === 'done' && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* メイン情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm ${todo.status === 'done' ? 'line-through' : ''}`}
            style={{ color: todo.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)' }}
          >
            {todo.title}
          </span>
          <PriorityBadge priority={todo.priority} />
          {todo.status !== 'done' && todo.status !== 'todo' && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
              {TODO_STATUS_LABELS[todo.status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {todo.assignee && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {userDisplayName(todo.assignee)}
            </span>
          )}
          {todo.due_date && (
            <span className="text-xs" style={{ color: overdue ? '#ef4444' : 'var(--text-muted)' }}>
              {overdue ? '⚠ ' : ''}{formatDate(todo.due_date)} 期日
            </span>
          )}
          {todo.phase_key && phases.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {phases.find(p => p.key === todo.phase_key)?.name ?? todo.phase_key}
            </span>
          )}
        </div>
      </div>

      {/* アクション */}
      <div className={`flex items-center gap-1 flex-shrink-0 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
        {depth === 0 && (
          <button
            onClick={() => onAddSubtask(todo.id)}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="サブタスク追加"
          >
            +サブ
          </button>
        )}
        <button
          onClick={() => onEdit(todo)}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          編集
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="text-xs px-2 py-1 rounded transition-colors"
          style={{ color: '#ef4444' }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// カンバンカード
// ──────────────────────────────────────────
function KanbanCard({
  todo,
  onEdit,
  onDelete,
  onDragStart,
}: {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, todo: Todo) => void;
}) {
  const overdue = isOverdue(todo.due_date, todo.status);

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, todo)}
      className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${TODO_PRIORITY_COLORS[todo.priority]}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{todo.title}</p>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(todo)} className="text-xs opacity-50 hover:opacity-100" title="編集">✏</button>
          <button onClick={() => onDelete(todo.id)} className="text-xs opacity-50 hover:opacity-100 text-red-400" title="削除">✕</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <PriorityBadge priority={todo.priority} />
        {todo.assignee && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{userDisplayName(todo.assignee)}</span>
        )}
        {todo.due_date && (
          <span className="text-xs" style={{ color: overdue ? '#ef4444' : 'var(--text-muted)' }}>
            {formatDate(todo.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// ガントバー（SVGベース）
// ──────────────────────────────────────────
const GANTT_ROW_H = 36;
const GANTT_LABEL_W = 200;

function GanttView({ todos }: { todos: Todo[] }) {
  // 日付がある Todo のみ表示
  const datedTodos = todos.filter(t => t.start_date || t.due_date);
  if (datedTodos.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">開始日または期日が設定されたタスクがありません</p>
      </div>
    );
  }

  // 全体の日付範囲を計算
  const dates = datedTodos.flatMap(t => [t.start_date, t.due_date].filter(Boolean) as string[]);
  const minDate = new Date(dates.reduce((a, b) => a < b ? a : b));
  const maxDate = new Date(dates.reduce((a, b) => a > b ? a : b));
  // 前後1日マージン
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 2);

  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000));
  const dayWidth = Math.max(20, Math.min(40, (600 / totalDays)));
  const svgWidth = GANTT_LABEL_W + totalDays * dayWidth;
  const svgHeight = (datedTodos.length + 1) * GANTT_ROW_H;

  function dateToX(dateStr: string): number {
    const d = new Date(dateStr);
    return GANTT_LABEL_W + Math.floor((d.getTime() - minDate.getTime()) / 86400000) * dayWidth;
  }

  // 月ヘッダー用
  const months: { label: string; x: number; width: number }[] = [];
  let cur = new Date(minDate);
  while (cur < maxDate) {
    const monthStart = new Date(cur);
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const monthEnd = nextMonth < maxDate ? nextMonth : maxDate;
    const x = GANTT_LABEL_W + Math.floor((monthStart.getTime() - minDate.getTime()) / 86400000) * dayWidth;
    const w = Math.floor((monthEnd.getTime() - monthStart.getTime()) / 86400000) * dayWidth;
    months.push({ label: `${cur.getFullYear()}/${cur.getMonth() + 1}`, x, width: w });
    cur = nextMonth;
  }

  const today = new Date();
  const todayX = GANTT_LABEL_W + Math.floor((today.getTime() - minDate.getTime()) / 86400000) * dayWidth;

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} style={{ minWidth: svgWidth, display: 'block' }}>
        {/* 背景 */}
        <rect width={svgWidth} height={svgHeight} fill="white" />

        {/* 月ヘッダー */}
        {months.map((m, i) => (
          <g key={i}>
            <rect x={m.x} y={0} width={m.width} height={GANTT_ROW_H / 2} fill={i % 2 === 0 ? '#f8fafc' : '#f1f5f9'} />
            <text x={m.x + m.width / 2} y={GANTT_ROW_H / 3} textAnchor="middle" fontSize={10} fill="#6b7280">{m.label}</text>
          </g>
        ))}

        {/* 今日のライン */}
        {todayX >= GANTT_LABEL_W && todayX <= svgWidth && (
          <line x1={todayX} y1={0} x2={todayX} y2={svgHeight} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />
        )}

        {/* 行 */}
        {datedTodos.map((todo, i) => {
          const y = (i + 1) * GANTT_ROW_H;
          const start = todo.start_date || todo.due_date;
          const end = todo.due_date || todo.start_date;
          const x1 = dateToX(start!);
          const x2 = Math.max(x1 + dayWidth, dateToX(end!));
          const barColor = TODO_PRIORITY_COLORS[todo.priority];
          const isDone = todo.status === 'done';

          return (
            <g key={todo.id}>
              <rect x={0} y={y} width={svgWidth} height={GANTT_ROW_H} fill={i % 2 === 0 ? 'white' : '#fafafa'} />
              {/* ラベル */}
              <text x={8} y={y + GANTT_ROW_H * 0.65} fontSize={11} fill={isDone ? '#9ca3af' : '#374151'}
                style={{ textDecoration: isDone ? 'line-through' : 'none' }}>
                {todo.title.length > 22 ? `${todo.title.slice(0, 22)}…` : todo.title}
              </text>
              {/* ガントバー */}
              <rect x={x1} y={y + 8} width={x2 - x1} height={GANTT_ROW_H - 16}
                rx={4} fill={barColor} opacity={isDone ? 0.35 : 0.8} />
              {/* バー内テキスト（幅が十分な場合） */}
              {(x2 - x1) > 40 && (
                <text x={x1 + 4} y={y + GANTT_ROW_H * 0.65} fontSize={9} fill="white">
                  {TODO_STATUS_LABELS[todo.status]}
                </text>
              )}
            </g>
          );
        })}

        {/* 縦グリッド（7日ごと） */}
        {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => {
          const x = GANTT_LABEL_W + i * 7 * dayWidth;
          return <line key={i} x1={x} y1={GANTT_ROW_H / 2} x2={x} y2={svgHeight} stroke="#e5e7eb" strokeWidth={0.5} />;
        })}
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────
export type TodoView = 'list' | 'kanban' | 'gantt';

interface TodoTabProps {
  projectId: string;
  todos: Todo[];
  assignableUsers: ProjectUser[];
  phases: ProjectPhase[];
  canEdit: boolean;
  onTodosChange: (todos: Todo[]) => void;
}

export default function TodoTab({ projectId, todos, assignableUsers, phases, canEdit, onTodosChange }: TodoTabProps) {
  const [view, setView] = useState<TodoView>('list');
  const [creating, setCreating] = useState(false);
  const [creatingSubtaskFor, setCreatingSubtaskFor] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [dragOver, setDragOver] = useState<TodoStatus | null>(null);

  // ──────────── API ハンドラ ────────────

  const createTodo = useCallback(async (data: Partial<Todo>, parentId?: string) => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/todos`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, parent_id: parentId ?? null }),
    });
    if (!res.ok) return;
    const created: Todo = await res.json();

    if (parentId) {
      // 親タスクのsubtasksに追加
      onTodosChange(todos.map(t =>
        t.id === parentId ? { ...t, subtasks: [...(t.subtasks ?? []), created] } : t
      ));
    } else {
      onTodosChange([...todos, { ...created, subtasks: [] }]);
    }
    setCreating(false);
    setCreatingSubtaskFor(null);
  }, [projectId, todos, onTodosChange]);

  const updateTodo = useCallback(async (id: string, data: Partial<Todo>) => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/todos/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const updated: Todo = await res.json();
    // アサイニーは既存データを維持
    const existing = todos.find(t => t.id === id) ?? todos.flatMap(t => t.subtasks ?? []).find(t => t.id === id);
    const merged = { ...updated, assignee: existing?.assignee ?? null };

    // 担当者を更新（assignee_id が変わった場合）
    if (data.assignee_id !== undefined) {
      const newAssignee = data.assignee_id ? assignableUsers.find(u => u.id === data.assignee_id) ?? null : null;
      Object.assign(merged, { assignee: newAssignee });
    }

    onTodosChange(todos.map(t => {
      if (t.id === id) return { ...merged, subtasks: t.subtasks };
      return { ...t, subtasks: (t.subtasks ?? []).map(s => s.id === id ? merged : s) };
    }));
    setEditingTodo(null);
  }, [projectId, todos, assignableUsers, onTodosChange]);

  const deleteTodo = useCallback(async (id: string) => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/todos/${id}`), { method: 'DELETE' });
    if (!res.ok) return;
    onTodosChange(
      todos
        .filter(t => t.id !== id)
        .map(t => ({ ...t, subtasks: (t.subtasks ?? []).filter(s => s.id !== id) }))
    );
  }, [projectId, todos, onTodosChange]);

  // ──────────── カンバン Drag & Drop ────────────

  const handleDragStart = useCallback((e: React.DragEvent, todo: Todo) => {
    e.dataTransfer.setData('todoId', todo.id);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: TodoStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('todoId');
    setDragOver(null);
    updateTodo(id, { status });
  }, [updateTodo]);

  // ──────────── 統計 ────────────
  const allTodos = todos.flatMap(t => [t, ...(t.subtasks ?? [])]);
  const doneCount = allTodos.filter(t => t.status === 'done').length;
  const totalCount = allTodos.length;

  // ──────────── ビュー ────────────

  const viewButtons = [
    { k: 'list' as const, l: 'リスト' },
    { k: 'kanban' as const, l: 'カンバン' },
    { k: 'gantt' as const, l: 'ガント' },
  ];

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgba(241,250,252,0.8)', border: '1px solid var(--border)' }}>
            {viewButtons.map(b => (
              <button
                key={b.k}
                onClick={() => setView(b.k)}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={view === b.k
                  ? { backgroundColor: 'white', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                  : { color: 'var(--text-muted)' }}
              >
                {b.l}
              </button>
            ))}
          </div>
          {totalCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {doneCount} / {totalCount} 完了
            </span>
          )}
        </div>
        {canEdit && !creating && !creatingSubtaskFor && (
          <button onClick={() => setCreating(true)} className="btn-primary text-sm">
            + タスク追加
          </button>
        )}
      </div>

      {/* 新規作成フォーム */}
      {creating && (
        <div className="card p-4">
          <TodoForm
            assignableUsers={assignableUsers}
            phases={phases}
            onSave={data => createTodo(data)}
            onCancel={() => setCreating(false)}
            saveLabel="作成"
          />
        </div>
      )}

      {/* 編集モーダル */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>タスクを編集</h3>
            <TodoForm
              initial={editingTodo}
              assignableUsers={assignableUsers}
              phases={phases}
              onSave={data => updateTodo(editingTodo.id, data)}
              onCancel={() => setEditingTodo(null)}
            />
          </div>
        </div>
      )}

      {/* ──── リストビュー ──── */}
      {view === 'list' && (
        <div className="space-y-1">
          {todos.length === 0 && !creating && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              タスクがありません。「タスク追加」から作成してください。
            </p>
          )}
          {todos.map(todo => (
            <div key={todo.id}>
              <TodoRow
                todo={todo}
                assignableUsers={assignableUsers}
                phases={phases}
                depth={0}
                onStatusChange={(id, s) => updateTodo(id, { status: s })}
                onEdit={setEditingTodo}
                onDelete={deleteTodo}
                onAddSubtask={id => setCreatingSubtaskFor(id)}
              />
              {/* サブタスク作成フォーム */}
              {creatingSubtaskFor === todo.id && (
                <div className="card p-3 ml-8 mt-1">
                  <TodoForm
                    assignableUsers={assignableUsers}
                    phases={phases}
                    onSave={data => createTodo(data, todo.id)}
                    onCancel={() => setCreatingSubtaskFor(null)}
                    saveLabel="サブタスク作成"
                  />
                </div>
              )}
              {/* サブタスク表示 */}
              {(todo.subtasks ?? []).map(sub => (
                <TodoRow
                  key={sub.id}
                  todo={sub}
                  assignableUsers={assignableUsers}
                  phases={phases}
                  depth={1}
                  onStatusChange={(id, s) => updateTodo(id, { status: s })}
                  onEdit={setEditingTodo}
                  onDelete={deleteTodo}
                  onAddSubtask={() => {}}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ──── カンバンビュー ──── */}
      {view === 'kanban' && (
        <div className="grid grid-cols-3 gap-4 min-h-[300px]">
          {STATUS_ORDER.map(status => {
            const columnTodos = todos.filter(t => t.status === status);
            return (
              <div
                key={status}
                className="rounded-2xl p-3 space-y-2 transition-colors"
                style={{
                  backgroundColor: dragOver === status ? `${STATUS_COLUMN_COLORS[status]}10` : 'rgba(248,250,252,0.8)',
                  border: `1px solid ${dragOver === status ? STATUS_COLUMN_COLORS[status] : 'var(--border)'}`,
                  minHeight: 200,
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(status); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, status)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ backgroundColor: `${STATUS_COLUMN_COLORS[status]}18`, color: STATUS_COLUMN_COLORS[status] }}
                  >
                    {TODO_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{columnTodos.length}</span>
                </div>
                {columnTodos.map(todo => (
                  <KanbanCard
                    key={todo.id}
                    todo={todo}
                    onEdit={setEditingTodo}
                    onDelete={deleteTodo}
                    onDragStart={handleDragStart}
                  />
                ))}
                {columnTodos.length === 0 && (
                  <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    タスクなし
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ──── ガントビュー ──── */}
      {view === 'gantt' && (
        <div className="card overflow-hidden">
          <GanttView todos={todos} />
        </div>
      )}
    </div>
  );
}

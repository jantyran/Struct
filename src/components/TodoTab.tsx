'use client';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Todo, TodoStatus, TodoPriority, ProjectUser, ProjectPhase } from '@/types';
import { TODO_STATUS_LABELS, TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import { useAuth } from '@/components/AuthContext';

// ──────────────────────────────────────────
// 定数
// ──────────────────────────────────────────
const STATUS_ORDER: TodoStatus[] = ['todo', 'in_progress', 'done'];
const STATUS_COLUMN_COLORS: Record<TodoStatus, string> = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  done: '#10b981',
};
const STATUS_BG: Record<TodoStatus, string> = {
  todo: 'text-slate-600 bg-slate-100',
  in_progress: 'text-blue-700 bg-blue-50',
  done: 'text-emerald-700 bg-emerald-50',
};

// ──────────────────────────────────────────
// 小ユーティリティ
// ──────────────────────────────────────────
function userDisplayName(user: { email: string; name?: string | null } | null | undefined): string {
  if (!user) return '未割当';
  return user.name?.trim() || user.email;
}

function formatDate(s: string): string {
  return s ? s.slice(0, 10) : '';
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOverdue(dueDate: string, status: TodoStatus): boolean {
  if (!dueDate || status === 'done') return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function isDueSoon(dueDate: string, status: TodoStatus): boolean {
  if (!dueDate || status === 'done') return false;
  const today = new Date().toISOString().slice(0, 10);
  const in3 = addDays(today, 3);
  return dueDate > today && dueDate <= in3;
}

// ──────────────────────────────────────────
// バッジ
// ──────────────────────────────────────────
function PriorityBadge({ priority }: { priority: TodoPriority }) {
  return (
    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: `${TODO_PRIORITY_COLORS[priority]}20`, color: TODO_PRIORITY_COLORS[priority] }}>
      {TODO_PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status, onClick }: { status: TodoStatus; onClick?: () => void }) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_BG[status]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
      title={onClick ? 'クリックでステータス変更' : undefined}
    >
      {TODO_STATUS_LABELS[status]}
    </span>
  );
}

// ──────────────────────────────────────────
// 詳細/編集モーダル
// ──────────────────────────────────────────
interface DetailModalProps {
  todo: Todo;
  assignableUsers: ProjectUser[];
  phases: ProjectPhase[];
  canEdit: boolean;
  onSave: (data: Partial<Todo>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function TodoDetailModal({ todo, assignableUsers, phases, canEdit, onSave, onDelete, onClose }: DetailModalProps) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? '');
  const [status, setStatus] = useState<TodoStatus>(todo.status);
  const [priority, setPriority] = useState<TodoPriority>(todo.priority);
  const [assigneeId, setAssigneeId] = useState(todo.assignee_id ?? '');
  const [phaseKey, setPhaseKey] = useState(todo.phase_key ?? '');
  const [startDate, setStartDate] = useState(todo.start_date ?? '');
  const [dueDate, setDueDate] = useState(todo.due_date ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  function cycleStatus() {
    if (!canEdit) return;
    const idx = STATUS_ORDER.indexOf(status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setStatus(next);
    setDirty(true);
  }

  function handleSave() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description, status, priority, assignee_id: assigneeId || null, phase_key: phaseKey, start_date: startDate, due_date: dueDate });
    onClose();
  }

  const overdue = isOverdue(todo.due_date, status);
  const subtaskCount = todo.subtasks?.length ?? 0;
  const subtaskDone = todo.subtasks?.filter(s => s.status === 'done').length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-3">
            {/* チェック/ステータスボタン */}
            <button
              className="mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
              style={{
                borderColor: status === 'done' ? '#10b981' : 'var(--border)',
                backgroundColor: status === 'done' ? '#10b981' : 'white',
              }}
              onClick={() => { mark(setStatus)(status === 'done' ? 'todo' : 'done'); }}
              title="完了/未着手を切り替え"
            >
              {status === 'done' && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              {canEdit ? (
                <input
                  className="w-full text-base font-semibold bg-transparent border-0 outline-none focus:outline-none p-0"
                  style={{ color: status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: status === 'done' ? 'line-through' : 'none' }}
                  value={title}
                  onChange={e => mark(setTitle)(e.target.value)}
                />
              ) : (
                <p className="text-base font-semibold" style={{ color: 'var(--text-primary)', textDecoration: status === 'done' ? 'line-through' : 'none' }}>{title}</p>
              )}
            </div>
            <button onClick={onClose} className="text-xl leading-none flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-primary)' }}>×</button>
          </div>

          {/* ステータスバッジ行 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <StatusBadge status={status} onClick={canEdit ? cycleStatus : undefined} />
            <PriorityBadge priority={priority} />
            {overdue && <span className="text-[11px] text-red-500 font-medium">⚠ 期限切れ</span>}
            {subtaskCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                サブタスク {subtaskDone}/{subtaskCount}
              </span>
            )}
          </div>
        </div>

        {/* 本文 */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 説明 */}
          {canEdit ? (
            <textarea
              className="w-full field-input text-sm resize-none"
              placeholder="説明を追加..."
              value={description}
              onChange={e => mark(setDescription)(e.target.value)}
              rows={3}
            />
          ) : description ? (
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{description}</p>
          ) : null}

          {/* メタ情報グリッド */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ステータス</p>
              {canEdit ? (
                <select className="field-input text-sm" value={status} onChange={e => mark(setStatus)(e.target.value as TodoStatus)}>
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{TODO_STATUS_LABELS[s]}</option>)}
                </select>
              ) : <StatusBadge status={status} />}
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>優先度</p>
              {canEdit ? (
                <select className="field-input text-sm" value={priority} onChange={e => mark(setPriority)(e.target.value as TodoPriority)}>
                  {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => <option key={p} value={p}>{TODO_PRIORITY_LABELS[p]}</option>)}
                </select>
              ) : <PriorityBadge priority={priority} />}
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>担当者</p>
              {canEdit ? (
                <select className="field-input text-sm" value={assigneeId} onChange={e => mark(setAssigneeId)(e.target.value)}>
                  <option value="">未割当</option>
                  {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>)}
                </select>
              ) : <p className="text-sm">{userDisplayName(todo.assignee)}</p>}
            </div>
            {phases.length > 0 && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>フェーズ</p>
                {canEdit ? (
                  <select className="field-input text-sm" value={phaseKey} onChange={e => mark(setPhaseKey)(e.target.value)}>
                    <option value="">未設定</option>
                    {phases.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                ) : <p className="text-sm">{phases.find(p => p.key === phaseKey)?.name ?? '未設定'}</p>}
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>開始日</p>
              {canEdit ? (
                <input type="date" className="field-input text-sm" value={startDate} onChange={e => mark(setStartDate)(e.target.value)} />
              ) : <p className="text-sm">{formatDate(startDate) || '—'}</p>}
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>期日</p>
              {canEdit ? (
                <input type="date" className="field-input text-sm" value={dueDate} onChange={e => mark(setDueDate)(e.target.value)} />
              ) : <p className="text-sm" style={{ color: overdue ? '#ef4444' : undefined }}>{formatDate(dueDate) || '—'}</p>}
            </div>
          </div>

          {/* サブタスク一覧（読み取り） */}
          {subtaskCount > 0 && (
            <div>
              <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>サブタスク</p>
              <div className="space-y-1">
                {todo.subtasks!.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 text-sm py-1">
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${sub.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                      {sub.status === 'done' && <svg viewBox="0 0 8 8" className="w-2 h-2"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" fill="none" /></svg>}
                    </span>
                    <span style={{ textDecoration: sub.status === 'done' ? 'line-through' : 'none', color: sub.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{sub.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
          <div>
            {canEdit && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">本当に削除しますか？</span>
                  <button onClick={() => { onDelete(todo.id); onClose(); }} className="text-xs text-red-600 font-medium hover:underline">削除する</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>キャンセル</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">閉じる</button>
            {canEdit && dirty && (
              <button onClick={handleSave} disabled={!title.trim()} className="btn-primary text-sm">保存</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// 新規作成モーダル
// ──────────────────────────────────────────
interface CreateModalProps {
  assignableUsers: ProjectUser[];
  phases: ProjectPhase[];
  parentTodo?: Todo | null;
  initialValues?: Partial<Todo> | null;
  onSave: (data: Partial<Todo>) => void;
  onCancel: () => void;
  saveLabel?: string;
}

function TodoCreateModal({ assignableUsers, phases, parentTodo, initialValues, onSave, onCancel, saveLabel = '作成' }: CreateModalProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [status, setStatus] = useState<TodoStatus>((initialValues?.status as TodoStatus | undefined) ?? 'todo');
  const [priority, setPriority] = useState<TodoPriority>((initialValues?.priority as TodoPriority | undefined) ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(initialValues?.assignee_id ?? '');
  const [phaseKey, setPhaseKey] = useState(parentTodo?.phase_key ?? initialValues?.phase_key ?? '');
  const [startDate, setStartDate] = useState(initialValues?.start_date ?? '');
  const [dueDate, setDueDate] = useState(initialValues?.due_date ?? '');

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>
                {parentTodo ? `サブタスクを追加: ${parentTodo.title}` : '新しいタスク'}
              </p>
              <input
                className="w-full text-base font-semibold bg-transparent border-0 outline-none focus:outline-none p-0"
                placeholder="タスク名（必須）"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSave(); if (e.key === 'Escape') onCancel(); }}
              />
            </div>
            <button onClick={onCancel} className="text-xl leading-none flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-primary)' }}>×</button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <textarea
            className="w-full field-input text-sm resize-none"
            placeholder="説明を追加..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ステータス</p>
              <select className="field-input text-sm" value={status} onChange={e => setStatus(e.target.value as TodoStatus)}>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{TODO_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>優先度</p>
              <select className="field-input text-sm" value={priority} onChange={e => setPriority(e.target.value as TodoPriority)}>
                {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => <option key={p} value={p}>{TODO_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>担当者</p>
              <select className="field-input text-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">未割当</option>
                {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>)}
              </select>
            </div>
            {phases.length > 0 && (
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>フェーズ</p>
                <select className="field-input text-sm" value={phaseKey} onChange={e => setPhaseKey(e.target.value)}>
                  <option value="">未設定</option>
                  {phases.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>開始日</p>
              <input type="date" className="field-input text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>期日</p>
              <input type="date" className="field-input text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onCancel} className="btn-secondary text-sm">キャンセル</button>
          <button onClick={handleSave} disabled={!title.trim()} className="btn-primary text-sm">{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// リストビュー: 1行
// ──────────────────────────────────────────
function TodoRow({
  todo, phases, depth, onStatusChange, onOpen, onDelete, onAddSubtask, canEdit,
}: {
  todo: Todo;
  phases: ProjectPhase[];
  depth: number;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onOpen: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (parentId: string) => void;
  canEdit: boolean;
}) {
  const overdue = isOverdue(todo.due_date, todo.status);
  const soon = isDueSoon(todo.due_date, todo.status);
  const subtaskCount = todo.subtasks?.length ?? 0;
  const subtaskDone = todo.subtasks?.filter(s => s.status === 'done').length ?? 0;

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-xl transition-colors hover:bg-slate-50 group cursor-pointer select-none"
      style={{ paddingLeft: depth > 0 ? `${12 + depth * 24}px` : undefined }}
      onDoubleClick={() => onOpen(todo)}
      title="ダブルクリックで詳細を開く"
    >
      {/* チェックボックス */}
      <button
        className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
        style={{
          borderColor: todo.status === 'done' ? '#10b981' : todo.status === 'in_progress' ? '#3b82f6' : 'var(--border)',
          backgroundColor: todo.status === 'done' ? '#10b981' : 'white',
        }}
        onClick={e => { e.stopPropagation(); onStatusChange(todo.id, todo.status === 'done' ? 'todo' : 'done'); }}
        title={todo.status === 'done' ? '未着手に戻す' : '完了にする'}
      >
        {todo.status === 'done' && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {todo.status === 'in_progress' && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3b82f6', display: 'block' }} />}
      </button>

      {/* タイトル + メタ */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className={`text-sm ${todo.status === 'done' ? 'line-through' : ''}`}
          style={{ color: todo.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {todo.title}
        </span>
        <PriorityBadge priority={todo.priority} />
        {todo.status === 'in_progress' && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full text-blue-700 bg-blue-50">進行中</span>
        )}
        {subtaskCount > 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {subtaskDone}/{subtaskCount}
          </span>
        )}
        {todo.assignee && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{userDisplayName(todo.assignee)}</span>
        )}
        {todo.due_date && (
          <span className="text-[11px] font-medium"
            style={{ color: overdue ? '#ef4444' : soon ? '#f59e0b' : 'var(--text-muted)' }}>
            {overdue ? '⚠ ' : soon ? '◎ ' : ''}{formatDate(todo.due_date)}
          </span>
        )}
        {todo.phase_key && phases.length > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {phases.find(p => p.key === todo.phase_key)?.name}
          </span>
        )}
      </div>

      {/* アクション（ホバー時） */}
      {canEdit && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {depth === 0 && (
            <button onClick={e => { e.stopPropagation(); onAddSubtask(todo.id); }}
              className="text-[11px] px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              style={{ color: 'var(--text-muted)' }} title="サブタスク追加">
              +サブ
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onOpen(todo); }}
            className="text-[11px] px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            開く
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
            className="text-[11px] px-2 py-1 rounded hover:bg-red-50 transition-colors text-red-400">
            削除
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// カンバンカード
// ──────────────────────────────────────────
function KanbanCard({
  todo, onOpen, onDelete, onDragStart,
}: {
  todo: Todo;
  onOpen: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, todo: Todo) => void;
}) {
  const overdue = isOverdue(todo.due_date, todo.status);
  const soon = isDueSoon(todo.due_date, todo.status);
  const draggedRef = useRef(false);

  return (
    <div
      draggable
      onDragStart={e => { draggedRef.current = true; onDragStart(e, todo); }}
      onDragEnd={() => { setTimeout(() => { draggedRef.current = false; }, 200); }}
      onDoubleClick={() => { if (!draggedRef.current) onOpen(todo); }}
      className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
      style={{ borderLeft: `3px solid ${TODO_PRIORITY_COLORS[todo.priority]}` }}
      title="ダブルクリックで詳細を開く"
    >
      <div className="flex items-start gap-1">
        <p className="text-sm font-medium leading-snug flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
          {todo.title}
        </p>
        <button
          onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
          className="text-xs opacity-0 group-hover:opacity-40 hover:!opacity-100 text-red-400 flex-shrink-0 transition-opacity p-0.5"
          title="削除"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <PriorityBadge priority={todo.priority} />
        {todo.assignee && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{userDisplayName(todo.assignee)}</span>
        )}
      </div>

      {todo.due_date && (
        <p className="text-[11px] mt-1.5 font-medium"
          style={{ color: overdue ? '#ef4444' : soon ? '#f59e0b' : 'var(--text-muted)' }}>
          {overdue ? '⚠ ' : soon ? '◎ ' : ''}{formatDate(todo.due_date)}
        </p>
      )}

      {(todo.subtasks?.length ?? 0) > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div className="h-full rounded-full bg-emerald-400"
              style={{ width: `${((todo.subtasks!.filter(s => s.status === 'done').length) / todo.subtasks!.length) * 100}%` }} />
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {todo.subtasks!.filter(s => s.status === 'done').length}/{todo.subtasks!.length}
          </span>
        </div>
      )}
    </div>
  );
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

type GanttScale = 'day' | 'week5' | 'week';
const GANTT_SCALE_LABELS: Record<GanttScale, string> = {
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

function GanttView({
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
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            バー中央をドラッグ: 期間移動 ／ 右端をドラッグ: 期日変更 ／ 未スケジュールからドラッグ: 日付付与 ／ 最下段をドラッグ: 新規タスク作成
          </p>
          <div className="flex items-center gap-3">
            {(['todo', 'in_progress', 'done'] as const).map(s => (
              <div key={s} className="flex items-center gap-1">
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: GANTT_STATUS_COLORS[s], opacity: 0.85, flexShrink: 0 }} />
                <span className="text-[10px]" style={{ color: '#64748b' }}>{TODO_STATUS_LABELS[s]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div style={{ width: 3, height: 10, borderRadius: 2, backgroundColor: '#3b82f6', flexShrink: 0 }} />
              <span className="text-[10px]" style={{ color: '#64748b' }}>優先度</span>
            </div>
          </div>
        </div>
      </div>
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
  const { user } = useAuth();
  const [view, setView] = useState<TodoView>(user?.settings?.default_task_view ?? 'list');
  const [creating, setCreating] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<Partial<Todo> | null>(null);
  const [creatingSubtaskFor, setCreatingSubtaskFor] = useState<string | null>(null);
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [dragOver, setDragOver] = useState<TodoStatus | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  const scrollOptions = useMemo(() => ({ behavior: 'smooth', block: 'center' } as const), []);

  // ──── ガント拡張表示 ────
  const [ganttFullscreen, setGanttFullscreen] = useState(false);
  const [ganttScale, setGanttScale] = useState<GanttScale>('day');

  // ──── フィルター状態 ────
  const [filterStatuses, setFilterStatuses] = useState<Set<TodoStatus>>(new Set(user?.settings?.default_task_statuses ?? []));
  const [filterPriorities, setFilterPriorities] = useState<Set<TodoPriority>>(new Set(user?.settings?.default_task_priorities ?? []));
  const [filterAssigneeId, setFilterAssigneeId] = useState<string>(user?.settings?.default_task_assignee === 'me' ? user.id : (user?.settings?.default_task_assignee ?? ''));
  const defaultTaskViewAppliedRef = useRef(false);
  const defaultTaskFilterAppliedRef = useRef(false);

  useEffect(() => {
    const preferredView = user?.settings?.default_task_view;
    if (!preferredView) return;
    if (defaultTaskViewAppliedRef.current) return;
    setView(preferredView);
    defaultTaskViewAppliedRef.current = true;
  }, [user?.settings?.default_task_view]);

  useEffect(() => {
    if (defaultTaskFilterAppliedRef.current) return;
    setFilterStatuses(new Set(user?.settings?.default_task_statuses ?? []));
    setFilterPriorities(new Set(user?.settings?.default_task_priorities ?? []));
    if (user?.settings?.default_task_hide_done) {
      setFilterStatuses((current) => {
        const next = new Set(current);
        next.add('todo');
        next.add('in_progress');
        next.delete('done');
        return next;
      });
    }
    setFilterAssigneeId(user?.settings?.default_task_assignee === 'me' ? user.id : (user?.settings?.default_task_assignee ?? ''));
    defaultTaskFilterAppliedRef.current = true;
  }, [
    user?.id,
    user?.settings?.default_task_assignee,
    user?.settings?.default_task_hide_done,
    user?.settings?.default_task_priorities,
    user?.settings?.default_task_statuses,
  ]);

  function toggleStatus(s: TodoStatus) {
    setFilterStatuses(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }
  function togglePriority(p: TodoPriority) {
    setFilterPriorities(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  const hideDone = filterStatuses.size > 0 && !filterStatuses.has('done');

  function toggleHideDone() {
    if (hideDone) {
      // 完了非表示を解除 → ステータスフィルタをクリア
      setFilterStatuses(new Set());
    } else {
      // 完了のみ除外
      setFilterStatuses(new Set(['todo', 'in_progress'] as TodoStatus[]));
    }
  }

  function matchesFilter(todo: Todo): boolean {
    if (filterStatuses.size > 0 && !filterStatuses.has(todo.status)) return false;
    if (filterPriorities.size > 0 && !filterPriorities.has(todo.priority)) return false;
    if (filterAssigneeId === 'unassigned' && todo.assignee_id) return false;
    if (filterAssigneeId && filterAssigneeId !== 'unassigned' && todo.assignee_id !== filterAssigneeId) return false;
    return true;
  }

  const isFiltering = filterStatuses.size > 0 || filterPriorities.size > 0 || filterAssigneeId !== '';

  // フィルター適用済みTodo
  const filteredTodos = useMemo(
    () => todos
      .filter(matchesFilter)
      .map(t => ({ ...t, subtasks: (t.subtasks ?? []).filter(matchesFilter) })),
    [todos, filterStatuses, filterPriorities, filterAssigneeId]
  );

  usePendingScrollTarget(
    pendingScrollTarget,
    [todos, filteredTodos, view],
    setPendingScrollTarget,
    scrollOptions,
  );

  useRegisterShortcutScope(`todo-tab-${projectId}`, 'タスク', {
    new_record: canEdit ? () => {
      setCreateDefaults(null);
      setCreating(true);
    } : undefined,
  });

  // ──── API ────

  const createTodo = useCallback(async (data: Partial<Todo>, parentId?: string) => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/todos`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, parent_id: parentId ?? null }),
    });
    if (!res.ok) return;
    const created: Todo = await res.json();

    if (parentId) {
      onTodosChange(todos.map(t =>
        t.id === parentId ? { ...t, subtasks: [...(t.subtasks ?? []), created] } : t
      ));
    } else {
      onTodosChange([...todos, { ...created, subtasks: [] }]);
    }
    setPendingScrollTarget(`todo-row-${created.id}`);
    setCreating(false);
    setCreateDefaults(null);
    setCreatingSubtaskFor(null);
    return created;
  }, [projectId, todos, onTodosChange]);

  const updateTodo = useCallback(async (id: string, data: Partial<Todo>) => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/todos/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const updated: Todo = await res.json();
    const existing = todos.find(t => t.id === id) ?? todos.flatMap(t => t.subtasks ?? []).find(t => t.id === id);
    const merged = { ...updated, assignee: existing?.assignee ?? null };
    if (data.assignee_id !== undefined) {
      const newAssignee = data.assignee_id ? assignableUsers.find(u => u.id === data.assignee_id) ?? null : null;
      Object.assign(merged, { assignee: newAssignee });
    }
    onTodosChange(todos.map(t => {
      if (t.id === id) return { ...merged, subtasks: t.subtasks };
      return { ...t, subtasks: (t.subtasks ?? []).map(s => s.id === id ? merged : s) };
    }));
    // detailTodoが開いていれば更新
    setDetailTodo(prev => prev?.id === id ? { ...merged, subtasks: prev.subtasks } : prev);
  }, [projectId, todos, assignableUsers, onTodosChange]);

  const deleteTodo = useCallback(async (id: string) => {
    const res = await fetch(withBasePath(`/api/projects/${projectId}/todos/${id}`), { method: 'DELETE' });
    if (!res.ok) return;
    onTodosChange(todos.filter(t => t.id !== id).map(t => ({ ...t, subtasks: (t.subtasks ?? []).filter(s => s.id !== id) })));
    setDetailTodo(null);
  }, [projectId, todos, onTodosChange]);

  // ──── カンバン D&D ────
  const handleDragStart = useCallback((e: React.DragEvent, todo: Todo) => {
    e.dataTransfer.setData('todoId', todo.id);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: TodoStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('todoId');
    setDragOver(null);
    updateTodo(id, { status });
  }, [updateTodo]);

  // ──── 統計 ────
  const allTodos = useMemo(() => todos.flatMap(t => [t, ...(t.subtasks ?? [])]), [todos]);
  const doneCount = useMemo(() => allTodos.filter(t => t.status === 'done').length, [allTodos]);
  const totalCount = allTodos.length;
  const urgentCount = useMemo(() => allTodos.filter(t => t.status !== 'done' && isOverdue(t.due_date, t.status)).length, [allTodos]);
  const filteredCount = useMemo(() => filteredTodos.flatMap(t => [t, ...(t.subtasks ?? [])]).length, [filteredTodos]);

  const viewButtons = [
    { k: 'list' as const, l: 'リスト' },
    { k: 'kanban' as const, l: 'カンバン' },
    { k: 'gantt' as const, l: 'ガント' },
  ];

  // カンバン用: フィルタされたステータス列のみ表示
  const visibleStatuses = useMemo(
    () => filterStatuses.size > 0
      ? STATUS_ORDER.filter(s => filterStatuses.has(s))
      : STATUS_ORDER,
    [filterStatuses]
  );

  return (
    <div className="space-y-3 min-w-0">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgba(241,250,252,0.8)', border: '1px solid var(--border)' }}>
            {viewButtons.map(b => (
              <button key={b.k} onClick={() => setView(b.k)}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={view === b.k
                  ? { backgroundColor: 'white', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                  : { color: 'var(--text-muted)' }}>
                {b.l}
              </button>
            ))}
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isFiltering ? `${filteredCount} / ${totalCount}件` : `${doneCount} / ${totalCount} 完了`}
              </span>
              {urgentCount > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium text-red-600 bg-red-50">
                  ⚠ {urgentCount} 件期限切れ
                </span>
              )}
            </div>
          )}
        </div>
        {canEdit && !creating && !creatingSubtaskFor && (
          <button onClick={() => { setCreateDefaults(null); setCreating(true); }} className="btn-primary text-sm">+ タスク追加</button>
        )}
      </div>

      {/* フィルターバー */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 py-2 rounded-xl"
          style={{ backgroundColor: 'rgba(248,250,252,0.8)', border: '1px solid var(--border)' }}>

          {/* 完了を隠す クイックトグル */}
          <button
            onClick={toggleHideDone}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors"
            style={hideDone
              ? { backgroundColor: 'var(--accent)', color: 'white' }
              : { color: 'var(--text-muted)', backgroundColor: 'transparent' }}>
            <span className="text-[10px]">{hideDone ? '✓' : '○'}</span>
            完了を隠す
          </button>

          <div className="w-px h-4 bg-slate-200" />

          {/* ステータス */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>状態</span>
            {STATUS_ORDER.map(s => (
              <button key={s} onClick={() => toggleStatus(s)}
                className="text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors"
                style={filterStatuses.has(s)
                  ? { backgroundColor: STATUS_COLUMN_COLORS[s], color: 'white' }
                  : { backgroundColor: `${STATUS_COLUMN_COLORS[s]}15`, color: STATUS_COLUMN_COLORS[s] }}>
                {TODO_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-slate-200" />

          {/* 優先度 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>優先度</span>
            {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => (
              <button key={p} onClick={() => togglePriority(p)}
                className="text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors"
                style={filterPriorities.has(p)
                  ? { backgroundColor: TODO_PRIORITY_COLORS[p], color: 'white' }
                  : { backgroundColor: `${TODO_PRIORITY_COLORS[p]}18`, color: TODO_PRIORITY_COLORS[p] }}>
                {TODO_PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>

          {/* 担当者 */}
          {assignableUsers.length > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>担当者</span>
                <select
                  className="text-[11px] rounded-lg px-2 py-0.5 border transition-colors"
                  style={{
                    borderColor: filterAssigneeId ? 'var(--accent)' : 'var(--border)',
                    color: filterAssigneeId ? 'var(--accent)' : 'var(--text-secondary)',
                    backgroundColor: filterAssigneeId ? 'rgba(15,154,177,0.06)' : 'white',
                  }}
                  value={filterAssigneeId}
                  onChange={e => setFilterAssigneeId(e.target.value)}
                >
                  <option value="">全員</option>
                  <option value="unassigned">未割当</option>
                  {assignableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* クリアボタン */}
          {isFiltering && (
            <button
              onClick={() => { setFilterStatuses(new Set()); setFilterPriorities(new Set()); setFilterAssigneeId(''); }}
              className="text-[11px] ml-auto px-2 py-0.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              クリア ×
            </button>
          )}
        </div>
      )}

      {/* 新規作成 */}
      {(creating || creatingSubtaskFor) && (
        <TodoCreateModal
          assignableUsers={assignableUsers}
          phases={phases}
          parentTodo={creatingSubtaskFor ? todos.find((todo) => todo.id === creatingSubtaskFor) ?? null : null}
          initialValues={createDefaults}
          onSave={data => createTodo(data, creatingSubtaskFor ?? undefined)}
          onCancel={() => {
            setCreating(false);
            setCreateDefaults(null);
            setCreatingSubtaskFor(null);
          }}
          saveLabel={creatingSubtaskFor ? 'サブタスク作成' : '作成'}
        />
      )}

      {/* 詳細モーダル */}
      {detailTodo && (
        <TodoDetailModal
          todo={detailTodo}
          assignableUsers={assignableUsers}
          phases={phases}
          canEdit={canEdit}
          onSave={data => updateTodo(detailTodo.id, data)}
          onDelete={deleteTodo}
          onClose={() => setDetailTodo(null)}
        />
      )}

      {/* ──── リストビュー ──── */}
      {view === 'list' && (
        <div className="space-y-0.5">
          {todos.length === 0 && !creating ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-2xl mb-2">✓</p>
              <p className="text-sm">タスクがありません</p>
              {canEdit && <button onClick={() => { setCreateDefaults(null); setCreating(true); }} className="btn-primary text-sm mt-4">タスクを追加</button>}
            </div>
          ) : filteredTodos.length === 0 && !creating ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">条件に一致するタスクがありません</p>
            </div>
          ) : null}
          {filteredTodos.map(todo => (
            <div key={todo.id} id={`todo-row-${todo.id}`}>
              <TodoRow
                todo={todo} phases={phases} depth={0} canEdit={canEdit}
                onStatusChange={(id, s) => updateTodo(id, { status: s })}
                onOpen={setDetailTodo}
                onDelete={deleteTodo}
                onAddSubtask={id => { setCreateDefaults(null); setCreatingSubtaskFor(id); }}
              />
              {(todo.subtasks ?? []).map(sub => (
                <div key={sub.id} id={`todo-row-${sub.id}`}>
                  <TodoRow
                    todo={sub} phases={phases} depth={1} canEdit={canEdit}
                    onStatusChange={(id, s) => updateTodo(id, { status: s })}
                    onOpen={setDetailTodo}
                    onDelete={deleteTodo}
                    onAddSubtask={() => {}}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ──── カンバンビュー ──── */}
      {view === 'kanban' && (
        <div className={`grid gap-4 min-h-[300px]`}
          style={{ gridTemplateColumns: `repeat(${visibleStatuses.length}, minmax(0, 1fr))` }}>
          {visibleStatuses.map(status => {
            const columnTodos = filteredTodos.filter(t => t.status === status);
            return (
              <div key={status}
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
                <div className="flex items-center justify-between mb-1 px-1">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ backgroundColor: `${STATUS_COLUMN_COLORS[status]}18`, color: STATUS_COLUMN_COLORS[status] }}>
                    {TODO_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{columnTodos.length}</span>
                </div>
                {columnTodos.map(todo => (
                  <div key={todo.id} id={`todo-row-${todo.id}`}>
                    <KanbanCard
                      todo={todo}
                      onOpen={setDetailTodo}
                      onDelete={deleteTodo}
                      onDragStart={handleDragStart}
                    />
                  </div>
                ))}
                {columnTodos.length === 0 && (
                  <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>タスクなし</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ──── ガントビュー ──── */}
      {view === 'gantt' && (
        <div className="card overflow-hidden p-3 min-w-0">
          <GanttView
            todos={filteredTodos}
            onOpen={setDetailTodo}
            onUpdate={updateTodo}
            onCreate={(data) => {
              setCreateDefaults({
                status: 'todo',
                priority: 'medium',
                ...data,
              });
              setCreating(true);
            }}
            canEdit={canEdit}
            scale={ganttScale} onScaleChange={setGanttScale}
            onExpand={() => setGanttFullscreen(true)}
          />
        </div>
      )}

      {/* ──── ガント拡大表示オーバーレイ ──── */}
      {ganttFullscreen && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'white' }}>
          {/* サイドバー */}
          <div className="w-52 shrink-0 h-full flex flex-col border-r overflow-y-auto"
            style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(241,250,252,0.95) 100%)' }}>

            {/* ヘッダー */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>ガントチャート</span>
              <button
                onClick={() => setGanttFullscreen(false)}
                className="text-lg leading-none rounded-md px-1.5 hover:bg-slate-100 transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <div className="p-4 space-y-5 flex-1">
              {/* 表示単位 */}
              <div>
                <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>表示単位</p>
                <div className="flex flex-col gap-1">
                  {(Object.keys(GANTT_SCALE_LABELS) as GanttScale[]).map(s => (
                    <button key={s} onClick={() => setGanttScale(s)}
                      className="text-xs text-left px-3 py-1.5 rounded-lg transition-colors"
                      style={ganttScale === s
                        ? { backgroundColor: 'var(--accent)', color: 'white' }
                        : { color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                      {GANTT_SCALE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t" style={{ borderColor: 'var(--border)' }} />

              {/* 完了を隠す */}
              <div>
                <button onClick={toggleHideDone}
                  className="w-full flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={hideDone
                    ? { backgroundColor: 'var(--accent)', color: 'white' }
                    : { color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  <span className="text-[10px]">{hideDone ? '✓' : '○'}</span>
                  完了を隠す
                </button>
              </div>

              {/* ステータス */}
              <div>
                <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>ステータス</p>
                <div className="flex flex-col gap-1">
                  {STATUS_ORDER.map(s => (
                    <button key={s} onClick={() => toggleStatus(s)}
                      className="text-xs text-left px-3 py-1.5 rounded-lg transition-colors"
                      style={filterStatuses.has(s)
                        ? { backgroundColor: STATUS_COLUMN_COLORS[s], color: 'white' }
                        : { backgroundColor: `${STATUS_COLUMN_COLORS[s]}15`, color: STATUS_COLUMN_COLORS[s] }}>
                      {TODO_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 優先度 */}
              <div>
                <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>優先度</p>
                <div className="flex flex-col gap-1">
                  {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => (
                    <button key={p} onClick={() => togglePriority(p)}
                      className="text-xs text-left px-3 py-1.5 rounded-lg transition-colors"
                      style={filterPriorities.has(p)
                        ? { backgroundColor: TODO_PRIORITY_COLORS[p], color: 'white' }
                        : { backgroundColor: `${TODO_PRIORITY_COLORS[p]}18`, color: TODO_PRIORITY_COLORS[p] }}>
                      {TODO_PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 担当者 */}
              {assignableUsers.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>担当者</p>
                  <select
                    className="w-full text-[11px] rounded-lg px-2 py-1.5 border transition-colors"
                    style={{
                      borderColor: filterAssigneeId ? 'var(--accent)' : 'var(--border)',
                      color: filterAssigneeId ? 'var(--accent)' : 'var(--text-secondary)',
                      backgroundColor: filterAssigneeId ? 'rgba(15,154,177,0.06)' : 'white',
                    }}
                    value={filterAssigneeId}
                    onChange={e => setFilterAssigneeId(e.target.value)}>
                    <option value="">全員</option>
                    <option value="unassigned">未割当</option>
                    {assignableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* クリア */}
              {isFiltering && (
                <button
                  onClick={() => { setFilterStatuses(new Set()); setFilterPriorities(new Set()); setFilterAssigneeId(''); }}
                  className="w-full text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  フィルタをクリア ×
                </button>
              )}
            </div>

            {/* フッター */}
            <div className="px-4 py-3 border-t text-[10px] leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              バー: ドラッグで移動<br />右端: ドラッグで期日変更<br />ダブルクリック: 詳細を開く
            </div>
          </div>

          {/* メインエリア */}
          <div className="flex-1 h-full overflow-auto p-4">
              <GanttView
                todos={filteredTodos}
                onOpen={setDetailTodo}
                onUpdate={updateTodo}
                onCreate={(data) => {
                  setCreateDefaults({
                    status: 'todo',
                    priority: 'medium',
                    ...data,
                  });
                  setCreating(true);
                }}
                canEdit={canEdit}
                scale={ganttScale} onScaleChange={setGanttScale} hideScaleUI
              />
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Todo, TodoStatus, TodoPriority, ProjectUser, ProjectPhase } from '@/types';
import { TODO_STATUS_LABELS, TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import { useAuth } from '@/components/AuthContext';
import { CommentSection } from '@/components/CommentSection';

import GanttView, { type GanttScale, GANTT_SCALE_LABELS } from '@/components/GanttView';
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
export function userDisplayName(user: { email: string; name?: string | null } | null | undefined): string {
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

export function isOverdue(dueDate: string, status: TodoStatus): boolean {
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
export function PriorityBadge({ priority }: { priority: TodoPriority }) {
  return (
    <span className="text-[0.6875rem] px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: `${TODO_PRIORITY_COLORS[priority]}20`, color: TODO_PRIORITY_COLORS[priority] }}>
      {TODO_PRIORITY_LABELS[priority]}
    </span>
  );
}

function StatusBadge({ status, onClick }: { status: TodoStatus; onClick?: () => void }) {
  return (
    <span
      className={`text-[0.6875rem] px-2 py-0.5 rounded-full font-medium ${STATUS_BG[status]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
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
  onSubtaskStatusChange: (id: string, status: TodoStatus) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function TodoDetailModal({ todo, assignableUsers, phases, canEdit, onSave, onSubtaskStatusChange, onDelete, onClose }: DetailModalProps) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? '');
  const [status, setStatus] = useState<TodoStatus>(todo.status);
  const [priority, setPriority] = useState<TodoPriority>(todo.priority);
  const [assigneeId, setAssigneeId] = useState(todo.assignee_id ?? '');
  const [phaseKey, setPhaseKey] = useState(todo.phase_key ?? '');
  const [startDate, setStartDate] = useState(todo.start_date ?? '');
  const [dueDate, setDueDate] = useState(todo.due_date ?? '');
  const [tags, setTags] = useState<string[]>(() => { try { return JSON.parse(todo.tags ?? '[]'); } catch { return []; } });
  const [tagInput, setTagInput] = useState('');
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
    onSave({ title: title.trim(), description, status, priority, assignee_id: assigneeId || null, phase_key: phaseKey, start_date: startDate, due_date: dueDate, tags: JSON.stringify(tags) });
    onClose();
  }

  function addTag(tag: string) {
    const t = tag.trim().replace(/^#/, '');
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    setDirty(true);
  }

  function removeTag(t: string) {
    setTags(tags.filter(x => x !== t));
    setDirty(true);
  }

  const overdue = isOverdue(todo.due_date, status);
  const subtaskCount = todo.subtasks?.length ?? 0;
  const subtaskDone = todo.subtasks?.filter(s => s.status === 'done').length ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
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
            {overdue && <span className="text-[0.6875rem] text-red-500 font-medium">⚠ 期限切れ</span>}
            {subtaskCount > 0 && (
              <span className="text-[0.6875rem] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
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
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ステータス</p>
              {canEdit ? (
                <select className="field-input text-sm" value={status} onChange={e => mark(setStatus)(e.target.value as TodoStatus)}>
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{TODO_STATUS_LABELS[s]}</option>)}
                </select>
              ) : <StatusBadge status={status} />}
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>優先度</p>
              {canEdit ? (
                <select className="field-input text-sm" value={priority} onChange={e => mark(setPriority)(e.target.value as TodoPriority)}>
                  {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => <option key={p} value={p}>{TODO_PRIORITY_LABELS[p]}</option>)}
                </select>
              ) : <PriorityBadge priority={priority} />}
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>担当者</p>
              {canEdit ? (
                <select className="field-input text-sm" value={assigneeId} onChange={e => mark(setAssigneeId)(e.target.value)}>
                  <option value="">未割当</option>
                  {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>)}
                </select>
              ) : <p className="text-sm">{userDisplayName(todo.assignee)}</p>}
            </div>
            {phases.length > 0 && (
              <div>
                <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>フェーズ</p>
                {canEdit ? (
                  <select className="field-input text-sm" value={phaseKey} onChange={e => mark(setPhaseKey)(e.target.value)}>
                    <option value="">未設定</option>
                    {phases.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                ) : <p className="text-sm">{phases.find(p => p.key === phaseKey)?.name ?? '未設定'}</p>}
              </div>
            )}
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>開始日</p>
              {canEdit ? (
                <input type="date" className="field-input text-sm" value={startDate} onChange={e => mark(setStartDate)(e.target.value)} />
              ) : <p className="text-sm">{formatDate(startDate) || '—'}</p>}
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>期日</p>
              {canEdit ? (
                <input type="date" className="field-input text-sm" value={dueDate} onChange={e => mark(setDueDate)(e.target.value)} />
              ) : <p className="text-sm" style={{ color: overdue ? '#ef4444' : undefined }}>{formatDate(dueDate) || '—'}</p>}
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>作成日</p>
              <p className="text-sm">{formatDate(todo.created_at) || '—'}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>完了日</p>
              <p className="text-sm">{status === 'done' ? (formatDate(todo.completed_at ?? '') || '保存後に記録') : '—'}</p>
            </div>
          </div>

          {/* タグ */}
          <div>
            <p className="text-[0.6875rem] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>タグ</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                  #{t}
                  {canEdit && (
                    <button type="button" onClick={() => removeTag(t)} className="opacity-60 hover:opacity-100 transition-opacity leading-none">×</button>
                  )}
                </span>
              ))}
              {tags.length === 0 && !canEdit && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>なし</span>
              )}
            </div>
            {canEdit && (
              <input
                className="field-input text-sm"
                placeholder="タグを入力して Enter（例: 設計・確認・執筆）"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagInput);
                    setTagInput('');
                  } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
              />
            )}
          </div>

          {/* サブタスク一覧 */}
          {subtaskCount > 0 && (
            <div>
              <p className="text-[0.6875rem] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>サブタスク</p>
              <div className="space-y-1">
                {todo.subtasks!.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 text-sm py-1">
                    <button
                      type="button"
                      className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${sub.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'} ${canEdit ? 'cursor-pointer hover:opacity-80' : ''}`}
                      onClick={() => {
                        if (!canEdit) return;
                        onSubtaskStatusChange(sub.id, sub.status === 'done' ? 'todo' : 'done');
                      }}
                      title={canEdit ? (sub.status === 'done' ? '未完了に戻す' : '完了にする') : undefined}
                    >
                      {sub.status === 'done' && <svg viewBox="0 0 8 8" className="w-2 h-2"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" fill="none" /></svg>}
                    </button>
                    <span style={{ textDecoration: sub.status === 'done' ? 'line-through' : 'none', color: sub.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{sub.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* コメントセクション */}
          <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[0.6875rem] font-medium mb-2" style={{ color: 'var(--text-muted)' }}>コメント</p>
            <CommentSection
              projectId={todo.project_id}
              targetType="todo"
              targetId={todo.id}
              compact={true}
            />
          </div>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onCancel}>
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
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>ステータス</p>
              <select className="field-input text-sm" value={status} onChange={e => setStatus(e.target.value as TodoStatus)}>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{TODO_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>優先度</p>
              <select className="field-input text-sm" value={priority} onChange={e => setPriority(e.target.value as TodoPriority)}>
                {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => <option key={p} value={p}>{TODO_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>担当者</p>
              <select className="field-input text-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">未割当</option>
                {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name?.trim() || u.email}</option>)}
              </select>
            </div>
            {phases.length > 0 && (
              <div>
                <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>フェーズ</p>
                <select className="field-input text-sm" value={phaseKey} onChange={e => setPhaseKey(e.target.value)}>
                  <option value="">未設定</option>
                  {phases.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>開始日</p>
              <input type="date" className="field-input text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <p className="text-[0.6875rem] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>期日</p>
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
          <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full text-blue-700 bg-blue-50">進行中</span>
        )}
        {subtaskCount > 0 && (
          <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {subtaskDone}/{subtaskCount}
          </span>
        )}
        {todo.assignee && (
          <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>{userDisplayName(todo.assignee)}</span>
        )}
        {todo.due_date && (
          <span className="text-[0.6875rem] font-medium"
            style={{ color: overdue ? '#ef4444' : soon ? '#f59e0b' : 'var(--text-muted)' }}>
            {overdue ? '⚠ ' : soon ? '◎ ' : ''}{formatDate(todo.due_date)}
          </span>
        )}
        {todo.phase_key && phases.length > 0 && (
          <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
            {phases.find(p => p.key === todo.phase_key)?.name}
          </span>
        )}
      </div>

      {/* アクション（ホバー時） */}
      {canEdit && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {depth === 0 && (
            <button onClick={e => { e.stopPropagation(); onAddSubtask(todo.id); }}
              className="text-[0.6875rem] px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              style={{ color: 'var(--text-muted)' }} title="サブタスク追加">
              +サブ
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onOpen(todo); }}
            className="text-[0.6875rem] px-2 py-1 rounded hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            開く
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(todo.id); }}
            className="text-[0.6875rem] px-2 py-1 rounded hover:bg-red-50 transition-colors text-red-400">
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
          <span className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>{userDisplayName(todo.assignee)}</span>
        )}
      </div>

      {todo.due_date && (
        <p className="text-[0.6875rem] mt-1.5 font-medium"
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
          <span className="text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>
            {todo.subtasks!.filter(s => s.status === 'done').length}/{todo.subtasks!.length}
          </span>
        </div>
      )}
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
  focusedTodoId?: string | null;
  onFocusedTodoConsumed?: () => void;
  onTodosChange: (todos: Todo[]) => void;
}

export default function TodoTab({ projectId, todos, assignableUsers, phases, canEdit, focusedTodoId, onFocusedTodoConsumed, onTodosChange }: TodoTabProps) {
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
  const autoOpenedTodoIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedTodoId) return;
    const preferredView = user?.settings?.default_task_view;
    if (!preferredView) return;
    if (defaultTaskViewAppliedRef.current) return;
    setView(preferredView);
    defaultTaskViewAppliedRef.current = true;
  }, [focusedTodoId, user?.settings?.default_task_view]);

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

  useEffect(() => {
    if (!focusedTodoId) return;
    if (autoOpenedTodoIdRef.current === focusedTodoId) return;
    const target = todos.flatMap(todo => [todo, ...(todo.subtasks ?? [])]).find(todo => todo.id === focusedTodoId);
    if (!target) return;
    setView('list');
    setDetailTodo(target);
    setPendingScrollTarget(`todo-row-${target.id}`);
    autoOpenedTodoIdRef.current = focusedTodoId;
    onFocusedTodoConsumed?.();
  }, [focusedTodoId, onFocusedTodoConsumed, todos]);

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
    // detailTodo が開いていれば、自身または内包するサブタスクも更新
    setDetailTodo(prev => {
      if (!prev) return prev;
      if (prev.id === id) return { ...merged, subtasks: prev.subtasks };
      if ((prev.subtasks ?? []).some(subtask => subtask.id === id)) {
        return {
          ...prev,
          subtasks: (prev.subtasks ?? []).map(subtask => subtask.id === id ? { ...subtask, ...merged } : subtask),
        };
      }
      return prev;
    });
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
                <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full font-medium text-red-600 bg-red-50">
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
            <span className="text-[0.625rem]">{hideDone ? '✓' : '○'}</span>
            完了を隠す
          </button>

          <div className="w-px h-4 bg-slate-200" />

          {/* ステータス */}
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6875rem] font-medium" style={{ color: 'var(--text-muted)' }}>状態</span>
            {STATUS_ORDER.map(s => (
              <button key={s} onClick={() => toggleStatus(s)}
                className="text-[0.6875rem] px-2 py-0.5 rounded-full font-medium transition-colors"
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
            <span className="text-[0.6875rem] font-medium" style={{ color: 'var(--text-muted)' }}>優先度</span>
            {(['urgent', 'high', 'medium', 'low'] as TodoPriority[]).map(p => (
              <button key={p} onClick={() => togglePriority(p)}
                className="text-[0.6875rem] px-2 py-0.5 rounded-full font-medium transition-colors"
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
                <span className="text-[0.6875rem] font-medium" style={{ color: 'var(--text-muted)' }}>担当者</span>
                <select
                  className="text-[0.6875rem] rounded-lg px-2 py-0.5 border transition-colors"
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
              className="text-[0.6875rem] ml-auto px-2 py-0.5 rounded-lg transition-colors"
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
          onSubtaskStatusChange={(id, status) => updateTodo(id, { status })}
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
                <p className="text-[0.6875rem] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>表示単位</p>
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
                  <span className="text-[0.625rem]">{hideDone ? '✓' : '○'}</span>
                  完了を隠す
                </button>
              </div>

              {/* ステータス */}
              <div>
                <p className="text-[0.6875rem] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>ステータス</p>
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
                <p className="text-[0.6875rem] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>優先度</p>
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
                  <p className="text-[0.6875rem] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>担当者</p>
                  <select
                    className="w-full text-[0.6875rem] rounded-lg px-2 py-1.5 border transition-colors"
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
            <div className="px-4 py-3 border-t text-[0.625rem] leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
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

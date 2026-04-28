'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TodoStatus, TodoPriority } from '@/types';
import { TODO_STATUS_LABELS, TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

interface MyTodo {
  id: string;
  project_id: string;
  project_name: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string;
  start_date: string;
  phase_key: string;
}

interface MyTodosData {
  todos: MyTodo[];
  projects: Array<{ id: string; name: string }>;
}

const STATUS_OPTIONS: Array<{ v: TodoStatus | 'all'; l: string }> = [
  { v: 'all', l: 'すべて' },
  { v: 'todo', l: '未着手' },
  { v: 'in_progress', l: '進行中' },
  { v: 'done', l: '完了' },
];

const PRIORITY_OPTIONS: Array<{ v: TodoPriority | 'all'; l: string }> = [
  { v: 'all', l: 'すべて' },
  { v: 'urgent', l: '至急' },
  { v: 'high', l: '高' },
  { v: 'medium', l: '中' },
  { v: 'low', l: '低' },
];

const STATUS_COLORS: Record<TodoStatus, string> = {
  todo: 'text-slate-600 bg-slate-100',
  in_progress: 'text-blue-700 bg-blue-50',
  done: 'text-emerald-700 bg-emerald-50',
};

function formatDate(d: string) {
  if (!d) return '';
  return d.slice(0, 10);
}

function isOverdue(dueDate: string, status: TodoStatus) {
  if (!dueDate || status === 'done') return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function isDueToday(dueDate: string, status: TodoStatus) {
  if (!dueDate || status === 'done') return false;
  return dueDate === new Date().toISOString().slice(0, 10);
}

function TodoRow({ todo }: { todo: MyTodo }) {
  const overdue = isOverdue(todo.due_date, todo.status);
  const today = isDueToday(todo.due_date, todo.status);

  return (
    <Link
      href={withBasePath(`/projects/${todo.project_id}?tab=todos&todo=${encodeURIComponent(todo.id)}`)}
      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* ステータス */}
      <span className={`text-[0.6875rem] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[todo.status]}`}>
        {TODO_STATUS_LABELS[todo.status]}
      </span>

      {/* タイトル + プロジェクト名 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{todo.title}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {todo.project_name}
        </p>
      </div>

      {/* 優先度 */}
      <span
        className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
        style={{
          backgroundColor: `${TODO_PRIORITY_COLORS[todo.priority]}20`,
          color: TODO_PRIORITY_COLORS[todo.priority],
        }}
      >
        {TODO_PRIORITY_LABELS[todo.priority]}
      </span>

      {/* 期日 */}
      {todo.due_date ? (
        <span className={`text-xs font-medium shrink-0 ${overdue ? 'text-red-600' : today ? 'text-amber-600' : ''}`}
          style={!overdue && !today ? { color: 'var(--text-muted)' } : undefined}>
          {overdue && '期限切れ '}
          {today && '本日 '}
          {formatDate(todo.due_date)}
        </span>
      ) : (
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>期日なし</span>
      )}
    </Link>
  );
}

export default function MyTodosPage() {
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const [data, setData] = useState<MyTodosData | null>(null);
  const [statusFilter, setStatusFilter] = useState<TodoStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TodoPriority | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [groupByProject, setGroupByProject] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (projectFilter !== 'all') params.set('project_id', projectFilter);

    const res = await fetch(withBasePath(`/api/my-todos?${params}`));
    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    setData(await res.json() as MyTodosData);
  }, [router, statusFilter, priorityFilter, projectFilter]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const resolved = user ?? await checkSession();
      if (!resolved) { router.push(withBasePath('/login')); return; }
      load();
    })();
  }, [authLoading, user, load, router, checkSession]);

  // フィルター変更時に再取得
  useEffect(() => {
    if (data !== null) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, projectFilter]);

  if (authLoading || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div>
      </div>
    );
  }

  const { todos, projects } = data;
  const today = new Date().toISOString().slice(0, 10);
  const urgentCount = todos.filter(t => t.due_date && t.due_date <= today && t.status !== 'done').length;
  const openCount = todos.filter(t => t.status !== 'done').length;

  // グループ化
  type Group = { label: string; todos: MyTodo[] };
  let groups: Group[] = [];

  if (groupByProject) {
    const map = new Map<string, Group>();
    for (const todo of todos) {
      if (!map.has(todo.project_id)) {
        map.set(todo.project_id, { label: todo.project_name, todos: [] });
      }
      map.get(todo.project_id)!.todos.push(todo);
    }
    groups = Array.from(map.values());
  } else {
    // 期日グループ
    const overdue: MyTodo[] = [];
    const todayList: MyTodo[] = [];
    const upcoming: MyTodo[] = [];
    const noDue: MyTodo[] = [];

    for (const todo of todos) {
      if (!todo.due_date) { noDue.push(todo); continue; }
      if (todo.due_date < today) { overdue.push(todo); continue; }
      if (todo.due_date === today) { todayList.push(todo); continue; }
      upcoming.push(todo);
    }
    if (overdue.length) groups.push({ label: '期限切れ', todos: overdue });
    if (todayList.length) groups.push({ label: '本日期限', todos: todayList });
    if (upcoming.length) groups.push({ label: '今後の期限', todos: upcoming });
    if (noDue.length) groups.push({ label: '期日なし', todos: noDue });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="card mb-6 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-cyan-50 via-white to-slate-50 flex items-center justify-between">
          <div>
            <p className="section-title mb-1">My Tasks</p>
            <h1 className="text-2xl font-bold tracking-tight">自分のタスク</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              全プロジェクト横断 · 未完了 {openCount} 件
              {urgentCount > 0 && <span className="ml-2 text-red-600 font-medium">うち期限超過 {urgentCount} 件</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupByProject(v => !v)}
              className={`btn-secondary text-xs ${groupByProject ? 'bg-cyan-50' : ''}`}
            >
              {groupByProject ? 'プロジェクト別' : '期日順'}
            </button>
          </div>
        </div>
      </div>

      {/* フィルター */}
      <div className="card mb-5 p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>ステータス</span>
          {STATUS_OPTIONS.map(o => (
            <button key={o.v} onClick={() => setStatusFilter(o.v as TodoStatus | 'all')}
              className={`tab-btn text-xs py-1 ${statusFilter === o.v ? 'active' : ''}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>優先度</span>
          {PRIORITY_OPTIONS.map(o => (
            <button key={o.v} onClick={() => setPriorityFilter(o.v as TodoPriority | 'all')}
              className={`tab-btn text-xs py-1 ${priorityFilter === o.v ? 'active' : ''}`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>プロジェクト</span>
          <select
            className="field-input text-xs py-1"
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
          >
            <option value="all">すべて</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Todo一覧 */}
      {groups.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-3xl mb-3">✓</p>
          <p className="text-sm">該当するタスクがありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.label} className="card overflow-hidden">
              <div className="px-4 py-2.5 border-b flex items-center gap-2"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-secondary)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {group.label}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {group.todos.length}
                </span>
              </div>
              <div>
                {group.todos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

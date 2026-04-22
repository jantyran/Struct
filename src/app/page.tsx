'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { Project, ProjectType, CloneOptions, ProjectTypeDefinition, CustomField, TodoPriority, TodoStatus } from '@/types';
import { TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS, TODO_STATUS_LABELS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

// ──────────────────────────────────────────
// 型
// ──────────────────────────────────────────
interface ProjectWithTodos extends Project {
  todo_total: number;
  todo_done: number;
}

interface DashboardTodo {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
}

interface DashboardData {
  projects: ProjectWithTodos[];
  my_open_todos: DashboardTodo[];
  managed_urgent_todos: DashboardTodo[];
  this_week_todos: DashboardTodo[];
  stale_projects: ProjectWithTodos[];
  project_type_definitions: ProjectTypeDefinition[];
  stats: {
    total: number;
    active: number;
    draft: number;
    my_todo_open: number;
    my_todo_urgent: number;
  };
}

// ──────────────────────────────────────────
// 新規プロジェクトモーダル
// ──────────────────────────────────────────
function NewProjectModal({
  projectTypes,
  onClose,
  onCreated,
}: {
  projectTypes: ProjectTypeDefinition[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>(projectTypes[0]?.key || 'campaign');
  const [loading, setLoading] = useState(false);
  const selectedType = projectTypes.find(d => d.key === type) || projectTypes[0];

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    const customFields: CustomField[] = (selectedType?.field_templates || []).map((field, index) => ({
      id: uuidv4(),
      project_id: '',
      template_id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      value: '',
      options: field.options || '{}',
      layout: field.layout === 'full' ? 'full' : 'half',
      inherited: 0,
      inherited_from: null,
      crawled_content: null,
      sort_order: index,
      is_builtin: field.is_builtin ? 1 : 0,
      section: field.section ?? '',
    }));
    const res = await fetch(withBasePath('/api/projects'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, phase_key: selectedType?.phases[0]?.key || '', custom_fields: customFields }),
    });
    const data = await res.json() as { id: string };
    setLoading(false);
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/10 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-5">新規プロジェクト</h2>
        <div className="space-y-4">
          <div>
            <label className="field-label">プロジェクト名 *</label>
            <input className="field-input" value={name} onChange={e => setName(e.target.value)} placeholder="例: 春の新製品キャンペーン 2026" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>
          <div>
            <label className="field-label">種別</label>
            <select className="field-input" value={type} onChange={e => setType(e.target.value as ProjectType)}>
              {projectTypes.map(d => <option key={d.id} value={d.key}>{d.name}</option>)}
            </select>
          </div>
          {selectedType && (
            <div className="text-xs leading-6" style={{ color: 'var(--text-muted)' }}>
              <p>初期フェーズ: {selectedType.phases.map(p => p.name).join(' / ') || 'なし'}</p>
              <p>初期項目: {selectedType.field_templates.map(f => f.label).join(' / ') || 'なし'}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={handleCreate} disabled={!name.trim() || loading} className="btn-primary flex-1">
            {loading ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// クローンモーダル
// ──────────────────────────────────────────
function CloneModal({ source, onClose, onCloned }: {
  source: Project;
  onClose: () => void;
  onCloned: (id: string) => void;
}) {
  const [options, setOptions] = useState<CloneOptions>({ new_name: `${source.name} (コピー)`, include_values: true });
  const [loading, setLoading] = useState(false);

  async function handleClone() {
    setLoading(true);
    const res = await fetch(withBasePath(`/api/projects/${source.id}/clone`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
    const data = await res.json() as { id: string };
    setLoading(false);
    onCloned(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/10 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1">プロジェクトをクローン</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>複製元: {source.name}</p>
        <div className="space-y-4">
          <div>
            <label className="field-label">新しいプロジェクト名 *</label>
            <input className="field-input" value={options.new_name} onChange={e => setOptions(o => ({ ...o, new_name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">複製モード</label>
            <div className="space-y-2 mt-1">
              {[
                { v: false, label: 'フィールド定義のみ', desc: '構造をコピーし、値はすべてリセット' },
                { v: true, label: '定義 + 入力値', desc: '値も引き継ぎ、継承フラグを付与（要確認）' },
              ].map(opt => (
                <label key={String(opt.v)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${options.include_values === opt.v ? 'bg-cyan-50' : 'bg-white/70'}`}
                  style={{ borderColor: options.include_values === opt.v ? 'rgba(15,154,177,0.35)' : 'var(--border)' }}
                >
                  <input type="radio" className="mt-0.5" checked={options.include_values === opt.v} onChange={() => setOptions(o => ({ ...o, include_values: opt.v }))} />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">キャンセル</button>
          <button onClick={handleClone} disabled={!options.new_name.trim() || loading} className="btn-primary flex-1">
            {loading ? '複製中...' : 'クローン'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// フェーズ進捗バー
// ──────────────────────────────────────────
function PhaseProgressBar({ phaseKey, phases }: { phaseKey: string; phases: { key: string; name: string }[] }) {
  if (!phases.length) return null;
  const idx = phases.findIndex(p => p.key === phaseKey);
  const progress = idx >= 0 ? (idx + 1) / phases.length : 0;

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>
          {idx >= 0 ? phases[idx].name : '—'}
        </span>
        <span className="text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>
          {idx >= 0 ? `${idx + 1} / ${phases.length}` : `— / ${phases.length}`}
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, backgroundColor: 'var(--accent)' }} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// プロジェクトカード
// ──────────────────────────────────────────
function ProjectCard({ project, typeLabel, phases, onClone }: {
  project: ProjectWithTodos;
  typeLabel: string;
  phases: { key: string; name: string }[];
  onClone: (p: Project) => void;
}) {
  const statusColors: Record<string, string> = { draft: 'text-slate-600 bg-slate-100', active: 'text-emerald-700 bg-emerald-50', archived: 'text-slate-500 bg-slate-100' };
  const statusLabels: Record<string, string> = { draft: '下書き', active: 'アクティブ', archived: 'アーカイブ' };
  const typeColors: Record<string, string> = { event: 'text-sky-700', campaign: 'text-cyan-700', content: 'text-amber-700', other: 'text-slate-500' };
  const todoOpen = project.todo_total - project.todo_done;

  return (
    <Link href={withBasePath(`/projects/${project.id}`)} className="card card-link flex flex-col">
      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[0.6875rem] font-semibold uppercase tracking-wide ${typeColors[project.type] ?? 'text-slate-500'}`}>{typeLabel}</span>
          <span className={`text-[0.6875rem] px-2 py-0.5 rounded-full shrink-0 font-medium ${statusColors[project.status] ?? statusColors.draft}`}>
            {statusLabels[project.status] ?? project.status}
          </span>
        </div>
        <h3 className="font-semibold text-sm leading-snug">{project.name}</h3>
        {project.target && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{project.target}</p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-1">
          {project.start_date && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {project.start_date}{project.end_date && ` 〜 ${project.end_date}`}
            </p>
          )}
          {project.cloned_from && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⬡ クローン</p>}
        </div>
        <PhaseProgressBar phaseKey={project.phase_key} phases={phases} />
      </div>
      {project.todo_total > 0 && (
        <div className="px-5 pb-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>タスク進捗</span>
            <span className="text-[0.625rem] font-medium" style={{ color: 'var(--text-muted)' }}>
              {project.todo_done} / {project.todo_total} 完了
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((project.todo_done / project.todo_total) * 100)}%`,
                backgroundColor: project.todo_done === project.todo_total ? '#10b981' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}
      <div className="flex gap-2 px-4 pb-4 pt-2 border-t items-center" style={{ borderColor: 'var(--border)' }}>
        <span className="btn-primary text-xs flex-1 justify-center py-1.5">開く →</span>
        <button onClick={e => { e.preventDefault(); onClone(project); }} className="btn-secondary text-xs px-3 py-1.5">
          クローン
        </button>
      </div>
    </Link>
  );
}

// ──────────────────────────────────────────
// サイドバー: Todoカード1行
// ──────────────────────────────────────────
function SidebarTodoRow({ todo, showAssignee }: { todo: DashboardTodo; showAssignee?: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = todo.due_date && todo.due_date < today && todo.status !== 'done';
  const dueToday = todo.due_date === today && todo.status !== 'done';
  const assigneeLabel = todo.assignee_name?.trim() || todo.assignee_email || null;

  return (
    <Link
      href={withBasePath(`/projects/${todo.project_id}?tab=todos`)}
      className="flex items-start gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors border-b last:border-0 group"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[0.6875rem] truncate" style={{ color: 'var(--text-muted)' }}>{todo.project_name}</p>
        <p className="text-xs font-medium truncate leading-snug mt-0.5">{todo.title}</p>
        {showAssignee && assigneeLabel && (
          <p className="text-[0.6875rem] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{assigneeLabel}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[0.625rem] px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${TODO_PRIORITY_COLORS[todo.priority]}20`, color: TODO_PRIORITY_COLORS[todo.priority] }}>
          {TODO_PRIORITY_LABELS[todo.priority]}
        </span>
        {todo.due_date && (
          <span className={`text-[0.625rem] font-medium ${overdue ? 'text-red-500' : dueToday ? 'text-amber-500' : ''}`}
            style={!overdue && !dueToday ? { color: 'var(--text-muted)' } : undefined}>
            {overdue ? '期限切れ' : dueToday ? '本日' : todo.due_date.slice(5)}
          </span>
        )}
      </div>
    </Link>
  );
}

// ──────────────────────────────────────────
// サイドバーパネル
// ──────────────────────────────────────────
function SidebarPanel({ myTodos, managedUrgentTodos, thisWeekTodos, staleProjects, myOpenCount, myUrgentCount }: {
  myTodos: DashboardTodo[];
  managedUrgentTodos: DashboardTodo[];
  thisWeekTodos: DashboardTodo[];
  staleProjects: ProjectWithTodos[];
  myOpenCount: number;
  myUrgentCount: number;
}) {
  return (
    <div className="flex flex-col gap-4 w-80 shrink-0">
      {/* 自分のタスク */}
      <div className="card overflow-hidden">
        <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-secondary)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>自分のタスク</span>
          {myOpenCount > 0 && (
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700">{myOpenCount}</span>
          )}
          {myUrgentCount > 0 && (
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600 ml-auto">⚠ {myUrgentCount}</span>
          )}
        </div>

        {myTodos.length === 0 ? (
          <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            アサインされたタスクなし
          </div>
        ) : (
          <div>
            {myTodos.map(t => (
              <SidebarTodoRow key={t.id} todo={t} />
            ))}
          </div>
        )}

        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link href={withBasePath('/my-todos')} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
            すべて見る →
          </Link>
        </div>
      </div>

      {/* 今週期限のタスク */}
      {thisWeekTodos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(245,158,11,0.04)' }}>
            <span className="text-xs">📅</span>
            <span className="text-xs font-semibold text-amber-700">今後7日以内の期限</span>
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 ml-auto">
              {thisWeekTodos.length}
            </span>
          </div>
          <div>
            {thisWeekTodos.map(t => (
              <SidebarTodoRow key={t.id} todo={t} />
            ))}
          </div>
        </div>
      )}

      {/* 管理プロジェクトの急ぎタスク */}
      {managedUrgentTodos.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(239,68,68,0.04)' }}>
            <span className="text-xs">⚠</span>
            <span className="text-xs font-semibold text-red-700">管理プロジェクトの急ぎタスク</span>
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600 ml-auto">
              {managedUrgentTodos.length}
            </span>
          </div>
          <div>
            {managedUrgentTodos.map(t => (
              <SidebarTodoRow key={t.id} todo={t} showAssignee />
            ))}
          </div>
        </div>
      )}

      {/* 更新が止まったプロジェクト */}
      {staleProjects.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(100,116,139,0.04)' }}>
            <span className="text-xs">💤</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>14日以上更新なし</span>
            <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500 ml-auto">
              {staleProjects.length}
            </span>
          </div>
          <div>
            {staleProjects.map(p => (
              <Link
                key={p.id}
                href={withBasePath(`/projects/${p.id}`)}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[0.6875rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    最終更新: {p.updated_at ? p.updated_at.slice(0, 10) : '—'}
                  </p>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// ダッシュボード本体
// ──────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [cloneSource, setCloneSource] = useState<Project | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(withBasePath('/api/dashboard'));
    if (res.status === 401) { router.push(withBasePath('/login')); return; }
    setData(await res.json() as DashboardData);
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const resolved = user ?? await checkSession();
      if (!resolved) { router.push(withBasePath('/login')); return; }
      load();
    })();
  }, [authLoading, user, load, router, checkSession]);

  if (authLoading || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div>
      </div>
    );
  }

  const { projects, my_open_todos, managed_urgent_todos, this_week_todos, stale_projects, project_type_definitions, stats } = data;
  const filtered = filter === 'archived'
    ? projects.filter(p => p.status === 'archived')
    : filter === 'all'
      ? projects.filter(p => p.status !== 'archived')
      : projects.filter(p => p.status !== 'archived' && (p.status === filter || p.type === filter));
  const typeLabelMap = Object.fromEntries(project_type_definitions.map(d => [d.key, d.name]));
  const phaseMap = Object.fromEntries(project_type_definitions.map(d => [d.key, d.phases]));

  const archivedCount = projects.filter(p => p.status === 'archived').length;
  const selectedTypeDef = project_type_definitions.find(d => d.key === filter);
  const filterChips = [
    { v: 'all', l: 'すべて' },
    { v: 'active', l: 'アクティブ' },
    { v: 'draft', l: '下書き' },
    ...(archivedCount > 0 ? [{ v: 'archived', l: `アーカイブ (${archivedCount})` }] : []),
  ];

  const statCards = [
    { label: '総プロジェクト', value: stats.total, color: 'text-cyan-700', accent: 'border-l-cyan-400' },
    { label: 'アクティブ', value: stats.active, color: 'text-emerald-700', accent: 'border-l-emerald-400' },
    { label: '下書き', value: stats.draft, color: 'text-slate-500', accent: 'border-l-slate-300' },
    {
      label: '自分のタスク（未完了）',
      value: stats.my_todo_open,
      color: stats.my_todo_urgent > 0 ? 'text-red-600' : 'text-amber-700',
      accent: stats.my_todo_urgent > 0 ? 'border-l-red-400' : 'border-l-amber-400',
      sub: stats.my_todo_urgent > 0 ? `うち ${stats.my_todo_urgent} 件が期限超過` : undefined,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-r from-cyan-50 via-white to-amber-50">
          <div>
            <p className="section-title mb-2">Workspace Overview</p>
            <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>プロジェクトと施策の情報を構造化して管理する</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">+ 新規プロジェクト</button>
        </div>
      </div>

      {/* サマリー統計 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className={`card p-4 border-l-4 ${s.accent}`}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className={`text-2xl font-bold mt-1.5 ${s.color}`}>{s.value}</p>
            {s.sub && <p className="text-xs mt-1 text-red-500">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* メインコンテンツ: プロジェクト一覧 + サイドバー */}
      <div className="flex gap-5 items-start">
        {/* 左: プロジェクト一覧 */}
        <div className="flex-1 min-w-0">
          {/* フィルター */}
          <div className="flex flex-wrap gap-2 mb-4">
            {filterChips.map(f => (
              <button key={f.v} onClick={() => { setFilter(f.v); setTypeDropdownOpen(false); }} className={`tab-btn${filter === f.v ? ' active' : ''}`}>
                {f.l}
              </button>
            ))}

            {/* タイプ別ドロップダウン */}
            {project_type_definitions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setTypeDropdownOpen(v => !v)}
                  className={`tab-btn${selectedTypeDef ? ' active' : ''}`}
                >
                  {selectedTypeDef ? selectedTypeDef.name : 'PJカテゴリ'} ▾
                </button>
                {typeDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTypeDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-20 card py-1 min-w-[140px] shadow-lg">
                      {selectedTypeDef && (
                        <button
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[rgba(15,154,177,0.06)] transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => { setFilter('all'); setTypeDropdownOpen(false); }}
                        >
                          絞り込みを解除
                        </button>
                      )}
                      {project_type_definitions.map(d => (
                        <button
                          key={d.key}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[rgba(15,154,177,0.06)] transition-colors"
                          style={{ color: filter === d.key ? 'var(--accent)' : 'var(--text-primary)', fontWeight: filter === d.key ? 600 : undefined }}
                          onClick={() => { setFilter(d.key); setTypeDropdownOpen(false); }}
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
              <p className="text-4xl mb-3" style={{ color: 'var(--accent)' }}>⬡</p>
              <p className="text-sm">プロジェクトがまだありません</p>
              <button onClick={() => setShowNew(true)} className="btn-primary mt-4">最初のプロジェクトを作成</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  typeLabel={typeLabelMap[p.type] || p.type}
                  phases={phaseMap[p.type] || []}
                  onClone={setCloneSource}
                />
              ))}
            </div>
          )}
        </div>

        {/* 右: サイドバー */}
        <SidebarPanel
          myTodos={my_open_todos}
          managedUrgentTodos={managed_urgent_todos}
          thisWeekTodos={this_week_todos}
          staleProjects={stale_projects}
          myOpenCount={stats.my_todo_open}
          myUrgentCount={stats.my_todo_urgent}
        />
      </div>

      {showNew && (
        <NewProjectModal
          projectTypes={project_type_definitions}
          onClose={() => setShowNew(false)}
          onCreated={id => { setShowNew(false); router.push(withBasePath(`/projects/${id}`)); }}
        />
      )}
      {cloneSource && (
        <CloneModal
          source={cloneSource}
          onClose={() => setCloneSource(null)}
          onCloned={id => { setCloneSource(null); router.push(withBasePath(`/projects/${id}`)); }}
        />
      )}
    </div>
  );
}

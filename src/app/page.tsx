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
    completed: number;
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
  const [options, setOptions] = useState<CloneOptions>({
    new_name: `${source.name} (コピー)`,
    include_values: false,
    include_todos: true,
    include_sheets: true,
    include_contacts: true,
    include_notes: false,
  });
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
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
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
                { v: false, label: '再実施用テンプレート', desc: '値・担当・日付・完了状態はリセット' },
                { v: true, label: '入力値も含める', desc: '値・行データ・Todo状態・日付も引き継ぐ' },
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
          <div>
            <label className="field-label">複製する内容</label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {[
                { key: 'include_todos' as const, label: 'Todo / サブタスク', desc: options.include_values ? '状態・担当・日付も含める' : 'タイトル・説明・優先度・フェーズだけコピー' },
                { key: 'include_sheets' as const, label: 'シート', desc: options.include_values ? '列と行データをコピー' : 'シート名と列構造だけコピー' },
                { key: 'include_contacts' as const, label: '関係者', desc: '名前・メール・電話・会社名をコピー' },
                { key: 'include_notes' as const, label: 'ノート', desc: options.include_values ? '本文もコピー' : 'タイトルだけコピー' },
              ].map(item => (
                <label key={item.key} className="flex items-start gap-3 rounded-xl border bg-white/70 p-3 cursor-pointer" style={{ borderColor: 'var(--border)' }}>
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-cyan-600"
                    checked={Boolean(options[item.key])}
                    onChange={(event) => setOptions((current) => ({ ...current, [item.key]: event.target.checked }))}
                  />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</span>
                  </span>
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
  const router = useRouter();
  const detailHref = withBasePath(`/projects/${project.id}`);
  const statusColors: Record<string, string> = { draft: 'text-slate-600 bg-slate-100', active: 'text-emerald-700 bg-emerald-50', completed: 'text-emerald-700 bg-emerald-50', archived: 'text-slate-500 bg-slate-100' };
  const statusLabels: Record<string, string> = { draft: '下書き', active: 'アクティブ', completed: '完了', archived: 'アーカイブ' };
  const typeColors: Record<string, string> = { event: 'text-sky-700', campaign: 'text-cyan-700', content: 'text-amber-700', other: 'text-slate-500' };
  const todoOpen = project.todo_total - project.todo_done;

  return (
    <Link
      href={detailHref}
      prefetch={false}
      onPointerEnter={() => router.prefetch(detailHref)}
      onMouseEnter={() => router.prefetch(detailHref)}
      onFocus={() => router.prefetch(detailHref)}
      className="card card-link flex flex-col"
    >
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
  const router = useRouter();
  const detailHref = withBasePath(`/projects/${todo.project_id}?tab=todos&todo=${encodeURIComponent(todo.id)}`);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = todo.due_date && todo.due_date < today && todo.status !== 'done';
  const dueToday = todo.due_date === today && todo.status !== 'done';
  const assigneeLabel = todo.assignee_name?.trim() || todo.assignee_email || null;

  return (
    <Link
      href={detailHref}
      prefetch={false}
      onPointerEnter={() => router.prefetch(detailHref)}
      onMouseEnter={() => router.prefetch(detailHref)}
      onFocus={() => router.prefetch(detailHref)}
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
    <div className="flex flex-col gap-4 w-full lg:w-80 lg:shrink-0">
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
                prefetch={false}
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
// テーブルビュー
// ──────────────────────────────────────────
type SortKey = 'name' | 'type' | 'status' | 'phase' | 'updated_at' | 'todo';
function ProjectTableView({ projects, typeLabelMap, phaseMap, onClone }: {
  projects: ProjectWithTodos[];
  typeLabelMap: Record<string, string>;
  phaseMap: Record<string, { key: string; name: string }[]>;
  onClone: (p: Project) => void;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...projects].sort((a, b) => {
    let va: string | number = '', vb: string | number = '';
    if (sortKey === 'name') { va = a.name; vb = b.name; }
    else if (sortKey === 'type') { va = typeLabelMap[a.type] || a.type; vb = typeLabelMap[b.type] || b.type; }
    else if (sortKey === 'status') { va = a.status; vb = b.status; }
    else if (sortKey === 'phase') { va = a.phase_key; vb = b.phase_key; }
    else if (sortKey === 'updated_at') { va = a.updated_at || ''; vb = b.updated_at || ''; }
    else if (sortKey === 'todo') { va = a.todo_done / (a.todo_total || 1); vb = b.todo_done / (b.todo_total || 1); }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const statusLabels: Record<string, string> = { draft: '下書き', active: 'アクティブ', completed: '完了', archived: 'アーカイブ' };
  const statusColors: Record<string, { color: string; bg: string }> = {
    draft: { color: '#475569', bg: '#f1f5f9' },
    active: { color: '#047857', bg: '#ecfdf5' },
    completed: { color: '#047857', bg: '#ecfdf5' },
    archived: { color: '#64748b', bg: '#f1f5f9' },
  };

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>↕</span>;
    return <span style={{ color: 'var(--accent)' }}>{sortAsc ? '↑' : '↓'}</span>;
  }

  const thStyle = (k: SortKey): React.CSSProperties => ({
    padding: '8px 12px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 600,
    color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    background: sortKey === k ? 'rgba(15,154,177,0.04)' : 'transparent',
  });

  return (
    <div className="card overflow-hidden">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              {([
                ['name', 'プロジェクト名'],
                ['type', '種別'],
                ['status', 'ステータス'],
                ['phase', 'フェーズ'],
                ['todo', 'Todo'],
                ['updated_at', '最終更新'],
              ] as [SortKey, string][]).map(([k, label]) => (
                <th key={k} style={thStyle(k)} onClick={() => toggleSort(k)}>
                  {label} <SortIcon k={k} />
                </th>
              ))}
              <th style={{ ...thStyle('name'), cursor: 'default' }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const detailHref = withBasePath(`/projects/${p.id}`);
              const phases = phaseMap[p.type] || [];
              const phaseLabel = phases.find(ph => ph.key === p.phase_key)?.name || p.phase_key || '—';
              const sc = statusColors[p.status] ?? statusColors.draft;
              const todoOpen = p.todo_total - p.todo_done;
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(detailHref)}
                  style={{
                    cursor: 'pointer',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(248,252,255,0.6)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => {
                    router.prefetch(detailHref);
                    e.currentTarget.style.background = 'rgba(15,154,177,0.05)';
                  }}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(248,252,255,0.6)')}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 600, maxWidth: 280, minWidth: 160 }}>
                    <span className="truncate block">{p.name}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {typeLabelMap[p.type] || p.type}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 999, fontWeight: 500, color: sc.color, background: sc.bg }}>
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{phaseLabel}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {p.todo_total > 0 ? (
                      <span style={{ color: todoOpen > 0 ? 'var(--text-secondary)' : 'var(--success)', fontSize: '0.75rem' }}>
                        {p.todo_done}/{p.todo_total}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {p.updated_at ? p.updated_at.slice(0, 10) : '—'}
                  </td>
                  <td style={{ padding: '6px 12px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onClone(p)}
                      title="クローン"
                      className="rounded-lg p-1.5 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  const isWideScreen = () => typeof window !== 'undefined' && window.innerWidth >= 1280;
  const [showAllProjects, setShowAllProjects] = useState(() => isWideScreen());
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    if (typeof window === 'undefined') return 'card';
    return (localStorage.getItem('dashboard_view') as 'card' | 'table') || 'card';
  });

  function switchView(mode: 'card' | 'table') {
    setViewMode(mode);
    localStorage.setItem('dashboard_view', mode);
  }

  const redirectToAuth = useCallback(async () => {
    try {
      const res = await fetch(withBasePath('/api/auth/setup-status'), { cache: 'no-store' });
      const setup = await res.json() as { env_configured?: boolean; needs_initial_setup?: boolean };
      if (setup.env_configured === false) {
        router.push(withBasePath('/setup/env'));
        return;
      }
      router.push(withBasePath(setup.needs_initial_setup ? '/signup' : '/login'));
    } catch {
      router.push(withBasePath('/login'));
    }
  }, [router]);

  const load = useCallback(async () => {
    const res = await fetch(withBasePath('/api/dashboard'));
    if (res.status === 401) { redirectToAuth(); return; }
    setData(await res.json() as DashboardData);
  }, [redirectToAuth]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const resolved = user ?? await checkSession();
      if (!resolved) { redirectToAuth(); return; }
      load();
    })();
  }, [authLoading, user, load, redirectToAuth, checkSession]);

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
    { v: 'completed', l: '完了' },
    ...(archivedCount > 0 ? [{ v: 'archived', l: `アーカイブ (${archivedCount})` }] : []),
  ];

  // アクティブプロジェクトのタスク完了率
  const activePjs = projects.filter(p => p.status === 'active');
  const activeTotalTasks = activePjs.reduce((s, p) => s + p.todo_total, 0);
  const activeDoneTasks = activePjs.reduce((s, p) => s + p.todo_done, 0);
  const completionRate = activeTotalTasks > 0 ? Math.round((activeDoneTasks / activeTotalTasks) * 100) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー + サマリー統計を一体化したカード */}
      <div className="card mb-5 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 bg-gradient-to-r from-cyan-50 via-white to-amber-50 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>プロジェクトと施策の情報を構造化して管理する</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary w-full sm:w-auto">+ 新規プロジェクト</button>
        </div>

        {/* サマリー統計 — 4列1行 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0" style={{ borderColor: 'var(--border)' }}>
          {/* プロジェクト */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>プロジェクト</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-bold text-cyan-700">{stats.active}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>活動中</span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              下書き {stats.draft} · 完了 {stats.completed} · 計 {stats.total}
            </p>
          </div>

          {/* 自分のタスク */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>自分のタスク</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className={`text-2xl font-bold ${stats.my_todo_urgent > 0 ? 'text-amber-700' : 'text-amber-700'}`}>{stats.my_todo_open}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>未完了</span>
            </div>
            {stats.my_todo_urgent > 0
              ? <p className="text-xs mt-1 text-red-500 font-medium">期限超過 {stats.my_todo_urgent} 件</p>
              : <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>期限超過なし</p>
            }
          </div>

          {/* 今週の期限 */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>今週の期限</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className={`text-2xl font-bold ${this_week_todos.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{this_week_todos.length}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>件</span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>7日以内に期限のタスク</p>
          </div>

          {/* チームの急ぎ / タスク完了率 */}
          <div className="px-5 py-4">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>チームの急ぎ</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className={`text-2xl font-bold ${managed_urgent_todos.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{managed_urgent_todos.length}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>件</span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              管理PJの期限超過
              {completionRate !== null && (
                <span className="ml-2 font-medium" style={{ color: 'var(--accent)' }}>完了率 {completionRate}%</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* メインコンテンツ: プロジェクト一覧 + サイドバー */}
      <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-start">
        {/* 左: プロジェクト一覧 */}
        <div className="flex-1 min-w-0">
          {/* フィルター + ビュー切り替え */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex flex-wrap gap-2 flex-1">
              {filterChips.map(f => (
                <button key={f.v} onClick={() => { setFilter(f.v); setTypeDropdownOpen(false); setShowAllProjects(isWideScreen()); }} className={`tab-btn${filter === f.v ? ' active' : ''}`}>
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
                            onClick={() => { setFilter('all'); setTypeDropdownOpen(false); setShowAllProjects(isWideScreen()); }}
                          >
                            絞り込みを解除
                          </button>
                        )}
                        {project_type_definitions.map(d => (
                          <button
                            key={d.key}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-[rgba(15,154,177,0.06)] transition-colors"
                            style={{ color: filter === d.key ? 'var(--accent)' : 'var(--text-primary)', fontWeight: filter === d.key ? 600 : undefined }}
                            onClick={() => { setFilter(d.key); setTypeDropdownOpen(false); setShowAllProjects(isWideScreen()); }}
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

            {/* カード / テーブル切り替え */}
            <div className="flex items-center gap-1 p-1 rounded-lg shrink-0" style={{ background: 'rgba(200,215,222,0.3)' }}>
              <button
                onClick={() => switchView('card')}
                title="カードビュー"
                className="rounded-md p-1.5 transition-colors"
                style={{ background: viewMode === 'card' ? 'white' : 'transparent', boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: viewMode === 'card' ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              </button>
              <button
                onClick={() => switchView('table')}
                title="テーブルビュー"
                className="rounded-md p-1.5 transition-colors"
                style={{ background: viewMode === 'table' ? 'white' : 'transparent', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', color: viewMode === 'table' ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
              <p className="text-4xl mb-3" style={{ color: 'var(--accent)' }}>⬡</p>
              <p className="text-sm">プロジェクトがまだありません</p>
              <button onClick={() => setShowNew(true)} className="btn-primary mt-4">最初のプロジェクトを作成</button>
            </div>
          ) : viewMode === 'table' ? (
            <ProjectTableView
              projects={filtered}
              typeLabelMap={typeLabelMap}
              phaseMap={phaseMap}
              onClone={setCloneSource}
            />
          ) : (() => {
            const PANEL_LIMIT = 4;
            const displayedProjects = showAllProjects ? filtered : filtered.slice(0, PANEL_LIMIT);
            const hiddenCount = filtered.length - PANEL_LIMIT;
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayedProjects.map(p => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      typeLabel={typeLabelMap[p.type] || p.type}
                      phases={phaseMap[p.type] || []}
                      onClone={setCloneSource}
                    />
                  ))}
                </div>
                {!showAllProjects && hiddenCount > 0 && (
                  <button
                    onClick={() => setShowAllProjects(true)}
                    className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      border: '1px dashed var(--border)',
                      color: 'var(--accent)',
                      background: 'rgba(15,154,177,0.03)',
                    }}
                  >
                    さらに {hiddenCount} 件のプロジェクトを表示
                  </button>
                )}
                {showAllProjects && filtered.length > PANEL_LIMIT && !isWideScreen() && (
                  <button
                    onClick={() => setShowAllProjects(isWideScreen())}
                    className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      border: '1px dashed var(--border)',
                      color: 'var(--text-muted)',
                      background: 'transparent',
                    }}
                  >
                    折りたたむ
                  </button>
                )}
              </>
            );
          })()}
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

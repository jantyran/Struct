'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { Project, ProjectType, CloneOptions, ProjectTypeDefinition, CustomField } from '@/types';
import { PROJECT_TYPE_LABELS } from '@/types';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

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

  const selectedType = projectTypes.find((definition) => definition.key === type) || projectTypes[0];

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
      body: JSON.stringify({
        name,
        type,
        phase_key: selectedType?.phases[0]?.key || '',
        custom_fields: customFields,
      }),
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
              {projectTypes.map((definition) => <option key={definition.id} value={definition.key}>{definition.name}</option>)}
            </select>
          </div>
          {selectedType && (
            <div className="text-xs leading-6" style={{ color: 'var(--text-muted)' }}>
              <p>初期フェーズ: {selectedType.phases.map((phase) => phase.name).join(' / ') || 'なし'}</p>
              <p>初期項目: {selectedType.field_templates.map((field) => field.label).join(' / ') || 'なし'}</p>
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

function CloneModal({ source, projects, onClose, onCloned }: {
  source: Project;
  projects: Project[];
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
                <label
                  key={String(opt.v)}
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

function ProjectCard({
  project,
  typeLabel,
  onClone,
}: {
  project: Project;
  typeLabel: string;
  onClone: (p: Project) => void;
}) {
  const channels = (() => { try { return JSON.parse(project.channels ?? '[]') as string[]; } catch { return []; } })();
  const statusColors: Record<string, string> = { draft: 'text-slate-600 bg-slate-100', active: 'text-emerald-700 bg-emerald-50', archived: 'text-slate-500 bg-slate-100' };
  const statusLabels: Record<string, string> = { draft: '下書き', active: 'アクティブ', archived: 'アーカイブ' };
  const typeColors: Record<string, string> = { event: 'text-sky-700', campaign: 'text-cyan-700', content: 'text-amber-700', other: 'text-slate-500' };

  return (
    <Link
      href={withBasePath(`/projects/${project.id}`)}
      className="card card-link flex flex-col"
    >
      {/* カード本文 */}
      <div className="p-5 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wide ${typeColors[project.type] ?? 'text-slate-500'}`}>
            {typeLabel}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 font-medium ${statusColors[project.status] ?? statusColors.draft}`}>
            {statusLabels[project.status] ?? project.status}
          </span>
        </div>

        <h3 className="font-semibold text-sm leading-snug">{project.name}</h3>

        {project.target && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {project.target}
          </p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-auto pt-1">
          {project.start_date && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {project.start_date}{project.end_date && ` 〜 ${project.end_date}`}
            </p>
          )}
          {project.cloned_from && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⬡ クローン</p>
          )}
        </div>
      </div>

      {/* フッター */}
      <div className="flex gap-2 px-4 pb-4 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="btn-primary text-xs flex-1 justify-center py-1.5">
          開く →
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onClone(project); }}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          クローン
        </button>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeDefinition[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [cloneSource, setCloneSource] = useState<Project | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    const [projectsRes, projectTypesRes] = await Promise.all([
      fetch(withBasePath('/api/projects')),
      fetch(withBasePath('/api/project-types')),
    ]);
    const [projectsData, projectTypesData] = await Promise.all([projectsRes.json(), projectTypesRes.json()]);

    if (projectsRes.status === 401) {
      setProjects([]);
      router.push(withBasePath('/login'));
      return;
    }

    setProjects(Array.isArray(projectsData) ? projectsData as Project[] : []);
    setProjectTypes(Array.isArray(projectTypesData.project_types) ? projectTypesData.project_types as ProjectTypeDefinition[] : []);
  }, [router]);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const resolvedUser = user ?? await checkSession();
      if (!resolvedUser) {
        setProjects([]);
        router.push(withBasePath('/login'));
        return;
      }
      load();
    })();
  }, [authLoading, user, load, router, checkSession]);

  if (authLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter || p.type === filter);
  const typeLabelMap = Object.fromEntries(projectTypes.map((definition) => [definition.key, definition.name]));
  const filterChips = [
    { v: 'all', l: 'すべて' },
    { v: 'active', l: 'アクティブ' },
    { v: 'draft', l: '下書き' },
    ...projectTypes.map((definition) => ({ v: definition.key, l: definition.name })),
  ];

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    draft: projects.filter(p => p.status === 'draft').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-r from-cyan-50 via-white to-amber-50">
          <div>
            <p className="section-title mb-2">Workspace Overview</p>
            <h1 className="text-2xl font-bold tracking-tight">ダッシュボード</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>マーケティング施策の構造を定義・資産化する</p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            + 新規プロジェクト
          </button>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '総プロジェクト', value: stats.total, color: 'text-cyan-700', accent: 'border-l-cyan-400' },
          { label: 'アクティブ', value: stats.active, color: 'text-emerald-700', accent: 'border-l-emerald-400' },
          { label: '下書き', value: stats.draft, color: 'text-amber-700', accent: 'border-l-amber-400' },
        ].map(s => (
          <div key={s.label} className={`card p-4 border-l-4 ${s.accent}`}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className={`text-2xl font-bold mt-1.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2 mb-5">
        {filterChips.map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`tab-btn${filter === f.v ? ' active' : ''}`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* プロジェクトグリッド */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-4xl mb-3" style={{ color: 'var(--accent)' }}>⬡</p>
          <p className="text-sm">プロジェクトがまだありません</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mt-4">
            最初のプロジェクトを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} typeLabel={typeLabelMap[p.type] || PROJECT_TYPE_LABELS[p.type as ProjectType] || p.type} onClone={setCloneSource} />
          ))}
        </div>
      )}

      {showNew && (
        <NewProjectModal
          projectTypes={projectTypes.length > 0 ? projectTypes : []}
          onClose={() => setShowNew(false)}
          onCreated={id => { setShowNew(false); router.push(withBasePath(`/projects/${id}`)); }}
        />
      )}

      {cloneSource && (
        <CloneModal
          source={cloneSource}
          projects={projects}
          onClose={() => setCloneSource(null)}
          onCloned={id => { setCloneSource(null); router.push(withBasePath(`/projects/${id}`)); }}
        />
      )}
    </div>
  );
}

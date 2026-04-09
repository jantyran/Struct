'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Project, ProjectType, CloneOptions } from '@/types';
import { PROJECT_TYPE_LABELS } from '@/types';

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('campaign');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type }) });
    const data = await res.json() as { id: string };
    setLoading(false);
    onCreated(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
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
              {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
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
    const res = await fetch(`/api/projects/${source.id}/clone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) });
    const data = await res.json() as { id: string };
    setLoading(false);
    onCloned(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
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
                <label key={String(opt.v)} className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${options.include_values === opt.v ? 'border-violet-500/60 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
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

function ProjectCard({ project, onClone }: { project: Project; onClone: (p: Project) => void }) {
  const channels = (() => { try { return JSON.parse(project.channels) as string[]; } catch { return []; } })();
  const statusColors: Record<string, string> = { draft: 'text-gray-400 bg-gray-700', active: 'text-green-300 bg-green-900/40', archived: 'text-gray-500 bg-gray-800' };
  const statusLabels: Record<string, string> = { draft: '下書き', active: '実施中', archived: 'アーカイブ' };
  const typeColors: Record<string, string> = { event: 'text-blue-300', campaign: 'text-purple-300', content: 'text-amber-300', other: 'text-gray-400' };

  return (
    <div className="card p-5 flex flex-col gap-3 hover:border-gray-600 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`text-xs font-medium ${typeColors[project.type] ?? 'text-gray-400'}`}>
            {PROJECT_TYPE_LABELS[project.type as ProjectType] ?? project.type}
          </span>
          <h3 className="font-semibold text-sm mt-0.5 leading-snug">{project.name}</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[project.status] ?? statusColors.draft}`}>
          {statusLabels[project.status] ?? project.status}
        </span>
      </div>

      {project.target && <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>▶ {project.target}</p>}

      {project.start_date && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {project.start_date}{project.end_date && ` 〜 ${project.end_date}`}
        </p>
      )}

      {project.cloned_from && (
        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span>⬡</span> クローン
        </p>
      )}

      <div className="flex gap-2 mt-auto pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link href={`/projects/${project.id}`} className="btn-primary text-xs flex-1 justify-center py-1.5">
          開く
        </Link>
        <button onClick={() => onClone(project)} className="btn-secondary text-xs px-3 py-1.5">
          クローン
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [cloneSource, setCloneSource] = useState<Project | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    const res = await fetch('/api/projects');
    setProjects(await res.json() as Project[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter || p.type === filter);

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    draft: projects.filter(p => p.status === 'draft').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">ダッシュボード</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>マーケティング施策の構造を定義・資産化する</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          + 新規プロジェクト
        </button>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '総プロジェクト', value: stats.total, color: 'text-violet-300' },
          { label: '実施中', value: stats.active, color: 'text-green-300' },
          { label: '下書き', value: stats.draft, color: 'text-amber-300' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-5">
        {[
          { v: 'all', l: 'すべて' },
          { v: 'active', l: '実施中' },
          { v: 'draft', l: '下書き' },
          { v: 'event', l: 'イベント' },
          { v: 'campaign', l: 'キャンペーン' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${filter === f.v ? 'border-violet-500/60 bg-violet-500/10 text-violet-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* プロジェクトグリッド */}
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-4xl mb-3">⬡</p>
          <p className="text-sm">プロジェクトがまだありません</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mt-4">
            最初のプロジェクトを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onClone={setCloneSource} />
          ))}
        </div>
      )}

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={id => { setShowNew(false); router.push(`/projects/${id}`); }}
        />
      )}

      {cloneSource && (
        <CloneModal
          source={cloneSource}
          projects={projects}
          onClose={() => setCloneSource(null)}
          onCloned={id => { setCloneSource(null); router.push(`/projects/${id}`); }}
        />
      )}
    </div>
  );
}

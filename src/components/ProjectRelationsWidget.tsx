'use client';

import { useEffect, useMemo, useState } from 'react';
import { withBasePath } from '@/lib/paths';
import type { ProjectTypeDefinition } from '@/types';

interface StructureProject {
  id: string;
  relation_id?: string;
  name: string;
  type: string;
  status: string;
  phase_key: string;
  parent_project_id: string | null;
  todo_total?: number;
  todo_done?: number;
  todo_overdue?: number;
  completion_rate?: number;
}

interface ProjectRelationsPayload {
  parent: StructureProject | null;
  children: StructureProject[];
  related: StructureProject[];
  available_projects: StructureProject[];
  rollup: {
    visible_children: number;
    visible_related: number;
    completed_children: number;
    todo_total: number;
    todo_done: number;
    todo_overdue: number;
    completion_rate: number;
  };
}

interface ProjectRelationsWidgetProps {
  projectId: string;
  projectTypes: ProjectTypeDefinition[];
  canEdit: boolean;
  compact?: boolean;
  onOpenStructureTab?: () => void;
  onProjectParentChange?: (parentProjectId: string | null) => void;
}

function typeLabel(projectTypes: ProjectTypeDefinition[], type: string) {
  return projectTypes.find((item) => item.key === type)?.name || type;
}

function statusLabel(status: string) {
  switch (status) {
    case 'draft': return '下書き';
    case 'active': return 'アクティブ';
    case 'completed': return '完了';
    case 'archived': return 'アーカイブ';
    default: return status || '未設定';
  }
}

function MiniProjectLink({ project, projectTypes, onRemove }: { project: StructureProject; projectTypes: ProjectTypeDefinition[]; onRemove?: () => void }) {
  return (
    <div className="rounded-lg border px-2.5 py-2 space-y-1.5" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.68)' }}>
      <div className="flex items-start justify-between gap-2">
        <a href={withBasePath(`/projects/${project.id}`)} className="text-xs font-semibold hover:underline min-w-0 break-words" style={{ color: 'var(--text-primary)' }}>
          {project.name}
        </a>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-[0.6875rem] shrink-0" style={{ color: '#b34a4a' }}>
            解除
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[0.625rem]" style={{ color: 'var(--text-muted)' }}>
        <span>{typeLabel(projectTypes, project.type)}</span>
        <span>/</span>
        <span>{statusLabel(project.status)}</span>
        {typeof project.completion_rate === 'number' && (
          <>
            <span>/</span>
            <span>{project.completion_rate}%</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProjectRelationsWidget({
  projectId,
  projectTypes,
  canEdit,
  compact = false,
  onOpenStructureTab,
  onProjectParentChange,
}: ProjectRelationsWidgetProps) {
  const [payload, setPayload] = useState<ProjectRelationsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [parentId, setParentId] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${projectId}/relations`));
      if (!res.ok) {
        setMessage('構成情報を読み込めません');
        return;
      }
      const data = await res.json() as ProjectRelationsPayload;
      setPayload(data);
      setParentId(data.parent?.id ?? '');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPayload(null);
    setMessage('');
    setParentId('');
    setRelatedId('');
    void load();
  }, [projectId]);

  const relatedIds = useMemo(() => new Set(payload?.related.map((project) => project.id) ?? []), [payload?.related]);
  const parentOptions = payload?.available_projects ?? [];
  const relatedOptions = useMemo(
    () => (payload?.available_projects ?? []).filter((project) => !relatedIds.has(project.id)),
    [payload?.available_projects, relatedIds]
  );

  async function saveParent() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(withBasePath(`/api/projects/${projectId}/relations/parent`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_project_id: parentId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || '親プロジェクトを保存できません');
        return;
      }
      onProjectParentChange?.(parentId || null);
      setMessage('保存しました');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addRelated() {
    if (!relatedId) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(withBasePath(`/api/projects/${projectId}/relations`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_project_id: relatedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || '関連プロジェクトを追加できません');
        return;
      }
      setRelatedId('');
      setMessage('追加しました');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeRelated(project: StructureProject) {
    if (!project.relation_id) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(withBasePath(`/api/projects/${projectId}/relations/${project.relation_id}`), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || '関連を解除できません');
        return;
      }
      setMessage('解除しました');
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !payload) {
    return (
      <div className="surface-read">
        <p className="field-label">プロジェクト構成</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="surface-read">
        <p className="field-label">プロジェクト構成</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{message || '表示できません'}</p>
      </div>
    );
  }

  return (
    <div className="surface-read space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="field-label">プロジェクト構成</p>
        {onOpenStructureTab && (
          <button type="button" onClick={onOpenStructureTab} className="text-xs" style={{ color: 'var(--accent)' }}>
            構成タブ →
          </button>
        )}
      </div>

      {message && (
        <p className="text-[0.6875rem]" style={{ color: message.includes('できません') ? '#b34a4a' : 'var(--success)' }}>
          {message}
        </p>
      )}

      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg py-2 px-1" style={{ backgroundColor: 'rgba(20,184,166,0.08)' }}>
          <p className="text-base font-bold leading-none" style={{ color: '#0f766e' }}>{payload.rollup.visible_children}</p>
          <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>子</p>
        </div>
        <div className="rounded-lg py-2 px-1" style={{ backgroundColor: 'rgba(15,154,177,0.08)' }}>
          <p className="text-base font-bold leading-none" style={{ color: 'var(--accent)' }}>{payload.rollup.visible_related}</p>
          <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>関連</p>
        </div>
        <div className="rounded-lg py-2 px-1" style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
          <p className="text-base font-bold leading-none" style={{ color: '#10b981' }}>{payload.rollup.completion_rate}%</p>
          <p className="text-[0.625rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>進捗</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>親プロジェクト</p>
        {payload.parent ? (
          <MiniProjectLink project={payload.parent} projectTypes={projectTypes} />
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>親プロジェクトなし</p>
        )}
        {canEdit && (
          <div className={compact ? 'space-y-2' : 'grid grid-cols-[1fr_auto] gap-2'}>
            <select className="field-input text-xs" value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">親なし</option>
              {parentOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <button type="button" onClick={saveParent} disabled={saving} className="btn-secondary text-xs px-2 py-1.5">
              保存
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>子プロジェクト</p>
        {payload.children.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>子プロジェクトなし</p>
        ) : (
          <div className="space-y-1.5">
            {payload.children.slice(0, 3).map((project) => (
              <MiniProjectLink key={project.id} project={project} projectTypes={projectTypes} />
            ))}
            {payload.children.length > 3 && (
              <p className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>他 {payload.children.length - 3} 件</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[0.6875rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>関連プロジェクト</p>
        {payload.related.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>関連プロジェクトなし</p>
        ) : (
          <div className="space-y-1.5">
            {payload.related.slice(0, 3).map((project) => (
              <MiniProjectLink
                key={project.id}
                project={project}
                projectTypes={projectTypes}
                onRemove={canEdit ? () => removeRelated(project) : undefined}
              />
            ))}
            {payload.related.length > 3 && (
              <p className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>他 {payload.related.length - 3} 件</p>
            )}
          </div>
        )}
        {canEdit && (
          <div className={compact ? 'space-y-2' : 'grid grid-cols-[1fr_auto] gap-2'}>
            <select className="field-input text-xs" value={relatedId} onChange={(event) => setRelatedId(event.target.value)}>
              <option value="">追加するプロジェクト</option>
              {relatedOptions.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <button type="button" onClick={addRelated} disabled={saving || !relatedId} className="btn-secondary text-xs px-2 py-1.5">
              追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

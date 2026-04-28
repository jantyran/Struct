'use client';

import { useEffect, useMemo, useState } from 'react';
import { withBasePath } from '@/lib/paths';
import type { ProjectTypeDefinition, ProjectUser } from '@/types';

interface StructureProject {
  id: string;
  relation_id?: string;
  name: string;
  type: string;
  status: string;
  phase_key: string;
  parent_project_id: string | null;
  primary_assignee?: { id: string; name: string | null; email: string; avatar_url?: string | null } | null;
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

interface ProjectStructureTabProps {
  projectId: string;
  projectType: string;
  projectTypes: ProjectTypeDefinition[];
  assignableUsers: ProjectUser[];
  canEdit: boolean;
  onProjectParentChange: (parentProjectId: string | null) => void;
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

function userName(user: ProjectUser | { name: string | null; email: string }) {
  return user.name?.trim() || user.email;
}

function projectTypeLabel(projectTypes: ProjectTypeDefinition[], type: string) {
  return projectTypes.find((item) => item.key === type)?.name || type;
}

function phaseLabel(projectTypes: ProjectTypeDefinition[], project: StructureProject) {
  return projectTypes
    .find((item) => item.key === project.type)
    ?.phases
    .find((phase) => phase.key === project.phase_key)
    ?.name || project.phase_key || '未設定';
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(111,135,148,0.14)' }}>
      <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: 'var(--accent)' }} />
    </div>
  );
}

function ProjectListItem({
  project,
  projectTypes,
  canRemove,
  onRemove,
}: {
  project: StructureProject;
  projectTypes: ProjectTypeDefinition[];
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.72)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={withBasePath(`/projects/${project.id}`)} className="text-sm font-semibold hover:underline break-words" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(15,154,177,0.08)', color: 'var(--accent)' }}>
              {projectTypeLabel(projectTypes, project.type)}
            </span>
            <span>{statusLabel(project.status)}</span>
            <span>/</span>
            <span>{phaseLabel(projectTypes, project)}</span>
          </div>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="btn-danger text-xs px-2 py-1 shrink-0">
            解除
          </button>
        )}
      </div>

      {'todo_total' in project && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>進捗 {project.completion_rate ?? 0}%</span>
            <span>Todo {project.todo_done ?? 0}/{project.todo_total ?? 0}</span>
          </div>
          <ProgressBar value={project.completion_rate ?? 0} />
          <p className="text-[0.6875rem]" style={{ color: 'var(--text-muted)' }}>
            期限超過: {project.todo_overdue ?? 0} / 主担当: {project.primary_assignee ? userName(project.primary_assignee) : '未設定'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ProjectStructureTab({
  projectId,
  projectType,
  projectTypes,
  assignableUsers,
  canEdit,
  onProjectParentChange,
}: ProjectStructureTabProps) {
  const [payload, setPayload] = useState<ProjectRelationsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [parentId, setParentId] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [childName, setChildName] = useState('');
  const [childType, setChildType] = useState(projectType);
  const [childAssigneeId, setChildAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(withBasePath(`/api/projects/${projectId}/relations`));
      if (!res.ok) {
        setMessage('構成情報の読み込みに失敗しました');
        return;
      }
      const data = await res.json() as ProjectRelationsPayload;
      setPayload(data);
      setParentId(data.parent?.id ?? '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPayload(null);
    setMessage('');
    setParentId('');
    setRelatedId('');
    setChildName('');
    setChildType(projectType);
    setChildAssigneeId('');
    void load();
  }, [projectId, projectType]);

  const relatedIds = useMemo(() => new Set(payload?.related.map((project) => project.id) ?? []), [payload?.related]);
  const parentOptions = useMemo(
    () => payload?.available_projects.filter((project) => project.id !== projectId) ?? [],
    [payload?.available_projects, projectId]
  );
  const relatedOptions = useMemo(
    () => payload?.available_projects.filter((project) => project.id !== projectId && !relatedIds.has(project.id)) ?? [],
    [payload?.available_projects, projectId, relatedIds]
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
        setMessage(data.error || '親プロジェクトの保存に失敗しました');
        return;
      }
      onProjectParentChange(parentId || null);
      setMessage('親プロジェクトを保存しました');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function createChild() {
    if (!childName.trim()) {
      setMessage('子プロジェクト名を入力してください');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(withBasePath(`/api/projects/${projectId}/children`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: childName.trim(),
          type: childType,
          primary_assignee_id: childAssigneeId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || '子プロジェクトの作成に失敗しました');
        return;
      }
      setChildName('');
      setChildAssigneeId('');
      setMessage('子プロジェクトを作成しました');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function addRelated() {
    if (!relatedId) {
      setMessage('関連プロジェクトを選択してください');
      return;
    }
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
        setMessage(data.error || '関連プロジェクトの追加に失敗しました');
        return;
      }
      setRelatedId('');
      setMessage('関連プロジェクトを追加しました');
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
        setMessage(data.error || '関連解除に失敗しました');
        return;
      }
      setMessage('関連プロジェクトを解除しました');
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !payload) {
    return (
      <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">構成情報を読み込み中...</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">{message || '構成情報を表示できません'}</p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {message && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', color: message.includes('失敗') || message.includes('入力') || message.includes('選択') ? '#b34a4a' : 'var(--success)', backgroundColor: 'rgba(255,255,255,0.72)' }}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>子プロジェクト</p>
          <p className="text-2xl font-bold mt-1">{payload.rollup.visible_children}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>完了済み</p>
          <p className="text-2xl font-bold mt-1">{payload.rollup.completed_children}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>未完了 Todo</p>
          <p className="text-2xl font-bold mt-1">{Math.max(0, payload.rollup.todo_total - payload.rollup.todo_done)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>全体進捗</p>
          <p className="text-2xl font-bold mt-1">{payload.rollup.completion_rate}%</p>
          <div className="mt-2"><ProgressBar value={payload.rollup.completion_rate} /></div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">親プロジェクト</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>このプロジェクトを束ねる上位プロジェクトです。</p>
          </div>
        </div>
        {payload.parent ? (
          <ProjectListItem project={payload.parent} projectTypes={projectTypes} />
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            親プロジェクトは設定されていません。
          </div>
        )}
        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="field-label">親を変更</label>
              <select className="field-input" value={parentId} onChange={(event) => setParentId(event.target.value)}>
                <option value="">親なし</option>
                {parentOptions.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={saveParent} disabled={saving} className="btn-secondary text-sm">
              保存
            </button>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="section-title">子プロジェクト</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>このプロジェクトに含まれる下位プロジェクトです。</p>
        </div>
        {payload.children.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            子プロジェクトはまだありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {payload.children.map((project) => (
              <ProjectListItem key={project.id} project={project} projectTypes={projectTypes} />
            ))}
          </div>
        )}
        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_180px_220px_auto] gap-3 items-end rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.66)' }}>
            <div>
              <label className="field-label">プロジェクト名</label>
              <input className="field-input" value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="例: LP制作" />
            </div>
            <div>
              <label className="field-label">種別</label>
              <select className="field-input" value={childType} onChange={(event) => setChildType(event.target.value)}>
                {projectTypes.map((type) => (
                  <option key={type.key} value={type.key}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">主担当</label>
              <select className="field-input" value={childAssigneeId} onChange={(event) => setChildAssigneeId(event.target.value)}>
                <option value="">自分</option>
                {assignableUsers.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>{userName(assignee)}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={createChild} disabled={saving || !childName.trim()} className="btn-secondary text-sm">
              作成
            </button>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="section-title">関連プロジェクト</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>親子ではないが、一緒に確認したいプロジェクトです。</p>
        </div>
        {payload.related.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            関連プロジェクトはまだありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {payload.related.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                projectTypes={projectTypes}
                canRemove={canEdit}
                onRemove={() => removeRelated(project)}
              />
            ))}
          </div>
        )}
        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <label className="field-label">関連プロジェクトを追加</label>
              <select className="field-input" value={relatedId} onChange={(event) => setRelatedId(event.target.value)}>
                <option value="">プロジェクトを選択</option>
                {relatedOptions.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={addRelated} disabled={saving || !relatedId} className="btn-secondary text-sm">
              追加
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

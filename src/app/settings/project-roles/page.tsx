'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/components/AuthContext';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import { withBasePath } from '@/lib/paths';
import type { ProjectRoleDefinition, ProjectRolePermissionKey, ProjectRolePermissions } from '@/types';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';

const PERMISSIONS: Array<{ key: ProjectRolePermissionKey; label: string; description: string }> = [
  { key: 'can_view', label: 'プロジェクト表示', description: 'プロジェクト自体を開ける' },
  { key: 'can_edit', label: 'プロジェクト編集', description: '名称、ステータス、フェーズ、主担当を編集' },
  { key: 'can_manage_members', label: 'メンバー管理', description: 'プロジェクトメンバーの追加、削除、ロール変更' },
  { key: 'can_delete', label: 'プロジェクト削除', description: 'プロジェクトを削除' },
  { key: 'can_view_items', label: '項目表示', description: '項目・セクション内データを表示' },
  { key: 'can_edit_items', label: '項目編集', description: '項目値を編集' },
  { key: 'can_view_content', label: '生成コンテンツ表示', description: '生成済みコンテンツを表示' },
  { key: 'can_generate_content', label: '生成/補完', description: 'AI生成、補完、生成物編集を実行' },
  { key: 'can_view_notes', label: 'ノート表示', description: 'ノートを表示' },
  { key: 'can_edit_notes', label: 'ノート編集', description: 'ノートの作成、編集、削除' },
];

function emptyPermissions(): ProjectRolePermissions {
  return PERMISSIONS.reduce((acc, permission) => {
    acc[permission.key] = false;
    return acc;
  }, {} as ProjectRolePermissions);
}

function normalizeKey(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export default function ProjectRolesSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<ProjectRoleDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingRoleScrollTarget, setPendingRoleScrollTarget] = useState<string | null>(null);
  const scrollOptions = useMemo(() => ({ behavior: 'smooth', block: 'center' } as const), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    loadRoles();
  }, [authLoading, router, user]);

  usePendingScrollTarget(
    pendingRoleScrollTarget,
    [roles],
    setPendingRoleScrollTarget,
    scrollOptions,
  );

  async function loadRoles() {
    const res = await fetch(withBasePath('/api/project-roles'));
    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (res.ok) {
      const payload = await res.json() as { roles: ProjectRoleDefinition[] };
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
    }
  }

  function updateRole(roleId: string, patch: Partial<ProjectRoleDefinition>) {
    setRoles((current) => current.map((role) => role.id === roleId ? { ...role, ...patch } : role));
  }

  function togglePermission(roleId: string, key: ProjectRolePermissionKey) {
    setRoles((current) => current.map((role) => {
      if (role.id !== roleId) return role;
      return { ...role, permissions: { ...role.permissions, [key]: !role.permissions[key] } };
    }));
  }

  function addRole() {
    const nextNumber = roles.length + 1;
    const nextRoleId = uuidv4();
    setRoles((current) => [
      ...current,
      {
        id: nextRoleId,
        key: `PROJECT_ROLE_${nextNumber}`,
        name: `プロジェクトロール ${nextNumber}`,
        description: '',
        permissions: emptyPermissions(),
        is_system: false,
        sort_order: current.length,
      },
    ]);
    setPendingRoleScrollTarget(`project-role-row-${nextRoleId}`);
  }

  useRegisterShortcutScope('settings-project-roles', 'プロジェクトロール設定', {
    save_current: () => saveRoles(),
    new_record: addRole,
  });

  function removeRole(roleId: string) {
    setRoles((current) => current.filter((role) => role.id !== roleId).map((role, index) => ({ ...role, sort_order: index })));
  }

  async function saveRoles() {
    setSaving(true);
    setMessage('');
    const res = await fetch(withBasePath('/api/project-roles'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: roles.map((role, index) => ({ ...role, key: normalizeKey(role.key), sort_order: index })),
      }),
    });
    const payload = await res.json() as { roles?: ProjectRoleDefinition[]; error?: string };
    setSaving(false);

    if (!res.ok) {
      setMessage(payload.error || '保存に失敗しました');
      return;
    }

    setRoles(payload.roles ?? []);
    setMessage('保存済み');
    setTimeout(() => setMessage(''), 2000);
  }

  if (authLoading || !user) {
    return <div className="p-6 max-w-6xl mx-auto"><div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">プロジェクトロール設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            プロジェクトメンバーに付与するロールと、プロジェクト内の表示・編集権限を定義します。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs" style={{ color: message === '保存済み' ? 'var(--success)' : '#b34a4a' }}>{message}</span>}
          <button onClick={addRole} className="btn-secondary text-sm">+ ロール追加</button>
          <button onClick={saveRoles} disabled={saving} className="btn-primary text-sm">{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>

      <div className="space-y-4">
        {roles.map((role) => (
          <section key={role.id} id={`project-role-row-${role.id}`} className="card p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[200px_220px_1fr_auto] gap-3 items-start">
              <div>
                <label className="field-label">ロールキー</label>
                <input className="field-input text-sm" value={role.key} onChange={(e) => updateRole(role.id, { key: e.target.value })} onBlur={(e) => updateRole(role.id, { key: normalizeKey(e.target.value) })} />
              </div>
              <div>
                <label className="field-label">表示名</label>
                <input className="field-input text-sm" value={role.name} onChange={(e) => updateRole(role.id, { name: e.target.value })} />
              </div>
              <div>
                <label className="field-label">説明</label>
                <input className="field-input text-sm" value={role.description} onChange={(e) => updateRole(role.id, { description: e.target.value })} />
              </div>
              <button onClick={() => removeRole(role.id)} className="btn-danger text-xs mt-6">削除</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              {PERMISSIONS.map((permission) => (
                <label key={permission.key} className="flex items-start gap-3 py-2 cursor-pointer">
                  <input type="checkbox" className="mt-1 accent-cyan-600" checked={Boolean(role.permissions[permission.key])} onChange={() => togglePermission(role.id, permission.key)} />
                  <span>
                    <span className="block text-sm font-medium">{permission.label}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{permission.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

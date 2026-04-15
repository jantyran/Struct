'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';
import type { RoleDefinition, SystemPermissionKey, SystemPermissions } from '@/types';

const PERMISSIONS: Array<{ key: SystemPermissionKey; label: string; description: string }> = [
  { key: 'manage_users', label: 'ユーザー管理', description: '全ユーザーの表示名、アバター、システムロールを変更' },
  { key: 'manage_system_roles', label: 'システムロール管理', description: 'システムロールと権限定義を変更' },
  { key: 'manage_project_roles', label: 'プロジェクトロール管理', description: 'プロジェクトメンバーに付与するロールと権限を変更' },
  { key: 'manage_project_settings', label: 'プロジェクト設定管理', description: 'プロジェクト種別、項目、セクション定義を管理' },
  { key: 'manage_global_assets', label: 'Global Assets管理', description: '共通アセット情報を管理' },
  { key: 'manage_ai_settings', label: 'AI設定管理', description: 'AIプロバイダ、モデル、APIキー設定を管理' },
  { key: 'view_all_projects', label: '全プロジェクト表示', description: '所有/参加していないプロジェクトも表示' },
  { key: 'edit_all_projects', label: '全プロジェクト編集', description: '所有/参加していないプロジェクトも編集' },
  { key: 'delete_any_project', label: '任意プロジェクト削除', description: '全プロジェクトを削除可能' },
];

function emptyPermissions(): SystemPermissions {
  return PERMISSIONS.reduce((acc, permission) => {
    acc[permission.key] = false;
    return acc;
  }, {} as SystemPermissions);
}

function normalizeKey(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

export default function RolesSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    loadRoles();
  }, [authLoading, router, user]);

  async function loadRoles() {
    const res = await fetch(withBasePath('/api/roles'));
    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (res.ok) {
      const payload = await res.json() as { roles: RoleDefinition[] };
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
    }
  }

  function updateRole(roleId: string, patch: Partial<RoleDefinition>) {
    setRoles((current) => current.map((role) => role.id === roleId ? { ...role, ...patch } : role));
  }

  function togglePermission(roleId: string, key: SystemPermissionKey) {
    setRoles((current) => current.map((role) => {
      if (role.id !== roleId) return role;
      return {
        ...role,
        permissions: {
          ...role.permissions,
          [key]: !role.permissions[key],
        },
      };
    }));
  }

  function addRole() {
    const nextNumber = roles.length + 1;
    setRoles((current) => [
      ...current,
      {
        id: uuidv4(),
        key: `ROLE_${nextNumber}`,
        name: `ロール ${nextNumber}`,
        description: '',
        permissions: emptyPermissions(),
        is_system: false,
        sort_order: current.length,
      },
    ]);
  }

  function removeRole(roleId: string) {
    setRoles((current) => current.filter((role) => role.id !== roleId).map((role, index) => ({ ...role, sort_order: index })));
  }

  async function saveRoles() {
    setSaving(true);
    setMessage('');
    const res = await fetch(withBasePath('/api/roles'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: roles.map((role, index) => ({
          ...role,
          key: normalizeKey(role.key),
          sort_order: index,
        })),
      }),
    });
    const payload = await res.json() as { roles?: RoleDefinition[]; error?: string };
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
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">ロール・権限設定</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            ユーザーに直接付与するシステムロールと、管理系・全体アクセス系の権限を定義します。
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
          <section key={role.id} className="card p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[180px_220px_1fr_auto] gap-3 items-start">
              <div>
                <label className="field-label">ロールキー</label>
                <input
                  className="field-input text-sm"
                  value={role.key}
                  onChange={(e) => updateRole(role.id, { key: e.target.value })}
                  onBlur={(e) => updateRole(role.id, { key: normalizeKey(e.target.value) })}
                />
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
                  <input
                    type="checkbox"
                    className="mt-1 accent-cyan-600"
                    checked={Boolean(role.permissions[permission.key])}
                    onChange={() => togglePermission(role.id, permission.key)}
                  />
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

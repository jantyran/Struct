'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { useRegisterShortcutScope } from '@/components/ShortcutProvider';
import { withBasePath } from '@/lib/paths';
import { usePendingScrollTarget } from '@/hooks/usePendingScrollTarget';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url?: string | null;
  system_role?: string;
  created_at?: string;
};

type SystemRole = { key: string; name: string };

function initials(user: Pick<UserRow, 'email' | 'name'>) {
  const label = user.name?.trim() || user.email;
  return label.slice(0, 2).toUpperCase();
}

export default function UsersSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [canManageSystemRoles, setCanManageSystemRoles] = useState(false);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', avatar_url: '', system_role: 'USER' });
  const [pendingUserScrollTarget, setPendingUserScrollTarget] = useState<string | null>(null);
  const scrollOptions = useMemo(() => ({ behavior: 'smooth', block: 'center' } as const), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    setName(user.name ?? '');
    setAvatarUrl(user.avatar_url ?? '');
    loadUsers();
  }, [authLoading, router, user]);

  usePendingScrollTarget(
    pendingUserScrollTarget,
    [users],
    setPendingUserScrollTarget,
    scrollOptions,
  );

  useRegisterShortcutScope('settings-users', 'ユーザー管理', {
    save_current: () => saveProfile(),
    new_record: canManageUsers && newUser.email.trim() && newUser.password ? () => createUser() : undefined,
  });

  async function loadUsers() {
    const res = await fetch(withBasePath('/api/users'));
    if (res.status === 401) {
      router.push(withBasePath('/login'));
      return;
    }
    if (res.ok) {
      const payload = await res.json() as { users: UserRow[]; roles: SystemRole[]; can_manage_users: boolean; can_manage_system_roles?: boolean };
      setUsers(Array.isArray(payload.users) ? payload.users : []);
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
      setCanManageUsers(Boolean(payload.can_manage_users));
      setCanManageSystemRoles(Boolean(payload.can_manage_system_roles));
    }
  }

  async function saveUserProfile(target: { user_id?: string; name: string; avatar_url: string; system_role?: string }) {
    setSaving(true);
    setMessage('');
    const res = await fetch(withBasePath('/api/users'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });
    setSaving(false);

    if (!res.ok) {
      setMessage('保存に失敗しました');
      return;
    }

    await checkSession();
    await loadUsers();
    setMessage('保存済み');
    setTimeout(() => setMessage(''), 2000);
  }

  async function saveProfile() {
    await saveUserProfile({ name, avatar_url: avatarUrl });
  }

  async function updateUser(item: UserRow, patch: Partial<UserRow>) {
    const next = { ...item, ...patch };
    setUsers((current) => current.map((userItem) => userItem.id === item.id ? next : userItem));
    await saveUserProfile({
      user_id: next.id,
      name: next.name ?? '',
      avatar_url: next.avatar_url ?? '',
      system_role: next.system_role,
    });
  }

  async function createUser() {
    if (!newUser.email.trim() || !newUser.password) return;
    setSaving(true);
    setMessage('');
    const res = await fetch(withBasePath('/api/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    const payload = await res.json() as { error?: string; user?: UserRow };
    setSaving(false);

    if (!res.ok) {
      setMessage(payload.error || 'ユーザー追加に失敗しました');
      return;
    }

    if (payload.user?.id) {
      setPendingUserScrollTarget(`user-row-${payload.user.id}`);
    }
    setNewUser({ email: '', password: '', name: '', avatar_url: '', system_role: 'USER' });
    await loadUsers();
    setMessage('ユーザーを追加しました');
    setTimeout(() => setMessage(''), 2000);
  }

  async function deleteUser(item: UserRow) {
    if (!window.confirm(`${item.email} を削除しますか？この操作は取り消せません。`)) return;
    setSaving(true);
    setMessage('');
    const res = await fetch(withBasePath(`/api/users?user_id=${encodeURIComponent(item.id)}`), { method: 'DELETE' });
    const payload = await res.json() as { error?: string };
    setSaving(false);

    if (!res.ok) {
      setMessage(payload.error || 'ユーザー削除に失敗しました');
      return;
    }

    await loadUsers();
    setMessage('ユーザーを削除しました');
    setTimeout(() => setMessage(''), 2000);
  }

  if (authLoading || !user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">ユーザー管理</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Todo、KANBAN、WBSで使う担当者情報の基盤を管理します。
        </p>
      </div>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="section-title">自分のプロフィール</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            表示名とアバターは、主担当・Todo担当者の表示に使います。
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">表示名</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 堀口 翔太郎" />
          </div>
          <div>
            <label className="field-label">アバターURL</label>
            <input className="field-input" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveProfile} disabled={saving} className="btn-primary text-sm">
            {saving ? '保存中...' : '保存'}
          </button>
          {message && <span className="text-xs" style={{ color: message === '保存済み' ? 'var(--success)' : '#b34a4a' }}>{message}</span>}
        </div>
      </section>

      {canManageUsers && (
        <section className="card p-5 space-y-4">
          <div>
            <h2 className="section-title">ユーザー追加</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              初期パスワードを設定してユーザーを作成します。作成後、本人がパスワード変更できます。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">メールアドレス *</label>
              <input className="field-input" value={newUser.email} onChange={(e) => setNewUser((current) => ({ ...current, email: e.target.value }))} placeholder="user@example.com" />
            </div>
            <div>
              <label className="field-label">初期パスワード *</label>
              <input className="field-input" type="password" value={newUser.password} onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))} placeholder="6文字以上" />
            </div>
            <div>
              <label className="field-label">表示名</label>
              <input className="field-input" value={newUser.name} onChange={(e) => setNewUser((current) => ({ ...current, name: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">システムロール</label>
              <select
                className="field-input"
                value={canManageSystemRoles ? newUser.system_role : 'USER'}
                disabled={!canManageSystemRoles}
                onChange={(e) => setNewUser((current) => ({ ...current, system_role: e.target.value }))}
              >
                {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="field-label">アバターURL</label>
              <input className="field-input" value={newUser.avatar_url} onChange={(e) => setNewUser((current) => ({ ...current, avatar_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <button onClick={createUser} disabled={saving || !newUser.email.trim() || !newUser.password} className="btn-primary text-sm">
            ユーザー追加
          </button>
        </section>
      )}

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="section-title">登録ユーザー</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {canManageUsers ? 'ユーザー管理権限に応じてプロフィールとシステムロールを変更できます。' : '自分のユーザー情報だけ表示しています。'}
          </p>
        </div>
        <div className="divide-y divide-slate-200/70">
          {users.map((item) => (
            <div key={item.id} id={`user-row-${item.id}`} className="py-3 flex items-center gap-3">
              {item.avatar_url ? (
                <img src={item.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border" style={{ borderColor: 'var(--border)' }} />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold" style={{ backgroundColor: 'rgba(15,154,177,0.1)', color: 'var(--accent)' }}>
                  {initials(item)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.name || '未設定'}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.email}</p>
              </div>
              {canManageUsers && (
                <div className="ml-auto flex items-center gap-2">
                  <button
                    className="btn-secondary text-xs px-2 py-1"
                    onClick={() => {
                      const nextName = window.prompt('表示名', item.name ?? '');
                      if (nextName !== null) updateUser(item, { name: nextName });
                    }}
                  >
                    表示名
                  </button>
                  <button
                    className="btn-secondary text-xs px-2 py-1"
                    onClick={() => {
                      const nextAvatar = window.prompt('アバターURL', item.avatar_url ?? '');
                      if (nextAvatar !== null) updateUser(item, { avatar_url: nextAvatar });
                    }}
                  >
                    アバター
                  </button>
                  <select
                    className="field-input text-xs py-1.5 w-44"
                    value={item.system_role ?? 'USER'}
                    disabled={!canManageSystemRoles || item.id === user.id}
                    onChange={(e) => updateUser(item, { system_role: e.target.value })}
                  >
                    {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                  </select>
                  {item.id !== user.id && (
                    <button onClick={() => deleteUser(item)} className="btn-danger text-xs px-2 py-1">
                      削除
                    </button>
                  )}
                </div>
              )}
              {item.id === user.id && (
                <span className={`${canManageUsers ? '' : 'ml-auto'} text-xs px-2 py-1 rounded-full`} style={{ backgroundColor: 'rgba(31,157,114,0.1)', color: 'var(--success)' }}>
                  自分
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

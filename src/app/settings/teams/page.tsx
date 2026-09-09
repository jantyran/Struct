'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';
import type { Team, TeamMember } from '@/types';

type OrgUser = {
  id: string;
  name: string | null;
  email: string;
  avatar_url?: string | null;
};

export default function TeamsSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<{ team: Team; members: TeamMember[] } | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // 新規チーム作成用
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  // チーム編集用
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // メンバー追加用
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'LEADER' | 'MEMBER'>('MEMBER');

  const isAdmin = Boolean(
    user?.system_permissions?.manage_users ||
    user?.system_permissions?.manage_organization_settings ||
    user?.system_role === 'SYSTEM_ADMIN' ||
    user?.system_role === 'MANAGER'
  );

  const isTeamLeader = Boolean(
    teamDetail?.members?.some((m) => m.user_id === user?.id && m.role === 'LEADER')
  );

  const canCreate = Boolean(user);
  const canEditTeam = isAdmin || isTeamLeader;

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(withBasePath('/api/teams'));
      if (!res.ok) throw new Error('チーム一覧の取得に失敗しました');
      const data = (await res.json()) as Team[];
      setTeams(data);
      if (data.length > 0 && !selectedTeamId) {
        setSelectedTeamId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId]);

  const loadTeamDetail = useCallback(async (teamId: string) => {
    try {
      const res = await fetch(withBasePath(`/api/teams/${teamId}`));
      if (!res.ok) throw new Error('チーム詳細の取得に失敗しました');
      const data = await res.json();
      setTeamDetail({ team: data.team, members: data.team.members || [] });
      setEditName(data.team.name);
      setEditDesc(data.team.description || '');
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadOrgUsers = useCallback(async () => {
    try {
      const res = await fetch(withBasePath('/api/users'));
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : (data.users || []);
        setOrgUsers(userList);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    loadTeams();
    loadOrgUsers();
  }, [authLoading, user, router, loadTeams, loadOrgUsers]);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamDetail(selectedTeamId);
    } else {
      setTeamDetail(null);
    }
  }, [selectedTeamId, loadTeamDetail]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || saving) return;

    try {
      setSaving(true);
      const res = await fetch(withBasePath('/api/teams'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim(), description: newTeamDesc.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '作成に失敗しました');
      }
      const created = await res.json();
      setShowCreateModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      await loadTeams();
      setSelectedTeamId(created.id);
      setMessage('チームを作成しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!selectedTeamId || !editName.trim() || saving) return;

    try {
      setSaving(true);
      const res = await fetch(withBasePath(`/api/teams/${selectedTeamId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      await loadTeams();
      await loadTeamDetail(selectedTeamId);
      setMessage('チーム情報を保存しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeamId) return;
    if (!window.confirm('このチームを削除してもよろしいですか？（プロジェクトは削除されません）')) return;

    try {
      const res = await fetch(withBasePath(`/api/teams/${selectedTeamId}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      setSelectedTeamId(null);
      await loadTeams();
      setMessage('チームを削除しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !addUserId || saving) return;

    try {
      setSaving(true);
      const res = await fetch(withBasePath(`/api/teams/${selectedTeamId}/members`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId, role: addRole }),
      });
      if (!res.ok) throw new Error('追加に失敗しました');
      setAddUserId('');
      await loadTeamDetail(selectedTeamId);
      await loadTeams();
      setMessage('メンバーを追加しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('メンバー追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMemberRole = async (userId: string, currentRole: 'LEADER' | 'MEMBER') => {
    if (!selectedTeamId) return;
    const newRole = currentRole === 'LEADER' ? 'MEMBER' : 'LEADER';
    try {
      const res = await fetch(withBasePath(`/api/teams/${selectedTeamId}/members`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!res.ok) throw new Error('ロール変更に失敗しました');
      await loadTeamDetail(selectedTeamId);
    } catch (err) {
      console.error(err);
      alert('ロール変更に失敗しました');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeamId) return;
    if (!window.confirm('このメンバーをチームから除外しますか？')) return;

    try {
      const res = await fetch(withBasePath(`/api/teams/${selectedTeamId}/members/${userId}`), {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('除外に失敗しました');
      await loadTeamDetail(selectedTeamId);
      await loadTeams();
      setMessage('メンバーを除外しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('メンバー除外に失敗しました');
    }
  };

  const currentMembers = teamDetail?.members ?? [];
  const currentMemberUserIds = new Set(currentMembers.map((m) => m.user_id));
  const availableUsers = orgUsers.filter((u) => !currentMemberUserIds.has(u.id));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ナビゲーション戻る */}
      <div className="mb-4">
        <Link
          href={withBasePath('/settings')}
          className="text-xs font-medium text-gray-500 hover:text-cyan-600 transition-colors inline-flex items-center gap-1"
        >
          ← 設定トップに戻る
        </Link>
      </div>

      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">チーム管理</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            組織内全体とは別にグループでのチーム制をとり、担当プロジェクトやメンバー進捗をまとめます。
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreateModal(true)} className="btn-primary shrink-0 text-xs sm:text-sm">
            + 新規チーム作成
          </button>
        )}
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
          ✓ {message}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          チーム情報を読み込み中...
        </div>
      ) : teams.length === 0 ? (
        <div className="card p-12 text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-base font-semibold">チームはまだ作成されていません</p>
          <p className="text-xs mt-1">「+ 新規チーム作成」から最初のチームを登録してください。</p>
          {canCreate && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4">
              最初のチームを作成
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* 左: チームリスト */}
          <div className="card p-3 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b mb-1" style={{ borderColor: 'var(--border)' }}>
              チーム一覧 ({teams.length})
            </div>
            {teams.map((t) => {
              const active = t.id === selectedTeamId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-cyan-50/80 text-cyan-900 font-semibold border border-cyan-200 shadow-xs'
                      : 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 font-normal">
                    {t.member_count ?? 0} 名
                  </span>
                </button>
              );
            })}
          </div>

          {/* 右: 選択中チームの詳細 */}
          <div className="md:col-span-2 space-y-6">
            {teamDetail ? (
              <>
                {/* チーム基本設定カード */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="section-title">チーム基本情報</h2>
                    <Link
                      href={withBasePath(`/teams?team=${teamDetail.team.id}`)}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-cyan-100 text-cyan-800 hover:bg-cyan-200 transition-colors inline-flex items-center gap-1"
                    >
                      👥 このチームの進捗画面を開く →
                    </Link>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="field-label">チーム名</label>
                      <input
                        className="field-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={!canEditTeam}
                      />
                    </div>
                    <div>
                      <label className="field-label">説明・ミッション</label>
                      <textarea
                        className="field-input resize-none"
                        rows={2}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="チームの役割や担当領域など"
                        disabled={!canEditTeam}
                      />
                    </div>
                  </div>

                  {canEditTeam && (
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={handleDeleteTeam}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        チームを削除
                      </button>
                      <button
                        onClick={handleUpdateTeam}
                        disabled={saving || !editName.trim()}
                        className="btn-primary text-xs sm:text-sm"
                      >
                        {saving ? '保存中...' : 'チーム情報を保存'}
                      </button>
                    </div>
                  )}
                </div>

                {/* メンバー管理カード */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="section-title">チームメンバー ({currentMembers.length})</h2>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        リーダーは進捗確認やチーム情報・メンバー編成の管理権限を持ちます。
                      </p>
                    </div>
                  </div>

                  {/* メンバー追加フォーム */}
                  {canEditTeam && (
                    availableUsers.length > 0 ? (
                      <form
                        onSubmit={handleAddMember}
                        className="p-3.5 rounded-xl border bg-slate-50/70 grid grid-cols-1 sm:grid-cols-[1fr_130px_auto] gap-2.5 items-center"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <select
                          className="field-input text-xs"
                          value={addUserId}
                          onChange={(e) => setAddUserId(e.target.value)}
                        >
                          <option value="">追加するメンバーを選択...</option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email} ({u.email})
                            </option>
                          ))}
                        </select>
                        <select
                          className="field-input text-xs"
                          value={addRole}
                          onChange={(e) => setAddRole(e.target.value as 'LEADER' | 'MEMBER')}
                        >
                          <option value="MEMBER">一般メンバー</option>
                          <option value="LEADER">リーダー</option>
                        </select>
                        <button
                          type="submit"
                          disabled={!addUserId || saving}
                          className="btn-primary text-xs px-4 h-[38px] rounded-xl font-medium inline-flex items-center justify-center shrink-0"
                        >
                          {saving ? '追加中...' : '追加'}
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-gray-400 py-1 px-2">
                        ※ 組織内のすべてのユーザーが既にチームに所属しています。
                      </p>
                    )
                  )}

                  {/* メンバーリスト */}
                  <div className="divide-y divide-slate-100">
                    {currentMembers.map((m) => {
                      const displayName = m.user_name || m.user_email || 'ユーザー';
                      const isLeader = m.role === 'LEADER';
                      return (
                        <div key={m.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            {m.user_avatar_url ? (
                              <img src={m.user_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                                {displayName[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold truncate">{displayName}</span>
                                {isLeader && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                    ⭐ リーダー
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 truncate">{m.user_email}</p>
                            </div>
                          </div>

                          {canEditTeam && (
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleToggleMemberRole(m.user_id, m.role)}
                                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors text-gray-600 bg-white"
                                title="リーダー/メンバーを切り替え"
                              >
                                {isLeader ? 'メンバーへ降格' : 'リーダーへ昇格'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.user_id)}
                                className="text-xs text-red-500 hover:text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                              >
                                除外
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="card p-8 text-center text-sm text-gray-400">
                左の一覧からチームを選択してください。
              </div>
            )}
          </div>
        </div>
      )}

      {/* 新規チーム作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onClick={() => setShowCreateModal(false)}>
          <div className="card w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">新規チーム作成</h2>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="field-label">チーム名 *</label>
                <input
                  className="field-input"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="例: マーケティング推進班 / プロダクト開発チーム"
                  autoFocus
                />
              </div>
              <div>
                <label className="field-label">説明・ミッション</label>
                <textarea
                  className="field-input resize-none"
                  rows={2}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="例: Q2キャンペーンおよび新機能リリースの企画進行"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary text-xs sm:text-sm">
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!newTeamName.trim() || saving}
                  className="btn-primary text-xs sm:text-sm"
                >
                  {saving ? '作成中...' : 'チームを作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

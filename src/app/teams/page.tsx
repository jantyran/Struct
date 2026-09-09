'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';
import type { Team, TeamMember, Todo, TodoPriority, TodoStatus } from '@/types';
import { TODO_PRIORITY_LABELS, TODO_PRIORITY_COLORS, TODO_STATUS_LABELS } from '@/types';

interface MemberStat {
  member: TeamMember;
  stats: {
    total: number;
    done: number;
    in_progress: number;
    overdue: number;
    completion_rate: number;
  };
  todos: Array<
    Todo & { project_name: string; project_visibility: string; p_id: string }
  >;
}

interface TeamProject {
  id: string;
  name: string;
  type: string;
  status: string;
  phase_key: string;
  visibility: string;
  todo_total: number;
  todo_done: number;
  updated_at: string;
}

function TeamsProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTeamId = searchParams.get('team');
  const { user, loading: authLoading } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(requestedTeamId);
  const [teamDetail, setTeamDetail] = useState<{
    team: Team;
    projects: TeamProject[];
    member_stats: MemberStat[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'overdue'>('open');

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch(withBasePath('/api/teams'));
      if (!res.ok) throw new Error('チーム一覧の取得に失敗しました');
      const data = (await res.json()) as Team[];
      setTeams(data);
      if (data.length > 0 && !selectedTeamId) {
        setSelectedTeamId(requestedTeamId || data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId, requestedTeamId]);

  const loadTeamDetail = useCallback(async (teamId: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(withBasePath(`/api/teams/${teamId}`));
      if (!res.ok) throw new Error('チーム進捗の取得に失敗しました');
      const data = await res.json();
      setTeamDetail({
        team: data.team,
        projects: data.projects || [],
        member_stats: data.member_stats || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    loadTeams();
  }, [authLoading, user, router, loadTeams]);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamDetail(selectedTeamId);
    }
  }, [selectedTeamId, loadTeamDetail]);

  const today = new Date().toISOString().slice(0, 10);

  // チーム全体の総タスク数と完了数
  const totalTasks = teamDetail?.projects.reduce((s, p) => s + (p.todo_total || 0), 0) || 0;
  const doneTasks = teamDetail?.projects.reduce((s, p) => s + (p.todo_done || 0), 0) || 0;
  const teamCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="card p-6 bg-gradient-to-r from-sky-50 via-white to-indigo-50 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">👥</span>
            <h1 className="text-xl font-bold tracking-tight">チーム進捗ダッシュボード</h1>
          </div>
          <p className="text-xs text-gray-500">
            チームメンバーごとのタスク状況・担当プロジェクトの進行度を俯瞰して確認できます。
          </p>
        </div>

        <div className="flex items-center gap-3">
          {teams.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 shrink-0">表示チーム:</label>
              <select
                value={selectedTeamId || ''}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  router.push(withBasePath(`/teams?team=${e.target.value}`));
                }}
                className="field-input text-xs font-medium py-1.5 px-3 min-w-[160px]"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.member_count ?? 0}名)
                  </option>
                ))}
              </select>
            </div>
          )}
          <Link
            href={withBasePath('/settings/teams')}
            className="btn-secondary text-xs shrink-0 py-1.5 px-3 inline-flex items-center gap-1"
          >
            ⚙️ チーム設定
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-sm text-gray-400">チーム情報を読み込み中...</div>
      ) : teams.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-base font-semibold">参加しているチームがありません</p>
          <p className="text-xs mt-1">「チーム設定」から新しいチームを作成してください。</p>
          <Link href={withBasePath('/settings/teams')} className="btn-primary inline-block mt-4 text-xs">
            チームを作成する
          </Link>
        </div>
      ) : detailLoading || !teamDetail ? (
        <div className="card p-12 text-center text-sm text-gray-400">チーム詳細を読み込み中...</div>
      ) : (
        <>
          {/* チームサマリー統計 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-medium">チームメンバー</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{teamDetail.team.members?.length ?? 0}</span>
                <span className="text-xs text-gray-400">名</span>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-medium">担当プロジェクト</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-gray-900">{teamDetail.projects.length}</span>
                <span className="text-xs text-gray-400">件</span>
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-medium">タスク進捗率</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-cyan-600">{teamCompletionRate}%</span>
                <span className="text-xs text-gray-400">({doneTasks}/{totalTasks})</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-cyan-600 h-1.5 rounded-full transition-all" style={{ width: `${teamCompletionRate}%` }} />
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between">
              <span className="text-xs text-gray-500 font-medium">要注意タスク（期限超過）</span>
              <div className="flex items-baseline gap-2 mt-2">
                {(() => {
                  const totalOverdue = teamDetail.member_stats.reduce((s, m) => s + m.stats.overdue, 0);
                  return (
                    <>
                      <span className={`text-2xl font-bold ${totalOverdue > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {totalOverdue}
                      </span>
                      <span className="text-xs text-gray-400">件</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 担当プロジェクト一覧 */}
          {teamDetail.projects.length > 0 && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="section-title">担当プロジェクト ({teamDetail.projects.length})</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamDetail.projects.map((pj) => {
                  const rate = pj.todo_total > 0 ? Math.round((pj.todo_done / pj.todo_total) * 100) : 0;
                  return (
                    <Link
                      key={pj.id}
                      href={withBasePath(`/projects/${pj.id}`)}
                      className="p-3.5 rounded-xl border border-gray-200/80 hover:border-cyan-400 hover:shadow-xs transition-all bg-white flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-semibold text-cyan-700 truncate">{pj.name}</span>
                          {pj.visibility === 'private' && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                              🔒
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                          <span>進捗: {rate}%</span>
                          <span>({pj.todo_done}/{pj.todo_total} 完了)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* メンバー別タスク進捗状況 */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">メンバー別タスク状況</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  権限に応じて閲覧可能なタスクが表示されています。
                </p>
              </div>

              {/* フィルター */}
              <div className="flex gap-1.5 p-1 rounded-lg bg-gray-100 shrink-0">
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'open' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
                  }`}
                >
                  未完了のみ
                </button>
                <button
                  onClick={() => setStatusFilter('overdue')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'overdue' ? 'bg-white shadow-xs text-red-600' : 'text-gray-500'
                  }`}
                >
                  ⚠ 期限超過
                </button>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === 'all' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
                  }`}
                >
                  すべて
                </button>
              </div>
            </div>

            {teamDetail.member_stats.length === 0 ? (
              <div className="card p-8 text-center text-xs text-gray-400">
                メンバーがまだ登録されていません。
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {teamDetail.member_stats.map(({ member, stats, todos }) => {
                  const displayName = member.user_name || member.user_email || 'ユーザー';
                  const isLeader = member.role === 'LEADER';

                  // フィルター適用
                  const filteredTodos = todos.filter((t) => {
                    if (statusFilter === 'open') return t.status !== 'done';
                    if (statusFilter === 'overdue') return t.status !== 'done' && t.due_date && t.due_date < today;
                    return true;
                  });

                  return (
                    <div key={member.id} className="card p-5 space-y-4">
                      {/* メンバーヘッダー */}
                      <div className="flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-3 min-w-0">
                          {member.user_avatar_url ? (
                            <img src={member.user_avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-cyan-600 text-white flex items-center justify-center font-semibold text-sm">
                              {displayName[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm truncate">{displayName}</span>
                              {isLeader && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  ⭐ リーダー
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{member.user_email}</p>
                          </div>
                        </div>

                        {/* タスク進捗バッジ */}
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold text-gray-700">
                            完了率: <span className="text-cyan-600">{stats.completion_rate}%</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {stats.done} / {stats.total} 件完了
                            {stats.overdue > 0 && (
                              <span className="text-red-500 font-medium ml-1">
                                (遅延 {stats.overdue})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* タスク一覧 */}
                      <div className="space-y-2">
                        {filteredTodos.length === 0 ? (
                          <div className="text-center py-6 text-xs text-gray-400 bg-gray-50/50 rounded-lg">
                            該当するタスクはありません
                          </div>
                        ) : (
                          filteredTodos.map((todo) => {
                            const isTaskOverdue = todo.status !== 'done' && todo.due_date && todo.due_date < today;
                            const priorityColor = TODO_PRIORITY_COLORS[todo.priority as TodoPriority] || '#6b7280';
                            const priorityLabel = TODO_PRIORITY_LABELS[todo.priority as TodoPriority] || todo.priority;
                            const statusLabel = TODO_STATUS_LABELS[todo.status as TodoStatus] || todo.status;

                            return (
                              <Link
                                key={todo.id}
                                href={withBasePath(`/projects/${todo.project_id}?tab=tasks&todo=${todo.id}`)}
                                className="p-2.5 rounded-lg border border-gray-200/70 hover:border-cyan-400 hover:bg-cyan-50/20 transition-all flex items-center justify-between gap-3 group text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 text-gray-600 truncate max-w-[130px]">
                                      {todo.project_name}
                                    </span>
                                    <span
                                      className="px-1.5 py-0.2 rounded text-[10px] font-medium text-white"
                                      style={{ backgroundColor: priorityColor }}
                                    >
                                      {priorityLabel}
                                    </span>
                                    {isTaskOverdue && (
                                      <span className="text-[10px] text-red-500 font-bold">
                                        ⚠ 遅延
                                      </span>
                                    )}
                                  </div>
                                  <p className={`font-medium text-gray-900 group-hover:text-cyan-700 truncate ${todo.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                                    {todo.title}
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="text-[11px] text-gray-500">
                                    {todo.due_date ? `期日: ${todo.due_date.slice(5)}` : '期日なし'}
                                  </div>
                                  <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                                    todo.status === 'done'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : todo.status === 'in_progress'
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {statusLabel}
                                  </span>
                                </div>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TeamsProgressPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-6 max-w-7xl mx-auto">
          <div className="card p-8 text-center text-sm text-gray-400">
            チーム情報を読み込み中...
          </div>
        </div>
      }
    >
      <TeamsProgressContent />
    </React.Suspense>
  );
}

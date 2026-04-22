'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';
import { TODO_PRIORITY_LABELS, TODO_STATUS_LABELS, TodoPriority, TodoStatus, UserSettings } from '@/types';

const DEFAULT_SETTINGS: UserSettings = {
  text_size: 'medium',
  default_project_tab: 'fields',
  default_task_view: 'list',
  default_task_hide_done: false,
  default_task_statuses: [],
  default_task_priorities: [],
  default_task_assignee: '',
  reduce_motion: false,
};

export default function UserSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, checkSession } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function toggleStatus(status: TodoStatus) {
    setSettings((current) => ({
      ...current,
      default_task_statuses: current.default_task_statuses.includes(status)
        ? current.default_task_statuses.filter((value) => value !== status)
        : [...current.default_task_statuses, status],
    }));
  }

  function togglePriority(priority: TodoPriority) {
    setSettings((current) => ({
      ...current,
      default_task_priorities: current.default_task_priorities.includes(priority)
        ? current.default_task_priorities.filter((value) => value !== priority)
        : [...current.default_task_priorities, priority],
    }));
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(withBasePath('/api/user-settings'));
        if (res.status === 401) {
          router.push(withBasePath('/login'));
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSettings(data.settings ?? DEFAULT_SETTINGS);
        }
      } catch {
        if (!cancelled) setError('ユーザー設定の読み込みに失敗しました。');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, router, user]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(withBasePath('/api/user-settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '保存に失敗しました。');
        return;
      }
      setSettings(data.settings ?? settings);
      await checkSession();
      setSuccess('ユーザー設定を保存しました。');
    } catch {
      setError('接続エラーが発生しました。');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user || loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">ユーザー設定</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          あなた自身の使いやすさに関わる個人設定を管理します。組織全体の設定には影響しません。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">表示</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              文字サイズはアプリ全体の読みやすさに影響します。
            </p>
          </div>
          <div>
            <label className="field-label">文字サイズ</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'xsmall', label: '極小' },
                { key: 'small', label: '小' },
                { key: 'medium', label: '標準' },
                { key: 'large', label: '大' },
                { key: 'xlarge', label: '特大' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSettings((current) => ({ ...current, text_size: option.key as UserSettings['text_size'] }))}
                  className={`tab-btn${settings.text_size === option.key ? ' active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.reduce_motion}
              onChange={(event) => setSettings((current) => ({ ...current, reduce_motion: event.target.checked }))}
            />
            アニメーションや動きを減らす
          </label>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">既定の開き方</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              プロジェクト詳細を開いたとき、最初に表示したいタブを選びます。
            </p>
          </div>
          <div>
            <label className="field-label">プロジェクト詳細の既定タブ</label>
            <select
              className="field-input"
              value={settings.default_project_tab}
              onChange={(event) => setSettings((current) => ({ ...current, default_project_tab: event.target.value as UserSettings['default_project_tab'] }))}
            >
              <option value="fields">プロジェクト情報</option>
              <option value="tasks">タスク</option>
              <option value="members">メンバー</option>
              <option value="notes">ノート</option>
              <option value="assets">生成コンテンツ</option>
            </select>
          </div>

          <details className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(255,255,255,0.55)' }}>
            <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-3 row-hover">
              <div>
                <p className="text-sm font-semibold">タスクのデフォルト表示</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  既定の表示形式や初期フィルターを個人設定として持たせます。
                </p>
              </div>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>▼ 開く</span>
            </summary>

            <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <label className="field-label">タスクの既定表示</label>
                <select
                  className="field-input"
                  value={settings.default_task_view}
                  onChange={(event) => setSettings((current) => ({ ...current, default_task_view: event.target.value as UserSettings['default_task_view'] }))}
                >
                  <option value="list">リスト</option>
                  <option value="kanban">カンバン</option>
                  <option value="gantt">ガント</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="field-label">タスクの既定フィルター</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.default_task_hide_done}
                    onChange={(event) => setSettings((current) => ({ ...current, default_task_hide_done: event.target.checked }))}
                  />
                  初期表示で完了を隠す
                </label>
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>状態</p>
                  <div className="flex flex-wrap gap-2">
                    {(['todo', 'in_progress', 'done'] as TodoStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleStatus(status)}
                        className={`tab-btn${settings.default_task_statuses.includes(status) ? ' active' : ''}`}
                      >
                        {TODO_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>優先度</p>
                  <div className="flex flex-wrap gap-2">
                    {(['low', 'medium', 'high', 'urgent'] as TodoPriority[]).map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => togglePriority(priority)}
                        className={`tab-btn${settings.default_task_priorities.includes(priority) ? ' active' : ''}`}
                      >
                        {TODO_PRIORITY_LABELS[priority]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">担当者</label>
                  <select
                    className="field-input"
                    value={settings.default_task_assignee}
                    onChange={(event) => setSettings((current) => ({ ...current, default_task_assignee: event.target.value as UserSettings['default_task_assignee'] }))}
                  >
                    <option value="">制限なし</option>
                    <option value="me">自分</option>
                    <option value="unassigned">未割当</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
        </section>

        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        {success && <p className="text-xs" style={{ color: 'var(--success)' }}>{success}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '保存中...' : 'ユーザー設定を保存'}
          </button>
          <button type="button" onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
            設定へ戻る
          </button>
        </div>
      </form>
    </div>
  );
}

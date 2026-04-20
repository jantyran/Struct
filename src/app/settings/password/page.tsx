'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';

export default function PasswordSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
    }
  }, [authLoading, router, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (nextPassword.length < 8) {
      setError('新しいパスワードは8文字以上で入力してください。');
      return;
    }

    if (nextPassword !== confirmPassword) {
      setError('新しいパスワードと確認用パスワードが一致しません。');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(withBasePath('/api/auth/password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          nextPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'パスワード変更に失敗しました。');
        return;
      }
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setSuccess('パスワードを更新しました。');
    } catch (err) {
      setError('接続エラーが発生しました。');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
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
        <h1 className="text-xl font-bold">パスワード変更</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          現在のパスワードを確認してから、新しいパスワードに更新します。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="field-label">現在のパスワード</label>
          <input
            type="password"
            className="field-input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label">新しいパスワード</label>
          <input
            type="password"
            className="field-input"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <div>
          <label className="field-label">新しいパスワード（確認）</label>
          <input
            type="password"
            className="field-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
        {success && <p className="text-xs" style={{ color: 'var(--success)' }}>{success}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? '更新中...' : 'パスワードを更新'}
          </button>
          <button type="button" onClick={() => router.push(withBasePath('/settings'))} className="btn-secondary">
            設定へ戻る
          </button>
        </div>
      </form>
    </div>
  );
}

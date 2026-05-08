'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { withBasePath } from '@/lib/paths';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) setErrorMsg('リセットトークンが見つかりません');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setErrorMsg('パスワードが一致しません');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(withBasePath('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('done');
        setTimeout(() => router.push(withBasePath('/login')), 3000);
      } else {
        setErrorMsg(data.error ?? 'エラーが発生しました');
        setStatus('error');
      }
    } catch {
      setErrorMsg('接続エラーが発生しました');
      setStatus('error');
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="card w-full max-w-md p-8 shadow-2xl text-center">
          <p className="text-red-400 text-sm">リセットリンクが無効です。</p>
          <Link href={withBasePath('/forgot-password')} className="btn-primary inline-flex justify-center mt-4">
            再発行する
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-violet-300">新しいパスワードを設定</h1>
        <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
          8文字以上のパスワードを入力してください。
        </p>

        {status === 'done' ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              パスワードを変更しました
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              3秒後にログインページへ移動します…
            </p>
            <Link href={withBasePath('/login')} className="btn-primary inline-flex justify-center mt-2">
              今すぐログインページへ
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">新しいパスワード</label>
              <input
                type="password"
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="field-label">パスワードの確認</label>
              <input
                type="password"
                className="field-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="もう一度入力"
                required
              />
            </div>

            {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full justify-center py-2.5"
            >
              {status === 'loading' ? '更新中...' : 'パスワードを変更する'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href={withBasePath('/login')} className="text-xs text-violet-400 hover:text-violet-300">
            ← ログインに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-black" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

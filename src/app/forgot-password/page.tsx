'use client';

import { useState } from 'react';
import Link from 'next/link';
import { withBasePath } from '@/lib/paths';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(withBasePath('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('sent');
      } else {
        setErrorMsg(data.error ?? 'エラーが発生しました');
        setStatus('error');
      }
    } catch {
      setErrorMsg('接続エラーが発生しました');
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-violet-300">パスワードをお忘れですか？</h1>
        <p className="text-sm text-center mb-6 leading-6" style={{ color: 'var(--text-secondary)' }}>
          登録済みのメールアドレスを入力してください。<br />
          パスワードリセット用のリンクをお送りします。
        </p>

        {status === 'sent' ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📧</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              メールを送信しました
            </p>
            <p className="text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
              <strong>{email}</strong> にリセットリンクを送りました。<br />
              メールが届かない場合は迷惑メールフォルダもご確認ください。<br />
              リンクの有効期限は1時間です。
            </p>
            <Link href={withBasePath('/login')} className="btn-primary inline-flex justify-center mt-2">
              ログインページへ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label">メールアドレス</label>
              <input
                type="email"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
                required
                autoFocus
              />
            </div>

            {status === 'error' && (
              <p className="text-red-400 text-xs">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full justify-center py-2.5"
            >
              {status === 'loading' ? '送信中...' : 'リセットリンクを送る'}
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

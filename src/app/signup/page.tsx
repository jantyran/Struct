'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialSetup, setInitialSetup] = useState<boolean | null>(null);
  const [publicSignupEnabled, setPublicSignupEnabled] = useState(false);
  const router = useRouter();
  const { checkSession } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(withBasePath('/api/auth/setup-status'), { cache: 'no-store' });
        const data = await res.json() as { env_configured?: boolean; needs_initial_setup?: boolean; public_signup_enabled?: boolean };
        if (cancelled) return;
        if (data.env_configured === false) {
          router.replace(withBasePath('/setup/env'));
          return;
        }
        setInitialSetup(Boolean(data.needs_initial_setup));
        setPublicSignupEnabled(Boolean(data.public_signup_enabled));
        if (!data.needs_initial_setup && !data.public_signup_enabled) {
          router.replace(withBasePath('/login'));
        }
      } catch {
        if (!cancelled) setInitialSetup(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(withBasePath('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (res.ok) {
        await checkSession();
        const redirectTo =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('redirect') || withBasePath('/')
            : withBasePath('/');
        router.push(redirectTo);
      } else {
        if (data.requires_env_setup) {
          router.push(withBasePath('/setup/env'));
          return;
        }
        setError(data.error || 'アカウントの作成に失敗しました。');
      }
    } catch {
      setError('接続エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  if (initialSetup === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="card w-full max-w-md p-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-violet-300">
          {initialSetup ? '管理者アカウント作成' : 'Struct アカウント作成'}
        </h1>
        <p className="text-sm text-center mb-6 leading-6" style={{ color: 'var(--text-secondary)' }}>
          {initialSetup
            ? '最初のユーザーはシステム管理者として作成されます。'
            : 'プロジェクト・施策管理ツールとして使い始めるための組織アカウントを作成します。'}
        </p>
        
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="field-label">お名前</label>
            <input 
              type="text" 
              className="field-input" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田 太郎"
            />
          </div>
          <div>
            <label className="field-label">メールアドレス</label>
            <input 
              type="email" 
              className="field-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div>
            <label className="field-label">パスワード</label>
            <input 
              type="password" 
              className="field-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <div>
            <label className="field-label">パスワード（確認）</label>
            <input 
              type="password" 
              className="field-input" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
            />
          </div>
          
          {error && <p className="text-red-400 text-xs">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5 mt-4"
          >
            {loading ? '作成中...' : 'アカウント作成'}
          </button>
        </form>
        
        {!initialSetup && publicSignupEnabled && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              すでにアカウントをお持ちですか？{' '}
              <Link href={withBasePath('/login')} className="text-violet-400 hover:text-violet-300">
                ログイン
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

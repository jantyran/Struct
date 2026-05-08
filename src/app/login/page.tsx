'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { checkSession } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(withBasePath('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
        setError(data.error || 'ログインに失敗しました。');
      }
    } catch (err: any) {
      setError('接続エラーが発生しました。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-violet-300">Struct にログイン</h1>
        <p className="text-sm text-center mb-6 leading-6" style={{ color: 'var(--text-secondary)' }}>
          プロジェクトと施策の情報、タスク、成果物をひとつの画面で管理します。
        </p>
        
        <form onSubmit={handleLogin} className="space-y-4">
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
          
          {error && <p className="text-red-400 text-xs">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5 mt-4"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
        
        <div className="mt-6 text-center space-y-3">
          <p className="text-xs text-gray-500">
            アカウントをお持ちでないですか？{' '}
            <Link href={withBasePath('/signup')} className="text-violet-400 hover:text-violet-300">
              新規登録
            </Link>
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <Link href={withBasePath('/forgot-password')} className="text-violet-400 hover:text-violet-300">
              パスワードをお忘れですか？
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

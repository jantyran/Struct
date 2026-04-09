'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      setError('アカウントの作成に失敗しました。' + (err.message || ''));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <div className="card w-full max-w-md p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-violet-300">Struct アカウント作成</h1>
        
        <form onSubmit={handleSignup} className="space-y-4">
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
        
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            すでにアカウントをお持ちですか？{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

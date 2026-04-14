'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { withBasePath } from '@/lib/paths';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (token) {
      fetch(withBasePath(`/api/invites/${token}`))
        .then(res => res.json())
        .then(data => {
          if (data.error) setError(data.error);
          else setInvitation(data);
        });
    }
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      router.push(withBasePath(`/login?redirect=${encodeURIComponent(withBasePath(`/invites/${token}`))}`));
      return;
    }
    
    setAccepting(true);
    try {
      const res = await fetch(withBasePath(`/api/invites/${token}/accept`), { method: 'POST' });
      const data = await res.json();
      if (data.error) setError(data.error);
      else router.push(withBasePath(`/projects/${data.projectId}`));
    } catch (err) {
      setError('招待の受諾に失敗しました。');
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading || (!invitation && !error)) return <div className="p-10 text-center">読み込み中...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-6">
      <div className="card w-full max-w-md p-8 shadow-2xl text-center">
        <h1 className="text-2xl font-bold mb-4 text-violet-300">プロジェクトへの招待</h1>
        
        {error ? (
          <div className="text-red-400 mb-6">{error}</div>
        ) : (
          <>
            <p className="mb-6">
              あなたはプロジェクト <strong>{invitation.project.name}</strong> に招待されました。
            </p>
            {!user ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">参加するにはログインが必要です。</p>
                <button onClick={() => router.push(withBasePath(`/login?redirect=${encodeURIComponent(withBasePath(`/invites/${token}`))}`))} className="btn-primary w-full justify-center">
                  ログインして参加
                </button>
              </div>
            ) : user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
              <div className="text-amber-400 text-sm mb-6">
                この招待は {invitation.email} 宛てです。現在ログインしているアカウント ({user.email}) と異なります。
              </div>
            ) : (
              <button 
                onClick={handleAccept} 
                disabled={accepting}
                className="btn-primary w-full justify-center py-2.5"
              >
                {accepting ? '処理中...' : '招待を受諾して参加する'}
              </button>
            )}
          </>
        )}
        
        <button onClick={() => router.push(withBasePath('/'))} className="mt-6 text-xs text-gray-500 hover:text-gray-300">
          ダッシュボードへ戻る
        </button>
      </div>
    </div>
  );
}

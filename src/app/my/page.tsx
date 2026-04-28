'use client';

import Link from 'next/link';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

export default function MyPage() {
  const { user } = useAuth();

  const cards = [
    {
      href: '/my-todos',
      title: '自分のタスク',
      desc: '担当タスクを期限・状態・プロジェクト別に確認します。',
      meta: '今やること',
    },
    {
      href: '/my-report',
      title: '実行レポート',
      desc: '完了数、期限遵守、月別推移、関与プロジェクトを振り返ります。',
      meta: '過去の実行履歴',
    },
    {
      href: '/settings/user',
      title: '表示・操作設定',
      desc: '初期タブ、タスク表示、文字サイズなどを調整します。',
      meta: '自分用設定',
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {user?.name || user?.email || 'My page'}
        </p>
        <h1 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>マイページ</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          自分の担当作業と実行履歴をまとめて確認します。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={withBasePath(card.href)} className="card card-link p-5">
            <span className="text-[0.6875rem] font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
              {card.meta}
            </span>
            <h2 className="text-lg font-semibold mt-3" style={{ color: 'var(--text-primary)' }}>{card.title}</h2>
            <p className="text-sm mt-2 leading-6" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

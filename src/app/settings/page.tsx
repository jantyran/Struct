'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

const settingSections = [
  {
    href: '/settings/ai',
    title: 'AI設定',
    description: '使用するAIプロバイダ、モデル、APIキーを管理します。',
    meta: 'Anthropic / OpenAI / モデル切替',
  },
  {
    href: '/settings/content-templates',
    title: '生成コンテンツ設定',
    description: '生成対象のコンテンツ定義と生成指示を管理します。',
    meta: '生成物ライブラリ / 指示設計 / 再利用',
  },
  {
    href: '/project-types',
    title: 'プロジェクト設定',
    description: 'プロジェクト種別、フェーズ、初期項目テンプレート、使用する生成コンテンツの選択を管理します。',
    meta: '種別設計 / パス設計 / 項目設計 / コンテンツ選択',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(withBasePath('/login'));
    }
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">設定</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          変更頻度の低い構造設定をここから管理します。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingSections.map((section) => (
          <Link
            key={section.href}
            href={withBasePath(section.href)}
            className="card p-5 block hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {section.description}
                </p>
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                  {section.meta}
                </p>
              </div>
              <span className="text-sm text-violet-300">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

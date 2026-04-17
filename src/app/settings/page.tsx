'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

const settingSections = [
  {
    href: '/settings/organization',
    title: '組織設定全体',
    description: 'この組織で使っている設定を横断して一覧で確認します。',
    meta: 'Org情報 / AI / Assets / 種別 / 生成 / ユーザー / ロール',
    permission: 'manage_organization_settings',
  },
  {
    href: '/settings/organization/basic',
    title: '組織基本設定',
    description: '組織名、住所、既定言語、ロケール、タイムゾーンを管理します。',
    meta: 'Company Information / 組織名 / 住所 / Locale / Time Zone',
    permission: 'manage_organization_settings',
  },
  {
    href: '/settings/ai',
    title: 'AI設定',
    description: '使用するAIプロバイダ、モデル、APIキーを管理します。',
    meta: 'Anthropic / OpenAI / モデル切替',
    permission: 'manage_ai_settings',
  },
  {
    href: '/settings/content-templates',
    title: '生成コンテンツ設定',
    description: '生成対象のコンテンツ定義と生成指示を管理します。',
    meta: '生成物ライブラリ / 指示設計 / 再利用',
    permission: 'manage_project_settings',
  },
  {
    href: '/project-types',
    title: 'プロジェクト設定',
    description: 'プロジェクト種別、フェーズ、初期項目テンプレート、使用する生成コンテンツの選択を管理します。',
    meta: '種別設計 / パス設計 / 項目設計 / コンテンツ選択',
    permission: 'manage_project_settings',
  },
  {
    href: '/settings/users',
    title: 'ユーザー管理',
    description: '表示名・アバターと、担当者として使うユーザー情報を管理します。',
    meta: 'プロフィール / メンバー基盤 / Todo担当者準備',
    permission: 'manage_users',
  },
  {
    href: '/settings/roles',
    title: 'ロール・権限設定',
    description: 'ロールを定義し、表示・編集・管理権限を設定します。',
    meta: 'ロール定義 / 表示権限 / 編集権限 / 管理権限',
    permission: 'manage_system_roles',
  },
  {
    href: '/settings/project-roles',
    title: 'プロジェクトロール設定',
    description: 'プロジェクトメンバーに付与するロールと、プロジェクト内権限を設定します。',
    meta: 'メンバー権限 / 項目表示 / 編集 / ノート / 生成',
    permission: 'manage_project_roles',
  },
  {
    href: '/settings/password',
    title: 'パスワード変更',
    description: '現在のパスワードを確認したうえで、ログイン用パスワードを更新します。',
    meta: 'セキュリティ / パスワード再設定',
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
        {settingSections
          .filter((section) => !section.permission || user.system_permissions?.[section.permission])
          .map((section) => (
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

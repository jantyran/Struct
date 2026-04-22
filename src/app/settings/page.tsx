'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';
import { useAuth } from '@/components/AuthContext';

type SettingItem = {
  href: string;
  title: string;
  description: string;
  permission?: string;
};

type SettingGroup = {
  label: string;
  items: SettingItem[];
};

const settingGroups: SettingGroup[] = [
  {
    label: 'アカウント',
    items: [
      {
        href: '/settings/user',
        title: 'ユーザー設定',
        description: '文字サイズ・既定タブ・タスク表示など個人の使い勝手を調整します。',
      },
      {
        href: '/settings/password',
        title: 'パスワード変更',
        description: 'ログイン用パスワードを更新します。',
      },
    ],
  },
  {
    label: '組織',
    items: [
      {
        href: '/settings/organization/basic',
        title: '基本設定',
        description: '組織名・住所・言語・タイムゾーンを管理します。',
        permission: 'manage_organization_settings',
      },
      {
        href: '/settings/shortcuts',
        title: 'ショートカット設定',
        description: 'アプリ全体で使うキーボードショートカットを管理します。',
        permission: 'manage_organization_settings',
      },
      {
        href: '/settings/ai',
        title: 'AI設定',
        description: 'AIプロバイダ・モデル・APIキーを管理します。',
        permission: 'manage_ai_settings',
      },
    ],
  },
  {
    label: 'プロジェクト管理',
    items: [
      {
        href: '/project-types',
        title: 'プロジェクト設定',
        description: '種別・フェーズ・項目テンプレート・使用コンテンツを管理します。',
        permission: 'manage_project_settings',
      },
      {
        href: '/settings/content-templates',
        title: '生成コンテンツ設定',
        description: '生成対象のコンテンツ定義と生成指示を管理します。',
        permission: 'manage_project_settings',
      },
    ],
  },
  {
    label: 'ユーザー・権限',
    items: [
      {
        href: '/settings/users',
        title: 'ユーザー管理',
        description: 'プロフィール・メンバー情報を管理します。',
        permission: 'manage_users',
      },
      {
        href: '/settings/roles',
        title: 'ロール・権限設定',
        description: 'ロールを定義し、表示・編集・管理権限を設定します。',
        permission: 'manage_system_roles',
      },
      {
        href: '/settings/project-roles',
        title: 'プロジェクトロール設定',
        description: 'プロジェクトメンバーのロールと権限を設定します。',
        permission: 'manage_project_roles',
      },
    ],
  },
  {
    label: '開発',
    items: [
      {
        href: '/settings/developer',
        title: '開発設定',
        description: 'フィールドキー・IDなどデバッグ用のUI表示オプション（ブラウザ保存）。',
      },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push(withBasePath('/login'));
  }, [authLoading, router, user]);

  if (authLoading || !user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>読み込み中...</div>
      </div>
    );
  }

  const visibleGroups = settingGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || user.system_permissions?.[item.permission]),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold">設定</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          変更頻度の低い構造設定をここから管理します。
        </p>
      </div>

      {visibleGroups.map((group) => (
        <section key={group.label} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
            {group.label}
          </h2>
          <div className="card overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={withBasePath(item.href)}
                className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[rgba(15,154,177,0.04)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
                </div>
                <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

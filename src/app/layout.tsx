'use client';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { DevSettingsProvider } from '@/components/DevSettingsContext';
import { withBasePath } from '@/lib/paths';

function Sidebar() {
  const path = usePathname();
  const { logout, user, loading } = useAuth();

  const privateNavItems = [
    { href: '/', label: 'ダッシュボード', icon: '⬡' },
    { href: '/my-todos', label: '自分のタスク', icon: '✓' },
    { href: '/global-assets', label: 'Global Assets', icon: '◈' },
  ];
  const publicNavItems = [
    { href: '/about', label: 'Struct とは', icon: '◌' },
    { href: '/guide', label: '使い方', icon: '◎' },
    { href: '/login', label: 'ログイン', icon: '→' },
    { href: '/signup', label: '新規登録', icon: '+' },
  ];

  const navItems = user ? privateNavItems : publicNavItems;

  return (
    <aside
      className="w-60 shrink-0 flex flex-col border-r backdrop-blur-xl"
      style={{
        borderColor: 'var(--border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(240,250,252,0.94) 100%)',
      }}
    >
      {/* ロゴ */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
          Struct
        </span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>MKTキャンペーン運用デスク</p>
      </div>

      {/* ナビ */}
      <nav className="p-3 flex-1">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  path === item.href
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                style={path === item.href
                  ? {
                      background: 'linear-gradient(135deg, rgba(126,215,222,0.3) 0%, rgba(255,255,255,0.92) 100%)',
                      boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.16)',
                    }
                  : undefined}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!user && !loading && (
        <div className="p-4 border-t text-xs leading-5" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          Struct は、マーケティングキャンペーンの進行管理、情報集約、全体整理をひとつにまとめるためのアプリです。
        </div>
      )}

      {user && (
        <div className="p-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
          <Link
            href={withBasePath('/settings')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              path.startsWith('/settings') || path.startsWith('/project-types')
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            style={path.startsWith('/settings') || path.startsWith('/project-types')
              ? {
                  background: 'linear-gradient(135deg, rgba(126,215,222,0.3) 0%, rgba(255,255,255,0.92) 100%)',
                  boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.16)',
                }
              : undefined}
          >
            <span className="text-base">⚙</span>
            設定
          </Link>
          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
          <button 
            onClick={logout}
            className="text-xs w-full text-left text-gray-400 hover:text-gray-200 transition-colors"
          >
            ログアウト
          </button>
        </div>
      )}

      <div className="p-4 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        v0.1.0
      </div>
    </aside>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <title>Struct — MKTキャンペーン運用デスク</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex h-screen overflow-hidden">
        <AuthProvider>
          <DevSettingsProvider>
            <div className="flex h-full w-full">
              <Sidebar />
              <main className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
                {children}
              </main>
            </div>
          </DevSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

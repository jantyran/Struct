'use client';
import './globals.css';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { DevSettingsProvider } from '@/components/DevSettingsContext';
import { ShortcutProvider } from '@/components/ShortcutProvider';
import GlobalSearch from '@/components/GlobalSearch';
import { withBasePath } from '@/lib/paths';

function Sidebar() {
  const path = usePathname();
  const { logout, user, loading } = useAuth();
  // モバイルドロワーの開閉状態
  const [mobileOpen, setMobileOpen] = useState(false);

  const privateNavItems = [
    { href: '/', label: 'ダッシュボード', icon: '⬡' },
    { href: '/my', label: 'マイページ', icon: '◍' },
    { href: '/my-todos', label: '自分のタスク', icon: '✓' },
    { href: '/my-report', label: 'レポート', icon: '▧' },
    { href: '/master-data', label: 'マスターデータ', icon: '◈' },
  ];
  const publicNavItems = [
    { href: '/about', label: 'Struct とは', icon: '◌' },
    { href: '/guide', label: '使い方', icon: '◎' },
  ];

  const navItems = user ? privateNavItems : publicNavItems;

  return (
    <>
      {/* モバイル専用固定ヘッダー（lg 未満で表示） */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-12 flex items-center px-3 gap-2 border-b"
        style={{
          borderColor: 'var(--border)',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* ブランド名 */}
        <span className="text-sm font-bold tracking-tight shrink-0" style={{ color: 'var(--accent)' }}>
          Struct
        </span>

        {/* グローバル検索（ログイン時のみ） */}
        {user && (
          <div className="flex-1 min-w-0">
            <GlobalSearch />
          </div>
        )}
        {!user && <div className="flex-1" />}

        {/* ハンバーガー / × ボタン */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={mobileOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          {mobileOpen ? (
            /* × アイコン */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            /* ハンバーガーアイコン */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </header>

      {/* モバイルドロワー（mobileOpen=true のとき表示） */}
      {mobileOpen && (
        <>
          {/* 背景オーバーレイ：タップで閉じる */}
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ top: '3rem', background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setMobileOpen(false)}
          />
          {/* ドロワー本体 */}
          <div
            className="lg:hidden fixed left-0 right-0 z-40 border-b"
            style={{
              top: '3rem',
              borderColor: 'var(--border)',
              background: 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* ナビ */}
            <nav className="p-3">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                        path === item.href
                          ? 'text-slate-900'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      style={
                        path === item.href
                          ? {
                              background:
                                'linear-gradient(135deg, rgba(126,215,222,0.3) 0%, rgba(255,255,255,0.92) 100%)',
                              boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.16)',
                            }
                          : undefined
                      }
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ログイン時のみ設定・ログアウト */}
            {user && (
              <div className="px-3 pb-3 border-t pt-3 space-y-1" style={{ borderColor: 'var(--border)' }}>
                <Link
                  href={withBasePath('/settings')}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    path.startsWith('/settings') || path.startsWith('/project-types')
                      ? 'text-slate-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  style={
                    path.startsWith('/settings') || path.startsWith('/project-types')
                      ? {
                          background:
                            'linear-gradient(135deg, rgba(126,215,222,0.3) 0%, rgba(255,255,255,0.92) 100%)',
                          boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.16)',
                        }
                      : undefined
                  }
                >
                  <span className="text-base">⚙</span>
                  設定
                </Link>
                <div className="text-xs px-3 truncate" style={{ color: 'var(--text-muted)' }}>
                  {user.email}
                </div>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="text-xs w-full text-left px-3 py-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* デスクトップサイドバー（lg 以上で表示） */}
      <aside
        className="app-sidebar hidden lg:flex w-60 shrink-0 flex-col border-r backdrop-blur-xl"
        style={{
          borderColor: 'var(--border)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(240,250,252,0.94) 100%)',
        }}
      >
        {/* ロゴ */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            Struct
          </span>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            プロジェクト・施策管理ツール
          </p>
        </div>

        {user && (
          <div className="app-sidebar-search px-3 pt-3">
            <GlobalSearch />
          </div>
        )}

        {/* ナビ */}
        <nav className="app-sidebar-nav p-3 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    path === item.href
                      ? 'text-slate-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  style={
                    path === item.href
                      ? {
                          background:
                            'linear-gradient(135deg, rgba(126,215,222,0.3) 0%, rgba(255,255,255,0.92) 100%)',
                          boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.16)',
                        }
                      : undefined
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {!user && !loading && (
          <div
            className="app-sidebar-public p-4 border-t text-xs leading-5"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Struct は、プロジェクトと施策の情報整理、進行管理、実行支援をひとつにまとめる管理ツールです。
          </div>
        )}

        {user && (
          <div className="app-sidebar-user p-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <Link
              href={withBasePath('/settings')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                path.startsWith('/settings') || path.startsWith('/project-types')
                  ? 'text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              style={
                path.startsWith('/settings') || path.startsWith('/project-types')
                  ? {
                      background:
                        'linear-gradient(135deg, rgba(126,215,222,0.3) 0%, rgba(255,255,255,0.92) 100%)',
                      boxShadow: 'inset 0 0 0 1px rgba(15,154,177,0.16)',
                    }
                  : undefined
              }
            >
              <span className="text-base">⚙</span>
              設定
            </Link>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user.email}
            </div>
            <button
              onClick={logout}
              className="text-xs w-full text-left text-gray-400 hover:text-gray-200 transition-colors"
            >
              ログアウト
            </button>
          </div>
        )}

        <div
          className="p-4 border-t text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          v0.1.0
        </div>
      </aside>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <title>Struct — プロジェクト・施策管理ツール</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex h-screen overflow-hidden">
        <AuthProvider>
          <ShortcutProvider>
            <DevSettingsProvider>
              <div className="app-shell flex h-full w-full min-w-0">
                <Sidebar />
                {/* pt-12 でモバイルヘッダー分の余白を確保、デスクトップでは不要 */}
                <main
                  className="app-main flex-1 min-w-0 overflow-y-auto overflow-x-hidden pt-12 lg:pt-0"
                  style={{ background: 'transparent' }}
                >
                  {children}
                </main>
              </div>
            </DevSettingsProvider>
          </ShortcutProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

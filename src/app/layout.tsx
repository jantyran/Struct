'use client';
import './globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Sidebar() {
  const path = usePathname();

  const navItems = [
    { href: '/', label: 'ダッシュボード', icon: '⬡' },
    { href: '/global-assets', label: 'Global Assets', icon: '◈' },
  ];

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      {/* ロゴ */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--accent-light)' }}>
          Eidos
        </span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>マーケティング資産エンジン</p>
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
                    ? 'bg-violet-700/20 text-violet-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

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
        <title>Eidos — マーケティング資産エンジン</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}

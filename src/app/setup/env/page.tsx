'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';

interface EnvSetupStatus {
  env_file_exists: boolean;
  env_configured: boolean;
  suggested_jwt_secret: string;
  suggested_base_url: string;
  suggested_base_path: string;
}

export default function EnvSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<EnvSetupStatus | null>(null);
  const [jwtSecret, setJwtSecret] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:3002');
  const [basePath, setBasePath] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(withBasePath('/api/setup/env'), { cache: 'no-store' });
      const data = await res.json() as EnvSetupStatus;
      if (cancelled) return;
      if (data.env_configured) {
        router.replace(withBasePath('/signup'));
        return;
      }
      setStatus(data);
      setJwtSecret(data.suggested_jwt_secret);
      setBaseUrl(data.suggested_base_url);
      setBasePath(data.suggested_base_path);
    })().catch(() => {
      if (!cancelled) setError('環境設定の状態を取得できませんでした。');
    });
    return () => { cancelled = true; };
  }, [router]);

  async function createEnv() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(withBasePath('/api/setup/env'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwtSecret, baseUrl, basePath }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(data.error || '.env の作成に失敗しました。');
        return;
      }

      const setupRes = await fetch(withBasePath('/api/auth/setup-status'), { cache: 'no-store' });
      const setup = await setupRes.json() as { needs_initial_setup?: boolean };
      router.replace(withBasePath(setup.needs_initial_setup ? '/signup' : '/login'));
    } catch {
      setError('接続エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createEnv();
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="card w-full max-w-md p-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black px-4">
      <div className="card w-full max-w-lg p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-4 text-center text-violet-300">はじめる準備</h1>
        <p className="text-sm text-center mb-6 leading-6" style={{ color: 'var(--text-secondary)' }}>
          Struct を安全に使うための設定ファイルを作成します。通常はデフォルト値のままで問題ありません。
        </p>

        {status.env_file_exists && (
          <p className="text-sm mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
            .env は存在しますが JWT_SECRET が読み込まれていません。サーバーを再起動してください。
          </p>
        )}

        {!showAdvanced && (
          <div className="space-y-4">
            <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-950">
              <div className="font-semibold">自動で設定される内容</div>
              <div className="mt-1">
                ログイン状態を守るための秘密の文字列、アプリのURL、登録設定をこのサーバー用に作成します。
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="button"
              onClick={createEnv}
              disabled={loading || status.env_file_exists}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? '設定中...' : 'デフォルト値で進める'}
            </button>

            <button
              type="button"
              onClick={() => setShowAdvanced(true)}
              className="btn-secondary w-full justify-center py-2.5"
            >
              環境設定を指定
            </button>
          </div>
        )}

        {showAdvanced && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
            値の意味がわかる場合だけ変更してください。迷った場合は戻ってデフォルト値で進められます。
          </div>

          <div>
            <label className="field-label">ログイン保護用の秘密キー</label>
            <input
              className="field-input"
              value={jwtSecret}
              onChange={(e) => setJwtSecret(e.target.value)}
              required
              minLength={32}
            />
          </div>
          <div>
            <label className="field-label">このアプリを開くURL</label>
            <input
              className="field-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:3002"
            />
          </div>
          <div>
            <label className="field-label">サブパス</label>
            <input
              className="field-input"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder="例: /struct"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(false)}
              disabled={loading}
              className="btn-secondary flex-1 justify-center py-2.5"
            >
              戻る
            </button>
            <button
              type="submit"
              disabled={loading || status.env_file_exists}
              className="btn-primary flex-1 justify-center py-2.5"
            >
              {loading ? '設定中...' : 'この内容で進める'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

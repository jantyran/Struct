/**
 * インメモリ・レートリミッター
 * ブルートフォース攻撃・クレデンシャルスタッフィングを軽減する
 *
 * 制限: シングルプロセス前提。複数インスタンスでスケールする場合は
 * Redis や Upstash Rate Limit への差し替えを推奨する。
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 期限切れエントリの定期クリーンアップ（メモリリーク防止）
function cleanup(): void {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  /** allowed=false のとき次にリセットされるまでの残りミリ秒 */
  retryAfterMs: number;
}

/**
 * キー単位でレートリミットをチェックする
 * @param key     識別子（IPアドレス + エンドポイント など）
 * @param max     ウィンドウ内の最大リクエスト数（デフォルト: 10）
 * @param windowMs ウィンドウ幅ミリ秒（デフォルト: 60秒）
 */
export function checkRateLimit(
  key: string,
  max = 10,
  windowMs = 60_000
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Next.js Request からクライアントIPを取得するヘルパー
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

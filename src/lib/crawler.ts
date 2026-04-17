import * as cheerio from 'cheerio';

// SSRF対策: 外部URLとしてアクセスを許可するか検証する
function validateUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('無効なURLです');
  }

  // http / https のみ許可
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`スキーム "${url.protocol}" は許可されていません`);
  }

  const hostname = url.hostname.toLowerCase();

  // プライベートIP・ループバック・リンクローカルを拒否
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,                         // loopback
    /^10\./,                          // RFC1918 class A
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // RFC1918 class B
    /^192\.168\./,                    // RFC1918 class C
    /^169\.254\./,                    // AWS metadata / link-local
    /^0\./,                           // 0.0.0.0/8
    /^::1$/,                          // IPv6 loopback
    /^fc[0-9a-f]{2}:/i,               // IPv6 unique local (fc00::/7)
    /^\[::1\]$/,                      // IPv6 loopback in brackets
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('プライベートネットワークへのアクセスは禁止されています');
    }
  }
}

export async function crawlUrl(url: string): Promise<string> {
  validateUrl(url);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Struct/1.0 Marketing Asset Generator (research bot)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // ノイズ要素を削除
  $('script, style, nav, footer, header, aside, .sidebar, .nav, .menu, .ad, .advertisement').remove();
  $('[class*="cookie"], [class*="popup"], [class*="modal"], [id*="cookie"]').remove();

  // メインコンテンツを優先取得
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content', 'body'];
  let text = '';
  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length) {
      text = el.text();
      break;
    }
  }

  // クリーンアップ: 連続空白・改行を圧縮
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 4000);
}

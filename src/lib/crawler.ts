import * as cheerio from 'cheerio';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

// SSRF対策: 外部URLとしてアクセスを許可するか検証する
async function validateExternalUrl(urlString: string): Promise<URL> {
  const url = parseUrl(urlString);

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('プライベートネットワークへのアクセスは禁止されています');
  }

  const literalIp = isIP(hostname) ? hostname : '';
  if (literalIp && isBlockedIp(literalIp)) {
    throw new Error('プライベートネットワークへのアクセスは禁止されています');
  }

  const addresses = await lookup(hostname, { all: true, verbatim: false });
  if (!addresses.length || addresses.some((entry) => isBlockedIp(entry.address))) {
    throw new Error('プライベートネットワークへのアクセスは禁止されています');
  }

  return url;
}

function parseUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('無効なURLです');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`スキーム "${url.protocol}" は許可されていません`);
  }

  if (url.username || url.password) {
    throw new Error('認証情報を含むURLは許可されていません');
  }

  return url;
}

function isBlockedIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split('.').map((part) => Number(part));
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) {
      return isBlockedIp(lower.replace('::ffff:', ''));
    }
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80:')
    );
  }

  return true;
}

export async function crawlUrl(url: string): Promise<string> {
  const response = await fetchValidated(url, 0);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !/^(text\/html|application\/xhtml\+xml|text\/plain)\b/i.test(contentType)) {
    throw new Error('HTMLまたはテキスト以外のコンテンツは取得できません');
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > 1_000_000) {
    throw new Error('取得対象のコンテンツが大きすぎます');
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

async function fetchValidated(urlString: string, redirectCount: number): Promise<Response> {
  if (redirectCount > 3) {
    throw new Error('リダイレクト回数が多すぎます');
  }

  const url = await validateExternalUrl(urlString);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Struct/1.0 Marketing Asset Generator (research bot)',
      'Accept': 'text/html,application/xhtml+xml,text/plain',
    },
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) throw new Error('リダイレクト先がありません');
    return fetchValidated(new URL(location, url).toString(), redirectCount + 1);
  }

  return response;
}

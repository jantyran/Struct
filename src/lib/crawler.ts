import * as cheerio from 'cheerio';

export async function crawlUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Eidos/1.0 Marketing Asset Generator (research bot)',
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

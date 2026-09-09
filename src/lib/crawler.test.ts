import { describe, it, expect } from 'vitest';
import { crawlUrl } from './crawler';

describe('SSRF Protection in Crawler', () => {
  it('blocks localhost / loopback addresses', async () => {
    await expect(crawlUrl('http://localhost:3000')).rejects.toThrow(
      'プライベートネットワークへのアクセスは禁止されています'
    );
    await expect(crawlUrl('http://127.0.0.1:8080')).rejects.toThrow(
      'プライベートネットワークへのアクセスは禁止されています'
    );
  });

  it('blocks non-http schemes', async () => {
    await expect(crawlUrl('ftp://example.com/file')).rejects.toThrow(
      'スキーム "ftp:" は許可されていません'
    );
    await expect(crawlUrl('file:///etc/passwd')).rejects.toThrow(
      'スキーム "file:" は許可されていません'
    );
  });

  it('blocks credentials in URLs', async () => {
    await expect(crawlUrl('http://user:pass@example.com')).rejects.toThrow(
      '認証情報を含むURLは許可されていません'
    );
  });
});

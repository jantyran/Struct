import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'struct-encryption-key-fallback';
  return createHash('sha256').update(secret).digest();
}

/**
 * 文字列を AES-256-GCM で暗号化する
 */
export function encryptString(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = randomBytes(12); // GCM 推奨 12バイト IV
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * 暗号化された文字列を復号化する。平文の場合はそのまま返す
 */
export function decryptString(value: string): string {
  if (!value) return '';
  if (!value.startsWith(PREFIX)) {
    // 平文のまま保存されているレガシーデータ
    return value;
  }

  try {
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return value;
    const [ivHex, authTagHex, ciphertextHex] = parts;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt string:', err);
    return '';
  }
}

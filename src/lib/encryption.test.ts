import { describe, it, expect } from 'vitest';
import { encryptString, decryptString } from './encryption';

describe('Encryption utilities', () => {
  it('encrypts and decrypts text successfully', () => {
    const original = 'sk-proj-super-secret-api-key-12345';
    const encrypted = encryptString(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);

    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(original);
  });

  it('handles empty string gracefully', () => {
    expect(encryptString('')).toBe('');
    expect(decryptString('')).toBe('');
  });

  it('returns legacy plaintext without error (backward compatibility)', () => {
    const plaintext = 'sk-plain-old-unencrypted-key';
    const result = decryptString(plaintext);
    expect(result).toBe(plaintext);
  });

  it('handles malformed encrypted strings without crashing', () => {
    expect(decryptString('enc:v1:invalid')).toBe('enc:v1:invalid');
    expect(decryptString('enc:v1:1234:5678:abcd')).toBe('');
  });
});

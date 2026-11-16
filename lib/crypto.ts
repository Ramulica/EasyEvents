import * as Crypto from 'expo-crypto';

export async function hashSecret(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `easyevents:${value}`);
}

export async function verifySecret(value: string, hash: string | null): Promise<boolean> {
  if (!hash) return true;
  const next = await hashSecret(value);
  return next === hash;
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEventCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function createChatId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

import { createHash, createPublicKey, verify } from 'node:crypto';

export function bodyHash(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('base64url');
}

export function canonicalRequest(
  method: string,
  url: string,
  timestamp: string,
  nonce: string,
  body: unknown
): string {
  return [method.toUpperCase(), url, timestamp, nonce, bodyHash(body)].join('\n');
}

export function verifySignature(publicKey: string, message: string, signature: string): boolean {
  try {
    return verify(
      null,
      Buffer.from(message),
      createPublicKey(publicKey),
      Buffer.from(signature, 'base64url')
    );
  } catch {
    return false;
  }
}

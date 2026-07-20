import { generateKeyPairSync, sign } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { canonicalRequest, verifySignature } from '../src/lib/crypto.js';

describe('device signature verification', () => {
  it('accepts an Ed25519 signature for the canonical request and rejects tampering', () => {
    const pair = generateKeyPairSync('ed25519');
    const message = canonicalRequest(
      'POST',
      '/api/v1/devices',
      '2026-07-20T12:00:00.000Z',
      'nonce-123',
      { key: 'value' }
    );
    const signature = sign(null, Buffer.from(message), pair.privateKey).toString('base64url');
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

    expect(verifySignature(publicKey, message, signature)).toBe(true);
    expect(verifySignature(publicKey, `${message}tampered`, signature)).toBe(false);
  });
});

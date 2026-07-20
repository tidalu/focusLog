import { createHash, randomUUID } from 'node:crypto';
import type { DeviceIdentity } from '../identity/device-identity.js';
import { signDeviceMessage } from '../identity/device-identity.js';

function canonicalRequest(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body: unknown
): string {
  const bodyHash = createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('base64url');
  return [method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\n');
}

export class AuthenticatedFocusLogClient {
  constructor(
    private readonly apiBase: URL,
    private readonly identity: DeviceIdentity
  ) {}

  async bootstrap(displayName: string): Promise<{ ownerId: string; deviceId: string }> {
    const payload = {
      ownerId: this.identity.ownerId,
      deviceId: this.identity.deviceId,
      publicKey: this.identity.publicKey,
      fingerprint: this.identity.fingerprint,
      platform: 'WINDOWS',
      displayName,
      proof: signDeviceMessage(
        this.identity,
        `FOCUSLOG:bootstrap:${this.identity.fingerprint}:${this.identity.publicKey}`
      )
    };
    return this.request('/api/v1/devices/bootstrap', 'POST', payload, false);
  }

  async createPairingCode(): Promise<{ pairingId: string; code: string; expiresAt: string }> {
    return this.request('/api/v1/devices/pairing-codes', 'POST', {});
  }

  async claimPairingCode(
    code: string,
    displayName: string
  ): Promise<{ pairingId: string; expiresAt: string }> {
    const payload = {
      code,
      deviceId: this.identity.deviceId,
      publicKey: this.identity.publicKey,
      fingerprint: this.identity.fingerprint,
      platform: 'WINDOWS',
      displayName,
      proof: signDeviceMessage(
        this.identity,
        `FOCUSLOG:pairing-claim:${this.identity.fingerprint}:${this.identity.publicKey}`
      )
    };
    return this.request('/api/v1/devices/pairing-codes/claim', 'POST', payload, false);
  }

  async approvePairing(pairingId: string): Promise<void> {
    await this.request(`/api/v1/devices/pairing-requests/${pairingId}/approve`, 'POST', {});
  }

  async pendingPairings(): Promise<
    Array<{ id: string; candidateDeviceId: string; candidatePlatform: string; expiresAt: string }>
  > {
    return this.request('/api/v1/devices/pairing-requests', 'GET', undefined);
  }

  async consumePairing(pairingId: string): Promise<{ ownerId: string; deviceId: string }> {
    const proof = signDeviceMessage(
      this.identity,
      `FOCUSLOG:pairing-consume:${pairingId}:${this.identity.fingerprint}`
    );
    return this.request(
      `/api/v1/devices/pairing-requests/${pairingId}/consume`,
      'POST',
      { proof },
      false
    );
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.request(`/api/v1/devices/${deviceId}/revoke`, 'POST', {});
  }

  async push(operations: unknown[]): Promise<{
    results: Array<{
      operationId: string;
      status: 'accepted' | 'duplicate' | 'conflict';
      conflictId?: string;
    }>;
  }> {
    const normalized = operations.map((operation) => {
      const row = operation as Record<string, unknown>;
      return {
        operationId: row.operation_id,
        deviceSequence: row.device_sequence,
        entityType: row.entity_type,
        entityId: row.entity_id,
        kind: row.kind,
        baseVersion: row.base_version ?? undefined,
        payload:
          typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json,
        occurredAt: row.occurred_at
      };
    });
    return this.request('/api/v1/sync/push', 'POST', { operations: normalized });
  }

  async pull(
    cursor: string
  ): Promise<{ changes: Array<Record<string, unknown>>; nextCursor: string }> {
    return this.request(`/api/v1/sync/pull?cursor=${encodeURIComponent(cursor)}`, 'GET', undefined);
  }

  async acknowledge(cursor: string): Promise<void> {
    await this.request('/api/v1/sync/ack', 'POST', { cursor });
  }

  async permanentlyDeleteOwnerData(): Promise<void> {
    await this.request('/api/v1/data', 'DELETE', {
      confirmation: 'DELETE ALL FOCUSLOG DATA'
    });
  }

  private async request<T>(
    path: string,
    method: string,
    body?: unknown,
    authenticated = true
  ): Promise<T> {
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (authenticated) {
      headers['x-focuslog-device-id'] = this.identity.deviceId;
      headers['x-focuslog-timestamp'] = timestamp;
      headers['x-focuslog-nonce'] = nonce;
      headers['x-focuslog-signature'] = signDeviceMessage(
        this.identity,
        canonicalRequest(method, path, timestamp, nonce, body)
      );
    }
    const response = await fetch(new URL(path, this.apiBase), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`FocusLog API ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }
}

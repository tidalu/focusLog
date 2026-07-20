import type { PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { ulid } from 'ulid';

import type { ServerConfig } from '../config.js';
import { canonicalRequest, verifySignature } from '../lib/crypto.js';
import { ApiError } from '../lib/errors.js';

export interface AuthenticatedDevice {
  readonly id: string;
  readonly ownerId: string;
  readonly isOwnerDevice: boolean;
}

export interface DeviceCredential {
  readonly deviceId: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly signature: string;
  readonly message: string;
}

function header(request: FastifyRequest, name: string): string {
  const value = request.headers[name];
  if (typeof value !== 'string' || value.length === 0)
    throw new ApiError(401, 'DEVICE_AUTH_REQUIRED', `Missing ${name} header.`);
  return value;
}

export async function authenticateDevice(
  request: FastifyRequest,
  prisma: PrismaClient,
  config: ServerConfig
): Promise<AuthenticatedDevice> {
  const deviceId = header(request, 'x-focuslog-device-id');
  const timestamp = header(request, 'x-focuslog-timestamp');
  const nonce = header(request, 'x-focuslog-nonce');
  const signature = header(request, 'x-focuslog-signature');
  return authenticateDeviceCredential(
    {
      deviceId,
      timestamp,
      nonce,
      signature,
      message: canonicalRequest(
        request.method,
        request.raw.url ?? request.url,
        timestamp,
        nonce,
        request.body
      )
    },
    prisma,
    config
  );
}

export async function authenticateDeviceCredential(
  credential: DeviceCredential,
  prisma: PrismaClient,
  config: ServerConfig
): Promise<AuthenticatedDevice> {
  const { deviceId, timestamp, nonce, signature, message } = credential;
  const timestampMs = Date.parse(timestamp);
  if (
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > config.DEVICE_AUTH_MAX_AGE_SECONDS * 1000
  ) {
    throw new ApiError(
      401,
      'DEVICE_AUTH_EXPIRED',
      'Device request timestamp is outside the permitted window.'
    );
  }
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true, ownerId: true, publicKey: true, status: true, isOwnerDevice: true }
  });
  if (!device || device.status !== 'ACTIVE')
    throw new ApiError(401, 'DEVICE_NOT_TRUSTED', 'Device is not active.');
  if (!verifySignature(device.publicKey, message, signature))
    throw new ApiError(401, 'DEVICE_SIGNATURE_INVALID', 'Device signature is invalid.');
  try {
    await prisma.deviceRequestNonce.create({
      data: {
        id: ulid(),
        deviceId,
        nonce,
        expiresAt: new Date(timestampMs + config.DEVICE_AUTH_MAX_AGE_SECONDS * 1000)
      }
    });
  } catch {
    throw new ApiError(
      409,
      'DEVICE_REQUEST_REPLAYED',
      'Device request nonce has already been used.'
    );
  }
  return { id: device.id, ownerId: device.ownerId, isOwnerDevice: device.isOwnerDevice };
}

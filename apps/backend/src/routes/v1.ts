import { createHash } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import {
  addReportDays,
  heatmapDays,
  localDayForInstant,
  reportDayBounds
} from '@focuslog/shared-utils';

import type { ServerConfig } from '../config.js';
import { verifySignature } from '../lib/crypto.js';
import { ApiError } from '../lib/errors.js';
import { authenticateDevice, type AuthenticatedDevice } from '../plugins/device-auth.js';
import { SyncService } from '../services/sync-service.js';
import type { FocusLogWebSocketGateway } from '../services/websocket-gateway.js';

const id = z.string().length(26);
const deviceInput = z.object({
  deviceId: id.optional(),
  publicKey: z.string().min(32),
  fingerprint: z.string().min(16).max(128),
  platform: z.enum(['WINDOWS', 'ANDROID']),
  displayName: z.string().max(120).optional(),
  proof: z.string().min(16)
});
const modeInput = z.object({
  name: z.string().trim().min(1).max(120),
  intervalMinutes: z.number().int().positive().max(1440),
  policy: z.record(z.unknown())
});
const sessionInput = z.object({
  focusModeId: id,
  name: z.string().max(160).optional(),
  schedulePolicy: z.record(z.unknown()),
  timezoneId: z.string().min(1).max(64),
  startedAt: z.coerce.date()
});
const checkInInput = z.object({
  reminderOccurrenceId: id.optional(),
  focusSessionId: id.optional(),
  categoryId: id.optional(),
  body: z.string().trim().min(1),
  submittedAt: z.coerce.date(),
  timezoneId: z.string().min(1).max(64)
});
const searchQuery = z.object({
  query: z.string().trim().min(1).max(500),
  tagId: id.optional(),
  categoryId: id.optional(),
  sessionId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100)
});

function proofMessage(action: string, input: { publicKey: string; fingerprint: string }): string {
  return `FOCUSLOG:${action}:${input.fingerprint}:${input.publicKey}`;
}

function pairingCode(): string {
  return ulid().slice(-12).toUpperCase();
}

function hashPairingCode(code: string): string {
  return createHash('sha256')
    .update(code.replaceAll(/[^A-Za-z0-9]/g, '').toUpperCase())
    .digest('base64url');
}

function json(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function registerV1Routes(
  prisma: PrismaClient,
  config: ServerConfig,
  websocketGateway?: FocusLogWebSocketGateway
): FastifyPluginAsync {
  return async (app) => {
    async function auth(request: FastifyRequest): Promise<AuthenticatedDevice> {
      return authenticateDevice(request, prisma, config);
    }
    function owner(device: AuthenticatedDevice): void {
      if (!device.isOwnerDevice)
        throw new ApiError(403, 'OWNER_DEVICE_REQUIRED', 'This action requires the owner device.');
    }

    app.post(
      '/devices/bootstrap',
      { config: { rateLimit: { max: 5, timeWindow: '1 hour' } }, schema: { tags: ['devices'] } },
      async (request, reply) => {
        const input = deviceInput.parse(request.body);
        if (!verifySignature(input.publicKey, proofMessage('bootstrap', input), input.proof))
          throw new ApiError(401, 'DEVICE_PROOF_INVALID', 'Device proof is invalid.');
        const ownerId =
          id.optional().parse((request.body as { ownerId?: string }).ownerId) ?? ulid();
        const deviceId = input.deviceId ?? ulid();
        const existing = await prisma.device.findUnique({ where: { id: deviceId } });
        if (existing) {
          if (existing.ownerId !== ownerId || existing.publicKey !== input.publicKey)
            throw new ApiError(
              409,
              'DEVICE_ID_CONFLICT',
              'Device identifier is already registered.'
            );
          return reply.send({ ownerId, deviceId });
        }
        if (await prisma.owner.findUnique({ where: { id: ownerId }, select: { id: true } }))
          throw new ApiError(
            409,
            'OWNER_ALREADY_REGISTERED',
            'This owner already has a registered device; use an approved pairing code.'
          );
        await prisma.$transaction([
          prisma.owner.upsert({ where: { id: ownerId }, update: {}, create: { id: ownerId } }),
          prisma.ownerSyncState.upsert({ where: { ownerId }, update: {}, create: { ownerId } }),
          prisma.setting.upsert({
            where: { ownerId },
            update: {},
            create: { ownerId, values: {}, version: ulid() }
          }),
          prisma.device.create({
            data: {
              id: deviceId,
              ownerId,
              publicKey: input.publicKey,
              fingerprint: input.fingerprint,
              platform: input.platform,
              displayName: input.displayName,
              isOwnerDevice: true
            }
          })
        ]);
        return reply.status(201).send({ ownerId, deviceId });
      }
    );

    app.post(
      '/devices/pairing-requests',
      { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { tags: ['devices'] } },
      async (request, reply) => {
        const input = deviceInput.extend({ ownerId: id }).parse(request.body);
        if (!verifySignature(input.publicKey, proofMessage('pairing-request', input), input.proof))
          throw new ApiError(401, 'DEVICE_PROOF_INVALID', 'Device proof is invalid.');
        const pairing = await prisma.devicePairing.create({
          data: {
            id: ulid(),
            ownerId: input.ownerId,
            candidateDeviceId: input.deviceId ?? ulid(),
            candidatePublicKey: input.publicKey,
            candidateFingerprint: input.fingerprint,
            candidatePlatform: input.platform,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          }
        });
        return reply.status(201).send({ pairingId: pairing.id, expiresAt: pairing.expiresAt });
      }
    );

    app.post(
      '/devices/pairing-codes',
      { schema: { tags: ['devices'] } },
      async (request, reply) => {
        const device = await auth(request);
        owner(device);
        const code = pairingCode();
        const pairing = await prisma.devicePairing.create({
          data: {
            id: ulid(),
            ownerId: device.ownerId,
            pairingCodeHash: hashPairingCode(code),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000)
          }
        });
        return reply
          .status(201)
          .send({ pairingId: pairing.id, code, expiresAt: pairing.expiresAt });
      }
    );

    app.post(
      '/devices/pairing-codes/claim',
      { config: { rateLimit: { max: 10, timeWindow: '1 hour' } }, schema: { tags: ['devices'] } },
      async (request, reply) => {
        const input = deviceInput
          .extend({ deviceId: id, code: z.string().min(8).max(64) })
          .parse(request.body);
        if (!verifySignature(input.publicKey, proofMessage('pairing-claim', input), input.proof))
          throw new ApiError(401, 'DEVICE_PROOF_INVALID', 'Device proof is invalid.');
        const pairing = await prisma.devicePairing.findUnique({
          where: { pairingCodeHash: hashPairingCode(input.code) }
        });
        if (!pairing || pairing.status !== 'PENDING' || pairing.expiresAt <= new Date())
          throw new ApiError(409, 'PAIRING_NOT_AVAILABLE', 'Pairing code is not available.');
        const claimed = await prisma.devicePairing.update({
          where: { id: pairing.id },
          data: {
            candidateDeviceId: input.deviceId,
            candidatePublicKey: input.publicKey,
            candidateFingerprint: input.fingerprint,
            candidatePlatform: input.platform
          }
        });
        return reply.status(201).send({ pairingId: claimed.id, expiresAt: claimed.expiresAt });
      }
    );

    app.get('/devices/pairing-requests', { schema: { tags: ['devices'] } }, async (request) => {
      const device = await auth(request);
      owner(device);
      return prisma.devicePairing.findMany({
        where: {
          ownerId: device.ownerId,
          status: 'PENDING',
          candidateDeviceId: { not: null },
          expiresAt: { gt: new Date() }
        },
        select: {
          id: true,
          candidateDeviceId: true,
          candidatePlatform: true,
          expiresAt: true,
          createdAt: true
        }
      });
    });

    app.post(
      '/devices/pairing-requests/:pairingId/approve',
      { schema: { tags: ['devices'] } },
      async (request) => {
        const device = await auth(request);
        owner(device);
        const pairingId = id.parse((request.params as { pairingId: string }).pairingId);
        const pending = await prisma.devicePairing.findFirst({
          where: { id: pairingId, ownerId: device.ownerId }
        });
        if (!pending || pending.status !== 'PENDING')
          throw new ApiError(409, 'PAIRING_NOT_AVAILABLE', 'Pairing request is not available.');
        if (pending.expiresAt <= new Date())
          throw new ApiError(409, 'PAIRING_EXPIRED', 'Pairing request has expired.');
        if (
          !pending.candidateDeviceId ||
          !pending.candidatePublicKey ||
          !pending.candidateFingerprint ||
          !pending.candidatePlatform
        )
          throw new ApiError(
            409,
            'PAIRING_NOT_CLAIMED',
            'A candidate device has not claimed this pairing code.'
          );
        const pairing = await prisma.devicePairing.update({
          where: { id: pairingId },
          data: { status: 'APPROVED', approvedByDeviceId: device.id, approvedAt: new Date() }
        });
        return { pairingId: pairing.id, status: pairing.status };
      }
    );

    app.post(
      '/devices/pairing-requests/:pairingId/consume',
      { schema: { tags: ['devices'] } },
      async (request, reply) => {
        const pairingId = id.parse((request.params as { pairingId: string }).pairingId);
        const input = z.object({ proof: z.string().min(16) }).parse(request.body);
        const pairing = await prisma.devicePairing.findUnique({ where: { id: pairingId } });
        if (!pairing || pairing.status !== 'APPROVED' || pairing.expiresAt <= new Date())
          throw new ApiError(409, 'PAIRING_NOT_AVAILABLE', 'Pairing request is not available.');
        if (
          !pairing.candidateDeviceId ||
          !pairing.candidatePublicKey ||
          !pairing.candidateFingerprint ||
          !pairing.candidatePlatform
        )
          throw new ApiError(
            409,
            'PAIRING_NOT_CLAIMED',
            'A candidate device has not claimed this pairing code.'
          );
        if (
          !verifySignature(
            pairing.candidatePublicKey,
            `FOCUSLOG:pairing-consume:${pairing.id}:${pairing.candidateFingerprint}`,
            input.proof
          )
        )
          throw new ApiError(401, 'DEVICE_PROOF_INVALID', 'Device proof is invalid.');
        if (
          !pairing.candidateDeviceId ||
          !pairing.candidatePublicKey ||
          !pairing.candidateFingerprint ||
          !pairing.candidatePlatform
        )
          throw new ApiError(
            409,
            'PAIRING_NOT_CLAIMED',
            'A candidate device has not claimed this pairing code.'
          );
        const deviceId = pairing.candidateDeviceId;
        await prisma.$transaction([
          prisma.device.create({
            data: {
              id: deviceId,
              ownerId: pairing.ownerId,
              publicKey: pairing.candidatePublicKey,
              fingerprint: pairing.candidateFingerprint,
              platform: pairing.candidatePlatform
            }
          }),
          prisma.syncCursor.create({ data: { ownerId: pairing.ownerId, deviceId } }),
          prisma.devicePairing.update({
            where: { id: pairing.id },
            data: { status: 'CONSUMED', consumedAt: new Date() }
          })
        ]);
        return reply.status(201).send({ deviceId, ownerId: pairing.ownerId });
      }
    );

    app.get('/devices', { schema: { tags: ['devices'] } }, async (request) => {
      const device = await auth(request);
      return prisma.device.findMany({
        where: { ownerId: device.ownerId },
        select: {
          id: true,
          platform: true,
          displayName: true,
          status: true,
          isOwnerDevice: true,
          lastSeenAt: true,
          revokedAt: true,
          createdAt: true
        }
      });
    });
    app.post('/devices/:deviceId/revoke', { schema: { tags: ['devices'] } }, async (request) => {
      const device = await auth(request);
      owner(device);
      const target = id.parse((request.params as { deviceId: string }).deviceId);
      if (target === device.id)
        throw new ApiError(
          409,
          'OWNER_DEVICE_CANNOT_REVOKE_SELF',
          'Promote recovery before revoking the owner device.'
        );
      const revoked = await prisma.device.update({
        where: { id: target, ownerId: device.ownerId },
        data: { status: 'REVOKED', revokedAt: new Date() }
      });
      websocketGateway?.notifyDeviceRevoked(device.ownerId, target);
      return revoked;
    });

    app.get('/focus-modes', { schema: { tags: ['focus modes'] } }, async (request) => {
      const device = await auth(request);
      return prisma.focusMode.findMany({
        where: { ownerId: device.ownerId, deletedAt: null },
        orderBy: { createdAt: 'asc' }
      });
    });
    app.post('/focus-modes', { schema: { tags: ['focus modes'] } }, async (request, reply) => {
      const device = await auth(request);
      const input = modeInput.parse(request.body);
      return reply.status(201).send(
        await prisma.focusMode.create({
          data: {
            id: ulid(),
            ownerId: device.ownerId,
            ...input,
            policy: json(input.policy),
            version: ulid()
          }
        })
      );
    });
    app.patch('/focus-modes/:modeId', { schema: { tags: ['focus modes'] } }, async (request) => {
      const device = await auth(request);
      const modeId = id.parse((request.params as { modeId: string }).modeId);
      const input = modeInput.partial().parse(request.body);
      return prisma.focusMode.update({
        where: { id: modeId, ownerId: device.ownerId },
        data: { ...input, policy: input.policy ? json(input.policy) : undefined, version: ulid() }
      });
    });
    app.delete('/focus-modes/:modeId', { schema: { tags: ['focus modes'] } }, async (request) => {
      const device = await auth(request);
      const modeId = id.parse((request.params as { modeId: string }).modeId);
      return prisma.focusMode.update({
        where: { id: modeId, ownerId: device.ownerId },
        data: { deletedAt: new Date(), version: ulid() }
      });
    });

    app.get('/focus-sessions', { schema: { tags: ['focus sessions'] } }, async (request) => {
      const device = await auth(request);
      return prisma.focusSession.findMany({
        where: { ownerId: device.ownerId, deletedAt: null },
        orderBy: { startedAt: 'desc' }
      });
    });
    app.post(
      '/focus-sessions',
      { schema: { tags: ['focus sessions'] } },
      async (request, reply) => {
        const device = await auth(request);
        const input = sessionInput.parse(request.body);
        return reply.status(201).send(
          await prisma.focusSession.create({
            data: {
              id: ulid(),
              ownerId: device.ownerId,
              ...input,
              schedulePolicy: json(input.schedulePolicy),
              version: ulid()
            }
          })
        );
      }
    );
    app.patch(
      '/focus-sessions/:sessionId',
      { schema: { tags: ['focus sessions'] } },
      async (request) => {
        const device = await auth(request);
        const sessionId = id.parse((request.params as { sessionId: string }).sessionId);
        const input = sessionInput.partial().parse(request.body);
        return prisma.focusSession.update({
          where: { id: sessionId, ownerId: device.ownerId },
          data: {
            ...input,
            schedulePolicy: input.schedulePolicy ? json(input.schedulePolicy) : undefined,
            version: ulid()
          } as Prisma.FocusSessionUncheckedUpdateInput
        });
      }
    );

    app.get('/reminders', { schema: { tags: ['reminders'] } }, async (request) => {
      const device = await auth(request);
      return prisma.reminderOccurrence.findMany({
        where: { ownerId: device.ownerId },
        orderBy: { scheduledAt: 'asc' }
      });
    });
    app.post(
      '/reminders/:occurrenceId/transitions',
      { schema: { tags: ['reminders'] } },
      async (request) => {
        const device = await auth(request);
        const occurrenceId = id.parse((request.params as { occurrenceId: string }).occurrenceId);
        const input = z
          .object({
            toState: z.enum([
              'DUE',
              'PRESENTED',
              'SNOOZED',
              'SKIPPED',
              'EMERGENCY_DISMISSED',
              'MISSED',
              'SUPERSEDED'
            ]),
            reason: z.string().max(500).optional(),
            occurredAt: z.coerce.date().default(() => new Date()),
            effectiveDueAt: z.coerce.date().optional()
          })
          .parse(request.body);
        return prisma.$transaction(async (tx) => {
          const occurrence = await tx.reminderOccurrence.findFirstOrThrow({
            where: { id: occurrenceId, ownerId: device.ownerId }
          });
          const allowed: Record<string, readonly string[]> = {
            SCHEDULED: ['DUE', 'SUPERSEDED'],
            DUE: ['PRESENTED', 'SNOOZED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'MISSED'],
            PRESENTED: ['SNOOZED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'MISSED'],
            SNOOZED: ['DUE', 'SUPERSEDED']
          };
          if (!allowed[occurrence.state]?.includes(input.toState))
            throw new ApiError(
              409,
              'REMINDER_TRANSITION_INVALID',
              `Invalid reminder transition ${occurrence.state} -> ${input.toState}.`
            );
          if (input.toState === 'SNOOZED' && !input.effectiveDueAt)
            throw new ApiError(
              400,
              'REMINDER_SNOOZE_DUE_REQUIRED',
              'Snoozing requires an effective due time.'
            );
          await tx.reminderOccurrence.update({
            where: { id: occurrenceId },
            data: {
              state: input.toState,
              scheduledAt: input.effectiveDueAt,
              resolvedAt: [
                'COMPLETED',
                'SKIPPED',
                'EMERGENCY_DISMISSED',
                'MISSED',
                'SUPERSEDED'
              ].includes(input.toState)
                ? input.occurredAt
                : null,
              version: ulid()
            }
          });
          return tx.reminderTransition.create({
            data: {
              id: ulid(),
              ownerId: device.ownerId,
              reminderOccurrenceId: occurrenceId,
              actingDeviceId: device.id,
              fromState: occurrence.state,
              toState: input.toState,
              reason: input.reason,
              originalScheduledAt: occurrence.originalScheduledAt,
              occurredAt: input.occurredAt,
              operationId: ulid()
            }
          });
        });
      }
    );

    app.get('/check-ins', { schema: { tags: ['check-ins'] } }, async (request) => {
      const device = await auth(request);
      return prisma.checkIn.findMany({
        where: { ownerId: device.ownerId, deletedAt: null },
        include: {
          revisions: { orderBy: { createdAt: 'desc' }, take: 1 },
          sections: { include: { category: true }, orderBy: { position: 'asc' } },
          tags: { include: { tag: true } }
        },
        orderBy: { submittedAt: 'desc' }
      });
    });
    app.post('/check-ins', { schema: { tags: ['check-ins'] } }, async (request, reply) => {
      const device = await auth(request);
      const input = checkInInput.parse(request.body);
      if (input.reminderOccurrenceId && [...input.body].length < 20)
        throw new ApiError(
          400,
          'REMINDER_COMPLETION_TOO_SHORT',
          'Reminder completion requires at least 20 Unicode characters.'
        );
      const checkInId = ulid();
      const revisionId = ulid();
      const syncService = new SyncService(prisma);
      return reply.status(201).send(
        await prisma.$transaction(async (tx) => {
          await tx.checkIn.create({
            data: {
              id: checkInId,
              ownerId: device.ownerId,
              reminderOccurrenceId: input.reminderOccurrenceId,
              focusSessionId: input.focusSessionId,
              categoryId: null,
              currentRevisionId: revisionId,
              submittedAt: input.submittedAt,
              timezoneId: input.timezoneId,
              version: ulid()
            }
          });
          const revision = await tx.checkInRevision.create({
            data: {
              id: revisionId,
              checkInId,
              body: input.body,
              authorDeviceId: device.id,
              operationId: ulid()
            }
          });
          const categoryId = await syncService.materializeLogSections(tx, {
            ownerId: device.ownerId,
            checkInId,
            revisionId,
            body: input.body,
            occurredAt: input.submittedAt,
            timezoneId: input.timezoneId
          });
          if (categoryId)
            await tx.checkIn.update({ where: { id: checkInId }, data: { categoryId } });
          return revision;
        })
      );
    });
    app.delete('/check-ins/:checkInId', { schema: { tags: ['check-ins'] } }, async (request) => {
      const device = await auth(request);
      const checkInId = id.parse((request.params as { checkInId: string }).checkInId);
      return prisma.$transaction(async (tx) => {
        const checkIn = await tx.checkIn.update({
          where: { id: checkInId, ownerId: device.ownerId },
          data: { deletedAt: new Date(), version: ulid() }
        });
        await tx.tombstone.upsert({
          where: {
            ownerId_entityType_entityId: {
              ownerId: device.ownerId,
              entityType: 'check_in',
              entityId: checkInId
            }
          },
          update: { version: checkIn.version, deletedAt: new Date() },
          create: {
            id: ulid(),
            ownerId: device.ownerId,
            entityType: 'check_in',
            entityId: checkInId,
            version: checkIn.version,
            deletedAt: new Date(),
            retentionUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
          }
        });
        return checkIn;
      });
    });

    app.get('/search', { schema: { tags: ['search'] } }, async (request) => {
      const device = await auth(request);
      const input = searchQuery.parse(request.query);
      const tagFilter = input.tagId
        ? Prisma.sql`AND EXISTS (
            SELECT 1 FROM "check_in_tags" filter_tags
            WHERE filter_tags."checkInId" = check_in.id
              AND filter_tags."tagId" = ${input.tagId}
          )`
        : Prisma.empty;
      const categoryFilter = input.categoryId
        ? Prisma.sql`AND (
            section_category.path = (SELECT path FROM "categories" WHERE id = ${input.categoryId})
            OR section_category.path LIKE (
              (SELECT path FROM "categories" WHERE id = ${input.categoryId}) || '/%'
            )
          )`
        : Prisma.empty;
      const sessionFilter = input.sessionId
        ? Prisma.sql`AND check_in."focusSessionId" = ${input.sessionId}`
        : Prisma.empty;
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          body: string;
          submittedAt: Date;
          rank: number;
          sectionId: string;
          sectionPath: string;
          sectionBody: string;
          metadata: Prisma.JsonValue;
          position: number;
        }>
      >(Prisma.sql`
        WITH search_query AS (
          SELECT websearch_to_tsquery('simple', ${input.query}) AS value
        )
        SELECT
          check_in.id,
          revision.body,
          check_in."submittedAt",
          section.id AS "sectionId",
          coalesce(section_category.path, 'Uncategorized') AS "sectionPath",
          section.body AS "sectionBody",
          section.metadata,
          section.position,
          ts_rank_cd(
            setweight(to_tsvector('simple', section.body), 'A')
              || setweight(to_tsvector('simple', coalesce(section_category.path, '')), 'B')
              || setweight(to_tsvector('simple', coalesce(tag_names.value, '')), 'B')
              || setweight(to_tsvector('simple', coalesce(session.name, '')), 'C'),
            search_query.value,
            32
          ) AS rank
        FROM "check_ins" check_in
        JOIN "check_in_revisions" revision
          ON revision.id = check_in."currentRevisionId"
        JOIN "log_sections" section
          ON section."revisionId" = check_in."currentRevisionId"
        LEFT JOIN "categories" section_category
          ON section_category.id = section."categoryId" AND section_category."deletedAt" IS NULL
        LEFT JOIN "focus_sessions" session
          ON session.id = check_in."focusSessionId" AND session."deletedAt" IS NULL
        LEFT JOIN LATERAL (
          SELECT string_agg(tag.name, ' ' ORDER BY tag.name) AS value
          FROM "check_in_tags" relation
          JOIN "tags" tag ON tag.id = relation."tagId" AND tag."deletedAt" IS NULL
          WHERE relation."checkInId" = check_in.id
        ) tag_names ON true
        CROSS JOIN search_query
        WHERE check_in."ownerId" = ${device.ownerId}
          AND check_in."deletedAt" IS NULL
          AND revision."deletedAt" IS NULL
          AND (
            setweight(to_tsvector('simple', section.body), 'A')
              || setweight(to_tsvector('simple', coalesce(section_category.path, '')), 'B')
              || setweight(to_tsvector('simple', coalesce(tag_names.value, '')), 'B')
              || setweight(to_tsvector('simple', coalesce(session.name, '')), 'C')
          ) @@ search_query.value
          ${tagFilter}
          ${categoryFilter}
          ${sessionFilter}
        ORDER BY rank DESC, check_in."submittedAt" DESC, check_in.id, section.position
        LIMIT ${input.limit}
      `);
      return {
        results: Array.from(
          rows
            .reduce<
              Map<
                string,
                {
                  id: string;
                  body: string;
                  submittedAt: Date;
                  rank: number;
                  sections: Array<{
                    id: string;
                    path: string;
                    categoryPath: string[];
                    body: string;
                    metadata: Prisma.JsonValue;
                    position: number;
                  }>;
                }
              >
            >((grouped, row) => {
              const current = grouped.get(row.id) ?? {
                id: row.id,
                body: row.body,
                submittedAt: row.submittedAt,
                rank: Number(row.rank),
                sections: []
              };
              current.rank = Math.max(current.rank, Number(row.rank));
              const path = row.sectionPath;
              current.sections.push({
                id: row.sectionId,
                path,
                categoryPath: path === 'Uncategorized' ? [] : path.split('/'),
                body: row.sectionBody,
                metadata: row.metadata,
                position: row.position
              });
              grouped.set(row.id, current);
              return grouped;
            }, new Map())
            .values()
        )
      };
    });

    app.post('/sync/push', { schema: { tags: ['synchronization'] } }, async (request) => {
      const device = await auth(request);
      const input = z
        .object({
          operations: z
            .array(
              z.object({
                operationId: id,
                deviceSequence: z.number().int().nonnegative(),
                entityType: z.string().max(80),
                entityId: id,
                kind: z.string().max(120),
                baseVersion: id.optional(),
                payload: z.record(z.unknown()),
                occurredAt: z.coerce.date()
              })
            )
            .min(1)
            .max(100)
        })
        .parse(request.body);
      const result = await new SyncService(prisma).push(
        device.ownerId,
        device.id,
        input.operations
      );
      const nextCursor = result.results.reduce(
        (latest, item) =>
          item.sequence && BigInt(item.sequence) > BigInt(latest) ? item.sequence : latest,
        '0'
      );
      if (nextCursor !== '0')
        await websocketGateway?.notifySyncAvailable(device.ownerId, device.id, nextCursor);
      return result;
    });
    app.get('/sync/pull', { schema: { tags: ['synchronization'] } }, async (request) => {
      const device = await auth(request);
      const cursor = z.coerce
        .bigint()
        .nonnegative()
        .default(0n)
        .parse((request.query as { cursor?: string }).cursor ?? '0');
      const changes = await prisma.syncOperation.findMany({
        where: { ownerId: device.ownerId, sequence: { gt: cursor } },
        orderBy: { sequence: 'asc' },
        take: 100,
        include: {
          device: {
            select: {
              id: true,
              publicKey: true,
              fingerprint: true,
              platform: true,
              displayName: true,
              status: true,
              isOwnerDevice: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
      return {
        changes: changes.map(({ device: sourceDevice, ...change }) => ({
          ...change,
          deviceSequence: change.deviceSequence.toString(),
          sequence: change.sequence?.toString(),
          sourceDevice
        })),
        nextCursor: changes.at(-1)?.sequence?.toString() ?? cursor.toString()
      };
    });
    app.post('/sync/ack', { schema: { tags: ['synchronization'] } }, async (request) => {
      const device = await auth(request);
      const input = z.object({ cursor: z.coerce.bigint().nonnegative() }).parse(request.body);
      const state = await prisma.ownerSyncState.findUnique({ where: { ownerId: device.ownerId } });
      if (input.cursor > (state?.nextSequence ?? 0n))
        throw new ApiError(400, 'SYNC_CURSOR_INVALID', 'Cursor is beyond the owner sync stream.');
      const current = await prisma.syncCursor.findUnique({ where: { deviceId: device.id } });
      const cursor =
        current && current.lastAppliedSequence > input.cursor
          ? current.lastAppliedSequence
          : input.cursor;
      await prisma.syncCursor.upsert({
        where: { deviceId: device.id },
        update: { lastAppliedSequence: cursor },
        create: { ownerId: device.ownerId, deviceId: device.id, lastAppliedSequence: cursor }
      });
      return { cursor: cursor.toString() };
    });

    app.get('/reports/daily', { schema: { tags: ['reports'] } }, async (request) => {
      const device = await auth(request);
      const query = z
        .object({
          day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          timezoneId: z.string().min(1).max(100)
        })
        .parse(request.query);
      let bounds: ReturnType<typeof reportDayBounds>;
      try {
        bounds = reportDayBounds(query.day, query.timezoneId);
      } catch (error) {
        throw new ApiError(
          400,
          'REPORT_SELECTION_INVALID',
          error instanceof Error ? error.message : 'Invalid report selection.'
        );
      }
      const [checkIns, occurrences, sessions, transitions, conflicts] = await Promise.all([
        prisma.checkIn.findMany({
          where: {
            ownerId: device.ownerId,
            deletedAt: null,
            submittedAt: { gte: bounds.start, lt: bounds.end }
          },
          include: {
            sections: {
              include: { category: { select: { path: true } } },
              orderBy: { position: 'asc' }
            },
            revisions: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { body: true }
            }
          },
          orderBy: { submittedAt: 'asc' }
        }),
        prisma.reminderOccurrence.findMany({
          where: {
            ownerId: device.ownerId,
            OR: [
              { resolvedAt: { gte: bounds.start, lt: bounds.end } },
              {
                resolvedAt: null,
                scheduledAt: { gte: bounds.start, lt: bounds.end }
              }
            ]
          },
          select: {
            id: true,
            state: true,
            scheduledAt: true,
            resolvedAt: true,
            timezoneId: true
          },
          orderBy: [{ resolvedAt: 'asc' }, { scheduledAt: 'asc' }]
        }),
        prisma.focusSession.findMany({
          where: {
            ownerId: device.ownerId,
            deletedAt: null,
            startedAt: { lt: bounds.end },
            OR: [{ endedAt: null }, { endedAt: { gt: bounds.start } }]
          },
          select: { id: true, name: true, timezoneId: true, startedAt: true, endedAt: true }
        }),
        prisma.reminderTransition.findMany({
          where: {
            ownerId: device.ownerId,
            occurredAt: { gte: bounds.start, lt: bounds.end }
          },
          select: {
            id: true,
            fromState: true,
            toState: true,
            reason: true,
            occurredAt: true,
            occurrence: { select: { timezoneId: true } }
          },
          orderBy: { occurredAt: 'asc' }
        }),
        prisma.conflict.findMany({
          where: {
            ownerId: device.ownerId,
            createdAt: { gte: bounds.start, lt: bounds.end }
          },
          select: {
            id: true,
            entityType: true,
            entityId: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        })
      ]);
      const completedIntervals = occurrences.filter((item) => item.state === 'COMPLETED').length;
      const missedIntervals = occurrences.filter((item) => item.state === 'MISSED').length;
      const now = new Date();
      const totalTrackedMinutes = Math.round(
        sessions.reduce((total, session) => {
          const start = session.startedAt < bounds.start ? bounds.start : session.startedAt;
          const naturalEnd = session.endedAt ?? now;
          const end = naturalEnd > bounds.end ? bounds.end : naturalEnd;
          return total + Math.max(0, end.getTime() - start.getTime()) / 60_000;
        }, 0)
      );
      const categories = Object.entries(
        checkIns.reduce<Record<string, number>>((all, item) => {
          for (const section of item.sections.filter(
            (candidate) => candidate.revisionId === item.currentRevisionId
          )) {
            const path = section.category?.path ?? 'Uncategorized';
            const segments = path === 'Uncategorized' ? [] : path.split('/');
            if (!segments.length) {
              all.Uncategorized = (all.Uncategorized ?? 0) + 1;
              continue;
            }
            for (let depth = 1; depth <= segments.length; depth += 1) {
              const categoryPath = segments.slice(0, depth).join('/');
              all[categoryPath] = (all[categoryPath] ?? 0) + 1;
            }
          }
          return all;
        }, {})
      ).map(([name, count]) => ({ name, count }));
      const totalIntervals = completedIntervals + missedIntervals;
      const timeline = [
        ...checkIns.map((item) => {
          const sections = item.sections
            .filter((section) => section.revisionId === item.currentRevisionId)
            .map((section) => ({
              id: section.id,
              path: section.category?.path ?? 'Uncategorized',
              body: section.body,
              metadata: section.metadata,
              position: section.position
            }));
          return {
            id: item.id,
            kind: 'CHECK_IN',
            occurredAt: item.submittedAt,
            title: `Check-in · ${sections[0]?.path ?? 'Uncategorized'}`,
            detail: sections
              .map((section) => section.body)
              .filter(Boolean)
              .join('\n\n'),
            sections,
            originalTimezoneId: item.timezoneId
          };
        }),
        ...occurrences.map((item) => ({
          id: item.id,
          kind: 'REMINDER',
          occurredAt: item.resolvedAt ?? item.scheduledAt,
          title: `Reminder ${item.state.toLowerCase().replaceAll('_', ' ')}`,
          detail: `Scheduled ${item.scheduledAt.toISOString()}`,
          originalTimezoneId: item.timezoneId
        })),
        ...transitions.map((item) => ({
          id: item.id,
          kind: 'REMINDER_TRANSITION',
          occurredAt: item.occurredAt,
          title: `${item.fromState.toLowerCase()} → ${item.toState.toLowerCase()}`,
          detail: item.reason ?? 'Reminder state transition',
          originalTimezoneId: item.occurrence.timezoneId
        })),
        ...sessions.flatMap((session) => {
          const entries = [];
          if (session.startedAt >= bounds.start && session.startedAt < bounds.end) {
            entries.push({
              id: `${session.id}:start`,
              kind: 'SESSION_START',
              occurredAt: session.startedAt,
              title: 'Focus session started',
              detail: session.name ?? 'Focus session',
              originalTimezoneId: session.timezoneId
            });
          }
          if (session.endedAt && session.endedAt >= bounds.start && session.endedAt < bounds.end) {
            entries.push({
              id: `${session.id}:end`,
              kind: 'SESSION_END',
              occurredAt: session.endedAt,
              title: 'Focus session ended',
              detail: session.name ?? 'Focus session',
              originalTimezoneId: session.timezoneId
            });
          }
          return entries;
        }),
        ...conflicts.map((item) => ({
          id: item.id,
          kind: 'CONFLICT',
          occurredAt: item.createdAt,
          title: `Synchronization conflict · ${item.status.toLowerCase()}`,
          detail: `${item.entityType} ${item.entityId}`
        }))
      ].sort(
        (left, right) =>
          left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id)
      );
      const occurrenceStates = Array.from(
        occurrences.reduce<Map<string, number>>((counts, item) => {
          counts.set(item.state, (counts.get(item.state) ?? 0) + 1);
          return counts;
        }, new Map())
      )
        .map(([state, count]) => ({ state, count }))
        .sort((left, right) => left.state.localeCompare(right.state));
      const trendCount = async (days: number) => {
        const trendStart = reportDayBounds(
          addReportDays(query.day, -(days - 1)),
          bounds.timezoneId
        ).start;
        return prisma.checkIn.count({
          where: {
            ownerId: device.ownerId,
            deletedAt: null,
            submittedAt: { gte: trendStart, lt: bounds.end }
          }
        });
      };
      const [weekly, monthly, yearly] = await Promise.all([
        trendCount(7),
        trendCount(30),
        trendCount(365)
      ]);
      return {
        day: bounds.day,
        timezoneId: bounds.timezoneId,
        dayDurationMinutes: bounds.durationMinutes,
        completedIntervals,
        missedIntervals,
        totalTrackedMinutes,
        focusScore:
          totalIntervals === 0 ? 0 : Math.round((completedIntervals / totalIntervals) * 100),
        categories,
        timeline,
        occurrenceStates,
        trends: { weekly, monthly, yearly }
      };
    });
    app.get('/reports/heatmap', { schema: { tags: ['reports'] } }, async (request) => {
      const device = await auth(request);
      const query = z
        .object({
          year: z.coerce.number().int().min(1970).max(9998),
          timezoneId: z.string().min(1).max(100)
        })
        .parse(request.query);
      let first: ReturnType<typeof reportDayBounds>;
      let last: ReturnType<typeof reportDayBounds>;
      try {
        first = reportDayBounds(
          `${query.year.toString().padStart(4, '0')}-01-01`,
          query.timezoneId
        );
        last = reportDayBounds(`${query.year.toString().padStart(4, '0')}-12-31`, query.timezoneId);
      } catch (error) {
        throw new ApiError(
          400,
          'REPORT_SELECTION_INVALID',
          error instanceof Error ? error.message : 'Invalid report selection.'
        );
      }
      const checkIns = await prisma.checkIn.findMany({
        where: {
          ownerId: device.ownerId,
          deletedAt: null,
          submittedAt: { gte: first.start, lt: last.end }
        },
        select: { submittedAt: true },
        orderBy: { submittedAt: 'asc' }
      });
      const values = new Map<string, number>();
      for (const checkIn of checkIns) {
        const day = localDayForInstant(checkIn.submittedAt, first.timezoneId);
        values.set(day, (values.get(day) ?? 0) + 1);
      }
      const result = heatmapDays(query.year, values);
      return {
        year: query.year,
        timezoneId: first.timezoneId,
        metric: 'check-ins',
        metricDescription:
          'Activity is the number of completed check-ins. Levels 1–4 use quartiles across active days in this year.',
        thresholds: result.thresholds,
        days: result.days
      };
    });
    app.post('/backups', { schema: { tags: ['backups'] } }, async (request, reply) => {
      const device = await auth(request);
      owner(device);
      const input = z
        .object({
          kind: z.enum(['BACKUP', 'EXPORT']).default('BACKUP'),
          formatVersion: z.number().int().positive(),
          schemaVersion: z.number().int().positive(),
          storageLocation: z.string().min(1),
          checksum: z.string().min(16).max(128),
          encryption: z.record(z.unknown()),
          expiresAt: z.coerce.date().optional()
        })
        .parse(request.body);
      return reply.status(201).send(
        await prisma.backupManifest.create({
          data: {
            id: ulid(),
            ownerId: device.ownerId,
            ...input,
            encryption: json(input.encryption)
          }
        })
      );
    });
    app.get('/backups', { schema: { tags: ['backups'] } }, async (request) => {
      const device = await auth(request);
      owner(device);
      return prisma.backupManifest.findMany({
        where: { ownerId: device.ownerId },
        orderBy: { createdAt: 'desc' }
      });
    });
    app.delete('/data', { schema: { tags: ['data'] } }, async (request) => {
      const device = await auth(request);
      owner(device);
      z.object({ confirmation: z.literal('DELETE ALL FOCUSLOG DATA') }).parse(request.body);
      const ownerId = device.ownerId;
      await prisma.$transaction(
        async (tx) => {
          await tx.checkInTag.deleteMany({ where: { checkIn: { ownerId } } });
          await tx.logSection.deleteMany({ where: { ownerId } });
          await tx.checkInRevision.deleteMany({ where: { checkIn: { ownerId } } });
          await tx.checkIn.deleteMany({ where: { ownerId } });
          await tx.reminderTransition.deleteMany({ where: { ownerId } });
          await tx.reminderOccurrence.deleteMany({ where: { ownerId } });
          await tx.focusSession.deleteMany({ where: { ownerId } });
          await tx.focusMode.deleteMany({ where: { ownerId } });
          await tx.tag.deleteMany({ where: { ownerId } });
          await tx.category.deleteMany({ where: { ownerId } });
          await tx.backupManifest.deleteMany({ where: { ownerId } });
          await tx.tombstone.deleteMany({ where: { ownerId } });
          await tx.conflict.deleteMany({ where: { ownerId } });
          await tx.syncOperation.deleteMany({ where: { ownerId } });
          await tx.syncCursor.deleteMany({ where: { ownerId } });
          await tx.deviceRequestNonce.deleteMany({ where: { device: { ownerId } } });
          await tx.devicePairing.deleteMany({ where: { ownerId } });
          await tx.setting.deleteMany({ where: { ownerId } });
          await tx.ownerSyncState.deleteMany({ where: { ownerId } });
          await tx.device.deleteMany({ where: { ownerId } });
          await tx.owner.delete({ where: { id: ownerId } });
        },
        { timeout: 30_000 }
      );
      return { deleted: true };
    });
  };
}

import { Prisma, type PrismaClient } from '@prisma/client';
import { parseJournalEntry } from '@focuslog/shared-utils';
import { ulid } from 'ulid';
import { z } from 'zod';

import { ApiError } from '../lib/errors.js';

const id = z.string().length(26);
const checkInCreatePayload = z.object({
  revisionId: id,
  body: z.string().trim().min(1),
  submittedAt: z.coerce.date(),
  timezoneId: z.string().min(1).max(64),
  reminderCompletion: z.boolean().optional().default(false),
  reminderOccurrenceId: id.optional()
});
const checkInRevisionPayload = z.object({
  revisionId: id,
  body: z.string().trim().min(1),
  createdAt: z.coerce.date()
});
const checkInDeletePayload = z.object({
  deletedAt: z.coerce.date()
});
const reminderState = z.enum([
  'SCHEDULED',
  'DUE',
  'PRESENTED',
  'SNOOZED',
  'COMPLETED',
  'SKIPPED',
  'EMERGENCY_DISMISSED',
  'MISSED',
  'SUPERSEDED'
]);
const reminderSchedulePayload = z.object({
  mode: z.object({
    id,
    name: z.string().trim().min(1).max(120),
    intervalMinutes: z.number().int().min(1).max(1440),
    policy: z.record(z.unknown()),
    version: id
  }),
  session: z.object({
    id,
    name: z.string().trim().min(1).max(160).nullable().optional(),
    startedAt: z.coerce.date(),
    timezoneId: z.string().min(1).max(64),
    schedulePolicy: z.record(z.unknown()),
    version: id
  }),
  occurrence: z.object({
    scheduledAt: z.coerce.date(),
    originalScheduledAt: z.coerce.date(),
    timezoneId: z.string().min(1).max(64),
    policySnapshot: z.record(z.unknown()),
    version: id
  })
});
const reminderTransitionPayload = z.object({
  transitionId: id,
  fromState: reminderState,
  toState: reminderState,
  occurredAt: z.coerce.date(),
  reason: z.string().max(500).nullable().optional(),
  effectiveDueAt: z.coerce.date().nullable().optional()
});
const reminderCompletePayload = z.object({
  transitionId: id,
  checkInId: id,
  revisionId: id,
  body: z.string().trim().min(1),
  completedAt: z.coerce.date()
});
const terminalReminderStates = new Set([
  'COMPLETED',
  'SKIPPED',
  'EMERGENCY_DISMISSED',
  'MISSED',
  'SUPERSEDED'
]);
const allowedReminderTransitions: Record<string, readonly string[]> = {
  SCHEDULED: ['DUE', 'SUPERSEDED'],
  DUE: ['PRESENTED', 'SNOOZED', 'COMPLETED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'MISSED'],
  PRESENTED: ['SNOOZED', 'COMPLETED', 'SKIPPED', 'EMERGENCY_DISMISSED', 'MISSED'],
  SNOOZED: ['DUE', 'SUPERSEDED'],
  COMPLETED: [],
  SKIPPED: [],
  EMERGENCY_DISMISSED: [],
  MISSED: [],
  SUPERSEDED: []
};

export interface SyncInputOperation {
  operationId: string;
  deviceSequence: number;
  entityType: string;
  entityId: string;
  kind: string;
  baseVersion?: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

interface ConflictDetails {
  localPayload?: Prisma.InputJsonValue;
  remotePayload: Prisma.InputJsonValue;
}

export class SyncService {
  constructor(private readonly prisma: PrismaClient) {}

  private async inferredCategoryId(
    tx: Prisma.TransactionClient,
    ownerId: string,
    body: string,
    occurredAt: Date
  ): Promise<string | null> {
    const parsed = parseJournalEntry(body);
    if (!parsed.hasCategoryToken) return null;
    const category = await tx.category.upsert({
      where: { ownerId_name: { ownerId, name: parsed.category } },
      update: { deletedAt: null, updatedAt: occurredAt },
      create: {
        id: ulid(),
        ownerId,
        name: parsed.category,
        version: ulid(),
        createdAt: occurredAt,
        updatedAt: occurredAt
      }
    });
    return category.id;
  }

  async push(ownerId: string, deviceId: string, operations: readonly SyncInputOperation[]) {
    const results: Array<{
      operationId: string;
      status: 'accepted' | 'duplicate' | 'conflict';
      sequence?: string;
      conflictId?: string;
    }> = [];

    for (const operation of operations) {
      const result = await this.prisma.$transaction(async (tx) => {
        // Concurrent retries of the same operation are serialized before any
        // domain data is changed, making the whole materialization idempotent.
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${operation.operationId}))`
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`${deviceId}:${operation.deviceSequence}`}))`
        );
        const existing = await tx.syncOperation.findUnique({
          where: { operationId: operation.operationId }
        });
        if (existing) {
          if (existing.ownerId !== ownerId || existing.deviceId !== deviceId)
            throw new ApiError(
              409,
              'OPERATION_ID_CONFLICT',
              'Operation identifier belongs to another device.'
            );
          return {
            operationId: operation.operationId,
            status: 'duplicate' as const,
            sequence: existing.sequence?.toString(),
            conflictId:
              existing.status === 'CONFLICT'
                ? (existing.result as { conflictId?: string } | null)?.conflictId
                : undefined
          };
        }
        const sequenceOwner = await tx.syncOperation.findUnique({
          where: {
            ownerId_deviceId_deviceSequence: {
              ownerId,
              deviceId,
              deviceSequence: operation.deviceSequence
            }
          },
          select: { operationId: true }
        });
        if (sequenceOwner)
          throw new ApiError(
            409,
            'DEVICE_SEQUENCE_REUSED',
            'Device sequence was already assigned to another operation.'
          );

        const sequence = (
          await tx.ownerSyncState.upsert({
            where: { ownerId },
            update: { nextSequence: { increment: 1 } },
            create: { ownerId, nextSequence: 1 }
          })
        ).nextSequence;

        const conflict = await this.materialize(tx, ownerId, deviceId, operation);
        if (conflict)
          return this.storeConflict(tx, ownerId, deviceId, operation, sequence, conflict);

        const saved = await tx.syncOperation.create({
          data: {
            ...operation,
            payload: operation.payload as Prisma.InputJsonValue,
            ownerId,
            deviceId,
            status: 'ACCEPTED',
            sequence
          }
        });
        return {
          operationId: saved.operationId,
          status: 'accepted' as const,
          sequence: saved.sequence?.toString()
        };
      });
      results.push(result);
    }
    return { results };
  }

  private async materialize(
    tx: Prisma.TransactionClient,
    ownerId: string,
    deviceId: string,
    operation: SyncInputOperation
  ): Promise<ConflictDetails | undefined> {
    if (operation.entityType === 'reminder_occurrence')
      return this.materializeReminder(tx, ownerId, deviceId, operation);

    if (operation.entityType !== 'check_in')
      throw new ApiError(
        400,
        'SYNC_OPERATION_UNSUPPORTED',
        `Unsupported synchronization entity: ${operation.entityType}.`
      );

    if (operation.kind === 'check_in.create') {
      const payload = checkInCreatePayload.parse(operation.payload);
      if (payload.reminderCompletion && [...payload.body].length < 20)
        throw new ApiError(
          400,
          'REMINDER_COMPLETION_TOO_SHORT',
          'Reminder completion requires at least 20 Unicode characters.'
        );
      const current = await tx.checkIn.findFirst({
        where: { id: operation.entityId, ownerId },
        include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
      if (current)
        return {
          localPayload: this.checkInSnapshot(current),
          remotePayload: operation.payload as Prisma.InputJsonValue
        };
      const categoryId = await this.inferredCategoryId(
        tx,
        ownerId,
        payload.body,
        payload.submittedAt
      );
      await tx.checkIn.create({
        data: {
          id: operation.entityId,
          ownerId,
          currentRevisionId: payload.revisionId,
          submittedAt: payload.submittedAt,
          timezoneId: payload.timezoneId,
          reminderOccurrenceId: payload.reminderOccurrenceId,
          categoryId,
          version: payload.revisionId
        }
      });
      await tx.checkInRevision.create({
        data: {
          id: payload.revisionId,
          checkInId: operation.entityId,
          body: payload.body,
          authorDeviceId: deviceId,
          operationId: operation.operationId,
          createdAt: payload.submittedAt
        }
      });
      return undefined;
    }

    const current = await tx.checkIn.findFirst({
      where: { id: operation.entityId, ownerId },
      include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });
    if (
      !current ||
      current.deletedAt ||
      !operation.baseVersion ||
      current.currentRevisionId !== operation.baseVersion
    )
      return {
        localPayload: current ? this.checkInSnapshot(current) : undefined,
        remotePayload: operation.payload as Prisma.InputJsonValue
      };

    if (operation.kind === 'check_in.revise') {
      const payload = checkInRevisionPayload.parse(operation.payload);
      const categoryId = await this.inferredCategoryId(
        tx,
        ownerId,
        payload.body,
        payload.createdAt
      );
      await tx.checkInRevision.create({
        data: {
          id: payload.revisionId,
          checkInId: operation.entityId,
          parentRevisionId: operation.baseVersion,
          body: payload.body,
          authorDeviceId: deviceId,
          operationId: operation.operationId,
          createdAt: payload.createdAt
        }
      });
      await tx.checkIn.update({
        where: { id: operation.entityId },
        data: { categoryId, currentRevisionId: payload.revisionId, version: payload.revisionId }
      });
      return undefined;
    }

    if (operation.kind === 'check_in.delete') {
      const payload = checkInDeletePayload.parse(operation.payload);
      await tx.checkIn.update({
        where: { id: operation.entityId },
        data: { deletedAt: payload.deletedAt, version: operation.operationId }
      });
      await tx.tombstone.upsert({
        where: {
          ownerId_entityType_entityId: {
            ownerId,
            entityType: 'check_in',
            entityId: operation.entityId
          }
        },
        update: {
          version: operation.operationId,
          deletedAt: payload.deletedAt,
          retentionUntil: new Date(payload.deletedAt.getTime() + 180 * 24 * 60 * 60 * 1000)
        },
        create: {
          id: ulid(),
          ownerId,
          entityType: 'check_in',
          entityId: operation.entityId,
          version: operation.operationId,
          deletedAt: payload.deletedAt,
          retentionUntil: new Date(payload.deletedAt.getTime() + 180 * 24 * 60 * 60 * 1000)
        }
      });
      return undefined;
    }

    throw new ApiError(
      400,
      'SYNC_OPERATION_UNSUPPORTED',
      `Unsupported synchronization operation: ${operation.kind}.`
    );
  }

  private async materializeReminder(
    tx: Prisma.TransactionClient,
    ownerId: string,
    deviceId: string,
    operation: SyncInputOperation
  ): Promise<ConflictDetails | undefined> {
    if (operation.kind === 'reminder.schedule') {
      const payload = reminderSchedulePayload.parse(operation.payload);
      const current = await tx.reminderOccurrence.findFirst({
        where: { id: operation.entityId, ownerId }
      });
      if (current) {
        if (current.version === payload.occurrence.version) return undefined;
        return {
          localPayload: this.reminderSnapshot(current),
          remotePayload: operation.payload as Prisma.InputJsonValue
        };
      }
      const sameNameMode = await tx.focusMode.findUnique({
        where: { ownerId_name: { ownerId, name: payload.mode.name } }
      });
      const modeId = sameNameMode?.id ?? payload.mode.id;
      if (!sameNameMode)
        await tx.focusMode.create({
          data: {
            id: modeId,
            ownerId,
            name: payload.mode.name,
            intervalMinutes: payload.mode.intervalMinutes,
            policy: payload.mode.policy as Prisma.InputJsonValue,
            version: payload.mode.version
          }
        });
      const session = await tx.focusSession.findFirst({
        where: { id: payload.session.id, ownerId }
      });
      if (!session)
        await tx.focusSession.create({
          data: {
            id: payload.session.id,
            ownerId,
            focusModeId: modeId,
            name: payload.session.name,
            status: 'ACTIVE',
            schedulePolicy: payload.session.schedulePolicy as Prisma.InputJsonValue,
            timezoneId: payload.session.timezoneId,
            startedAt: payload.session.startedAt,
            version: payload.session.version
          }
        });
      await tx.reminderOccurrence.create({
        data: {
          id: operation.entityId,
          ownerId,
          focusSessionId: payload.session.id,
          scheduledAt: payload.occurrence.scheduledAt,
          originalScheduledAt: payload.occurrence.originalScheduledAt,
          timezoneId: payload.occurrence.timezoneId,
          policySnapshot: payload.occurrence.policySnapshot as Prisma.InputJsonValue,
          version: payload.occurrence.version
        }
      });
      return undefined;
    }

    const occurrence = await tx.reminderOccurrence.findFirst({
      where: { id: operation.entityId, ownerId }
    });
    if (!occurrence)
      return {
        remotePayload: operation.payload as Prisma.InputJsonValue
      };

    if (operation.kind === 'reminder.complete') {
      const payload = reminderCompletePayload.parse(operation.payload);
      if ([...payload.body].length < 20)
        throw new ApiError(
          400,
          'REMINDER_COMPLETION_TOO_SHORT',
          'Reminder completion requires at least 20 Unicode characters.'
        );
      const existingCheckIn = await tx.checkIn.findUnique({
        where: { reminderOccurrenceId: operation.entityId },
        include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
      if (existingCheckIn) {
        if (existingCheckIn.id === payload.checkInId) return undefined;
        return {
          localPayload: this.checkInSnapshot(existingCheckIn),
          remotePayload: operation.payload as Prisma.InputJsonValue
        };
      }
      if (
        terminalReminderStates.has(occurrence.state) ||
        !['DUE', 'PRESENTED'].includes(occurrence.state) ||
        (operation.baseVersion && occurrence.version !== operation.baseVersion)
      )
        return {
          localPayload: this.reminderSnapshot(occurrence),
          remotePayload: operation.payload as Prisma.InputJsonValue
        };
      await tx.reminderOccurrence.update({
        where: { id: occurrence.id },
        data: {
          state: 'COMPLETED',
          resolvedAt: payload.completedAt,
          version: operation.operationId
        }
      });
      await tx.reminderTransition.create({
        data: {
          id: payload.transitionId,
          ownerId,
          reminderOccurrenceId: occurrence.id,
          actingDeviceId: deviceId,
          fromState: occurrence.state,
          toState: 'COMPLETED',
          originalScheduledAt: occurrence.originalScheduledAt,
          occurredAt: payload.completedAt,
          operationId: operation.operationId
        }
      });
      const categoryId = await this.inferredCategoryId(
        tx,
        ownerId,
        payload.body,
        payload.completedAt
      );
      await tx.checkIn.create({
        data: {
          id: payload.checkInId,
          ownerId,
          reminderOccurrenceId: occurrence.id,
          focusSessionId: occurrence.focusSessionId,
          categoryId,
          currentRevisionId: payload.revisionId,
          submittedAt: payload.completedAt,
          timezoneId: occurrence.timezoneId,
          version: payload.revisionId
        }
      });
      await tx.checkInRevision.create({
        data: {
          id: payload.revisionId,
          checkInId: payload.checkInId,
          body: payload.body,
          authorDeviceId: deviceId,
          operationId: operation.operationId,
          createdAt: payload.completedAt
        }
      });
      return undefined;
    }

    if (operation.kind === 'reminder.transition') {
      const payload = reminderTransitionPayload.parse(operation.payload);
      if (occurrence.state === payload.toState) return undefined;
      if (
        terminalReminderStates.has(occurrence.state) ||
        !allowedReminderTransitions[occurrence.state]?.includes(payload.toState) ||
        occurrence.state !== payload.fromState ||
        (operation.baseVersion && occurrence.version !== operation.baseVersion)
      )
        return {
          localPayload: this.reminderSnapshot(occurrence),
          remotePayload: operation.payload as Prisma.InputJsonValue
        };
      await tx.reminderOccurrence.update({
        where: { id: occurrence.id },
        data: {
          state: payload.toState,
          scheduledAt: payload.effectiveDueAt ?? undefined,
          presentedAt: payload.toState === 'PRESENTED' ? payload.occurredAt : undefined,
          resolvedAt: terminalReminderStates.has(payload.toState) ? payload.occurredAt : undefined,
          version: operation.operationId
        }
      });
      await tx.reminderTransition.create({
        data: {
          id: payload.transitionId,
          ownerId,
          reminderOccurrenceId: occurrence.id,
          actingDeviceId: deviceId,
          fromState: occurrence.state,
          toState: payload.toState,
          reason: payload.reason,
          originalScheduledAt: occurrence.originalScheduledAt,
          occurredAt: payload.occurredAt,
          operationId: operation.operationId
        }
      });
      return undefined;
    }

    throw new ApiError(
      400,
      'SYNC_OPERATION_UNSUPPORTED',
      `Unsupported synchronization operation: ${operation.kind}.`
    );
  }

  private async storeConflict(
    tx: Prisma.TransactionClient,
    ownerId: string,
    deviceId: string,
    operation: SyncInputOperation,
    sequence: bigint,
    details: ConflictDetails
  ) {
    const conflictId = ulid();
    await tx.conflict.create({
      data: {
        id: conflictId,
        ownerId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        localOperationId: operation.baseVersion,
        remoteOperationId: operation.operationId,
        localPayload: details.localPayload,
        remotePayload: details.remotePayload
      }
    });
    await tx.syncOperation.create({
      data: {
        ...operation,
        payload: operation.payload as Prisma.InputJsonValue,
        ownerId,
        deviceId,
        status: 'CONFLICT',
        result: { conflictId },
        sequence
      }
    });
    return {
      operationId: operation.operationId,
      status: 'conflict' as const,
      sequence: sequence.toString(),
      conflictId
    };
  }

  private checkInSnapshot(checkIn: {
    currentRevisionId: string | null;
    deletedAt: Date | null;
    revisions: Array<{ body: string; createdAt: Date }>;
  }): Prisma.InputJsonValue {
    return {
      revisionId: checkIn.currentRevisionId,
      body: checkIn.revisions[0]?.body ?? '',
      createdAt: checkIn.revisions[0]?.createdAt.toISOString(),
      deletedAt: checkIn.deletedAt?.toISOString()
    };
  }

  private reminderSnapshot(reminder: {
    state: string;
    scheduledAt: Date;
    originalScheduledAt: Date;
    resolvedAt: Date | null;
    version: string;
  }): Prisma.InputJsonValue {
    return {
      state: reminder.state,
      scheduledAt: reminder.scheduledAt.toISOString(),
      originalScheduledAt: reminder.originalScheduledAt.toISOString(),
      resolvedAt: reminder.resolvedAt?.toISOString(),
      version: reminder.version
    };
  }
}

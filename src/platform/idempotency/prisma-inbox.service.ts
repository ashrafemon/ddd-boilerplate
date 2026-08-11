import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaWriteService } from '../../infrastructure/database/prisma/prisma-write.service';
import { InboxPort } from '../../shared-kernel/ports/idempotency/inbox.port';

/**
 * Inbox deduplication backed by the InboxEvent table. The unique constraint on
 * (messageId, eventType) guarantees that a message is claimed only once.
 */
@Injectable()
export class PrismaInboxService implements InboxPort {
  constructor(private readonly prismaWrite: PrismaWriteService) {}

  public async tryClaim(
    messageId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<'PROCESS' | 'DUPLICATE'> {
    try {
      await this.prismaWrite.inboxEvent.create({
        data: {
          messageId,
          eventType,
          payload: payload as Prisma.InputJsonValue,
          status: 'PROCESSING',
        },
      });
      return 'PROCESS';
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return 'DUPLICATE';
      }
      throw error;
    }
  }

  public async markProcessed(messageId: string, eventType: string): Promise<void> {
    await this.prismaWrite.inboxEvent.update({
      where: { messageId_eventType: { messageId, eventType } },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  }

  public async markFailed(messageId: string, eventType: string, error: string): Promise<void> {
    await this.prismaWrite.inboxEvent.update({
      where: { messageId_eventType: { messageId, eventType } },
      data: {
        status: 'FAILED',
        lastError: error.slice(0, 2000),
        attemptCount: { increment: 1 },
      },
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

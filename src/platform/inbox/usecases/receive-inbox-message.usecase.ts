import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@config/config.service';
import { PrismaInboxRepository } from '../repositories/prisma-inbox.repository';
import { InboxIdentity, InboxReceiveRequest, InboxReceiveResult } from '../inbox.types';

/**
 * Use case: receive/claim an inbound message.
 *
 * 1. INSERT-as-claim on the unique identity → `ACQUIRED` (first delivery wins).
 * 2. Duplicate → look the row up: PROCESSED ⇒ `DUPLICATE`, SUSPENDED ⇒ `BUSY`.
 * 3. IN_PROGRESS ⇒ `BUSY` while the claim is live (inside the lease) or the
 *    retry is not due; CAS re-claim on the stored token (`attempts + 1`) once
 *    the lease expired or the retry is due ⇒ `ACQUIRED`. Losing the race ⇒
 *    `BUSY`.
 */
@Injectable()
export class ReceiveInboxMessageUseCase {
  constructor(
    private readonly repository: PrismaInboxRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: InboxReceiveRequest): Promise<InboxReceiveResult> {
    const identity: InboxIdentity = {
      tenantId: request.tenantId ?? '',
      organizationId: request.organizationId ?? '',
      consumer: request.consumer,
      messageId: request.messageId,
    };
    const claimToken = randomUUID();
    const now = new Date();

    const inserted = await this.repository.insertIfAbsent({
      identity,
      messageType: request.messageType,
      payload: request.payload,
      claimToken,
      claimedAt: now,
      correlationId: request.correlationId ?? null,
      causationId: request.causationId ?? null,
    });
    if (inserted) {
      return { status: 'ACQUIRED', reservation: { id: inserted.id, claimToken } };
    }

    const existing = await this.repository.findUnique(identity);
    if (!existing || existing.status === 'SUSPENDED') {
      return { status: 'BUSY' };
    }
    if (existing.status === 'PROCESSED') {
      return { status: 'DUPLICATE' };
    }

    const { claimLeaseMs } = this.configService.getInbox();
    const claimLive =
      existing.claimedAt !== null && now.getTime() - existing.claimedAt.getTime() < claimLeaseMs;
    if (claimLive) {
      return { status: 'BUSY' };
    }
    if (existing.nextAttemptAt !== null && existing.nextAttemptAt.getTime() > now.getTime()) {
      return { status: 'BUSY' };
    }

    const reclaimed = await this.repository.reclaim(
      existing.id,
      existing.claimToken,
      claimToken,
      now,
    );
    if (!reclaimed) {
      return { status: 'BUSY' };
    }
    return { status: 'ACQUIRED', reservation: { id: existing.id, claimToken } };
  }
}

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { InboxRepositoryPort } from '../ports/inbox-repository.port';
import { InboxReceiveRequest, InboxReceiveResult } from '../inbox.types';

/**
 * Use case: receive/claim an inbound message.
 *
 * 1. Try to insert as new claim (unique constraint on identity)
 * 2. If insert succeeds → ACQUIRED
 * 3. If unique constraint violation → find existing row
 * 4. If PROCESSED → PROCESSED (duplicate delivery)
 * 5. If IN_PROGRESS → IN_PROGRESS (another worker owns it)
 * 6. If FAILED → retry claim
 * 7. If payloadHash mismatch → MESSAGE_REUSED
 */
@Injectable()
export class ReceiveInboxMessageUseCase {
  constructor(private readonly repository: InboxRepositoryPort) {}

  async execute(request: InboxReceiveRequest): Promise<InboxReceiveResult> {
    const tenantId = request.tenantId ?? '';
    const organizationId = request.organizationId ?? '';
    const claimToken = randomUUID();

    // Compute payload hash if not provided
    const payloadHash =
      request.payloadHash ??
      createHash('sha256')
        .update(JSON.stringify(request.payload ?? null))
        .digest('hex');

    // Try to insert as new claim
    try {
      const inserted = await this.repository.insert(request, claimToken, payloadHash);
      return {
        status: 'ACQUIRED',
        reservation: {
          id: inserted.id,
          claimToken,
          version: inserted.version,
        },
      };
    } catch {
      // Unique constraint violation — row already exists
    }

    // Find the existing row
    const existing = await this.repository.findUnique(
      tenantId,
      organizationId,
      request.consumer,
      request.messageId,
    );
    if (!existing) {
      // Should not happen after constraint violation, but handle gracefully
      const inserted = await this.repository.insert(request, claimToken, payloadHash);
      return {
        status: 'ACQUIRED',
        reservation: {
          id: inserted.id,
          claimToken,
          version: inserted.version,
        },
      };
    }

    // Check payload hash mismatch (same message ID, different payload)
    if (existing.payloadHash && payloadHash && existing.payloadHash !== payloadHash) {
      return { status: 'MESSAGE_REUSED' };
    }

    // Handle based on current status
    switch (existing.status) {
      case 'PROCESSED':
        return { status: 'PROCESSED' };

      case 'IN_PROGRESS':
        return { status: 'IN_PROGRESS' };

      case 'FAILED': {
        // Re-claim failed messages
        const retryable = await this.repository.claimRetryable({
          batchSize: 1,
          maxAttempts: existing.attempts + 1,
        });
        const reclaimed = retryable.find(r => r.id === existing.id);
        if (reclaimed) {
          return {
            status: 'ACQUIRED',
            reservation: {
              id: existing.id,
              claimToken,
              version: reclaimed.version,
            },
          };
        }
        return { status: 'FAILED' };
      }

      case 'SUSPENDED':
        return { status: 'SUSPENDED' };

      default:
        return { status: 'IN_PROGRESS' };
    }
  }
}

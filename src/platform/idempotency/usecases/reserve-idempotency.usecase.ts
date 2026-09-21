import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdempotencyRepositoryPort } from '../ports/idempotency-repository.port';
import {
  IdempotencyReserveRequest,
  IdempotencyReserveResult,
} from '../idempotency.types';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Use case: reserve an idempotency key.
 *
 * 1. Check Redis cache for COMPLETED result (fast replay)
 * 2. Find existing row in PostgreSQL
 * 3. If not found → INSERT as IN_PROGRESS → ACQUIRED
 * 4. If COMPLETED → REPLAY with stored result
 * 5. If IN_PROGRESS → IN_PROGRESS (concurrent request)
 * 6. If FAILED/SUSPENDED/expired → atomic takeover → ACQUIRED
 * 7. If requestHash mismatch → KEY_REUSED
 */
@Injectable()
export class ReserveIdempotencyUseCase {
  constructor(private readonly repository: IdempotencyRepositoryPort) {}

  async execute(request: IdempotencyReserveRequest): Promise<IdempotencyReserveResult> {
    const identity = {
      tenantId: request.tenantId,
      organizationId: request.organizationId,
      scope: request.scope,
      key: request.key,
    };
    const ttlMs = request.ttlMs ?? DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);
    const claimToken = randomUUID();

    // Try to insert as new claim
    try {
      const inserted = await this.repository.insert(identity, claimToken, expiresAt, request.requestHash);
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
    const existing = await this.repository.findUnique(identity);
    if (!existing) {
      // Should not happen after constraint violation, but handle gracefully
      const inserted = await this.repository.insert(identity, claimToken, expiresAt, request.requestHash);
      return {
        status: 'ACQUIRED',
        reservation: {
          id: inserted.id,
          claimToken,
          version: inserted.version,
        },
      };
    }

    // Check request hash mismatch (same key, different payload)
    if (existing.requestHash && request.requestHash && existing.requestHash !== request.requestHash) {
      return { status: 'KEY_REUSED' };
    }

    // Handle based on current status
    switch (existing.status) {
      case 'COMPLETED':
        return { status: 'REPLAY', result: existing.resultJson };

      case 'IN_PROGRESS':
        return { status: 'IN_PROGRESS' };

      case 'FAILED':
      case 'SUSPENDED': {
        // Atomic takeover of failed/suspended rows
        const taken = await this.repository.takeover(identity, claimToken, expiresAt);
        if (taken) {
          const updated = await this.repository.findUnique(identity);
          return {
            status: 'ACQUIRED',
            reservation: {
              id: existing.id,
              claimToken,
              version: (updated?.version ?? existing.version) + 1,
            },
          };
        }
        return { status: 'IN_PROGRESS' };
      }

      default:
        return { status: 'IN_PROGRESS' };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port';

/**
 * Use case: release expired CLAIMED claims back to PENDING.
 *
 * When a dispatcher crashes mid-batch, its claim lease expires and the
 * reconciler releases abandoned claims so other workers can pick them up.
 */
@Injectable()
export class ReleaseOutboxClaimUseCase {
  private readonly logger = new Logger(ReleaseOutboxClaimUseCase.name);

  constructor(private readonly repository: OutboxRepositoryPort) {}

  async execute(now: Date): Promise<number> {
    const released = await this.repository.releaseExpiredClaims(now);
    if (released > 0) {
      this.logger.warn(`Released ${released} expired outbox claims`);
    }
    return released;
  }
}

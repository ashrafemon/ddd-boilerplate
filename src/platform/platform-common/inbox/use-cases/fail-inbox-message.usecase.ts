import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { InboxRepositoryPort } from '../outbound/ports/inbox.repository.port';
import { InboxFailRequest } from '../types/inbox.types';

/**
 * Use case: record a failed delivery.
 *
 * Default: keep the row IN_PROGRESS with a backoff `nextAttemptAt` (CAS on the
 * claim token) so the broker's redelivery is accepted when it is due.
 * `permanent: true` parks it FAILED instead — for errors no redelivery can fix
 * (contract mismatch, unparseable payload), which otherwise burn attempts until
 * they look like a poison message.
 */
@Injectable()
export class FailInboxMessageUseCase {
  private readonly logger = new Logger(FailInboxMessageUseCase.name);

  constructor(
    private readonly repository: InboxRepositoryPort,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: InboxFailRequest): Promise<void> {
    const { reservation, lastError = null, permanent = false } = request;

    if (permanent) {
      const parked = await this.repository.markPermanentlyFailed(
        reservation.id,
        reservation.claimToken,
        lastError,
      );
      if (!parked) {
        this.logger.warn(`Inbox permanent fail lost ownership for reservation ${reservation.id}`);
      }
      return;
    }

    const { retryBaseDelayMs, retryMaxDelayMs } = this.configService.getInbox();
    const failed = await this.repository.fail(
      reservation.id,
      reservation.claimToken,
      lastError,
      retryBaseDelayMs,
      retryMaxDelayMs,
    );
    if (!failed) {
      this.logger.warn(`Inbox fail lost ownership for reservation ${reservation.id}`);
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { PrismaInboxRepository } from '../repositories/prisma-inbox.repository';
import { InboxFailRequest } from '../inbox.types';

/**
 * Use case: keep an inbox message pending with a backoff `nextAttemptAt`
 * (CAS on the claim token). The broker NACK then triggers redelivery; the
 * message stays deduped by its identity throughout.
 */
@Injectable()
export class FailInboxMessageUseCase {
  private readonly logger = new Logger(FailInboxMessageUseCase.name);

  constructor(
    private readonly repository: PrismaInboxRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(request: InboxFailRequest): Promise<void> {
    const { reservation, lastError = null } = request;
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

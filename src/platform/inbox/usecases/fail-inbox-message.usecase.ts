import { Injectable, Logger } from '@nestjs/common';
import { InboxRepositoryPort } from '../ports/inbox-repository.port';
import { InboxFailRequest } from '../inbox.types';

/**
 * Use case: mark an inbox message as FAILED.
 *
 * CAS update: IN_PROGRESS → FAILED with claim token + version.
 * A FAILED message can be re-acquired by a subsequent receive.
 */
@Injectable()
export class FailInboxMessageUseCase {
  private readonly logger = new Logger(FailInboxMessageUseCase.name);

  constructor(private readonly repository: InboxRepositoryPort) {}

  async execute(request: InboxFailRequest): Promise<void> {
    const { reservation, errorCode, errorMessage, nextAttemptAt } = request;

    const success = await this.repository.fail(
      reservation.id,
      reservation.claimToken,
      reservation.version,
      errorCode,
      errorMessage,
      nextAttemptAt,
    );

    if (!success) {
      this.logger.warn(`Inbox fail failed — ownership lost for reservation ${reservation.id}`);
    }
  }
}

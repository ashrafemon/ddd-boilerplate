import { Injectable, Logger } from '@nestjs/common';
import { InboxRepositoryPort } from '../ports/inbox-repository.port';
import { InboxCompleteRequest } from '../inbox.types';

/**
 * Use case: mark an inbox message as PROCESSED.
 *
 * CAS update: IN_PROGRESS → PROCESSED with claim token + version.
 * Returns silently if ownership lost (another worker took over).
 */
@Injectable()
export class CompleteInboxMessageUseCase {
  private readonly logger = new Logger(CompleteInboxMessageUseCase.name);

  constructor(private readonly repository: InboxRepositoryPort) {}

  async execute(request: InboxCompleteRequest): Promise<void> {
    const { reservation } = request;

    const success = await this.repository.complete(
      reservation.id,
      reservation.claimToken,
      reservation.version,
    );

    if (!success) {
      this.logger.warn(`Inbox complete failed — ownership lost for reservation ${reservation.id}`);
    }
  }
}

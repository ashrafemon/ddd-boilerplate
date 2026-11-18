import { Injectable, Logger } from '@nestjs/common';
import { InboxRepositoryPort } from '../outbound/ports/inbox.repository.port';
import { InboxCompleteRequest } from '../types/inbox.types';

/**
 * Use case: mark an inbox message as PROCESSED (CAS on the claim token).
 *
 * The broker ACK must fire only after this returns.
 */
@Injectable()
export class CompleteInboxMessageUseCase {
  private readonly logger = new Logger(CompleteInboxMessageUseCase.name);

  constructor(private readonly repository: InboxRepositoryPort) {}

  async execute(request: InboxCompleteRequest): Promise<void> {
    const { reservation } = request;
    const completed = await this.repository.complete(reservation.id, reservation.claimToken);
    if (!completed) {
      this.logger.warn(`Inbox complete lost ownership for reservation ${reservation.id}`);
    }
  }
}

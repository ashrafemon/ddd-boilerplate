import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AppendOutboxEventUseCase } from '@platform/platform-common/outbox/use-cases/append-outbox-event.usecase';
import { SagaOutboxRepositoryPort } from '../outbound/ports/saga-outbox.repository.port';

/**
 * Use case: append one saga event to `saga_outbox`.
 *
 * Identical envelope handling to `AppendOutboxEventUseCase` (same headers, same
 * payload stripping, same CLS-derived tenancy) — only the ledger differs, which
 * is why it subclasses rather than duplicates.
 */
@Injectable()
export class AppendSagaOutboxEventUseCase extends AppendOutboxEventUseCase {
  constructor(repository: SagaOutboxRepositoryPort, requestContext: RequestContextPort) {
    super(repository, requestContext);
  }
}

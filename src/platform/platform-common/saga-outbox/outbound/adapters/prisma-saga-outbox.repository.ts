import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  OutboxLedgerDelegate,
  OutboxLedgerRepository,
} from '@platform/platform-common/outbox/outbound/adapters/outbox-ledger.repository';
import { SagaOutboxRepositoryPort } from '../ports/saga-outbox.repository.port';

/**
 * PostgreSQL adapter for `saga_outbox` (the workbook's saga publication ledger).
 *
 * The table is column-for-column identical to `outbox_messages`, so it binds the
 * shared `OutboxLedgerRepository` instead of re-implementing the claim/CAS state
 * machine. The delegate is cast once here because Prisma types each model
 * separately; the shapes are guaranteed equal by the schema.
 */
@Injectable()
export class PrismaSagaOutboxRepository
  extends OutboxLedgerRepository
  implements SagaOutboxRepositoryPort
{
  constructor(txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super(txHost, 'saga_outbox', txHost.tx.sagaOutboxMessage as unknown as OutboxLedgerDelegate);
  }
}

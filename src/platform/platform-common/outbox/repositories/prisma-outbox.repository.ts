import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { OutboxLedgerRepository } from './outbox-ledger.repository';

/**
 * PostgreSQL adapter for the shared transactional outbox (`outbox_messages`).
 *
 * Implements `OutboxRepositoryPort`; use cases inject the port, never this
 * class. All behaviour — claim, CAS settles, retention — lives in
 * `OutboxLedgerRepository`, which the saga's own ledger reuses bound to
 * `saga_outbox`.
 */
@Injectable()
export class PrismaOutboxRepository extends OutboxLedgerRepository {
  constructor(txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super(txHost, 'outbox_messages', txHost.tx.outboxMessage);
  }
}

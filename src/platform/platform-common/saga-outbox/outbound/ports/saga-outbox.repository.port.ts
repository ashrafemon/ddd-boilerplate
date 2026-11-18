import { OutboxRepositoryPort } from '@platform/platform-common/outbox/outbound/ports/outbox.repository.port';

/**
 * Outbound port: the saga's own publication ledger (`saga_outbox`).
 *
 * Same contract as the shared `OutboxRepositoryPort` — append inside the
 * caller's transaction, claim with `FOR UPDATE SKIP LOCKED` + lease, CAS-settle
 * on `claimToken`. The saga owns this ledger so lifecycle traffic
 * (`onComplete.emit`) can be claimed, retried and purged on its own schedule
 * without competing with business traffic in `outbox_messages`.
 */
export abstract class SagaOutboxRepositoryPort extends OutboxRepositoryPort {}

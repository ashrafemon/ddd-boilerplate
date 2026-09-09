import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class OutboxWriterPort {
  abstract append(event: DomainEvent, aggregateType: string, aggregateId: string): Promise<void>;
}

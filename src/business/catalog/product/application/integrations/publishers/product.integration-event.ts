import { DomainEvent } from '@business/shared-business';

export abstract class ProductIntegrationEvet {
  abstract send(event: DomainEvent, aggregateType: string, aggregateId: string): Promise<void>;
}

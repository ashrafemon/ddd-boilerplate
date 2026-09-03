import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class GrnIntegrationPort {
  abstract send(event: DomainEvent, grnId: string): Promise<void>;
}
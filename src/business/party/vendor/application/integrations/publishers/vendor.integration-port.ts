import { DomainEvent } from '@business/shared-business/domain/bases/event.base';

export abstract class VendorIntegrationPort {
  abstract send(event: DomainEvent, vendorId: string): Promise<void>;
}
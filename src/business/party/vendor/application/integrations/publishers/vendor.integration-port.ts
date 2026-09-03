import { DomainEvent } from '@business/shared-business';

export abstract class VendorIntegrationPort {
  abstract send(event: DomainEvent, vendorId: string): Promise<void>;
}
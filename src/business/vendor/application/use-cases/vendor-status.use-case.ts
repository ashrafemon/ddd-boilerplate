import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  VENDOR_REPOSITORY,
  VendorRepositoryPort,
} from '../../ports/outbound/vendor-repository.port';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';
import { VendorErrors } from '../../domain/errors/vendor.errors';

type StatusAction = 'activate' | 'deactivate' | 'block';

@Injectable()
export class VendorStatusUseCase implements UseCase<
  { id: string; action: StatusAction },
  VendorId
> {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendorRepository: VendorRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: { id: string; action: StatusAction }): Promise<VendorId> {
    return this.unitOfWork.execute(async () => {
      const id = VendorId.fromString(input.id);
      const vendor = await this.vendorRepository.findById(id);
      if (!vendor) {
        throw VendorErrors.notFound();
      }

      switch (input.action) {
        case 'activate':
          vendor.activate();
          break;
        case 'deactivate':
          vendor.deactivate();
          break;
        case 'block':
          vendor.block();
          break;
      }

      await this.vendorRepository.update(vendor);

      for (const event of vendor.pullEvents()) {
        await this.outboxWriter.append(event, 'Vendor', vendor.id.toString());
        this.eventBus.publish(event);
      }

      return vendor.id;
    });
  }
}

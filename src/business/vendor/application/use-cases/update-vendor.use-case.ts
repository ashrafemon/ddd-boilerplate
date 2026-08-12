import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@business/shared-business/application/use-case';
import { UNIT_OF_WORK, UnitOfWork } from '@business/shared-business/ports/unit-of-work.port';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { UpdateVendorInput } from '../../ports/inbound/vendor.command.port';
import {
  VENDOR_REPOSITORY,
  VendorRepositoryPort,
} from '../../ports/outbound/vendor-repository.port';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';
import { VendorErrors } from '../../domain/errors/vendor.errors';

@Injectable()
export class UpdateVendorUseCase implements UseCase<UpdateVendorInput, VendorId> {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendorRepository: VendorRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
  ) {}

  async execute(input: UpdateVendorInput): Promise<VendorId> {
    return this.unitOfWork.execute(async () => {
      const id = VendorId.fromString(input.id);
      const vendor = await this.vendorRepository.findById(id);
      if (!vendor) {
        throw VendorErrors.notFound();
      }

      vendor.update({
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
      });
      await this.vendorRepository.update(vendor);

      for (const event of vendor.pullEvents()) {
        await this.outboxWriter.append(event, 'Vendor', vendor.id.toString());
        this.eventBus.publish(event);
      }

      return vendor.id;
    });
  }
}

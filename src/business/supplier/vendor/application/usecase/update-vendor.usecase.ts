import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import {
  IN_PROCESS_EVENT_BUS,
  InProcessEventBus,
} from '@business/shared-business/ports/event-bus.port';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';
import { VendorErrors } from '../../domain/errors/vendor.errors';
import {
  VENDOR_COMMAND_REPOSITORY,
  VendorCommandRepositoryPort,
} from '../../ports/outbound/vendor-command-repository.port';

export interface UpdateVendorInput {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class UpdateVendorUseCase implements CommandUseCase<UpdateVendorInput, VendorId> {
  constructor(
    @Inject(VENDOR_COMMAND_REPOSITORY)
    private readonly vendorRepository: VendorCommandRepositoryPort,
    @Inject(IN_PROCESS_EVENT_BUS) private readonly eventBus: InProcessEventBus,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: UpdateVendorInput): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

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
  }
}

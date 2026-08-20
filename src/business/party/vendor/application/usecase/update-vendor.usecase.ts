import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { UpdateVendorRequest } from '../../domain/types/vendor.types';
import { VendorId } from '../../domain/value-objects';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports';

@Injectable()
export class UpdateVendorUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepositoryPort,
    private readonly outboxWriter: OutboxWriterPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: UpdateVendorRequest): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const id = VendorId.fromString(input.id);
    const vendor = await this.vendorRepository.findById(id);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
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
    }

    return vendor.id;
  }
}

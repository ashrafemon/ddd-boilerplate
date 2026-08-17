import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { VendorId } from '../../domain/value-objects';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports';

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
    @Inject(VendorCommandRepositoryPort)
    private readonly vendorRepository: VendorCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: UpdateVendorInput): Promise<VendorId> {
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

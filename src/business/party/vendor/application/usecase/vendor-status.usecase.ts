import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { VendorId } from '../../domain/value-objects';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports';

export type VendorStatusAction = 'activate' | 'deactivate' | 'block';

export interface VendorStatusInput {
  id: string;
  action: VendorStatusAction;
}

@Injectable()
export class VendorStatusUseCase implements CommandUseCase<VendorStatusInput, VendorId> {
  constructor(
    @Inject(VendorCommandRepositoryPort)
    private readonly vendorRepository: VendorCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: VendorStatusInput): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const id = VendorId.fromString(input.id);
    const vendor = await this.vendorRepository.findById(id);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
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
    }

    return vendor.id;
  }
}

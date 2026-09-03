import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { VendorStatusRequest } from '../../domain/types/vendor.types';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports/vendor-command-repository.port';
import { VendorIntegrationPort } from '../integrations/publishers/vendor.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class VendorStatusUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepositoryPort,
    private readonly integrationEvent: VendorIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: VendorStatusRequest): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const id = VendorId.fromString(input.id);
    const vendor = await this.vendorRepository.findById(id.toString());
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
      await this.integrationEvent.send(event, vendor.id.toString());
    }

    return vendor.id;
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { VendorStatusRequest } from '../../domain/types/vendor.types';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { VendorPublisherPort } from '../integrations/publishes/vendor.publisher-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class VendorStatusUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepository,
    private readonly integrationEvent: VendorPublisherPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: VendorStatusRequest): Promise<string> {
    await this.companyConfig.getCompanyConfig();

    const id = input.id;
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

    return vendor.id.toString();
  }
}

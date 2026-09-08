import { Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { UpdateVendorRequest } from '../../domain/types/vendor.types';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { VendorIntegrationPort } from '../integrations/publishes/vendor.integration-port';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class UpdateVendorUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepository,
    private readonly integrationEvent: VendorIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: UpdateVendorRequest): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const id = VendorId.fromString(input.id);
    const vendor = await this.vendorRepository.findById(id.toString());
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
      await this.integrationEvent.send(event, vendor.id.toString());
    }

    return vendor.id;
  }
}

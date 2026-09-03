import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CreateVendorRequest } from '../../domain/types/vendor.types';
import { vendorFactory } from '../../domain/factories';
import { VendorId } from '../../domain/value-objects';
import { VendorCode } from '../../domain/value-objects';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports';
import { VendorIntegrationPort } from '../integrations';
import { CompanyConfigOutboundPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreateVendorUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepositoryPort,
    private readonly integrationEvent: VendorIntegrationPort,
    private readonly companyConfig: CompanyConfigOutboundPort,
  ) {}

  @Transactional()
  async execute(input: CreateVendorRequest): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const vendor = vendorFactory.create(input);

    const existing = await this.vendorRepository.findByCode(VendorCode.create(vendor.code).toString());
    if (existing) {
      throw new ConflictException(`Vendor with code "${vendor.code}" already exists`);
    }

    await this.vendorRepository.save(vendor);

    for (const event of vendor.pullEvents()) {
      await this.integrationEvent.send(event, vendor.id.toString());
    }

    return vendor.id;
  }
}
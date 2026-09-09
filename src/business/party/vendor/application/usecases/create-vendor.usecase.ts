import { Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CreateVendorRequest } from '../../domain/types/vendor.types';
import { VendorFactory } from '../../domain/factories/vendor.factory';
import { VendorId } from '@business/shared-business/domain/common/value-objects/vendor-id';
import { VendorCode } from '../../domain/value-objects/vendor.vos';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { VendorIntegrationPort } from '../integrations/publishes/vendor.integration-port';
import { CompanyConfigPort } from '../outbound-ports/company-config.port';

@Injectable()
export class CreateVendorUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepository,
    private readonly integrationEvent: VendorIntegrationPort,
    private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: CreateVendorRequest): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const vendor = VendorFactory.create(input);

    const existing = await this.vendorRepository.findByCode(
      VendorCode.create(vendor.code).toString(),
    );
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

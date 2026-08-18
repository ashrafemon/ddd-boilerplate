import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import { CompanyConfigPort } from '@platform/configuration/ports/company-config.port';
import { CreateVendorRequest } from '../../domain/types/vendor.types';
import { vendorFactory } from '../../domain/factories';
import { VendorId } from '../../domain/value-objects';
import { VendorCode } from '../../domain/value-objects';
import { VendorCommandRepositoryPort } from '../../domain/domain-ports';

@Injectable()
export class CreateVendorUseCase implements CommandUseCase<CreateVendorRequest, VendorId> {
  constructor(
    @Inject(VendorCommandRepositoryPort)
    private readonly vendorRepository: VendorCommandRepositoryPort,
    @Inject(OutboxWriterPort) private readonly outboxWriter: OutboxWriterPort,
    @Inject(CompanyConfigPort) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: CreateVendorRequest): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const vendor = vendorFactory.create(input);

    const existing = await this.vendorRepository.findByCode(VendorCode.create(vendor.code));
    if (existing) {
      throw new ConflictException(`Vendor with code "${vendor.code}" already exists`);
    }

    await this.vendorRepository.save(vendor);

    for (const event of vendor.pullEvents()) {
      await this.outboxWriter.append(event, 'Vendor', vendor.id.toString());
    }

    return vendor.id;
  }
}

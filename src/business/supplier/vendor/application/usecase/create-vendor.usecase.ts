import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { vendorFactory } from '../../domain/factories';
import { VendorId } from '../../domain/value-objects';
import { VendorCode } from '../../domain/value-objects';
import { VendorErrors } from '../../domain/errors';
import {
  VENDOR_COMMAND_REPOSITORY,
  VendorCommandRepositoryPort,
} from '../../domain/ports';

export interface CreateVendorInput {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class CreateVendorUseCase implements CommandUseCase<CreateVendorInput, VendorId> {
  constructor(
    @Inject(VENDOR_COMMAND_REPOSITORY)
    private readonly vendorRepository: VendorCommandRepositoryPort,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: CreateVendorInput): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const vendor = vendorFactory.create(input);

    const existing = await this.vendorRepository.findByCode(VendorCode.create(vendor.code));
    if (existing) {
      throw VendorErrors.codeConflict(vendor.code);
    }

    await this.vendorRepository.save(vendor);

    for (const event of vendor.pullEvents()) {
      await this.outboxWriter.append(event, 'Vendor', vendor.id.toString());
    }

    return vendor.id;
  }
}

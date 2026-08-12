import { Inject, Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { CommandUseCase } from '@business/shared-business/application/use-case';
import { OUTBOX_WRITER, OutboxWriterPort } from '@platform/outbox/ports/outbox-writer.port';
import {
  COMPANY_CONFIG,
  CompanyConfigPort,
} from '@platform/configuration/ports/company-config.port';
import { VendorId } from '../../domain/value-objects/vendor-id.vo';
import { VendorErrors } from '../../domain/errors/vendor.errors';
import {
  VENDOR_COMMAND_REPOSITORY,
  VendorCommandRepositoryPort,
} from '../../domain/ports/vendor-command-repository.port';

export type VendorStatusAction = 'activate' | 'deactivate' | 'block';

export interface VendorStatusInput {
  id: string;
  action: VendorStatusAction;
}

@Injectable()
export class VendorStatusUseCase implements CommandUseCase<VendorStatusInput, VendorId> {
  constructor(
    @Inject(VENDOR_COMMAND_REPOSITORY)
    private readonly vendorRepository: VendorCommandRepositoryPort,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriterPort,
    @Inject(COMPANY_CONFIG) private readonly companyConfig: CompanyConfigPort,
  ) {}

  @Transactional()
  async execute(input: VendorStatusInput): Promise<VendorId> {
    await this.companyConfig.getCompanyConfig();

    const id = VendorId.fromString(input.id);
    const vendor = await this.vendorRepository.findById(id);
    if (!vendor) {
      throw VendorErrors.notFound();
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

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { CreateVendorRequest } from '../../domain/types/vendor.types';
import { VendorFactory } from '../../domain/factories/vendor.factory';
import { VendorCommandRepository } from '../../domain/repositories/vendor-command.repository';
import { VendorPublisherPort } from '../publishes/publishers/vendor.publisher-port';

@Injectable()
export class CreateVendorUseCase {
  constructor(
    private readonly vendorRepository: VendorCommandRepository,
    private readonly integrationEvent: VendorPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: CreateVendorRequest): Promise<string> {
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    const abacResult = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: 'Vendor',
      action: 'create',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const vendor = VendorFactory.create(input);

    const existing = await this.vendorRepository.findByCode(vendor.code);
    if (existing) {
      throw new ConflictException(`Vendor with code "${vendor.code}" already exists`);
    }

    await this.vendorRepository.save(vendor);

    for (const event of vendor.pullEvents()) {
      await this.integrationEvent.send(event, vendor.id.toString());
    }

    return vendor.id.toString();
  }
}

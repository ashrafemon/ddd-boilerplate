import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { PriceListCommandRepository } from '../../domain/repositories/price-list-command.repository';
import { PriceListFactory } from '../../domain/factories/price-list.factory';
import { PriceListPublisherPort } from '../publishes/publishers/price-list.publisher-port';
import { CreatePriceListRequest } from '../../domain/types/price-list.types';

@Injectable()
export class CreatePriceListUseCase {
  constructor(
    private readonly priceListRepository: PriceListCommandRepository,
    private readonly integrationEvent: PriceListPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: CreatePriceListRequest): Promise<string> {
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
      resource: 'PriceList',
      action: 'create',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

    const priceList = PriceListFactory.create({
      name: input.name,
      code: input.code,
      currency: input.currency,
      effectiveFrom,
      effectiveTo,
    });

    const existing = await this.priceListRepository.findByCode(priceList.code);
    if (existing) {
      throw new ConflictException(`Price list with code "${priceList.code}" already exists`);
    }

    await this.priceListRepository.save(priceList);

    for (const event of priceList.pullEvents()) {
      await this.integrationEvent.send(event, priceList.id.toString());
    }

    return priceList.id.toString();
  }
}

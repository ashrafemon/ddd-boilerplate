import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { PriceListCommandRepository } from '../../domain/repositories/price-list-command.repository';
import { PriceListPublisherPort } from '../publishes/publishers/price-list.publisher-port';
import { UpdatePriceListRequest } from '../../domain/types/price-list.types';

@Injectable()
export class UpdatePriceListUseCase {
  constructor(
    private readonly priceListRepository: PriceListCommandRepository,
    private readonly integrationEvent: PriceListPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: UpdatePriceListRequest): Promise<string> {
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
      action: 'update',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const priceList = await this.priceListRepository.findById(input.id);
    if (!priceList) {
      throw new NotFoundException('Price list not found');
    }

    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : null;
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

    priceList.update({
      name: input.name,
      code: input.code,
      currency: input.currency,
      effectiveFrom: effectiveFrom ?? undefined,
      effectiveTo: effectiveTo ?? undefined,
    });

    await this.priceListRepository.update(priceList);

    for (const event of priceList.pullEvents()) {
      await this.integrationEvent.send(event, priceList.id.toString());
    }

    return priceList.id.toString();
  }
}

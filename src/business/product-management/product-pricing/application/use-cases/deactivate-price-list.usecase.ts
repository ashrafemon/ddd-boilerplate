import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { PriceListCommandRepository } from '../../domain/repositories/price-list-command.repository';
import { PriceListPublisherPort } from '../publishes/publishers/price-list.publisher-port';
import { DeactivatePriceListRequest } from '../../domain/types/price-list.types';

@Injectable()
export class DeactivatePriceListUseCase {
  constructor(
    private readonly priceListRepository: PriceListCommandRepository,
    private readonly integrationEvent: PriceListPublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: DeactivatePriceListRequest): Promise<string> {
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
      action: 'deactivate',
    });
    if (abacResult.decision === 'DENY') {
      throw new ForbiddenException(abacResult.reason ?? 'ABAC denied');
    }

    const priceList = await this.priceListRepository.findById(input.id);
    if (!priceList) {
      throw new NotFoundException('Price list not found');
    }

    priceList.deactivate();

    await this.priceListRepository.update(priceList);

    for (const event of priceList.pullEvents()) {
      await this.integrationEvent.send(event, priceList.id.toString());
    }

    return priceList.id.toString();
  }
}

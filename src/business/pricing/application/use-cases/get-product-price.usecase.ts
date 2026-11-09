import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { PriceListQuery } from '../../application/queries/price-list.query';
import { GetProductPriceRequest, GetProductPriceResult } from '../../domain/types/price-list.types';

@Injectable()
export class GetProductPriceUseCase {
  constructor(
    private readonly priceListQuery: PriceListQuery,
    private readonly requestContext: RequestContextPort,
  ) {}

  async execute(input: GetProductPriceRequest): Promise<GetProductPriceResult | null> {
    const ctx = this.requestContext.require();
    const result = await this.priceListQuery.findPurchasablePriceForProduct(
      input.productId,
      ctx.companyId,
      ctx.tenantId ?? undefined,
    );
    if (!result) {
      throw new NotFoundException(`No active price found for product ${input.productId}`);
    }
    return result;
  }
}

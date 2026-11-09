import { PriceListQuery } from '@business/pricing/application/queries/price-list.query';
import { PrismaReadPort } from '@platform/platform-common/context/ports/prisma-read.port';
import { Injectable } from '@nestjs/common';
import { PageQuery, PageResult } from '@common/application/types/pagination';
import {
  PriceListQueryRecord,
  GetProductPriceResult,
} from '../../../domain/types/price-list.types';
import { PrismaPriceListMapper } from './prisma-price-list.mapper';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { TenantScope } from '@common/application/utils/tenant-scope';

@Injectable()
export class PrismaPriceListQueryRepository extends PriceListQuery {
  constructor(
    private readonly prismaRead: PrismaReadPort,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  private sharedScope(): { OR: Array<{ tenantId: string | null }> } {
    return TenantScope.where<{ OR: Array<{ tenantId: string | null }> }>(
      this.requestContext.getTenantId(),
      { includeUnscoped: true },
    );
  }

  async findById(id: string): Promise<PriceListQueryRecord | null> {
    const row = await this.prismaRead.priceList.findFirst({ where: { id, ...this.sharedScope() } });
    return row ? PrismaPriceListMapper.toRecord(row as never) : null;
  }

  async findByCode(code: string): Promise<PriceListQueryRecord | null> {
    const row = await this.prismaRead.priceList.findFirst({
      where: { code, ...this.sharedScope() },
    });
    return row ? PrismaPriceListMapper.toRecord(row as never) : null;
  }

  async findActiveByCode(code: string): Promise<PriceListQueryRecord | null> {
    const row = await this.prismaRead.priceList.findFirst({
      where: { code, status: 'ACTIVE', ...this.sharedScope() },
    });
    return row ? PrismaPriceListMapper.toRecord(row as never) : null;
  }

  async findPurchasablePriceForProduct(
    productId: string,
    companyId?: string,
    tenantId?: string,
  ): Promise<GetProductPriceResult | null> {
    const scope: Record<string, unknown> = { ...this.sharedScope() };
    if (companyId) scope['companyId'] = companyId;
    if (tenantId) scope['tenantId'] = tenantId;

    const activeLists = await this.prismaRead.priceList.findMany({
      where: { status: 'ACTIVE', ...scope },
      select: { id: true, currency: true },
    });

    if (activeLists.length === 0) {
      const customerPrice = await this.prismaRead.customerPrice.findFirst({
        where: { productId, ...scope },
      });
      if (customerPrice) {
        return {
          productId,
          price: Number(customerPrice.price),
          currency: customerPrice.currency,
          source: 'customer-price',
        };
      }
      return null;
    }

    const activeListIds = activeLists.map(l => l.id);
    const line = await this.prismaRead.priceListLine.findFirst({
      where: {
        productId,
        priceListId: { in: activeListIds },
      },
      orderBy: { price: 'asc' },
    });

    if (line) {
      const priceList = activeLists.find(l => l.id === line.priceListId);
      return {
        productId,
        price: Number(line.price),
        currency: priceList?.currency ?? 'USD',
        source: 'price-list-line',
      };
    }

    const customerPrice = await this.prismaRead.customerPrice.findFirst({
      where: { productId, ...scope },
    });
    if (customerPrice) {
      return {
        productId,
        price: Number(customerPrice.price),
        currency: customerPrice.currency,
        source: 'customer-price',
      };
    }

    return null;
  }

  async findAll(query: PageQuery): Promise<PageResult<PriceListQueryRecord>> {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.prismaRead.priceList.findMany({
        where: this.sharedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaRead.priceList.count({ where: this.sharedScope() }),
    ]);
    return {
      items: rows.map((row: never) => PrismaPriceListMapper.toRecord(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}

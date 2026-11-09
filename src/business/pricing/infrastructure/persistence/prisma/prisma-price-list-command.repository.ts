import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PriceList } from '@business/pricing/domain/aggregates/price-list.aggregate';
import { PriceListCommandRepository } from '@business/pricing/domain/repositories/price-list-command.repository';
import { PrismaPriceListMapper } from './prisma-price-list.mapper';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { resolveCompanyId } from '@shared-kernel/constants/company';

@Injectable()
export class PrismaPriceListCommandRepository extends PriceListCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
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

  async findById(id: string): Promise<PriceList | null> {
    const row = await this.txHost.tx.priceList.findFirst({
      where: { id, ...this.sharedScope() },
    });
    return row ? PrismaPriceListMapper.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<PriceList | null> {
    const row = await this.txHost.tx.priceList.findFirst({
      where: { code, ...this.sharedScope() },
    });
    return row ? PrismaPriceListMapper.toDomain(row) : null;
  }

  async save(priceList: PriceList): Promise<PriceList> {
    await this.txHost.tx.priceList.create({
      data: {
        ...PrismaPriceListMapper.toRow(priceList),
        tenantId: this.requestContext.getTenantId(),
        companyId: resolveCompanyId(this.requestContext.get()),
      } as never,
    });
    return priceList;
  }

  async update(priceList: PriceList): Promise<PriceList> {
    const res = await this.txHost.tx.priceList.updateMany({
      where: {
        id: priceList.id.toString(),
        version: priceList.getVersion(),
        ...this.sharedScope(),
      },
      data: { ...PrismaPriceListMapper.toRow(priceList), version: { increment: 1 } } as never,
    });
    if (res.count === 0) {
      throw new ConflictException('Price list was modified concurrently (not found in scope)');
    }
    return priceList;
  }
}

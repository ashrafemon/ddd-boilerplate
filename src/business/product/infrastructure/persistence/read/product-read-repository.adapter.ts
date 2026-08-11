import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { PrismaReadService } from '../../../../../infrastructure/database/prisma/prisma-read.service';
import {
  ProductReadModel,
  ProductReadRepositoryPort,
} from '../../../domain/port/product-read-repository.port';
import { ProductMapper } from '../product.mapper';

/**
 * Read-side repository for products, scoped to the current tenant.
 */
@Injectable()
export class PrismaProductReadRepositoryAdapter implements ProductReadRepositoryPort {
  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async findById(id: string): Promise<ProductReadModel | null> {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.prismaRead.product.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    return row ? ProductMapper.toReadModel(row) : null;
  }

  public async findByIds(ids: string[]): Promise<ProductReadModel[]> {
    if (ids.length === 0) return [];
    const tenantId = this.requestContext.getTenantId();
    const rows = await this.prismaRead.product.findMany({
      where: { id: { in: ids }, ...(tenantId ? { tenantId } : {}) },
    });
    return rows.map(ProductMapper.toReadModel);
  }

  public async findByCode(
    tenantId: string,
    organizationId: string,
    code: string,
  ): Promise<ProductReadModel | null> {
    const row = await this.prismaRead.product.findFirst({
      where: { tenantId, organizationId, code: code.trim().toUpperCase() },
    });
    return row ? ProductMapper.toReadModel(row) : null;
  }
}

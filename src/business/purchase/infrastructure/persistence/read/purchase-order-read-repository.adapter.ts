import { Injectable } from '@nestjs/common';
import { RequestContextPort } from '../../../../../shared-kernel/ports/context/request-context.port';
import { PrismaReadService } from '../../../../../infrastructure/database/prisma/prisma-read.service';
import {
  PurchaseOrderReadModel,
  PurchaseOrderReadRepositoryPort,
} from '../../../domain/port/purchase-order-read-repository.port';
import { PurchaseOrderMapper } from '../purchase-order.mapper';

/**
 * Read-side repository for purchase orders, scoped to the current tenant.
 */
@Injectable()
export class PrismaPurchaseOrderReadRepositoryAdapter implements PurchaseOrderReadRepositoryPort {
  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly requestContext: RequestContextPort,
  ) {}

  public async findById(id: string): Promise<PurchaseOrderReadModel | null> {
    const tenantId = this.requestContext.getTenantId();
    const row = await this.prismaRead.purchaseOrder.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      include: { lines: true },
    });
    if (!row) return null;

    const vendor = await this.prismaRead.vendor.findUnique({
      where: { id: row.vendorId },
      select: { id: true, code: true, name: true },
    });

    return PurchaseOrderMapper.toReadModel(row, vendor);
  }
}

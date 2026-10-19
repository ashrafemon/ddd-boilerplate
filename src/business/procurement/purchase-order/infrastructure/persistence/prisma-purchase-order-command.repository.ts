import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PurchaseOrder } from '@business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate';
import { PurchaseOrderId } from '@business/procurement/purchase-order/domain/value-objects/purchase-order-id.vo';
import { PurchaseOrderCommandRepository } from '@business/procurement/purchase-order/domain/repositories/purchase-order-command.repository';
import { PrismaPurchaseOrderMapper } from './prisma-purchase-order.mapper';
import { PageQuery } from '@shared-kernel/types/pagination';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';
import { resolveCompanyId } from '@shared-kernel/constants/company';

@Injectable()
export class PrismaPurchaseOrderCommandRepository extends PurchaseOrderCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /**
   * Tenancy scope of the current request (ARCHITECTURE.md §5). A purchase
   * order is an OWNED document: a tenant-scoped request sees only its own
   * rows, and an unscoped request (single-tenant deployment) sees all.
   */
  private ownedScope(): { tenantId?: string } {
    return TenantScope.where<{ tenantId?: string }>(this.requestContext.getTenantId());
  }

  async save(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    await this.txHost.tx.purchaseOrder.create({
      data: {
        ...PrismaPurchaseOrderMapper.toRow(purchaseOrder),
        tenantId: this.requestContext.getTenantId(),
        companyId: resolveCompanyId(this.requestContext.get()),
        lines: { create: PrismaPurchaseOrderMapper.toLinesCreateInput(purchaseOrder) },
      } as never,
    });
    return purchaseOrder;
  }

  /**
   * Optimistic-concurrency write (plan Phase 0.6): CAS on `(id, version)`
   * first — `version: { increment: 1 }` so a stale aggregate can never match
   * again (last-write-wins is impossible); zero rows ⇒ 409. The line rewrite
   * runs in the same CLS transaction, and only after the CAS succeeded
   * (`updateMany` does not accept nested relation writes — that is why the
   * two steps are split).
   */
  async update(purchaseOrder: PurchaseOrder): Promise<PurchaseOrder> {
    const cas = await this.txHost.tx.purchaseOrder.updateMany({
      where: {
        id: purchaseOrder.id.toString(),
        version: purchaseOrder.getVersion(),
        ...this.ownedScope(),
      },
      data: {
        ...PrismaPurchaseOrderMapper.toRow(purchaseOrder),
        version: { increment: 1 },
      } as never,
    });
    if (cas.count === 0) {
      throw new ConflictException(
        'Purchase order was modified concurrently (optimistic concurrency conflict)',
      );
    }

    await this.txHost.tx.purchaseOrder.update({
      where: { id: purchaseOrder.id.toString() },
      data: {
        lines: {
          deleteMany: {},
          create: PrismaPurchaseOrderMapper.toLinesCreateInput(purchaseOrder),
        },
      } as never,
    });
    return purchaseOrder;
  }

  async findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findFirst({
      where: { id: id.toString(), ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toDomain(row) : null;
  }

  async findByOrderNumber(orderNumber: string): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findFirst({
      where: { orderNumber, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toDomain(row) : null;
  }

  async findByExternalReference(externalReference: string): Promise<PurchaseOrder | null> {
    const row = await this.txHost.tx.purchaseOrder.findFirst({
      where: { externalReference, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaPurchaseOrderMapper.toDomain(row) : null;
  }

  async findAll(query: PageQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const [rows, total] = await Promise.all([
      this.txHost.tx.purchaseOrder.findMany({
        where: this.ownedScope(),
        skip,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { lines: true },
      }),
      this.txHost.tx.purchaseOrder.count({ where: this.ownedScope() }),
    ]);
    return {
      items: rows.map((row: never) => PrismaPurchaseOrderMapper.toDomain(row)),
      total,
    };
  }
}

import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { GoodReceiptNote } from '../../domain/aggregates/grn.aggregate';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { PrismaGrnMapper } from './prisma-grn.mapper';
import { RequestContextPort } from '@platform/context/ports/request-context.port';
import { TenantScope } from '@shared-kernel/utils/tenant-scope.util';

@Injectable()
export class PrismaGrnCommandRepository extends GrnCommandRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly requestContext: RequestContextPort,
  ) {
    super();
  }

  /**
   * A GRN is an OWNED document: a tenant-scoped request sees only its own
   * rows; a row owned by another tenant is NOT FOUND (no existence leak).
   */
  private ownedScope(): { tenantId?: string } {
    return TenantScope.where<{ tenantId?: string }>(this.requestContext.getTenantId());
  }

  async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    await this.txHost.tx.goodReceiptNote.create({
      data: {
        ...PrismaGrnMapper.toRow(grn),
        tenantId: this.requestContext.getTenantId(),
        companyId: this.requestContext.getCompanyId(),
        lines: { create: PrismaGrnMapper.toLinesCreateInput(grn) },
      } as never,
    });
    return grn;
  }

  /**
   * Optimistic-concurrency write (plan Phase 0.6): CAS on `(id, version)`
   * with `version: { increment: 1 }` so a stale aggregate can never match
   * again; zero rows ⇒ 409. The line rewrite follows in the same CLS
   * transaction (`updateMany` rejects nested relation writes — hence the split).
   */
  async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    const cas = await this.txHost.tx.goodReceiptNote.updateMany({
      where: { id: grn.id.toString(), version: grn.getVersion(), ...this.ownedScope() },
      data: {
        ...PrismaGrnMapper.toRow(grn),
        version: { increment: 1 },
      } as never,
    });
    if (cas.count === 0) {
      throw new ConflictException(
        'GRN was modified concurrently (optimistic concurrency conflict)',
      );
    }

    await this.txHost.tx.goodReceiptNote.update({
      where: { id: grn.id.toString() },
      data: {
        lines: {
          deleteMany: {},
          create: PrismaGrnMapper.toLinesCreateInput(grn),
        },
      } as never,
    });
    return grn;
  }

  async findById(id: string): Promise<GoodReceiptNote | null> {
    const row = await this.txHost.tx.goodReceiptNote.findFirst({
      where: { id, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaGrnMapper.toDomain(row as never) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null> {
    const row = await this.txHost.tx.goodReceiptNote.findFirst({
      where: { grnNumber, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaGrnMapper.toDomain(row as never) : null;
  }

  async findByReversalOfId(reversalOfId: string): Promise<GoodReceiptNote | null> {
    const row = await this.txHost.tx.goodReceiptNote.findFirst({
      where: { reversalOfId, ...this.ownedScope() },
      include: { lines: true },
    });
    return row ? PrismaGrnMapper.toDomain(row as never) : null;
  }
}

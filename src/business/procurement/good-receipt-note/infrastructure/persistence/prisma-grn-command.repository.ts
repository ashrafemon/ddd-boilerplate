import { ConflictException, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { GoodReceiptNote } from '../../domain/aggregates/grn.aggregate';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { PrismaGrnMapper } from './prisma-grn.mapper';

@Injectable()
export class PrismaGrnCommandRepository extends GrnCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    await this.txHost.tx.goodReceiptNote.create({
      data: {
        ...PrismaGrnMapper.toRow(grn),
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
      where: { id: grn.id.toString(), version: grn.getVersion() },
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
    const row = await this.txHost.tx.goodReceiptNote.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? PrismaGrnMapper.toDomain(row as never) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null> {
    const row = await this.txHost.tx.goodReceiptNote.findUnique({
      where: { grnNumber },
      include: { lines: true },
    });
    return row ? PrismaGrnMapper.toDomain(row as never) : null;
  }

  async findByReversalOfId(reversalOfId: string): Promise<GoodReceiptNote | null> {
    const row = await this.txHost.tx.goodReceiptNote.findFirst({
      where: { reversalOfId },
      include: { lines: true },
    });
    return row ? PrismaGrnMapper.toDomain(row as never) : null;
  }
}

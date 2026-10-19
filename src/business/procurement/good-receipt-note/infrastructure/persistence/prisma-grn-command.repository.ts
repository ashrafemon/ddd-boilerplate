import { Injectable } from '@nestjs/common';
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

  async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    const result = await this.txHost.tx.goodReceiptNote.updateMany({
      where: { id: grn.id.toString(), version: grn.getVersion() },
      data: {
        ...PrismaGrnMapper.toRow(grn),
        lines: {
          deleteMany: {},
          create: PrismaGrnMapper.toLinesCreateInput(grn),
        },
      } as never,
    });
    if (result.count === 0) {
      throw new Error('GRN was modified concurrently (optimistic concurrency conflict)');
    }
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
}

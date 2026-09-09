import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { GoodReceiptNote } from '../../domain/aggregates/grn.aggregate';
import { GrnCommandRepository } from '../../domain/repositories/grn-command.repository';
import { GrnId } from '../../domain/value-objects/grn.vos';
import { PrismaGrnCommandMapper } from './prisma-grn.mapper';

@Injectable()
export class PrismaGrnCommandRepository extends GrnCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    await (
      this.txHost.tx as never as {
        goodReceiptNote: { create: (args: { data: never }) => Promise<unknown> };
      }
    ).goodReceiptNote.create({ data: { ...PrismaGrnCommandMapper.toRow(grn) } as never });
    return grn;
  }

  async update(grn: GoodReceiptNote): Promise<GoodReceiptNote> {
    await (
      this.txHost.tx as never as {
        goodReceiptNote: {
          update: (args: { where: { id: string }; data: never }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.update({
      where: { id: grn.id.toString() },
      data: { ...PrismaGrnCommandMapper.toRow(grn) } as never,
    });
    return grn;
  }

  async findById(id: string): Promise<GoodReceiptNote | null> {
    const row = await (
      this.txHost.tx as never as {
        goodReceiptNote: { findUnique: (args: { where: { id: string } }) => Promise<unknown> };
      }
    ).goodReceiptNote.findUnique({ where: { id } });
    return row ? PrismaGrnCommandMapper.toDomain(row as never) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<GoodReceiptNote | null> {
    const row = await (
      this.txHost.tx as never as {
        goodReceiptNote: {
          findUnique: (args: { where: { grnNumber: string } }) => Promise<unknown>;
        };
      }
    ).goodReceiptNote.findUnique({ where: { grnNumber } });
    return row ? PrismaGrnCommandMapper.toDomain(row as never) : null;
  }

  async nextGrnSequence(): Promise<number> {
    const result = await this.txHost.tx.$queryRawUnsafe<{ next: number }[]>(
      `SELECT nextval('grn_sequence') as next`,
    );
    return result[0]?.next ?? 1;
  }
}

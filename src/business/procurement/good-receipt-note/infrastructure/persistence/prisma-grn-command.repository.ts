import { Grn } from '@business/procurement/good-receipt-note/domain/entities/grn.aggregate';
import { GrnCommandRepositoryPort } from '@business/procurement/good-receipt-note/domain/ports/grn-command-repository.port';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { GrnMapper } from '../mappers/grn.mapper';

@Injectable()
export class PrismaGrnCommandRepository extends GrnCommandRepositoryPort {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async save(grn: Grn): Promise<Grn> {
    await this.txHost.tx.goodReceiptNote.create({ data: { ...GrnMapper.toRow(grn) } as never });
    return grn;
  }

  async update(grn: Grn): Promise<Grn> {
    await this.txHost.tx.goodReceiptNote.update({
      where: { id: grn.id.toString() },
      data: { ...GrnMapper.toRow(grn) } as never,
    });
    return grn;
  }

  async findById(id: string): Promise<Grn | null> {
    const row = await this.txHost.tx.goodReceiptNote.findUnique({ where: { id } });
    return row ? GrnMapper.toDomain(row) : null;
  }

  async findByGrnNumber(grnNumber: string): Promise<Grn | null> {
    const row = await this.txHost.tx.goodReceiptNote.findUnique({ where: { grnNumber } });
    return row ? GrnMapper.toDomain(row) : null;
  }

  async nextGrnSequence(): Promise<number> {
    const result = await this.txHost.tx.$queryRawUnsafe<{ next: number }[]>(
      `SELECT nextval('grn_sequence') as next`,
    );
    return result[0]?.next ?? 1;
  }
}
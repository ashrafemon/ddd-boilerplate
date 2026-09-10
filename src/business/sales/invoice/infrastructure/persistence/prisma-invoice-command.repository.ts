import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Invoice } from '../../domain/aggregates/invoice.aggregate';
import { InvoiceCommandRepository } from '../../domain/repositories/invoice-command.repository';
import { PrismaInvoiceMapper } from './prisma-invoice.mapper';

@Injectable()
export class PrismaInvoiceCommandRepository extends InvoiceCommandRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {
    super();
  }

  async findById(id: string): Promise<Invoice | null> {
    const row = await this.txHost.tx.invoice.findUnique({ where: { id } });
    return row ? PrismaInvoiceMapper.toDomain(row) : null;
  }

  async save(invoice: Invoice): Promise<Invoice> {
    await this.txHost.tx.invoice.create({
      data: { ...PrismaInvoiceMapper.toRow(invoice) } as never,
    });
    return invoice;
  }

  async update(invoice: Invoice): Promise<Invoice> {
    await this.txHost.tx.invoice.update({
      where: { id: invoice.id.toString() },
      data: { ...PrismaInvoiceMapper.toRow(invoice) } as never,
    });
    return invoice;
  }
}

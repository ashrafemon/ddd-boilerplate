import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { Invoice } from '../../domain/aggregates/invoice.aggregate';
import { InvoiceId } from '../../domain/value-objects/invoice-id.vo';
import { InvoiceLine } from '../../domain/value-objects/invoice-line.vo';
import { InvoiceNumber } from '../../domain/value-objects/invoice-number.vo';
import { InvoiceQueryRecord, InvoiceStatus } from '../../domain/types/invoice.types';

interface InvoiceRow {
  id: string;
  invoiceNo: string;
  customerId: string;
  status: string;
  currency: string;
  totalAmount: { toNumber(): number } | number;
  lines: unknown;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface StoredLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export class PrismaInvoiceMapper {
  static toDomain(row: InvoiceRow): Invoice {
    const lines = (Array.isArray(row.lines) ? (row.lines as StoredLine[]) : []).map(line =>
      InvoiceLine.create(
        line.description,
        line.quantity,
        Money.fromDecimal(line.unitPrice, row.currency),
      ),
    );
    return Invoice.instantiate(
      InvoiceId.fromString(row.id),
      {
        invoiceNo: InvoiceNumber.create(row.invoiceNo),
        customerId: row.customerId,
        status: row.status as InvoiceStatus,
        currency: row.currency,
        lines,
        postedAt: row.postedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.version,
    );
  }

  static toRow(invoice: Invoice) {
    return {
      id: invoice.id.toString(),
      invoiceNo: invoice.invoiceNo,
      customerId: invoice.customerId,
      status: invoice.status,
      currency: invoice.currency,
      totalAmount: invoice.totalAmount().amount,
      lines: invoice.lines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice.amount,
      })),
      postedAt: invoice.postedAt,
      version: invoice.getVersion(),
    };
  }

  static toRecord(row: InvoiceRow): InvoiceQueryRecord {
    const total =
      typeof row.totalAmount === 'number' ? row.totalAmount : row.totalAmount.toNumber();
    return {
      id: row.id,
      invoiceNo: row.invoiceNo,
      customerId: row.customerId,
      status: row.status,
      currency: row.currency,
      totalAmount: total,
      lines: (Array.isArray(row.lines) ? (row.lines as StoredLine[]) : []).map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      postedAt: row.postedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

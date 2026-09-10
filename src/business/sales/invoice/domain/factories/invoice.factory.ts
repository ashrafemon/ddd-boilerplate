import { Money } from '@business/shared-business/domain/common/value-objects/money';
import { invariantRegistry } from '@business/shared-business/domain/registries/invariant.registry';
import { Invoice } from '../aggregates/invoice.aggregate';
import { InvoiceCreated } from '../events/invoice.created.event';
import { CreateInvoiceInput, InvoiceProps, InvoiceStatus } from '../types/invoice.types';
import { InvoiceId } from '../value-objects/invoice-id.vo';
import { InvoiceLine } from '../value-objects/invoice-line.vo';
import { InvoiceNumber } from '../value-objects/invoice-number.vo';
import '../aggregates/invoice.invariants';
import '../value-objects/invoice-number.invariants';

/** The only sanctioned build path for an Invoice aggregate. */
export class InvoiceFactory {
  static create(input: CreateInvoiceInput): Invoice {
    invariantRegistry.enforce<{ lineCount: number }>('invoice.create', {
      lineCount: input.lines.length,
    });

    const now = new Date();
    const lines = input.lines.map(line => {
      const unitPrice = Money.fromDecimal(line.unitPrice, input.currency);
      invariantRegistry.enforce<{ quantity: number; unitPriceMinor: number }>('invoice.line', {
        quantity: line.quantity,
        unitPriceMinor: unitPrice.minorUnits,
      });
      return InvoiceLine.create(line.description, line.quantity, unitPrice);
    });

    const invoice = Invoice.instantiate(
      InvoiceId.generate(),
      {
        invoiceNo: InvoiceNumber.create(input.invoiceNo),
        customerId: input.customerId,
        status: InvoiceStatus.DRAFT,
        currency: input.currency,
        lines,
        postedAt: null,
        createdAt: now,
        updatedAt: now,
      } satisfies InvoiceProps,
      1,
    );

    invoice.addEvent(
      new InvoiceCreated(
        invoice.id,
        invoice.invoiceNo,
        invoice.customerId,
        invoice.totalAmount().amount,
        invoice.currency,
      ),
    );
    return invoice;
  }

  static reconstitute(id: InvoiceId, props: InvoiceProps, version: number): Invoice {
    return Invoice.instantiate(id, props, version);
  }
}

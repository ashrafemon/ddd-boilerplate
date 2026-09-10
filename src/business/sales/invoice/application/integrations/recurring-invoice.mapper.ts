import { ConflictException } from '@nestjs/common';
import { InvoiceLineInput } from '../../domain/types/invoice.types';

/**
 * Normalises the opaque RecurringTemplate.lines JSON carried by a
 * RecurringOccurrenceRequested event into typed invoice line inputs.
 */
export function asInvoiceLines(lines: unknown[]): InvoiceLineInput[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new ConflictException('Recurring Invoice template must have at least one line');
  }
  return lines.map((raw, index) => {
    const line = raw as Record<string, unknown>;
    const description = stringField(line, 'description', `lines[${index}]`);
    const quantity = numberField(line, 'quantity', `lines[${index}]`);
    const unitPrice = numberField(line, 'unitPrice', `lines[${index}]`);
    return { description, quantity, unitPrice };
  });
}

function stringField(source: Record<string, unknown>, key: string, prefix: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConflictException(`Recurring Invoice ${prefix}.${key} is required`);
  }
  return value;
}

function numberField(source: Record<string, unknown>, key: string, prefix: string): number {
  const value = Number(source[key]);
  if (!Number.isFinite(value)) {
    throw new ConflictException(`Recurring Invoice ${prefix}.${key} must be a number`);
  }
  return value;
}

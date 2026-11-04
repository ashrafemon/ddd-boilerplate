import { ConflictException } from '@nestjs/common';
import { AddLineInput } from '../../domain/types/purchase-order.types';

/**
 * Normalises the opaque RecurringTemplate.lines JSON carried by a
 * RecurringOccurrenceRequested event into typed purchase order line inputs.
 */
export function asPurchaseOrderLines(lines: unknown[]): Omit<AddLineInput, 'id'>[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new ConflictException('Recurring PurchaseOrder template must have at least one line');
  }
  return lines.map((raw, index) => {
    const line = raw as Record<string, unknown>;
    const productId = stringField(line, 'productId', `lines[${index}]`);
    const quantity = numberField(line, 'quantity', `lines[${index}]`);
    const unitPrice = numberField(line, 'unitPrice', `lines[${index}]`);
    return { productId, quantity, unitPrice };
  });
}

function stringField(source: Record<string, unknown>, key: string, prefix: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConflictException(`Recurring PurchaseOrder ${prefix}.${key} is required`);
  }
  return value;
}

function numberField(source: Record<string, unknown>, key: string, prefix: string): number {
  const value = Number(source[key]);
  if (!Number.isFinite(value)) {
    throw new ConflictException(`Recurring PurchaseOrder ${prefix}.${key} must be a number`);
  }
  return value;
}

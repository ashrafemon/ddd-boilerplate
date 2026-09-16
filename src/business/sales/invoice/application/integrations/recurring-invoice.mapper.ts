import { ConflictException } from '@nestjs/common';
import { JsonValue } from '@shared-kernel/types/json-value.type';
import { InvoiceLineInput } from '../../domain/types/invoice.types';

/**
 * Normalises the opaque RecurringTemplate.lines JSON carried by a
 * RecurringOccurrenceRequested event into typed invoice line inputs.
 */
export class RecurringInvoiceLineMapper {
  static toLines(lines: JsonValue[]): InvoiceLineInput[] {
    if (lines.length === 0) {
      throw new ConflictException('Recurring Invoice template must have at least one line');
    }
    return lines.map((raw, index) => {
      const line = RecurringInvoiceLineMapper.asObject(raw, index);
      return {
        description: RecurringInvoiceLineMapper.stringField(line, 'description', index),
        quantity: RecurringInvoiceLineMapper.numberField(line, 'quantity', index),
        unitPrice: RecurringInvoiceLineMapper.numberField(line, 'unitPrice', index),
      };
    });
  }

  private static asObject(raw: JsonValue, index: number): Record<string, JsonValue> {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ConflictException(`Recurring Invoice lines[${index}] must be an object`);
    }
    return raw;
  }

  private static stringField(line: Record<string, JsonValue>, key: string, index: number): string {
    const value = line[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new ConflictException(`Recurring Invoice lines[${index}].${key} is required`);
    }
    return value;
  }

  private static numberField(line: Record<string, JsonValue>, key: string, index: number): number {
    const value = line[key];
    const numeric =
      typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(numeric)) {
      throw new ConflictException(`Recurring Invoice lines[${index}].${key} must be a number`);
    }
    return numeric;
  }
}

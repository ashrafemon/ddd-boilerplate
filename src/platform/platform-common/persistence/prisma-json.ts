import { Prisma } from '../../../generated/client';
import { JsonObject } from '../types/json-value';

export class PrismaJson {
  static toInput(value: object | null | undefined): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  static toInputRequired(value: object): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  static asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  static as<T>(value: unknown): T | null {
    return value === null || value === undefined ? null : (value as T);
  }

  static asRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  static snapshot(value: object): JsonObject {
    return JSON.parse(JSON.stringify(value)) as JsonObject;
  }
}

import { Prisma } from '../../generated/client';
import { JsonObject } from '../types/json-value.type';

/**
 * Single audited boundary between "arbitrary JSON from Prisma columns" and
 * typed application data.
 *
 * - `toInput` produces a value Prisma's input types accept for JSON columns
 *   (undefined passthrough for optional columns).
 * - `toInputRequired` is the non-null variant.
 * - `asRecord` / `asRecordArray` read JSON column values back into typed
 *   application shapes instead of scattering `as` casts through repositories.
 */
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

  /** Audited narrowing of a JSON column into a domain shape. */
  static as<T>(value: unknown): T | null {
    return value === null || value === undefined ? null : (value as T);
  }

  static asRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  /** Stable JSON snapshot of a class instance (events, payloads). */
  static snapshot(value: object): JsonObject {
    return JSON.parse(JSON.stringify(value)) as JsonObject;
  }
}

import { z } from 'zod';

export function envString(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export function envBoolean(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export function envNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function booleanFromString(defaultValue = false) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      throw new Error(`Invalid boolean value: ${value}`);
    })
    .pipe(z.boolean());
}

export function numberFromString(defaultValue: number) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number value: ${value}`);
      }
      return parsed;
    })
    .pipe(z.number());
}

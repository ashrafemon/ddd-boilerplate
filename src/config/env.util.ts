/**
 * Environment parsing helpers used by every registerAs config block. All
 * numeric env values go through numericEnv so garbage input fails fast with
 * a clear message instead of silently producing NaN.
 */

export function numericEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric value for ${name}: "${raw}"`);
  }
  return value;
}

export function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

export function requiredInProduction(...names: string[]): void {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = names.filter(name => {
    const raw = process.env[name];
    return raw === undefined || raw.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(', ')}`,
    );
  }
}

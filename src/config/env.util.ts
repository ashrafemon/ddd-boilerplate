/**
 * Environment parsing helpers used by every registerAs config block. All
 * numeric env values go through numericEnv so garbage input fails fast with
 * a clear message instead of silently producing NaN.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

class EnvUtils {
  private static envLoaded = false;

  static envFileCandidates(cwd: string = process.cwd()): string[] {
    const env = process.env.NODE_ENV ?? 'development';
    return [`.env.${env}.local`, `.env.${env}`, '.env'].map(name => resolve(cwd, name));
  }

  static ensureEnvLoaded(): void {
    if (EnvUtils.envLoaded) return;
    EnvUtils.envLoaded = true;

    for (const file of EnvUtils.envFileCandidates().reverse()) {
      if (!existsSync(file)) continue;

      for (const [key, value] of Object.entries(EnvUtils.parseEnv(readFileSync(file, 'utf8')))) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  }

  static parseEnv(contents: string): Record<string, string> {
    const parsed: Record<string, string> = {};

    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;
      if (!match) continue;

      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")
      ) {
        value = value.slice(1, -1);
      }
      parsed[match[1]] = value;
    }

    return parsed;
  }
}

/**
 * Loads `.env` files into `process.env` at most once, without overriding real
 * environment variables. Needed by module definitions that must branch on a
 * driver flag before `ConfigModule` has been scanned (for example the cache
 * client selection), so the branch no longer depends on import order.
 */
export const ensureEnvLoaded = EnvUtils.ensureEnvLoaded;

/** Env files in override order, shared by ConfigModule and ensureEnvLoaded. */
export const envFileCandidates = EnvUtils.envFileCandidates;

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

export function stringEnv(name: string, fallback = ''): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
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
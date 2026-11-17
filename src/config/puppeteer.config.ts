import { registerAs } from '@nestjs/config';
import { booleanEnv } from '@common/application/utils/env.util';

export type IPuppeteerConfig = {
  enabled: boolean;
  headless: boolean;
  /** System Chrome/Chromium path; empty = the bundled Chrome for Testing. */
  executablePath: string;
  /** Extra Chromium flags (containers typically need --no-sandbox). */
  args: string[];
  /** Page lifecycle is the platform adapter's concern; this bounds the browser boot. */
  launchTimeoutMs: number;
};

/**
 * Puppeteer (headless Chrome) config — used by document generation (HTML →
 * PDF). Opt-in: a machine without Chrome must not block the boot. When
 * enabled but broken, fail-closed in production.
 */
export default registerAs('puppeteer', () => ({
  enabled: booleanEnv('PUPPETEER_ENABLED', false),
  headless: booleanEnv('PUPPETEER_HEADLESS', true),
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '',
  args: (process.env.PUPPETEER_ARGS ?? '--no-sandbox,--disable-dev-shm-usage')
    .split(',')
    .map(arg => arg.trim())
    .filter(Boolean),
  launchTimeoutMs: Number(process.env.PUPPETEER_LAUNCH_TIMEOUT_MS ?? 30_000),
}));

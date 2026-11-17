import { Browser } from 'puppeteer';
import { ConfigService } from '@config/config.service';
import { InfrastructureException } from '@common/application/exceptions/infrastructure.exception';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { IPuppeteerConfig } from '@config/puppeteer.config';

/**
 * Puppeteer client — client initialization only.
 *
 * Manages one shared headless Chrome (opt-in via `PUPPETEER_ENABLED`; a
 * machine without Chrome must not block boot, so disabled never fails, while
 * enabled-but-broken is fail-closed in production). The browser launches
 * lazily on first use and the launch promise is memoized so concurrent
 * callers share one browser. Rendering pipelines (HTML → PDF, templates,
 * streaming to S3) are platform-capability decisions and open/close pages
 * via `getBrowser()` — not here.
 */
@Injectable()
export class PuppeteerService implements OnModuleInit, OnModuleDestroy {
  private readonly config?: IPuppeteerConfig;
  private readonly isProduction: boolean;
  private readonly logger = new Logger(PuppeteerService.name);
  private launchPromise?: Promise<Browser>;

  constructor(configService: ConfigService) {
    const config = configService.getPuppeteer();

    this.isProduction = configService.isProduction;

    if (!config.enabled) {
      this.logger.warn('puppeteer-disabled');
      return;
    }

    this.config = config;
  }

  /** False when `PUPPETEER_ENABLED` is not set — no browser is managed. */
  get isEnabled(): boolean {
    return this.config !== undefined;
  }

  /** The shared browser instance; launches on first call. */
  public getBrowser(): Promise<Browser> {
    if (!this.config) {
      return Promise.reject(
        new InfrastructureException('Puppeteer is not configured: set PUPPETEER_ENABLED=true'),
      );
    }
    if (!this.launchPromise) {
      this.launchPromise = this.launch();
    }
    return this.launchPromise;
  }

  private async launch(): Promise<Browser> {
    const config = this.config!;
    try {
      const { default: puppeteer } = await import('puppeteer');
      const browser = await puppeteer.launch({
        headless: config.headless,
        ...(config.executablePath ? { executablePath: config.executablePath } : {}),
        args: config.args,
        protocolTimeout: config.launchTimeoutMs,
      });
      this.logger.log('puppeteer-browser-launched');
      return browser;
    } catch (error) {
      this.launchPromise = undefined;
      const reason = (error as Error).message;
      if (this.isProduction) {
        throw new InfrastructureException('puppeteer-launch-failed', { reason });
      }
      this.logger.warn(`puppeteer-launch-failed: ${reason}`);
      throw new InfrastructureException('puppeteer-launch-failed', { reason });
    }
  }

  public async onModuleInit(): Promise<void> {
    if (!this.config) return;

    // Boot probe: verify Chrome can actually launch so a broken install is
    // caught at startup (fail-closed in production) instead of on first PDF.
    try {
      const browser = await this.getBrowser();
      await browser.version();
      this.logger.log('puppeteer-connected');
    } catch (error) {
      if (this.isProduction) {
        throw new InfrastructureException('puppeteer-unreachable', {
          reason: (error as Error).message,
        });
      }
      this.logger.warn(`puppeteer-unreachable: ${(error as Error).message}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    const browser = await this.launchPromise?.catch(() => undefined);
    if (browser) {
      await browser.close().catch(() => undefined);
      this.logger.log('puppeteer-browser-closed');
    }
  }
}

import { Module } from '@nestjs/common';
import { PuppeteerService } from './puppeteer.service';

/**
 * Puppeteer client module — client initialization only.
 *
 * Registers the shared headless Chrome browser (opt-in via
 * PUPPETEER_ENABLED). Document rendering lives in the platform layer.
 * Deliberately NOT `@Global()`.
 */
@Module({
  providers: [PuppeteerService],
  exports: [PuppeteerService],
})
export class PuppeteerModule {}

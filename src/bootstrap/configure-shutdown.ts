import * as Sentry from '@sentry/nestjs';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { stopTracing } from './configure-tracing';

export function configureShutdown(app: NestFastifyApplication): void {
  app.enableShutdownHooks();

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onClose', async () => {
      await stopTracing();
      await Sentry.close(2_000);
    });
}

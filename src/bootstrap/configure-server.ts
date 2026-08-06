import type { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Binds the HTTP server to the configured port and logs the entry points.
 */
export async function configureServer(
  app: INestApplication,
  logger: Logger,
): Promise<void> {
  const config = app.get(ConfigService);

  const port = config.get<number>('app.port', 4000);
  await app.listen(port);

  logger.log(`Mukut ERP API listening on ${app.getUrl()}/api`);
  logger.log(`Swagger: ${app.getUrl()}/docs`);
}

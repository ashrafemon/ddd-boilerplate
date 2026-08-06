import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureShutdown(app: NestFastifyApplication): void {
  app.enableShutdownHooks();
}

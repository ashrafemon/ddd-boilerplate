import type { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export async function configureServer(app: NestFastifyApplication, logger: Logger): Promise<void> {
  const config = app.get(ConfigService);

  const port = config.get<number>('app.port', 4000);
  const host = config.get<string>('app.host', '0.0.0.0');
  await app.listen({ port, host });

  const url = await app.getUrl();
  logger.log(`ERP API listening on ${url}`);
  logger.log(`Swagger: ${url}/api/docs`);
}

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { ConfigurationService } from './config/configuration.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configuration = app.get(ConfigurationService);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(configuration.port, configuration.host);

  Logger.log(
    `ERP API listening on http://${configuration.host}:${configuration.port} (${configuration.env})`,
    'Bootstrap',
  );
}

void bootstrap();

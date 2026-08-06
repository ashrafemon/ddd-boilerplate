import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import 'reflect-metadata';
import { AppModule } from '../app.module';
import { configureCors } from './configure-cors';
import { configureHttp } from './configure-http';
import { configureSecurity } from './configure-security';
import { configureServer } from './configure-server';
import { configureShutdown } from './configure-shutdown';
import { configureSwagger } from './configure-swagger';

/**
 * Bootstraps the application by composing each independent configuration
 * step: security, CORS, HTTP prefix/versioning, validation, Swagger, and
 * finally the HTTP listener.
 */
export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });
  app.useLogger(new Logger());
  const logger = new Logger('Bootstrap');

  await configureSecurity(app);
  configureCors(app);
  configureHttp(app);
  configureSwagger(app);
  configureShutdown(app);
  await configureServer(app, logger);
}

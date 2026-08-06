import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import 'reflect-metadata';
import { AppModule } from '../app.module';
import { configureCors } from './configure-cors';
import { configureHttp } from './configure-http';
import { configureSecurity } from './configure-security';
import { configureServer } from './configure-server';
import { configureSwagger } from './configure-swagger';
import { configureValidation } from './configure-validation';

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
  configureValidation(app);
  configureSwagger(app);
  await configureServer(app, logger);
}

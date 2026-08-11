import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import 'reflect-metadata';
import { AppModule } from '../app.module';
import { configureCors } from './configure-cors';
import { configureHttp } from './configure-http';
import { configureSecurity } from './configure-security';
import { configureSentry } from './configure-sentry';
import { configureServer } from './configure-server';
import { configureShutdown } from './configure-shutdown';
import { configureSwagger } from './configure-swagger';

/**
 * Bootstraps the application by composing each independent configuration
 * step: security, CORS, HTTP prefix/versioning, validation, Swagger, and
 * finally the HTTP listener.
 */
export async function bootstrap(): Promise<void> {
  configureSentry();

  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: process.env.NODE_ENV === 'production' ? false : true,
        bodyLimit: 1024 * 1024 * 5,
        requestTimeout: 30_000,
        connectionTimeout: 30_000,
        keepAliveTimeout: 65_000,
      }),
      {
        logger:
          process.env.NODE_ENV === 'production'
            ? ['error', 'warn', 'log']
            : ['error', 'warn', 'log', 'debug', 'verbose'],
        bufferLogs: true,
      },
    );

    app.useLogger(new Logger());
    app.flushLogs();

    await configureSecurity(app);
    configureCors(app);
    configureHttp(app);
    configureShutdown(app);
    configureSwagger(app);
    await configureServer(app, logger);
  } catch (err) {
    logger.error(`Application bootstrap failed: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  }
}

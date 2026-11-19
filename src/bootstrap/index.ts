import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger as PinoLoggerService } from 'nestjs-pino';
import 'reflect-metadata';
import { AppModule } from '../app.module';
import { ensureEnvLoaded } from '@common/application/utils/env.util';
import appConfig from '@config/app.config';
import { configureTracing } from './configure-tracing';
import { configureCors } from './configure-cors';
import { configureHttp } from './configure-http';
import { configureSecurity } from './configure-security';
import { configureSentry } from './configure-sentry';
import { configureServer } from './configure-server';
import { configureShutdown } from './configure-shutdown';
import { configureSwagger } from './configure-swagger';
import { CompanyConfigContextMiddleware } from '@common/http/middleware/company-config-context.middleware';

/**
 * Bootstraps the application by composing each independent configuration
 * step: security, CORS, HTTP prefix/versioning, validation, Swagger, and
 * finally the HTTP listener.
 */
export async function bootstrap(): Promise<void> {
  // .env files must be loaded before any config facade is read — tracing and
  // Sentry initialize before the Nest application (and its ConfigModule) exist.
  ensureEnvLoaded();

  // Tracing first — instrumentations must patch modules before first use.
  configureTracing();

  configureSentry();

  const logger = new Logger('Bootstrap');
  const isProduction = appConfig().env === 'production';

  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: isProduction ? false : true,
        bodyLimit: 1024 * 1024 * 5,
        requestTimeout: 30_000,
        connectionTimeout: 30_000,
        keepAliveTimeout: 65_000,
      }),
      {
        logger: isProduction
          ? ['error', 'warn', 'log']
          : ['error', 'warn', 'log', 'debug', 'verbose'],
        bufferLogs: true,
      },
    );

    // `PinoLogger` (nestjs-pino) is a TRANSIENT-scoped provider, so it cannot be
    // resolved with `app.get()` (Nest throws InvalidClassScopeException). The
    // injectable Nest `LoggerService` is nestjs-pino's `Logger`, which is a
    // singleton and is what `useLogger()` expects.
    app.useLogger(app.get(PinoLoggerService));
    app.flushLogs();

    // Company configuration is resolved and stamped into the global CLS
    // RequestContext by middleware (Rule 8), before any route handler runs.
    // `strict: true` would restrict the lookup to the root module; the middleware
    // lives in (and is exported by) ConfigurationModule, so resolve it globally.
    const companyConfigContext = app.get(CompanyConfigContextMiddleware);
    app.use((req, res, next) => companyConfigContext.use(req, res, next));

    // Business opt-ins (batch/import/notification/webhook handlers) register
    // themselves via decorators + DiscoveryService — see
    // platform-common/<capability>/<capability>-opt-in.ts. Bootstrap holds
    // only what the NestJS application needs to run.
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

import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { configureBatchOperations } from '../../src/bootstrap/configure-batch-operations';
import { configureCors } from '../../src/bootstrap/configure-cors';
import { configureHttp } from '../../src/bootstrap/configure-http';
import { configureImports } from '../../src/bootstrap/configure-imports';
import { configureNotifications } from '../../src/bootstrap/configure-notifications';
import { configureSecurity } from '../../src/bootstrap/configure-security';
import { configureWebhooks } from '../../src/bootstrap/configure-webhooks';

/**
 * The application, wired exactly like `src/main.ts` wires it.
 *
 * The composition-root opt-in bridges (batch operations, imports,
 * notifications, webhooks) register the business handlers on the platform
 * registries. They are NOT part of a Nest module — `main.ts` calls them
 * before `listen()`. A test that skips them silently runs with no
 * notification handler, no import handler and no batch handler registered,
 * which looks exactly like a broken platform.
 *
 * Order matters: the bridges must run BEFORE `init()`, because the
 * `onModuleInit` hooks that subscribe the in-process consumers fire inside
 * it and resolve the handlers the bridges registered.
 */
export async function createTestApp(): Promise<{
  app: NestFastifyApplication;
  moduleFixture: TestingModule;
}> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  configureBatchOperations(app);
  configureImports(app);
  configureNotifications(app);
  configureWebhooks(app);

  await configureSecurity(app);
  configureCors(app);
  configureHttp(app);

  await app.init();

  return { app, moduleFixture };
}

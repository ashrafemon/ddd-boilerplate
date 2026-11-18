import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module';
import { configureCors } from '../../bootstrap/configure-cors';
import { configureHttp } from '../../bootstrap/configure-http';
import { configureSecurity } from '../../bootstrap/configure-security';

/**
 * The application, wired exactly like `src/main.ts` wires it.
 *
 * Business opt-ins (batch/import/notification/webhook handlers) register
 * themselves via decorators + DiscoveryService during `app.init()` — no
 * composition-root bridge needed, so a test app behaves like production.
 */
export async function createTestApp(): Promise<{
  app: NestFastifyApplication;
  moduleFixture: TestingModule;
}> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  await configureSecurity(app);
  configureCors(app);
  configureHttp(app);

  await app.init();

  return { app, moduleFixture };
}

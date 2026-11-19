import { Provider, Type } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppValidationPipe } from '@common/http/pipes/validator.pipe';

export interface ApiTestAppOptions {
  /** Controller under test — the production class, never a copy. */
  controller: Type<unknown>;
  /** Collaborator doubles for the endpoint under test. */
  providers?: Provider[];
}

export interface ApiTestApp {
  app: NestFastifyApplication;
  /** `request(app.getHttpServer())` — a fresh supertest agent per call. */
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * Boots ONE controller on a real Fastify server with the global validation
 * pipe registered exactly as `AppModule` registers it, so a spec sees the same
 * `400`s production produces.
 *
 * Controllers inject every use case they expose, so the endpoints a spec does
 * not exercise still need a binding: any constructor parameter without an
 * explicit double gets a swallowed stub. A typo in a `provide` token therefore
 * fails as "unused double" behaviour (the call assertion) instead of a silent
 * pass, and a new dependency added to the controller never breaks unrelated
 * endpoint specs.
 */
export async function createApiTestApp(options: ApiTestAppOptions): Promise<ApiTestApp> {
  const { controller, providers = [] } = options;

  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [...stubsForUnprovided(controller, providers), ...providers].concat({
      provide: APP_PIPE,
      useClass: AppValidationPipe,
    }),
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}

/** Id value object stub: controllers call `String(result)`/`.toString()`. */
export const idOf = (value: string): { toString: () => string } => ({
  toString: () => value,
});

function stubsForUnprovided(controller: Type<unknown>, providers: Provider[]): Provider[] {
  const provided = new Set<unknown>(
    providers.map(provider => (provider as { provide?: unknown }).provide),
  );
  const tokens = (Reflect.getMetadata('design:paramtypes', controller) ?? []) as unknown[];

  return tokens
    .filter(token => !provided.has(token))
    .map(token => ({ provide: token as Type<unknown>, useValue: stubFor(token) }));
}

function stubFor(token: unknown): Record<string, jest.Mock> {
  const name = (token as { name?: string }).name ?? '';
  if (name.endsWith('ContextPort') || name.endsWith('RequestContext')) {
    return { require: jest.fn(() => ({})), get: jest.fn() };
  }
  return { execute: jest.fn(() => undefined) };
}

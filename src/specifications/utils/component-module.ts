import { Provider, Type } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import { defaultPlatformProviders } from '@test/support/platform/fake-platform-ports';
import { initNoopTransactionHost } from './noop-transaction-host';

type Token = string | symbol | Type<unknown> | ((...args: never[]) => unknown);

function tokenOf(provider: Provider): Token | undefined {
  if (typeof provider === 'function') return provider as Token;
  if (provider && typeof provider === 'object' && 'provide' in provider) {
    return (provider as { provide: Token }).provide;
  }
  return undefined;
}

export interface ComponentModuleOptions {
  /**
   * Providers that replace the module's own IO bindings — the aggregate
   * repositories and query repositories. Anything the module binds with
   * `useClass`/`useFactory` (Prisma, outbox factory) is swapped here.
   */
  overrides?: Provider[];
  /** Platform port doubles that replace the harness defaults. */
  platform?: Provider[];
  /** Drop a provider the feature does not need (e.g. an opt-in handler). */
  without?: Type<unknown>[];
}

/**
 * Build the real Nest dependency graph of a business module with every IO edge
 * faked — the definition of a component test in `docs/testing-business-modules.md`.
 *
 * The module's own `providers` metadata is replayed, so every use case, facade,
 * `useExisting`/`useFactory` binding and port token is wired by Nest exactly as
 * in production; only the `imports: [PlatformModule]` edge is skipped (it would
 * open Prisma/Redis/RabbitMQ connections) and replaced by the platform doubles.
 *
 * A missing or misspelled `provide` token, a provider that forgot `@Injectable()`
 * or a constructor that injects an unbound port all fail here — which is the
 * class of bug unit tests (manual `new`) cannot see.
 */
export async function createComponentModule(
  moduleClass: Type<unknown>,
  options: ComponentModuleOptions = {},
): Promise<TestingModule> {
  initNoopTransactionHost();

  const declared: Provider[] = (Reflect.getMetadata('providers', moduleClass) ?? []) as Provider[];
  const controllers = (Reflect.getMetadata('controllers', moduleClass) ?? []) as Type<unknown>[];

  const overrides = options.overrides ?? [];
  const platform = options.platform ?? [];
  const overriddenTokens = new Set(
    [...overrides, ...platform].map(tokenOf).filter((token): token is Token => token !== undefined),
  );
  const dropped = new Set<unknown>(options.without ?? []);

  const kept = declared.filter(provider => {
    const token = tokenOf(provider);
    if (token !== undefined && overriddenTokens.has(token)) return false;
    if (typeof provider === 'function' && dropped.has(provider)) return false;
    return true;
  });

  const defaults = defaultPlatformProviders().filter(provider => {
    const token = tokenOf(provider);
    return token === undefined || !overriddenTokens.has(token);
  });

  const moduleFixture = await Test.createTestingModule({
    controllers,
    providers: [...kept, ...defaults, ...platform, ...overrides],
  }).compile();

  return moduleFixture;
}

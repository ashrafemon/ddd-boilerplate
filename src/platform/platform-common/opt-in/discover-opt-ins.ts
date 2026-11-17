import { DiscoveryService } from '@nestjs/core';

export interface DiscoveredOptIn<TMeta> {
  instance: object;
  meta: TMeta;
}

/**
 * Collects every provider instance whose CLASS carries the given metadata
 * key — the generic engine behind the platform opt-in decorators
 * (`@BatchOperationOptIn`, `@ImportOptIn`, `@NotificationOptIn`,
 * `@WebhookEventTypeOptIn`, `@WebhookInboundSourceOptIn`).
 *
 * Business adapters stay PURE (no registry imports, no lifecycle): they
 * declare their opt-in declaratively on the class, and the owning platform
 * capability module scans them at bootstrap. This replaces the old
 * composition-root bridges in `src/bootstrap/configure-*.ts`.
 *
 * Safe at onApplicationBootstrap: all providers are instantiated before any
 * lifecycle hook fires, and no platform consumer resolves registry entries
 * during init (dispatchers only subscribe lazily).
 */
export function discoverOptIns<TMeta>(
  discovery: DiscoveryService,
  metadataKey: string,
): Array<DiscoveredOptIn<TMeta>> {
  const found: Array<DiscoveredOptIn<TMeta>> = [];

  for (const wrapper of discovery.getProviders()) {
    const instance = wrapper.instance as unknown;
    if (!instance || typeof instance !== 'object') continue;

    const metatype = wrapper.metatype ?? instance.constructor;
    if (typeof metatype !== 'function') continue;

    const meta = Reflect.getMetadata(metadataKey, metatype) as TMeta | undefined;
    if (meta !== undefined) {
      found.push({ instance: instance, meta });
    }
  }

  return found;
}

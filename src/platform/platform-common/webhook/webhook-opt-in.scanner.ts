import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { WebhookEventTypeRegistry } from './webhook-event-type.registry';
import { WebhookInboundSourceRegistry } from './webhook-inbound-source.registry';
import {
  WEBHOOK_EVENT_TYPE_OPT_IN_METADATA,
  WEBHOOK_INBOUND_OPT_IN_METADATA,
  WebhookInboundOptInMeta,
} from './webhook-opt-in';
import { discoverOptIns } from '@platform/platform-common/opt-in/discover-opt-ins';

/**
 * Scans the DI graph for webhook opt-ins at bootstrap:
 * `@WebhookEventTypeOptIn(name)` → event-type registry,
 * `@WebhookInboundSourceOptIn({source, verify})` → inbound-source registry.
 * Replaces the old composition-root bridge.
 */
@Injectable()
export class WebhookOptInScanner implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly eventTypeRegistry: WebhookEventTypeRegistry,
    private readonly inboundRegistry: WebhookInboundSourceRegistry,
  ) {}

  public onApplicationBootstrap(): void {
    for (const { meta } of discoverOptIns<string[]>(
      this.discovery,
      WEBHOOK_EVENT_TYPE_OPT_IN_METADATA,
    )) {
      for (const eventType of meta) {
        this.eventTypeRegistry.register(eventType);
      }
    }

    for (const { instance, meta } of discoverOptIns<WebhookInboundOptInMeta[]>(
      this.discovery,
      WEBHOOK_INBOUND_OPT_IN_METADATA,
    )) {
      for (const entry of meta) {
        this.inboundRegistry.register(entry.source, {
          verify: entry.verify,
          handler: instance as Parameters<WebhookInboundSourceRegistry['register']>[1]['handler'],
        });
      }
    }
  }
}

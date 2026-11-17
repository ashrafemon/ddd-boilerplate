import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { NotificationHandlerRegistry } from './notification-handler.registry';
import { NOTIFICATION_OPT_IN_METADATA, NotificationOptInMeta } from './notification-opt-in';
import { discoverOptIns } from '@platform/platform-common/opt-in/discover-opt-ins';

/**
 * Scans the DI graph for `@NotificationOptIn({...})` classes (stackable) and
 * registers every declared notificationType on the registry at bootstrap.
 * Replaces the old composition-root bridge.
 */
@Injectable()
export class NotificationOptInScanner implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly registry: NotificationHandlerRegistry,
  ) {}

  public onApplicationBootstrap(): void {
    for (const { instance, meta } of discoverOptIns<NotificationOptInMeta[]>(
      this.discovery,
      NOTIFICATION_OPT_IN_METADATA,
    )) {
      for (const entry of meta) {
        this.registry.register(
          {
            notificationType: entry.notificationType,
            channels: entry.channels,
            priority: entry.priority,
            ...(entry.eventName ? { eventName: entry.eventName } : {}),
          },
          instance as Parameters<NotificationHandlerRegistry['register']>[1],
        );
      }
    }
  }
}

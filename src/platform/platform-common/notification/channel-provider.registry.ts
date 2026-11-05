import { Injectable } from '@nestjs/common';
import { KeyedRegistryBase } from '@shared-kernel/utils/keyed-registry.base';
import { ChannelProvider } from './ports/channel-provider.port';
import {
  DuplicateChannelProviderRegistrationError,
  UnregisteredChannelProviderError,
} from './notification.errors';

/**
 * Map<channel, provider>, resolved by string key. Populated by infrastructure
 * bootstrap registration — providers are aggregate-unaware and never import a
 * domain module. One provider per channel for v1 (multi-provider failover is
 * an open item, not built).
 */
@Injectable()
export class ChannelProviderRegistry extends KeyedRegistryBase<ChannelProvider> {
  register(channel: string, provider: ChannelProvider): void {
    this.registerEntry(
      channel,
      provider,
      () => new DuplicateChannelProviderRegistrationError(channel),
    );
  }

  resolve(channel: string): ChannelProvider {
    return this.requireEntry(channel, () => new UnregisteredChannelProviderError(channel));
  }

  /** Health indicator listing every registered channel and its capabilities. */
  health(): Array<{ channel: string; capabilities: ReturnType<ChannelProvider['capabilities']> }> {
    return this.registeredKeys().map(channel => ({
      channel,
      capabilities: this.resolve(channel).capabilities(),
    }));
  }
}

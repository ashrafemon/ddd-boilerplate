import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { KeyedRegistryBase } from '@platform/platform-common/registry/keyed-registry';
import { ChannelProvider } from './ports/channel-provider.port';

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
      () => new ConflictException(`ChannelProvider for channel '${channel}' already registered`),
    );
  }

  resolve(channel: string): ChannelProvider {
    return this.requireEntry(
      channel,
      () =>
        new UnprocessableEntityException(`No ChannelProvider registered for channel '${channel}'`),
    );
  }

  /** Health indicator listing every registered channel and its capabilities. */
  health(): Array<{ channel: string; capabilities: ReturnType<ChannelProvider['capabilities']> }> {
    return this.registeredKeys().map(channel => ({
      channel,
      capabilities: this.resolve(channel).capabilities(),
    }));
  }
}

import { ConfigService } from '@config/config.service';

export function buildBullMqOptions(config: ConfigService) {
  const { url } = config.getRedis();

  return {
    connection: {
      url: url || undefined,
      maxRetriesPerRequest: null,
    },
  };
}

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ICacheDriver, IMemcachedConfig, IRedisConfig } from './cache.config';
import { IDatabaseConfig, IDatabaseDriver } from './database.config';
import { IKafkaConfig, IRabbitMQConfig, ISqsConfig } from './messaging.config';
import { ISesConfig, ISnsConfig } from './notification.config';
import { ILokiConfig, ISentryConfig } from './observability.config';
import { IOutboxConfig } from './outbox.config';
import { ISecurityConfig, IThrottlerConfig } from './security.config';
import { IS3Config, IStorageDriver } from './storage.config';

/**
 * Typed configuration facade. `process.env` is read only inside the
 * `registerAs` blocks; everything else goes through this service so adapters
 * never touch `process.env` or raw `ConfigService.get` strings.
 */
@Injectable()
export class ConfigService {
  constructor(private readonly config: NestConfigService) {}

  /** App Environment Variables */
  public get env(): string {
    return this.config.get<string>('app.env', 'development');
  }

  public get isProduction(): boolean {
    return this.env === 'production';
  }

  public get appName(): string {
    return this.config.get<string>('app.name', 'erp-api');
  }

  public get logLevel(): string {
    return this.config.get<string>('app.logLevel', 'info');
  }

  public get port(): number {
    return this.config.get<number>('app.port', 4000);
  }

  /** Database Environment Variables */
  public getDatabaseDriver(): IDatabaseDriver {
    return this.config.get<IDatabaseDriver>('database.driver', 'postgres');
  }
  public getPostgres(): IDatabaseConfig {
    return this.config.get<IDatabaseConfig>('database.postgres', {
      url: '',
      readUrl: '',
    });
  }

  /** Cache Environment Variables */
  public getCacheDriver(): ICacheDriver {
    return this.config.get<ICacheDriver>('cache.driver', 'redis');
  }
  public getRedis(): IRedisConfig {
    return this.config.get('cache.redis', {
      url: '',
    });
  }
  public getMemcached(): IMemcachedConfig {
    return this.config.get('cache.memcached', {
      host: '',
      port: 11211,
      ttl: 300,
      username: '',
      password: '',
    });
  }

  /** Messaging Environment Variables */
  public getRabbitMQ(): IRabbitMQConfig {
    return this.config.get('messaging.rabbitmq', {
      url: 'amqp://localhost:5672',
      exchange: 'erp.events',
    });
  }
  public getKafka(): IKafkaConfig {
    return this.config.get('messaging.kafka', {
      brokers: [],
      clientId: 'erp-boilerplate',
      groupId: 'erp-boilerplate-group',
    });
  }
  public getSqs(): ISqsConfig {
    return this.config.get('messaging.sqs', {
      accessKey: '',
      secretKey: '',
      url: '',
      region: 'us-east-1',
    });
  }

  /** Notification Environment Variables */
  public getSns(): ISnsConfig {
    return this.config.get('notification.sns', {
      accessKey: '',
      secretKey: '',
      topicArn: '',
      region: 'us-east-1',
    });
  }
  public getSes(): ISesConfig {
    return this.config.get<ISesConfig>('notification.ses', {
      accessKey: '',
      secretKey: '',
      address: '',
      region: 'us-east-1',
    });
  }

  /** Storage Environment Variables */
  public getStorageDriver(): IStorageDriver {
    return this.config.get<IStorageDriver>('storage.driver', 's3');
  }
  public getS3(): IS3Config {
    return this.config.get<IS3Config>('storage.s3', {
      accessKey: '',
      secretKey: '',
      bucket: '',
      endpoint: '',
      region: 'us-east-1',
      pathStyle: true,
      url: '',
      presignedUrlTtlSeconds: 900,
    });
  }

  /** Observability Environment Variables */
  public getLoki(): ILokiConfig {
    return this.config.get<ILokiConfig>('observability.loki', { url: '' });
  }
  public getSentry(): ISentryConfig {
    return this.config.get<ISentryConfig>('observability.sentry', {
      dsn: '',
      tracesSampleRate: 0.1,
    });
  }

  /** Outbox Environment Variables */
  public getOutbox(): IOutboxConfig {
    return this.config.get<IOutboxConfig>('outbox', {
      pollIntervalMs: 5_000,
      batchSize: 50,
      maxAttempts: 10,
      retryBackoffBaseMs: 1_000,
      cleanupOlderThanHours: 24,
    });
  }

  /** Security Environment Variables */
  public getThrottler(): IThrottlerConfig {
    return this.config.get<IThrottlerConfig>('security.throttler', { ttlMs: 60_000, limit: 120 });
  }

  public getSecurity(): ISecurityConfig {
    return this.config.get<ISecurityConfig>('security', {
      throttler: { ttlMs: 60_000, limit: 120 },
      settingsEncryptionKey: '',
      tenantHeader: 'x-tenant-id',
      organizationHeader: 'x-organization-id',
    });
  }
}

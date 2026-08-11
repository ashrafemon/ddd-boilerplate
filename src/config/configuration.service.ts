import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './configuration';

export interface CacheSettings {
  enabled: boolean;
  host: string;
  port: number;
  password: string;
  db: number;
  ttlSeconds: number;
}

export interface MessagingSettings {
  enabled: boolean;
  url: string;
  exchange: string;
  queuePrefix: string;
}

export interface AwsSettings {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Typed, centralized configuration access. Business/application code must use
 * this service instead of scattering `process.env.X` around the codebase.
 */
@Injectable()
export class ConfigurationService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService<AppEnv, true>) {}

  public get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    return this.configService.get(key, { infer: true });
  }

  public get env(): string {
    return this.get('NODE_ENV');
  }

  public get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  public get appName(): string {
    return this.get('APP_NAME');
  }

  public get port(): number {
    return this.get('PORT');
  }

  public get host(): string {
    return this.get('HOST');
  }

  public get logLevel(): string {
    return this.get('LOG_LEVEL');
  }

  public get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  public get databaseReadUrl(): string {
    return this.get('DATABASE_URL_READ');
  }

  public get tenantHeader(): string {
    return this.get('TENANT_HEADER');
  }

  public get organizationHeader(): string {
    return this.get('ORGANIZATION_HEADER');
  }

  public getRedis(): CacheSettings {
    return {
      enabled: this.get('REDIS_ENABLED'),
      host: this.get('REDIS_HOST'),
      port: this.get('REDIS_PORT'),
      password: this.get('REDIS_PASSWORD'),
      db: this.get('REDIS_DB'),
      ttlSeconds: this.get('REDIS_TTL_SECONDS'),
    };
  }

  public getMemcached(): CacheSettings {
    return {
      enabled: this.get('MEMCACHED_ENABLED'),
      host: this.get('MEMCACHED_HOST'),
      port: this.get('MEMCACHED_PORT'),
      password: '',
      db: 0,
      ttlSeconds: this.get('MEMCACHED_TTL_SECONDS'),
    };
  }

  public getRabbitMq(): MessagingSettings {
    return {
      enabled: this.get('RABBITMQ_ENABLED'),
      url: this.get('RABBITMQ_URL'),
      exchange: this.get('RABBITMQ_EXCHANGE'),
      queuePrefix: this.get('RABBITMQ_QUEUE_PREFIX'),
    };
  }

  public getKafka(): { enabled: boolean; brokers: string; clientId: string; groupId: string } {
    return {
      enabled: this.get('KAFKA_ENABLED'),
      brokers: this.get('KAFKA_BROKERS'),
      clientId: this.get('KAFKA_CLIENT_ID'),
      groupId: this.get('KAFKA_GROUP_ID'),
    };
  }

  public getAws(): AwsSettings {
    return {
      region: this.get('AWS_REGION'),
      accessKeyId: this.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.get('AWS_SECRET_ACCESS_KEY'),
    };
  }

  public getS3(): { enabled: boolean; bucket: string; region: string; presignedUrlTtlSeconds: number } {
    return {
      enabled: this.get('S3_ENABLED'),
      bucket: this.get('S3_BUCKET'),
      region: this.get('S3_REGION'),
      presignedUrlTtlSeconds: this.get('S3_PRESIGNED_URL_TTL_SECONDS'),
    };
  }

  public getSns(): { enabled: boolean; topicArn: string } {
    return {
      enabled: this.get('SNS_ENABLED'),
      topicArn: this.get('SNS_TOPIC_ARN'),
    };
  }

  public getSes(): { enabled: boolean; fromAddress: string } {
    return {
      enabled: this.get('SES_ENABLED'),
      fromAddress: this.get('SES_FROM_ADDRESS'),
    };
  }

  public getSqs(): { enabled: boolean; queueUrl: string } {
    return {
      enabled: this.get('SQS_ENABLED'),
      queueUrl: this.get('SQS_QUEUE_URL'),
    };
  }

  public getSentry(): { enabled: boolean; dsn: string } {
    return {
      enabled: this.get('SENTRY_ENABLED'),
      dsn: this.get('SENTRY_DSN'),
    };
  }

  public getPrometheus(): { enabled: boolean; path: string } {
    return {
      enabled: this.get('PROMETHEUS_ENABLED'),
      path: this.get('PROMETHEUS_METRICS_PATH'),
    };
  }

  public getLoki(): { enabled: boolean; url: string } {
    return {
      enabled: this.get('LOKI_ENABLED'),
      url: this.get('LOKI_URL'),
    };
  }

  public getOutbox(): { pollIntervalMs: number; batchSize: number; maxAttempts: number } {
    return {
      pollIntervalMs: this.get('OUTBOX_POLL_INTERVAL_MS'),
      batchSize: this.get('OUTBOX_BATCH_SIZE'),
      maxAttempts: this.get('OUTBOX_MAX_ATTEMPTS'),
    };
  }
}

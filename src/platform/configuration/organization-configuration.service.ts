import { Injectable } from '@nestjs/common';
import { AggregateNotFoundException } from '../../shared-kernel/exceptions/aggregate-not-found.exception';
import { RequestContextPort } from '../../shared-kernel/ports/context/request-context.port';
import { LoggerPort } from '../../shared-kernel/ports/observability/logger.port';
import { CachePort } from '../../shared-kernel/ports/cache/cache.port';
import { buildCacheKey } from '../../shared-kernel/utilities/cache-key';
import { OrganizationRepositoryPort } from '../../shared-kernel/ports/organization/organization-repository.port';
import {
  AggregateConfigQuery,
  OrganizationConfigurationPort,
} from '../../shared-kernel/ports/configuration/organization-configuration.port';

const CONFIG_CACHE_TTL_SECONDS = 60;

/**
 * Loads organization configuration from the organization record (stored as a
 * JSON document) and caches it briefly. Fallbacks keep the configuration
 * optional during development.
 */
@Injectable()
export class OrganizationConfigurationService implements OrganizationConfigurationPort {
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly cache: CachePort,
    private readonly requestContext: RequestContextPort,
    private readonly logger: LoggerPort,
  ) {}

  public async get<TConfig extends Record<string, unknown>>(
    query: AggregateConfigQuery,
  ): Promise<TConfig | null> {
    const organization = await this.loadOrganization(query);

    const aggregateConfig = (organization.config?.[query.aggregate] as Record<string, unknown>) ?? null;

    if (query.role) {
      const roleConfig = (
        (organization.config?.[query.aggregate] as Record<string, unknown>)?.roles as Record<
          string,
          unknown
        >
      )?.[query.role] as Record<string, unknown> | undefined;
      if (roleConfig) {
        return roleConfig as TConfig;
      }
    }

    return (aggregateConfig as TConfig) ?? null;
  }

  public async getValue<TValue>(
    query: AggregateConfigQuery,
    key: string,
    fallback?: TValue,
  ): Promise<TValue | null> {
    const config = await this.get<Record<string, unknown>>(query);
    if (config && key in config) {
      return config[key] as TValue;
    }
    return fallback ?? null;
  }

  private async loadOrganization(query: AggregateConfigQuery) {
    const cacheKey = buildCacheKey('org-config', {
      tenantId: query.tenantId.getValue(),
      organizationId: query.organizationId.getValue(),
    }, 'current');

    const cached = await this.cache.get<{ config: Record<string, unknown> | null }>(cacheKey);
    if (cached) {
      return { config: cached.config };
    }

    const organization = await this.organizationRepository.findById(
      query.tenantId,
      query.organizationId,
    );

    if (!organization) {
      throw new AggregateNotFoundException('Organization', query.organizationId.getValue());
    }

    await this.cache.set(
      cacheKey,
      { config: organization.config },
      CONFIG_CACHE_TTL_SECONDS,
    );

    return organization;
  }
}

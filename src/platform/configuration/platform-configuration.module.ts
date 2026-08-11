import { Global, Module } from '@nestjs/common';
import { OrganizationConfigurationPort } from '../../shared-kernel/ports/configuration/organization-configuration.port';
import { OrganizationConfigurationService } from './organization-configuration.service';

/**
 * Platform configuration module. Manages platform-level configuration,
 * currently the organization configuration (approval limits, numbering
 * prefixes) loaded from the organization record and cached briefly.
 */
@Global()
@Module({
  providers: [
    OrganizationConfigurationService,
    { provide: OrganizationConfigurationPort, useClass: OrganizationConfigurationService },
  ],
  exports: [OrganizationConfigurationPort],
})
export class PlatformConfigurationModule {}

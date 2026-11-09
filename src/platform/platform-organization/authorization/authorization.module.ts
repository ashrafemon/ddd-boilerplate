import { Module } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { NoopAbacAdapter } from './adapters/noop-abac.adapter';
import { NoopRbacAdapter } from './adapters/noop-rbac.adapter';
import { ProductionAbacAdapter } from './adapters/production-abac.adapter';
import { ProductionRbacAdapter } from './adapters/production-rbac.adapter';
import { AbacPort } from './ports/abac.port';
import { RbacPort } from './ports/rbac.port';

@Module({
  providers: [
    ConfigService,
    {
      provide: AbacPort,
      useFactory: (config: ConfigService) =>
        config.isProduction ? new ProductionAbacAdapter() : new NoopAbacAdapter(),
      inject: [ConfigService],
    },
    {
      provide: RbacPort,
      useFactory: (config: ConfigService) =>
        config.isProduction ? new ProductionRbacAdapter() : new NoopRbacAdapter(),
      inject: [ConfigService],
    },
  ],
  exports: [AbacPort, RbacPort],
})
export class AuthorizationModule {}

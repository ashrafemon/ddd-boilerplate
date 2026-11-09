import { Module } from '@nestjs/common';
import { ConfigService } from '@config/config.service';
import { NoopAuthenticationAdapter } from './adapters/noop-authentication.adapter';
import { ProductionAuthenticationAdapter } from './adapters/production-authentication.adapter';
import { AuthenticationPort } from './ports/authentication.port';

@Module({
  providers: [
    ConfigService,
    {
      provide: AuthenticationPort,
      useFactory: (config: ConfigService) =>
        config.isProduction
          ? new ProductionAuthenticationAdapter()
          : new NoopAuthenticationAdapter(),
      inject: [ConfigService],
    },
  ],
  exports: [AuthenticationPort],
})
export class AuthenticationModule {}

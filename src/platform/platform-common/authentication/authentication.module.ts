import { Module } from '@nestjs/common';
import { NoopAuthenticationAdapter } from './adapters/noop-authentication.adapter';
import { AuthenticationPort } from './ports/authentication.port';

@Module({
  providers: [
    NoopAuthenticationAdapter,
    { provide: AuthenticationPort, useExisting: NoopAuthenticationAdapter },
  ],
  exports: [AuthenticationPort],
})
export class AuthenticationModule {}

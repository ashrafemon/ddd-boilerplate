import { Module } from '@nestjs/common';
import { SecretsManagerService } from './secrets.service';

/**
 * Secrets Manager client module — client initialization only.
 *
 * Registers the AWS Secrets Manager client (opt-in via SECRETS_MANAGER_ENABLED).
 * Secret resolution lives in the platform layer. Deliberately NOT `@Global()`.
 */
@Module({
  providers: [SecretsManagerService],
  exports: [SecretsManagerService],
})
export class SecretsManagerModule {}

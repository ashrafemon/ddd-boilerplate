import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './configuration';
import { ConfigurationService } from './configuration.service';

/**
 * Bootstrap configuration module.
 *
 * It is separated from the application and platform modules on purpose: the
 * environment is validated once here and every client group is typed through
 * `ConfigurationService`, so no other module reads `process.env` directly.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env'],
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class AppConfigModule {}

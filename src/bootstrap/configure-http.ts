import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureHttp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('app.apiPrefix', 'api');

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}

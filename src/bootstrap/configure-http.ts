import { VersioningType } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureHttp(app: NestFastifyApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}

import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';

/**
 * Configures the global API prefix and URI versioning.
 */
export function configureHttp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}

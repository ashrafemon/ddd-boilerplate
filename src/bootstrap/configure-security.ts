import { compress } from '@fastify/compress';
import helmet from '@fastify/helmet';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * Configures base HTTP hardening: helmet security headers and
 * gzip/deflate compression.
 */
export function configureSecurity(app: NestFastifyApplication): void {
  app.register(helmet);
  app.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate', 'br'],
    threshold: 1024, // Only compress responses larger than 1 KB
  });
}

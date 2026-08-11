import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureCors(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);

  const env = config.get<string>('app.env', 'development');
  const origin =
    env === 'production'
      ? config.get<string[]>('app.corsOrigins', [])
      : config.get<string[]>('app.corsOrigins', ['http://localhost:3000', 'http://localhost:8081']);

  if (env === 'production' && origin.length === 0) {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400,
  });
}

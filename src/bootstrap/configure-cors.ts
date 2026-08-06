import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureCors(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);

  const origin =
    config.get<string>('app.env', 'development') === 'production'
      ? config.get<string[]>('app.corsOrigins', [])
      : config.get<string[]>('app.corsOrigins', ['http://localhost:3000', 'http://localhost:8081']);

  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization'],
    maxAge: 86400,
  });
}

import { registerAs } from '@nestjs/config';

/**
 * Core application config: runtime environment, HTTP port, global API
 * prefix and allowed CORS origins.
 */
export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  host: process.env.APP_HOST ?? '0.0.0.0',
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:8081').split(
    ',',
  ),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  swaggerTitle: process.env.SWAGGER_TITLE ?? 'Mukut ERP API',
  swaggerDescription:
    process.env.SWAGGER_DESCRIPTION ?? 'ERP platform API — hexagonal architecture, event-driven',
  swaggerVersion: process.env.SWAGGER_VERSION ?? '1.0',
  swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
}));

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Configures Swagger docs at `/docs`. Disabled in production.
 */
export function configureSwagger(app: INestApplication): void {
  const config = app.get(ConfigService);
  if (config.get<string>('app.env', 'development') === 'production') return;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mukut ERP API')
    .setDescription('ERP platform API — hexagonal architecture, event-driven')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}

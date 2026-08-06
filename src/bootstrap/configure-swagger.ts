import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = app.get(ConfigService);
  const env = config.get<string>('app.env', 'development');
  if (env === 'production') return;

  const swaggerConfig = new DocumentBuilder()
    .setTitle(config.get<string>('app.swaggerTitle', 'Mukut ERP API'))
    .setDescription(
      config.get<string>(
        'app.swaggerDescription',
        'ERP platform API — hexagonal architecture, event-driven',
      ),
    )
    .setVersion(config.get<string>('app.swaggerVersion', '1.0'))
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(config.get<string>('app.swaggerPath', 'docs'), app, document);
}

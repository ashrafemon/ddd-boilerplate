import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);
  const env = config.get<string>('app.env', 'development');
  if (env === 'production') return;

  const swaggerConfig = new DocumentBuilder()
    .setTitle(config.get<string>('app.swaggerTitle', 'ERP Boilerplate API'))
    .setDescription(
      config.get<string>(
        'app.swaggerDescription',
        'ERP platform — hexagonal architecture, DDD, event-driven modular monolith',
      ),
    )
    .setVersion(config.get<string>('app.swaggerVersion', '1.0'))
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const path = config.get<string>('app.swaggerPath', 'docs');
  SwaggerModule.setup(`api/${path}`, app, document);
}

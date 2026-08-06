import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureValidation(app: NestFastifyApplication): void {
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('app.env', 'development') === 'production';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: isProduction,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );
}

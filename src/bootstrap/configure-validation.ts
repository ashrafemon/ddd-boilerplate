import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configureValidation(app: INestApplication): void {
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

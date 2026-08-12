import { Injectable, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { ZodValidationPipe } from 'nestjs-zod';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor(config: ConfigService) {
    const isProduction = config.get<string>('app.env', 'development') === 'production';

    super({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: isProduction,
      skipMissingProperties: false,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });
  }
}

// @Injectable()
// export class AppValidationPipe extends ZodValidationPipe {}

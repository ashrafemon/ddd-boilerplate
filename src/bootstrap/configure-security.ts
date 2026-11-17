import compress from '@fastify/compress';
import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import appConfig from '@config/app.config';

export async function configureSecurity(app: NestFastifyApplication): Promise<void> {
  const isProduction = appConfig().env === 'production';

  const helmetOptions: Record<string, unknown> = {
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  };

  if (isProduction) {
    helmetOptions.contentSecurityPolicy = {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, `data:`, `https:`],
        fontSrc: [`'self'`, `https:`, `data:`],
        scriptSrc: [`'self'`],
        objectSrc: [`'none'`],
        baseUri: [`'self'`],
        frameSrc: [`'self'`],
      },
    };
  }

  await app.register(helmet, helmetOptions);

  await app.register(compress, {
    encodings: ['gzip', 'deflate', 'br'],
    threshold: 1024,
  });
}

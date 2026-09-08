import { SetMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';

export interface DeviceResponseOptions {
  mobile: ZodSchema;
  web: ZodSchema;
}

export function DeviceResponse(mobile: ZodSchema, web: ZodSchema) {
  return SetMetadata('deviceResponse', { mobile, web });
}

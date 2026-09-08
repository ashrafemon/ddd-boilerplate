import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DeviceType } from '../types/device-context';
import { DeviceResponseOptions } from '../decorators/device-response.decorator';
import { getDeviceTypeFromHeader } from '../decorators/device-context.decorator';
import { ClsService } from 'nestjs-cls';
import { ZodSchema } from 'zod';

@Injectable()
export class DeviceResponseInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
    }>();
    const deviceType = getDeviceTypeFromHeader(request.headers?.['x-device-type']);
    this.cls.set('deviceContext', { type: deviceType });

    return next.handle().pipe(
      map((response: unknown) => {
        if (!response || typeof response !== 'object') {
          return response;
        }

        const handler = context.getHandler();
        const deviceResponse = Reflect.getMetadata('deviceResponse', handler) as
          DeviceResponseOptions | undefined;

        if (!deviceResponse) {
          return response;
        }

        const { mobile, web } = deviceResponse;
        const device = this.cls.get<{ type: DeviceType }>('deviceContext') ?? {
          type: DeviceType.WEB,
        };
        const schema = device.type === DeviceType.MOBILE ? mobile : web;

        if (!schema) {
          return response;
        }

        const { data, ...rest } = response as Record<string, unknown>;

        if (data && typeof data === 'object') {
          return {
            ...rest,
            data: this.mapToDto(data, schema),
          };
        }

        return response;
      }),
    );
  }

  private mapToDto(data: unknown, schema: ZodSchema & { deviceItem?: ZodSchema }): unknown {
    if (Array.isArray(data)) {
      const itemSchema = schema.deviceItem ?? schema;
      return data.map(item => itemSchema.parse(item));
    }

    if (data && typeof data === 'object' && !(data instanceof Date)) {
      return schema.parse(data);
    }

    return data;
  }
}

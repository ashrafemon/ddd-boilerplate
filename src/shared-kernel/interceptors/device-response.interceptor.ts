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
        const dtoClass = device.type === DeviceType.MOBILE ? mobile : web;

        if (!dtoClass) {
          return response;
        }

        const { data, ...rest } = response as Record<string, unknown>;

        if (data && typeof data === 'object') {
          return {
            ...rest,
            data: this.mapToDto(data, dtoClass),
          };
        }

        return response;
      }),
    );
  }

  private mapToDto(data: unknown, dtoClass: new () => unknown): unknown {
    const schema = (dtoClass as unknown as { schema?: ZodSchema }).schema ?? dtoClass;
    const itemClass = (dtoClass as unknown as { deviceItem?: new () => unknown }).deviceItem;
    const itemSchema = itemClass
      ? ((itemClass as unknown as { schema?: ZodSchema }).schema ?? itemClass)
      : undefined;

    if (Array.isArray(data)) {
      const parseSchema = itemSchema ?? schema;
      return data.map(item => (parseSchema as ZodSchema).parse(item));
    }

    if (data && typeof data === 'object' && !(data instanceof Date)) {
      return (schema as ZodSchema).parse(data);
    }

    return data;
  }
}

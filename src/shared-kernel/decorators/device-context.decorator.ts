import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DeviceType, IDeviceContext } from '../types/device-context';

export const DEVICE_HEADER = 'x-device-type';

export function getDeviceTypeFromHeader(headerValue: string | undefined): DeviceType {
  const normalized = headerValue?.toLowerCase().trim();
  if (normalized === DeviceType.MOBILE) {
    return DeviceType.MOBILE;
  }
  return DeviceType.WEB;
}

export const DeviceContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IDeviceContext => {
    const request: { headers?: Record<string, string | undefined> } = ctx
      .switchToHttp()
      .getRequest();
    const deviceType = getDeviceTypeFromHeader(request.headers?.[DEVICE_HEADER]);
    return { type: deviceType };
  },
);

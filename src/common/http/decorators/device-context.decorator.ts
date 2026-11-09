import { SetMetadata } from '@nestjs/common';

export const DEVICE_CONTEXT_KEY = 'deviceContext';

export interface DeviceContextOptions {
  mobile: new () => unknown;
  web: new () => unknown;
}

export function DeviceContext(mobile: new () => unknown, web: new () => unknown) {
  return SetMetadata(DEVICE_CONTEXT_KEY, { mobile, web });
}

export function getDeviceTypeFromHeader(header?: string | null): 'mobile' | 'web' | undefined {
  if (!header) return undefined;
  const v = header.toLowerCase().trim();
  if (v === 'mobile') return 'mobile';
  if (v === 'web') return 'web';
  return undefined;
}

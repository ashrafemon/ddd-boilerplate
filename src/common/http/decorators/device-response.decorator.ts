import { SetMetadata } from '@nestjs/common';

export interface DeviceResponseOptions {
  mobile: new () => unknown;
  web: new () => unknown;
}

export function DeviceResponse(mobile: new () => unknown, web: new () => unknown) {
  return SetMetadata('deviceResponse', { mobile, web });
}

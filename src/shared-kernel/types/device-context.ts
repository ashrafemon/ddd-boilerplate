/**
 * Supported device types for response shaping.
 *
 * - mobile: minimal payload for bandwidth-constrained clients
 * - web: full payload for desktop/web admin clients
 */
export enum DeviceType {
  MOBILE = 'mobile',
  WEB = 'web',
}

export interface IDeviceContext {
  type: DeviceType;
}

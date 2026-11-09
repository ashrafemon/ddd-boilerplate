export enum DeviceType {
  MOBILE = 'mobile',
  WEB = 'web',
}

export interface IDeviceContext {
  type: DeviceType;
}

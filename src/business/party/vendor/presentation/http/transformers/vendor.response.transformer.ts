import { DeviceType, IDeviceContext } from '@shared-kernel/types/device-context';
import { VendorQueryRecord } from '../../../domain/types/vendor.types';
import { VendorMobileResponse } from '../response/device/mobile/vendor.response.dto';
import { VendorWebResponse } from '../response/device/web/vendor.response.dto';
import { VendorMobileListResponse } from '../response/device/mobile/vendor-list.response.dto';
import { VendorWebListResponse } from '../response/device/web/vendor-list.response.dto';

export class VendorResponseTransformer {
  static toResponse(
    record: VendorQueryRecord,
    device: IDeviceContext,
  ): VendorMobileResponse | VendorWebResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        id: record.id,
        name: record.name,
        status: record.status,
      };
    }
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      email: record.email,
      phone: record.phone,
      address: record.address,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toListResponse(
    result: {
      items: VendorQueryRecord[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    },
    device: IDeviceContext,
  ): VendorMobileListResponse | VendorWebListResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        items: result.items.map(item => VendorResponseTransformer.toResponse(item, device)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      };
    }
    return {
      items: result.items.map(
        item => VendorResponseTransformer.toResponse(item, device) as VendorWebResponse,
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}

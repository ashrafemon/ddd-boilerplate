import { DeviceType, IDeviceContext } from '@shared-kernel/types/device-context';
import { ProductQueryRecord } from '../../../domain/types/product.types';
import { ProductMobileResponse } from '../response/device/mobile/product.response.dto';
import { ProductWebResponse } from '../response/device/web/product.response.dto';
import { ProductListResponse } from '../response/product-list.response.dto';
import { ProductMobileListResponse } from '../response/device/mobile/product-list.response.dto';
import { ProductWebListResponse } from '../response/device/web/product-list.response.dto';

export class ProductResponseTransformer {
  static toResponse(
    record: ProductQueryRecord,
    device: IDeviceContext,
  ): ProductMobileResponse | ProductWebResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        id: record.id,
        name: record.name,
        status: record.status,
        unitPrice: record.unitPrice,
        currency: record.currency,
      };
    }
    return {
      id: record.id,
      sku: record.sku,
      name: record.name,
      description: record.description,
      status: record.status,
      unitPrice: record.unitPrice,
      currency: record.currency,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toListResponse(
    result: {
      items: ProductQueryRecord[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    },
    device: IDeviceContext,
  ): ProductMobileListResponse | ProductWebListResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        items: result.items.map(item => ProductResponseTransformer.toResponse(item, device)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      };
    }
    return {
      items: result.items.map(
        item => ProductResponseTransformer.toResponse(item, device) as ProductWebResponse,
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}

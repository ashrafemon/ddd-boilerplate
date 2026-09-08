import { DeviceType, IDeviceContext } from '@shared-kernel/types/device-context';
import { PurchaseOrderQueryRecord } from '../../../domain/types/purchase-order.types';
import { PurchaseOrderMobileResponse } from '../response/device/mobile/purchase-order.response.dto';
import { PurchaseOrderWebResponse } from '../response/device/web/purchase-order.response.dto';
import { PurchaseOrderMobileListResponse } from '../response/device/mobile/purchase-order-list.response.dto';
import { PurchaseOrderWebListResponse } from '../response/device/web/purchase-order-list.response.dto';

export class PurchaseOrderResponseTransformer {
  static toResponse(
    record: PurchaseOrderQueryRecord,
    device: IDeviceContext,
  ): PurchaseOrderMobileResponse | PurchaseOrderWebResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        id: record.id,
        orderNumber: record.orderNumber,
        status: record.status,
        total: record.total,
        lines: record.lines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      };
    }
    return {
      id: record.id,
      orderNumber: record.orderNumber,
      vendorId: record.vendorId,
      status: record.status,
      currency: record.currency,
      subtotal: record.subtotal,
      total: record.total,
      lines: record.lines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.total,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toListResponse(
    result: {
      items: PurchaseOrderQueryRecord[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    },
    device: IDeviceContext,
  ): PurchaseOrderMobileListResponse | PurchaseOrderWebListResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        items: result.items.map(item => PurchaseOrderResponseTransformer.toResponse(item, device)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      };
    }
    return {
      items: result.items.map(
        item =>
          PurchaseOrderResponseTransformer.toResponse(item, device) as PurchaseOrderWebResponse,
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}

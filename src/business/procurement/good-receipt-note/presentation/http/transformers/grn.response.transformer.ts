import { DeviceType, IDeviceContext } from '@shared-kernel/types/device-context';
import { GrnQueryRecord } from '../../../domain/types/grn.types';
import { GrnMobileResponse } from '../response/device/mobile/grn.response.dto';
import { GrnWebResponse } from '../response/device/web/grn.response.dto';
import { GrnMobileListResponse } from '../response/device/mobile/grn-list.response.dto';
import { GrnWebListResponse } from '../response/device/web/grn-list.response.dto';

export class GrnResponseTransformer {
  static toResponse(
    record: GrnQueryRecord,
    device: IDeviceContext,
  ): GrnMobileResponse | GrnWebResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        id: record.id,
        grnNumber: record.grnNumber,
        status: record.status,
        total: record.total,
        lines: record.lines.map(line => ({
          productId: line.productId,
          receivedQuantity: line.receivedQuantity,
        })),
      };
    }
    return {
      id: record.id,
      grnNumber: record.grnNumber,
      purchaseOrderId: record.purchaseOrderId,
      vendorId: record.vendorId,
      status: record.status,
      currency: record.currency,
      subtotal: record.subtotal,
      total: record.total,
      lines: record.lines.map(line => ({
        productId: line.productId,
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: line.receivedQuantity,
        unitPrice: line.unitPrice,
        total: line.total,
      })),
      receivedAt: record.receivedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toListResponse(
    result: {
      items: GrnQueryRecord[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    },
    device: IDeviceContext,
  ): GrnMobileListResponse | GrnWebListResponse {
    if (device.type === DeviceType.MOBILE) {
      return {
        items: result.items.map(item => GrnResponseTransformer.toResponse(item, device)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      };
    }
    return {
      items: result.items.map(
        item => GrnResponseTransformer.toResponse(item, device) as GrnWebResponse,
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    };
  }
}

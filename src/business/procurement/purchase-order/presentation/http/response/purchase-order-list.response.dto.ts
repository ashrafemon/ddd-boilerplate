import { ApiProperty } from '@nestjs/swagger';
import { PurchaseOrderResponse } from './purchase-order.response.dto';

export class PurchaseOrderListResponse {
  @ApiProperty({ type: [PurchaseOrderResponse] })
  items!: PurchaseOrderResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { PurchaseOrderWebResponse } from './purchase-order.response.dto';

export class PurchaseOrderWebListResponse {
  @ApiProperty({ type: [PurchaseOrderWebResponse] })
  items!: PurchaseOrderWebResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

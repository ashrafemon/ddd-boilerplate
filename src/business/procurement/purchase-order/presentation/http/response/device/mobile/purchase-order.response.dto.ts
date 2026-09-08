import { ApiProperty } from '@nestjs/swagger';

export class PurchaseOrderLineMobileResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  productId!: string;

  @ApiProperty({ example: 10 })
  quantity!: number;
}

export class PurchaseOrderMobileResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'PO-00000001' })
  orderNumber!: string;

  @ApiProperty({ example: 'DRAFT' })
  status!: string;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ type: [PurchaseOrderLineMobileResponse] })
  lines!: PurchaseOrderLineMobileResponse[];
}

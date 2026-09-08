import { ApiProperty } from '@nestjs/swagger';

export class PurchaseOrderLineWebResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  productId!: string;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: 19.99 })
  unitPrice!: number;

  @ApiProperty({ example: 199.9 })
  total!: number;
}

export class PurchaseOrderWebResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'PO-00000001' })
  orderNumber!: string;

  @ApiProperty({ example: 'VEN-001' })
  vendorId!: string;

  @ApiProperty({ example: 'DRAFT' })
  status!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: 100 })
  subtotal!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ type: [PurchaseOrderLineWebResponse] })
  lines!: PurchaseOrderLineWebResponse[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

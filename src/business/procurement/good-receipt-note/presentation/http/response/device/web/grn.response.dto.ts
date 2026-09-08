import { ApiProperty } from '@nestjs/swagger';

export class GrnLineWebResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  productId!: string;

  @ApiProperty({ example: 10 })
  orderedQuantity!: number;

  @ApiProperty({ example: 10 })
  receivedQuantity!: number;

  @ApiProperty({ example: 19.99 })
  unitPrice!: number;

  @ApiProperty({ example: 199.9 })
  total!: number;
}

export class GrnWebResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'GRN-1234567890' })
  grnNumber!: string;

  @ApiProperty({ example: 'PO-00000001' })
  purchaseOrderId!: string;

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

  @ApiProperty({ type: [GrnLineWebResponse] })
  lines!: GrnLineWebResponse[];

  @ApiProperty()
  receivedAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

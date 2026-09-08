import { ApiProperty } from '@nestjs/swagger';

export class GrnLineMobileResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  productId!: string;

  @ApiProperty({ example: 10 })
  receivedQuantity!: number;
}

export class GrnMobileResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'GRN-1234567890' })
  grnNumber!: string;

  @ApiProperty({ example: 'DRAFT' })
  status!: string;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ type: [GrnLineMobileResponse] })
  lines!: GrnLineMobileResponse[];
}

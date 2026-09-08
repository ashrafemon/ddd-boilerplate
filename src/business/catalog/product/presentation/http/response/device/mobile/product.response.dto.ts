import { ApiProperty } from '@nestjs/swagger';

export class ProductMobileResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  name!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 19.99 })
  unitPrice!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

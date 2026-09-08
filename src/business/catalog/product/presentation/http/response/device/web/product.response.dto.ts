import { ApiProperty } from '@nestjs/swagger';

export class ProductWebResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'SKU-001' })
  sku!: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  name!: string;

  @ApiProperty({ example: 'A wireless mouse' })
  description!: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 19.99 })
  unitPrice!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

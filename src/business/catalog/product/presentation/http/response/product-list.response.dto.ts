import { ApiProperty } from '@nestjs/swagger';
import { ProductResponse } from './product.response.dto';

export class ProductListResponse {
  @ApiProperty({ type: [ProductResponse] })
  items!: ProductResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { ProductWebResponse } from './product.response.dto';

export class ProductWebListResponse {
  @ApiProperty({ type: [ProductWebResponse] })
  items!: ProductWebResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

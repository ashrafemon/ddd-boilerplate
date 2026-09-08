import { ApiProperty } from '@nestjs/swagger';
import { ProductMobileResponse } from './product.response.dto';

export class ProductMobileListResponse {
  @ApiProperty({ type: [ProductMobileResponse] })
  items!: ProductMobileResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

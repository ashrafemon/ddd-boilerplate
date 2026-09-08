import { ApiProperty } from '@nestjs/swagger';
import { VendorWebResponse } from './vendor.response.dto';

export class VendorWebListResponse {
  @ApiProperty({ type: [VendorWebResponse] })
  items!: VendorWebResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

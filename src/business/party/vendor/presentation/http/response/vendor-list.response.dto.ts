import { ApiProperty } from '@nestjs/swagger';
import { VendorResponse } from './vendor.response.dto';

export class VendorListResponse {
  @ApiProperty({ type: [VendorResponse] })
  items!: VendorResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { GrnMobileResponse } from './grn.response.dto';

export class GrnMobileListResponse {
  @ApiProperty({ type: [GrnMobileResponse] })
  items!: GrnMobileResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

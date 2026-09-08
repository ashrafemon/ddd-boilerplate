import { ApiProperty } from '@nestjs/swagger';
import { GrnResponse } from './grn.response.dto';

export class GrnListResponse {
  @ApiProperty({ type: [GrnResponse] })
  items!: GrnResponse[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

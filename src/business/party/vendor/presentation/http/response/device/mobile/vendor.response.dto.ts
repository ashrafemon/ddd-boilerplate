import { ApiProperty } from '@nestjs/swagger';

export class VendorMobileResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'Acme Supplies' })
  name!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;
}

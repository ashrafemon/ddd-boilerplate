import { ApiProperty } from '@nestjs/swagger';

export class VendorResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;

  @ApiProperty({ example: 'VEN-001' })
  code!: string;

  @ApiProperty({ example: 'Acme Supplies' })
  name!: string;

  @ApiProperty({ example: 'billing@acme.com' })
  email!: string | null;

  @ApiProperty({ example: '+1-555-0100' })
  phone!: string | null;

  @ApiProperty({ example: '123 Main St' })
  address!: string | null;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

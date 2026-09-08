import { ApiProperty } from '@nestjs/swagger';

export class IdResponse {
  @ApiProperty({ example: '8b3b9f9e-...' })
  id!: string;
}

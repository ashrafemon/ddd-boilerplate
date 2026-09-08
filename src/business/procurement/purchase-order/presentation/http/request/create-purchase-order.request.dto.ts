import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: '8b3b9f9e-...' })
  @IsUUID()
  vendorId!: string;
}

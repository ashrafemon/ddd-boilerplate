import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPurchaseOrderDto {
  @ApiProperty({ example: 'Vendor pricing out of budget' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

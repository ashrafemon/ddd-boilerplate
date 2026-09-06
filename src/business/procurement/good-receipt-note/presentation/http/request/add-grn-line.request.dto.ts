import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AddGrnLineDto {
  @ApiProperty({ example: '8b3b9f9e-...' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  orderedQuantity!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  receivedQuantity!: number;

  @ApiProperty({ example: 19.99 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

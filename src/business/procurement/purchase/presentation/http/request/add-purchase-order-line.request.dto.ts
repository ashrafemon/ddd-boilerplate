import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddLineDto {
  @ApiProperty({ example: '8b3b9f9e-...' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 19.99 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

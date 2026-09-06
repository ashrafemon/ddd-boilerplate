import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateGrnLineDto {
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

export class CreateGrnDto {
  @ApiProperty({ example: '8b3b9f9e-...' })
  @IsString()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @ApiProperty({ example: 'VEN-001' })
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [CreateGrnLineDto] })
  @IsArray()
  @IsNotEmpty()
  lines!: CreateGrnLineDto[];
}

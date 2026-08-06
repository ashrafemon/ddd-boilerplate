import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseOrderDto } from './purchase-order.create.dto';

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}

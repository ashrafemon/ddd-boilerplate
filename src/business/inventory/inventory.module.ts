import { Module } from '@nestjs/common';
import { StockMovementModule } from './stock-movement/stock-movement.module';

/**
 * Inventory bounded context. Composes the aggregate modules; each imports
 * PlatformModule itself for the platform services it uses.
 */
@Module({
  imports: [StockMovementModule],
})
export class InventoryModule {}

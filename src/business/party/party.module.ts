import { Module } from '@nestjs/common';
import { VendorModule } from './vendor';

@Module({
  imports: [VendorModule],
})
export class PartyModule {}

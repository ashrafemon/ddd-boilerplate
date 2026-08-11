import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { OUTBOX_WRITER } from './ports/outbox-writer.port';
import { OutboxWriter } from './outbox/outbox-writer';
import { OutboxPublisher } from './outbox/outbox-publisher';
import { NestEventBusAdapter } from './events/nest-event-bus.adapter';
import { IN_PROCESS_EVENT_BUS } from '@business/shared-business/ports/event-bus.port';
import {
  DefaultMessageRoutingPolicy,
  MESSAGE_ROUTING_POLICY,
} from './events/message-routing.policy';
import { PlatformScheduler } from './scheduler/platform-scheduler';
import { PurchaseOrderSaga } from './saga/purchase-order.saga';
import { VendorModule } from '@business/vendor/vendor.module';
import { ProductModule } from '@business/product/product.module';
import { PurchaseOrderModule } from '@business/purchase-order/purchase-order.module';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    VendorModule,
    ProductModule,
    PurchaseOrderModule,
  ],
  providers: [
    OutboxWriter,
    OutboxPublisher,
    NestEventBusAdapter,
    DefaultMessageRoutingPolicy,
    PlatformScheduler,
    PurchaseOrderSaga,
    { provide: OUTBOX_WRITER, useExisting: OutboxWriter },
    { provide: IN_PROCESS_EVENT_BUS, useExisting: NestEventBusAdapter },
    { provide: MESSAGE_ROUTING_POLICY, useExisting: DefaultMessageRoutingPolicy },
  ],
  exports: [OUTBOX_WRITER, IN_PROCESS_EVENT_BUS],
})
export class PlatformModule {}

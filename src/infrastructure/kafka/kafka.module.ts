import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';

/**
 * Kafka client module — client initialization only.
 *
 * Registers the KafkaService client wrapper (producer, consumer factory,
 * enabled flag). Consumer binding lives in the platform layer; no ports or
 * adapters live here.
 */
@Module({
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}

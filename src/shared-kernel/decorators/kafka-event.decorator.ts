import { SetMetadata } from '@nestjs/common';

export const KAFKA_EVENT = 'kafka:event';
export const KafkaEvent = (topic: string) => SetMetadata(KAFKA_EVENT, topic);

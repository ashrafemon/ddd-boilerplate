import { ConfigService } from '@config/config.service';
import { SqsModule } from '@ssut/nestjs-sqs';
import { Module } from '@nestjs/common';
import { buildSqsOptions } from './sqs-config.factory';

/**
 * SQS client module — connection initialization only.
 *
 * Registers the SQS producers/consumers from the typed config facade and
 * re-exports SqsModule so consumers get SqsService. No ports or adapters
 * live here.
 */
@Module({
  imports: [
    SqsModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildSqsOptions,
    }),
  ],
  exports: [SqsModule],
})
export class SqsClientModule {}

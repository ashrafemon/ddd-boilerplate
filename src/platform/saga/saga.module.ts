import { Module } from '@nestjs/common';
import { SagaExecutor } from './saga-executor.service';

@Module({
  providers: [SagaExecutor],
  exports: [SagaExecutor],
})
export class SagaModule {}

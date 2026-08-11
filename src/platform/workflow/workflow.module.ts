import { Module } from '@nestjs/common';
import { WorkflowEngine } from './workflow-engine.service';

@Module({
  providers: [WorkflowEngine],
  exports: [WorkflowEngine],
})
export class WorkflowModule {}

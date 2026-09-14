import { createZodDto } from 'nestjs-zod';
import { batchOperationSelectionSchema } from './batch-operation-selection.schema';

export class ValidateBatchOperationDto extends createZodDto(batchOperationSelectionSchema) {}

import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType } from 'zod';
import { ValidationException } from '../exceptions/validation.exception';
import { mapZodError } from '../validations/zod-error.mapper';

/**
 * Zod-based validation pipe replacing class-validator/class-transformer.
 *
 * Validates the input against a schema and returns the typed, parsed output.
 * Schema validation is input validation only; business correctness is enforced
 * separately by domain invariants and policies.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  public transform(value: unknown, _metadata: ArgumentMetadata): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationException(mapZodError(error));
      }
      throw error;
    }
  }
}

export function zodValidationPipe<T>(schema: ZodType<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}

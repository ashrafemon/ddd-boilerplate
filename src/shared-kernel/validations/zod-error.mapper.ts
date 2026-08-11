import { ZodError, ZodIssue } from 'zod';
import { ValidationIssue } from '../exceptions/validation.exception';

/**
 * Maps a ZodError into the structured validation issue shape used by the
 * application's error envelope.
 */
export function mapZodError(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue: ZodIssue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    message: issue.message,
    code: issue.code,
  }));
}

import { z } from 'zod';
import { JsonValue } from '../types/json-value.type';

/** Recursive zod schema for any JSON document (opaque payloads stay typed). */
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

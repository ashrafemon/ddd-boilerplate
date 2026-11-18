import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const eventRef = z.object({ name: z.string().min(1), version: z.number().int().positive() });

const action = z.union([
  z.string().min(1),
  z.object({ name: z.string().min(1), version: z.number().int().optional() }),
]);

const step = z
  .object({
    id: z.string().min(1),
    kind: z.string().optional(),
    policy: z.string().optional(),
    action: action.optional(),
    compensation: action.optional(),
    do: z.string().optional(),
    undo: z.string().optional(),
    input: z.record(z.string(), z.string()).optional(),
    waitFor: eventRef.optional(),
    match: z.string().optional(),
    when: z.string().optional(),
    acceptedEventCondition: z.string().optional(),
    requires: z.array(z.string()).optional(),
    if: z.string().optional(),
    timeout: z.string().optional(),
    onTimeout: z.string().optional(),
    retryPolicy: z.string().optional(),
    retry: z.object({ maxAttempts: z.number().int().positive() }).optional(),
    pivot: z.boolean().optional(),
  })
  .strict();

/**
 * Publish request for a runtime saga definition.
 *
 * The schema mirrors the document shape only loosely — `parseSagaDefinition`
 * normalises aliases and `findDefinitionProblems` decides executability, so
 * semantic errors come back as 400 from the use case, not as a Zod rejection.
 */
export const publishSagaDefinitionSchema = z.object({
  ownerModule: z.string().min(1).nullish(),
  status: z.enum(['DRAFT', 'ACTIVE']).optional(),
  document: z
    .object({
      key: z.string().min(1),
      version: z.number().int().positive(),
      requires: z.array(z.string()).optional(),
      start: z.object({
        event: eventRef,
        key: z.string().min(1),
        when: z.string().optional(),
        context: z.record(z.string(), z.string()).optional(),
      }),
      cancelOn: z.array(eventRef).optional(),
      steps: z.array(step).min(1),
      onComplete: z.object({ emit: action }).optional(),
    })
    .strict(),
});

export class PublishSagaDefinitionDto extends createZodDto(publishSagaDefinitionSchema) {}

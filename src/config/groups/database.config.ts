import { z } from 'zod';

/**
 * Database client group — Prisma credentials from the environment.
 */
export const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_READ: z.string().min(1),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

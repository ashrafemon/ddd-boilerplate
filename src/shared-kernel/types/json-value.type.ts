/**
 * The exact set of shapes a PostgreSQL jsonb / Prisma Json column can hold.
 * Use this instead of `unknown` wherever platform data round-trips through
 * JSON columns (opaque payloads, snapshots, template lines).
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A JSON object — the common shape for stored maps (overrides, snapshots). */
export type JsonObject = { [key: string]: JsonValue };

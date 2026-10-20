import { z } from 'zod';

/**
 * A date on the wire is an ISO-8601 string.
 *
 * A response schema describes the WIRE format, and on the wire a date is a
 * string. The handler however returns a live `Date`, so the schema accepts
 * both: a `Date` is converted to its ISO form, a string is validated as an
 * ISO timestamp.
 *
 * This matters for the read caches — the HTTP response cache and the
 * per-aggregate read cache both hand back the JSON form, where the date is
 * already a string. A schema that only accepts `z.date()` rejects a perfectly
 * valid cached response with a 500.
 *
 * It also keeps the generated OpenAPI document valid: `z.date()` alone
 * cannot be represented in JSON Schema.
 *
 * Use it in RESPONSE schemas only — a request body never carries a `Date`.
 */
export const wireDate = z.preprocess(
  value => (value instanceof Date ? value.toISOString() : value),
  z.iso.datetime(),
);

/**
 * A date in a REQUEST body: the wire carries an ISO-8601 string, the domain
 * wants a `Date`.
 *
 * A Zod codec decodes the string into a `Date` while the generated OpenAPI
 * document still describes the wire format (`string` / `date-time`) — a
 * `z.date()` cannot be represented in JSON Schema at all, which used to
 * break the whole Swagger document generation.
 */
export const requestDate = z.codec(z.iso.datetime(), z.date(), {
  decode: value => new Date(value),
  encode: value => value.toISOString(),
});

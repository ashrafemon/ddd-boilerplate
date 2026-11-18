/**
 * Sequence key namespacing.
 *
 * The durable key is `company:series`, and both segments are caller-supplied
 * (a company id can be any string the identity layer hands out, a series key is
 * chosen by the module). Joining them raw would let `("a:b", "c")` and
 * `("a", "b:c")` collide on one counter row, so every segment is percent-encoded
 * first — the same rule the cache, idempotency and lock key builders follow.
 */
export function buildSequenceKey(companyId: string, sequenceKey: string): string {
  return `${encodeURIComponent(companyId)}:${encodeURIComponent(sequenceKey)}`;
}

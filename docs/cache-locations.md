# Backend Architecture Explanation — Where Cache Lives

This system does **not** cache inside command use cases (create/update/reverse/etc.).  
It caches inside **query** use cases, and invalidates that cache when commands succeed.

The pattern is intentionally simple:

1. **Query use cases** (`get-*`, `list-*`) are the only places that touch cache.
2. **Command use cases** (`create-*`, `update-*`, `reverse-*`, `post-*`, etc.) never read cache.  
   They only **invalidate** the cache after a successful write.
3. Controllers and other callers use the cached query use case directly, so there is one read path and one invalidation path.

---

## Why cache is in query use cases, not command use cases

- Command use cases mutate state; they should not depend on cached reads to do their job.
- If caching lived in command use cases, you would be caching temporary or transitional state, which is error-prone.
- Query use cases are the natural place for caching because they are read-only and idempotent in shape.

So the system keeps cache at the **query layer**.

---

## What the cache adapter is for

The cache adapter:

- sits behind a module-local read-cache port,
- is fail-open by design,
- is used only by query use cases,
- is invalidated by command use cases after a write.

That means the adapter is **not** a general helper for every use case.  
It exists to support cached reads and their invalidation.

---

## How invalidation works

After a command modifies data, it invalidates the relevant cache entry:

- `create` → invalidate the new record’s cache key
- `update` → invalidate the updated record’s cache key
- `reverse` / `cancel` / `delete` → invalidate the affected record’s cache key

This keeps the cached read model eventually consistent with the command model without making commands depend on cache reads.

---

## Practical effect

- Reads can be faster because `get-*` use cases may serve from cache.
- Writes stay clean because command use cases do not read cache.
- Consistency is handled by invalidation, not by trying to keep cache and command logic intertwined.

---

## Summary

- **Cache lives in query use cases.**
- **Command use cases only invalidate cache.**
- **Cache adapters support that read/write split; they are not mixed into command logic.**
- **This keeps the architecture simple: cache for reads, invalidation for writes.**

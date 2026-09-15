# platform/storage — Object storage (S3 / local)

> File up/download, metadata, and presigned URLs behind `FileStoragePort`,
> over the `@amirrivand/nestjs-file-storage` default disk.

## What it does

`upload/download/delete/getMetadata` for private objects, plus two presign
modes: `getPresignedUrl(key, ttl)` and `createPresignedUpload({key,
expiresInSeconds, maxBytes?, contentTypes?})` (always PUT). `createPresigned-
Upload` does **not** rely on an S3 POST policy: `maxBytes`/`contentTypes`
are advisory for the client and are enforced authoritatively later — see the
import service (size via `getMetadata` at job creation + the upload DTO
content-type allowlist). Presigning throws if the disk lacks
`getTemporaryUrl`; it never falls back to the indefinite public `disk.url()`
(which would expose a private object).

## Public API
```ts
import { FileStoragePort } from '@platform/storage/ports/file-storage.port';
await this.storage.createPresignedUpload({ key, expiresInSeconds, maxBytes });
```

## Layout / bindings / config
`ports/file-storage.port.ts`, `adapters/s3-file-storage.adapter.ts`
(injects infra `FileStorageService`), `storage.module.ts` (port `useClass`).
Config `storage.*` + `getStorageDriver()`/`getS3()` (`storage.config.ts`,
default presign TTL 900s). No tables (import owns `storage_objects`).

## Who calls it / how called
Only `platform/import` — the 3 upload/job use cases + the reconciliation
file purge. Business modules do not inject it.

## Tenancy & gotchas
- Keys should embed the tenant (`imports/<tenant>/<entity>/<uuid>`) — the
  caller builds them; this module is tenancy-agnostic.
- To add a POST-policy upload hard-limit, extend the adapter (S3 `conditions`)
  rather than trusting the client to honor `maxBytes`.

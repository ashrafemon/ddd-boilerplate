# Maintainer Guide

Operational, deployment, and maintenance procedures for the ERP Boilerplate.

Audience: maintainers, release managers, on-call engineers, and anyone running this in a
non-local environment.

- Architecture & design: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Development workflows: [DEVELOPER.md](./DEVELOPER.md)

---

## 1. Maintainer Responsibilities

- Keep `ARCHITECTURE.md`, `DEVELOPER.md`, and `eslint.config.mjs` in sync — they are the
  enforcement contract. A change to dependency rules must update all three.
- Review PRs for architecture violations even when lint passes (lint covers imports, not
  intent).
- Own the release process (§5) and migration discipline (§4).
- Monitor outbox health, broker connectivity, and observability (§8).

---

## 2. Repository & Branch Strategy

- **`main` is the trunk** — always deployable, protected.
- **Short-lived feature branches** off `main`: `feat/<module>/<what>`, `fix/<what>`,
  `chore/<what>`, `refactor/<what>`.
- **PRs** require, at minimum:
  - Green `npm run lint:check`
  - Green `npm test`
  - Green `npm run build`
  - Migration included (if schema changed), with a matching `prisma migrate dev` step
  - No `no-restricted-imports` violations
- Merge with **squash** and a conventional message: `feat:`, `fix:`, `refactor:`,
  `chore:`, `docs:`, `test:`.

Suggested CI gates (no pipeline is committed yet — create `.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci --ignore-scripts
      - run: npx prisma generate
      - run: npm run lint:check
      - run: npm run format:check
      - run: npm test
      - run: npm run build
```

---

## 3. Local vs Production Infrastructure

### Local (`docker compose up -d`)

Spins up PostgreSQL 16, Redis 7, RabbitMQ 3.13 (+ management UI on :15672), and a
single-node Kafka (KRaft, no ZooKeeper). These match the `.env.example` defaults.

### Production

Do **not** run the app inside the dev `docker-compose.yml`. Provision managed services
instead:

| Service | Production suggestion |
|---|---|
| PostgreSQL | managed (RDS/Cloud SQL), `DATABASE_URL` + read replica via `DATABASE_SLAVE_URL` |
| Redis / Memcached | managed cache (ElastiCache/Memorystore) |
| RabbitMQ | managed queue (CloudAMQP/Amazon MQ) |
| Kafka | managed Kafka (MSK/Confluent) or in-cluster |
| SQS / SNS / SES | AWS native (keys via secrets) |
| S3 / MinIO | object storage for `FileStoragePort` |
| Sentry | `SENTRY_DSN` |

### App container

`Dockerfile` is multi-stage (build → runtime, `node:22-alpine`). Key points:

- `npm ci --ignore-scripts` in build (postinstall `prisma generate` is skipped) then
  `npx prisma generate` explicitly once the schema is present.
- Runtime installs only production deps (`--omit=dev --ignore-scripts`), copies `dist/`,
  `prisma/`, `tsconfig.json`, and `tsconfig-paths`.
- Entrypoint: `node -r tsconfig-paths/register dist/main.js` on port 4000.
- Migrations are **not** run by the container — run them as a deploy step (§4).

Build:

```bash
docker build -t erp-boilerplate:$(git rev-parse --short HEAD) .
```

Run with secrets injected (never bake `.env` into the image):

```bash
docker run -p 4000:4000 --env-file .env.production erp-boilerplate:<sha>
```

---

## 4. Database Migrations (Deploy Discipline)

```bash
# local / dev
npx prisma migrate dev --name <desc>

# staging / production (apply only)
npx prisma migrate deploy

# if your provider regenerates the client
npx prisma generate
```

Rules:

1. **Apply migrations before/at deploy, not from inside app containers.** Multiple app
   replicas racing `migrate deploy` is fine (Prisma takes a migration lock), but keep it a
   separate step.
2. **Never edit a pushed migration.** Create a follow-up migration.
3. **Never deploy a new schema version without `prisma generate`** — generated code in
   `src/generated/prisma/` must match the schema or queries will throw.
4. Big table changes (`outbox_messages`, `purchase_orders`) — add indexes in the same
   migration as the column, and consider `expand → migrate → contract` for locking changes.
5. The seed (`npm run db:seed`) is for dev/staging only.

Rollback: create a corrective forward migration. There is no down-migration path.

---

## 5. Releases

Version is read from `package.json` (currently `0.0.1`). Suggested flow:

1. `main` accumulates merged feature PRs.
2. Run the full gate locally: `npm run lint:check && npm test && npm run build`.
3. Tag + bump:

   ```bash
   npm version patch|minor|major -m "release: v%s"
   git push origin main --tags
   ```

4. Build & push the image (§3), deploy, apply migrations (§4), then seed if needed.
5. Post-deploy checklist:
   - `/api/v1` health/root responds
   - Swagger reachable in non-prod only
   - Outbox drains (`SELECT count(*) FROM outbox_messages WHERE status <> 'PUBLISHED'`)
   - Broker consumers connected

---

## 6. Environment Variables

Full reference: [`.env.example`](./.env.example). The non-obvious ones:

| Variable | Behavior |
|---|---|
| `CORS_ORIGINS` | **Required in production** — app refuses to boot without it (`configureCors`) |
| `DATABASE_SLAVE_URL` | Read replicas for `PrismaReadService`; falls back to master if unset |
| `SENTRY_DSN` | Unset → Sentry is a no-op (local dev) |
| `SQS_URL` | Unset → SQS publisher is a no-op; `MessageRoutingPolicy` defaults to rabbitmq/kafka |
| `KAFKA_BROKERS` | comma-separated; `KAFKA_GROUP_ID` used by consumer host |
| `OUTBOX_*` | publisher cadence/batch/retries/cleanup (defaults: 5s poll, batch 50, attempts 10, cleanup 24h) |
| `JWT_*` | access/refresh secrets + TTLs; `openssl rand -base64 32` in prod |
| `SETTINGS_ENCRYPTION_KEY` | encryption for stored settings |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | rate limiting |

Secrets (AWS keys, JWT, DSNs) belong in a secret manager, injected at runtime. Never commit
`.env`.

---

## 7. Quality Gates & Enforcement

### Local

```bash
npm run lint:check   # architecture + style (read-only)
npm run format:check # prettier
npm test             # unit
npm run build        # type-check + compile
npm run test:e2e     # smoke, needs docker
```

### Architecture enforcement (do not bypass)

`eslint.config.mjs` `no-restricted-imports` blocks:

- broker/DB/cache libs outside `infrastructure`/`config`/`bootstrap`/`platform`
- `@nestjs/*` in domain folders
- infrastructure implementation imports from business code
- cross-module outbound-port imports in domain + `application/ports`

If a rule is genuinely wrong, change `eslint.config.mjs` **and** update
[ARCHITECTURE.md §4](./ARCHITECTURE.md#4-dependency-direction--eslint-enforcement) in the
same PR.

---

## 8. Operations & Monitoring

### Outbox (most important operational signal)

| Query | Meaning |
|---|---|
| `status='PENDING'` and rising | publisher stalled or scheduler not running |
| `status='FAILED'` and climbing | broker down / routing misconfig; auto-retried up to `OUTBOX_MAX_ATTEMPTS` |
| `attempts` near `OUTBOX_MAX_ATTEMPTS` | message will be dropped from retry — alert |
| `lastError` | why publishing failed |

Useful queries:

```sql
SELECT status, count(*) FROM outbox_messages GROUP BY status;
SELECT id, event_type, attempts, last_error FROM outbox_messages
  WHERE status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 20;
SELECT count(*) FROM outbox_messages
  WHERE status = 'PUBLISHED' AND "publishedAt" < now() - interval '25 hours';
```

Cleanup job deletes published rows older than `OUTBOX_CLEANUP_OLDER_THAN_HOURS` (default 24h)
every hour.

### Brokers

- **RabbitMQ** — management UI (`/`), check `erp.events` exchange bindings, consumer
  counts, and that queues from `application/consumers` are bound.
- **Kafka** — check `KafkaConsumerHost` group lag; `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true` in
  dev only. Production topics must exist beforehand.
- **SQS** — consumers via `@ssut/nestjs-sqs`; DLQ when the queue is configured.

### Observability

- Sentry (`SENTRY_DSN`) — boot-time errors are captured too (init runs before NestFactory).
- Prometheus metrics adapter (`MetricsPort`) — wire a `/metrics` scrape endpoint when the
  HTTP layer is ready for it.
- Logging — `LoggingInterceptor` + CLS `requestId`/`correlationId`; thread them into log
  shipping (Loki). Every outbox message carries `request-id`/`correlation-id` headers, so
  trace a request end-to-end by correlation id.

### Health & load

- Rate limiting via throttler defaults; tune `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`.
- Fastify body/request/connection/keep-alive timeouts are set in `bootstrap` — revisit if
  you stream large uploads.
- `PrismaReadService` to a replica for read-heavy reports.

---

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| App won't start in prod | `CORS_ORIGINS` set? `DATABASE_URL` reachable? migrations applied? |
| `P2010`/connect errors at boot | Postgres up, `DATABASE_URL` valid, network/security-group |
| Prisma type errors after schema change | run `npx prisma generate` |
| Events never reach brokers | scheduler running? `MessageRoutingPolicy.resolve` matches event name? broker env set? |
| Consumers see no messages | queue/routing-key mismatch vs `product.rabbitmq.consumer.ts`; exchange name drift |
| Stuck PUBLISHING rows | publisher crashed mid-batch; rows are re-claimed after restart/next tick |
| Memory growth | outbox cleanup disabled? `OUTBOX_CLEANUP_OLDER_THAN_HOURS` too high? |
| 422s on valid requests | invariant/policy violated — read the error body; domain rules are intentional |

---

## 10. Housekeeping Checklist (per release / monthly)

- [ ] `outbox_messages` draining and size bounded
- [ ] Sentry error rate reviewed; no new recurring exceptions
- [ ] Broker consumer lag within tolerance
- [ ] Dependencies bumped (`npm audit` / `npm outdated` reviewed) — engine pin: Node ≥ 20.10
- [ ] `ARCHITECTURE.md` matches the current tree (folder map, module anatomy)
- [ ] No committed secrets (`git log -p` scan)
- [ ] Migrations folder has exactly one pending migration per release
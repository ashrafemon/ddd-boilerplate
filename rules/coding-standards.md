# ERP Boilerplate — Coding Standards

TypeScript, NestJS, and naming conventions for the ERP boilerplate.

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- No `any` unless unavoidable; prefer `unknown` + type guards
- No `// @ts-ignore` or `// @ts-nocheck`
- No `console.log`/`console.error` in production code (use `LoggerPort`)
- No comments unless explicitly asked (per agent instructions)

## Naming conventions

| Item | Convention | Example |
|------|-----------|---------|
| Use case file | `<verb>-<noun>.usecase.ts` | `create-product.usecase.ts` |
| Use case class | `<Verb><Noun>UseCase` | `CreateProductUseCase` |
| Request DTO file | `<name>.request.dto.ts` | `create-product.request.dto.ts` |
| Response DTO file | `<name>.<web|mobile>.response.dto.ts` | `create-product.web.response.dto.ts` |
| Repository port | `<name>CommandRepository` / `<name>Query` | `ProductCommandRepository`, `ProductQuery` |
| Integration port | `<name>PublisherPort` / `<name>IntegrationPort` | `ProductPublisherPort` |
| Outbound port | `<name>Port` | `OrderableVendorPort` |
| Public port | `<name>For<Consumer>Port` | `ProductForPurchasePort` |
| Facade | `<name>For<Consumer>Facade` | `ProductForPurchaseFacade` |
| Prisma repository | `Prisma<Name><Type>Repository` | `PrismaProductCommandRepository` |
| Adapter | `<Name>Adapter` | `CompanyConfigAdapter`, `OutboxAdapter` |
| Guard | `<Name>Guard` | `RbacGuard`, `TenancyAuthGuard` |
| Middleware | `<Name>ContextMiddleware` | `CompanyConfigContextMiddleware` |
| Decorator | `<name>.decorator.ts` | `rbac.decorator.ts` |
| Interceptor | `<Name>Interceptor` | `RequestIdInterceptor`, `LoggingInterceptor` |
| Filter | `<Name>Filter` | `HttpExceptionsFilter` |
| Pipe | `<Name>Pipe` | `AppValidationPipe` |
| Port file | `<name>.port.ts` | `request-context.port.ts`, `rbac.port.ts` |
| Invariant file | `<name>.invariants.ts` | `product.invariants.ts` |
| Policy file | `<name>.policy.ts` | `can-approve.policy.ts` |
| Factory file | `<name>.factory.ts` | `product.factory.ts` |
| Aggregate file | `<name>.aggregate.ts` | `product.aggregate.ts` |
| Entity file | `<name>.entity.ts` | `purchase-order-line.entity.ts` |
| Value object file | `<name>.vo.ts` / `<name>.invariants.ts` | `product-id.vo.ts` |
| Event file | `<name>.event.ts` | `product-created.event.ts` |
| Listener file | `*.listener.ts` / `*.listener-event.ts` | `vendor-bill-posted.listener.ts` |
| Config file | `<name>.config.ts` | `database.config.ts` |
| Module file | `<name>.module.ts` | `product.module.ts` |

## Import alias conventions

| Alias | Path |
|-------|------|
| `@config/*` | `src/config/*` |
| `@shared-kernel/*` | `src/shared-kernel/*` |
| `@bootstrap/*` | `src/bootstrap/*` |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@platform/*` | `src/platform/*` |
| `@business/*` | `src/business/*` |
| `@test/*` | `test/*` |
| `@prisma/client` | `src/generated/client.ts` (relative path in code) |

## File header conventions

No file headers, copyright notices, or author tags.

## Class conventions

- Use `private readonly` for injected dependencies
- Constructor injection only (no property injection)
- `@Injectable()` on all services/usecases
- `@Transactional()` on command use case `execute()` methods
- `async`/`await` for all async operations (no `.then()` chains)

## Interface conventions

- Ports are abstract classes (not interfaces) used as DI tokens
- Data shapes use `interface` or `type`
- Request/response DTOs use classes with Zod decorators

## Exception conventions

- `NotFoundException` — entity not found (404)
- `ConflictException` — business rule violation (409)
- `ForbiddenException` — ABAC/RBAC denial (403)
- `BadRequestException` — invalid input (400)
- Domain errors thrown via `invariantRegistry.enforce()` / `policyRegistry.enforce()`

## Testing conventions

- No unit specs in `src/` (removed; `npm test` runs with `--passWithNoTests`)
- E2E tests in `test/` require `docker compose up -d` + `.env`
- Test support files in `test/support/`
- Test utilities in `test/utils/`

## Commit conventions

- Concise commit messages matching repo style
- No secrets or `.env`
- Never edit `src/generated/**`
- Only commit when explicitly requested

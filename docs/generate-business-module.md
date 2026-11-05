# Generating a New Business Module — AI Agent Guide

Target: one bounded-context aggregate under `src/business/<context>/<module>/`.
Reference layout: `src/business/procurement/product`.

## Required file structure

```
src/business/<context>/<module>/
├── domain/
│   ├── aggregates/<module>.aggregate.ts
│   ├── aggregates/<module>.invariants.ts
│   ├── entities/<child>.entity.ts
│   ├── entities/<child>.entity.invariants.ts
│   ├── value-objects/<name>.vo.ts
│   ├── value-objects/<name>.invariants.ts
│   ├── events/<module>.<event>.event.ts
│   ├── policies/<name>.policy.ts
│   ├── factories/<module>.factory.ts
│   ├── repositories/<module>-command.repository.ts
│   └── types/<module>.types.ts
├── application/
│   ├── usecases/<verb>-<noun>.usecase.ts
│   ├── queries/<module>.query.ts
│   ├── facades/<module>-for-<consumer>.facade.ts
│   ├── outbound-ports/<name>.port.ts
│   └── integrations/
│       ├── publishes/<module>.publisher-port.ts
│       └── listeners/
├── infrastructure/
│   ├── persistence/prisma/prisma-<module>-command.repository.ts
│   ├── persistence/prisma/prisma-<module>-query.repository.ts
│   ├── persistence/prisma/prisma-<module>.mapper.ts
│   └── adapters/
│       ├── platform/company-config.adapter.ts
│       ├── platform/outbox.adapter.ts
│       └── module/<consumer>-adapter.ts
├── presentation/http/
│   ├── <module>.controller.ts
│   ├── requests/<name>.request.dto.ts
│   └── responses/<name>.<web|mobile>.response.dto.ts
├── public/
│   ├── contracts/<module>-for-<consumer>.contract.ts
│   ├── ports/<module>-for-<consumer>.port.ts
│   └── index.ts
└── <module>.module.ts
```

## Naming conventions

| Item | Convention | Example |
|------|-----------|---------|
| Use case file | `<verb>-<noun>.usecase.ts` | `create-product.usecase.ts` |
| Use case class | `<Verb><Noun>UseCase` | `CreateProductUseCase` |
| Repository port | `<Module>CommandRepository` | `ProductCommandRepository` |
| Query port | `<Module>Query` | `ProductQuery` |
| Integration port | `<Module>PublisherPort` | `ProductPublisherPort` |
| Outbound port | `<Name>Port` | `OrderableVendorPort` |
| Public port | `<Module>For<Consumer>Port` | `ProductForPurchasePort` |
| Facade | `<Module>For<Consumer>Facade` | `ProductForPurchaseFacade` |
| Prisma repo | `Prisma<Module><Type>Repository` | `PrismaProductCommandRepository` |
| Adapter | `<Name>Adapter` | `CompanyConfigAdapter` |
| Request DTO | `<name>.request.dto.ts` | `create-product.request.dto.ts` |
| Response DTO | `<name>.<web|mobile>.response.dto.ts` | `create-product.web.response.dto.ts` |
| Policy file | `<name>.policy.ts` | `can-approve.policy.ts` |
| Invariant file | `<module>.invariants.ts` | `product.invariants.ts` |
| Factory file | `<module>.factory.ts` | `product.factory.ts` |
| Event file | `<module>.<Event>.event.ts` | `product-created.event.ts` |

## Import aliases

| Alias | Path |
|-------|------|
| `@platform/*` | `src/platform/*` |
| `@business/*` | `src/business/*` |
| `@shared-kernel/*` | `src/shared-kernel/*` |
| `@prisma/client` | `src/generated/client.ts` (relative path) |

## Module registration

1. Add module to `src/business/business.module.ts` imports.
2. Add module to `src/platform/platform.module.ts` if it provides platform ports.
3. Register outbound port adapters in `<module>.module.ts` providers with `useClass`/`useExisting`.
4. Export public ports from `<module>.module.ts` exports.

## Command use case template

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';
import { RequestContextPort } from '@platform/platform-common/context/ports/request-context.port';
import { AbacPort } from '@platform/platform-organization/authorization/ports/abac.port';
import { <Module>CommandRepository } from '../../domain/repositories/<module>-command.repository';
import { <Module>PublisherPort } from '../integrations/publishes/<module>.publisher-port';
import { <CreateModule>Request } from '../../domain/types/<module>.types';

@Injectable()
export class Create<Module>UseCase {
  constructor(
    private readonly repo: <Module>CommandRepository,
    private readonly integrationEvent: <Module>PublisherPort,
    private readonly requestContext: RequestContextPort,
    private readonly abac: AbacPort,
  ) {}

  @Transactional()
  async execute(input: <CreateModule>Request): Promise<string> {
    // 1. Read context from CLS (never inject AuthenticationPort / CompanyConfigPort)
    const ctx = this.requestContext.require();
    const companyId = ctx.companyId;
    if (!companyId) {
      throw new NotFoundException('Company not found in request context');
    }

    // 2. ABAC before business steps
    const result = await this.abac.evaluate({
      context: {
        tenantId: ctx.tenantId ?? '',
        companyId,
        userId: ctx.userId ?? '',
        roles: ctx.roles,
        defaultCurrency: ctx.defaultCurrency ?? 'USD',
        autoApproveThreshold: ctx.autoApproveThreshold ?? 0,
        overReceiptTolerance: ctx.overReceiptTolerance ?? 0,
      },
      resource: '<Module>',
      action: 'create',
    });
    if (result.decision === 'DENY') {
      throw new ForbiddenException(result.reason ?? 'ABAC denied');
    }

    // 3. Business steps: factory → aggregate → repo → outbox
    // ...

    return id;
  }
}
```

## ESLint rules to respect

- `src/platform/**` may not import `@business/**`
- Business modules import ONLY `@platform` ports, another module's `public/**` or
  `application/outbound-ports/**`, and `shared-business` primitives
- Domain folders import no `@nestjs/*`
- No raw clients (Prisma, amqplib, kafkajs, ioredis/redis) outside
  `infrastructure/config/bootstrap/platform`
- Side effects via `OutboxWriterPort` inside `@Transactional()` only
- No comments in code unless asked
- Never edit `src/generated/**`

## Verification after generating

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

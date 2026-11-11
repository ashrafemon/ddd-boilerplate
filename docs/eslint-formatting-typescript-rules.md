# ESLint, Formatting & TypeScript Rules

Single reference for every lint, formatting, and type rule in this repository, including the
architecture boundaries enforced through `no-restricted-imports`.

Everything here describes **what the tooling actually enforces today**. Where the configuration
has drifted from the codebase, it is called out in [§13 Known drift](#13-known-drift).

## 1. Source of truth

| File                                     | Owns                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| `eslint.config.mjs`                      | ESLint flat config: rule sets, import boundaries, overrides |
| `.prettierrc`                            | Formatting rules                                            |
| `.prettierignore`                        | Paths Prettier never touches                                |
| `.editorconfig`                          | Editor-level whitespace/newline defaults                    |
| `tsconfig.json`                          | TypeScript compiler rules, path aliases                     |
| `tsconfig.build.json`                    | Build-only compiler overrides                               |
| `tsconfig.jest.json`                     | Test compiler overrides                                     |
| `jest.architecture.config.ts`            | Architecture test runner (layer boundaries)                 |
| `test/architecture/architecture.spec.ts` | Cross-module boundary assertions                            |
| `package.json`                           | Scripts and the unit/e2e Jest mappings                      |

Severity legend: `off (0)` · `warn (1)` · `error (2)`.

## 2. Commands

| Command                                         | What it does                                            |
| ----------------------------------------------- | ------------------------------------------------------- |
| `npm run lint`                                  | ESLint with `--fix` over `{src,apps,libs,test}/**/*.ts` |
| `npm run lint:check`                            | ESLint without fixes (CI gate)                          |
| `npm run format`                                | Prettier write over `src/**/*.ts` and `test/**/*.ts`    |
| `npm run format:check`                          | Prettier check (CI gate)                                |
| `npx tsc --noEmit -p tsconfig.json`             | Full type check (includes tests)                        |
| `npx jest --config jest.architecture.config.ts` | Architecture tests (not part of `npm test`)             |
| `npx eslint --print-config <file>`              | Print the resolved config for one file                  |
| `npm run build`                                 | `nest build` using `tsconfig.build.json`                |

`lint`/`lint:check` cover `src`, `apps`, `libs`, `test`. `apps/` and `libs/` do not exist, so in
practice the scope is `src` + `test`. `format`/`format:check` cover only `src` + `test` — `prisma/`
and `docs/` are not formatted by these scripts.

## 3. ESLint config model

`eslint.config.mjs` is an **ESLint 9 flat config** exporting `tseslint.config(...)`. Order matters:

1. Global `ignores`
2. `eslint.configs.recommended`
3. `tseslint.configs.recommendedTypeChecked`
4. `eslintPluginPrettierRecommended`
5. Language options + project rule overrides
6. Raw-client ban (broad `src/**` scope)
7. `businessBoundaryRules` — one block per declared business module
8. Domain-layer block
9. Listener blocks (`application/integrations/listens`, `integrations/consumes/listeners`)
10. Platform block
11. `shared-business` block
12. `infrastructure` / `config` / `bootstrap` block (turns import bans off)
13. `test/**` + `prisma/**` block

### 3.1 Global ignores

```js
ignores: ['eslint.config.mjs', 'prisma/generated/**', 'src/generated/**', 'dist/**'];
```

Generated Prisma output is never linted. It is also emitted with `/* eslint-disable */` and
`// @ts-nocheck`.

### 3.2 Language options

| Option                          | Value                                                        |
| ------------------------------- | ------------------------------------------------------------ |
| `globals`                       | `node` + `jest`                                              |
| `sourceType`                    | `commonjs`                                                   |
| `parserOptions.projectService`  | `true` (type-aware linting over the nearest `tsconfig.json`) |
| `parserOptions.tsconfigRootDir` | `import.meta.dirname`                                        |

### 3.3 Precedence caveat

In flat config a later matching block **replaces** `no-restricted-imports` options; it does not
merge them. That is why every block restates the full `paths` list for its scope. The **last**
matching block wins. The practical consequence for `src/business/**/domain/**` and listener files
is documented in [§5.10](#510-enforcement-gaps).

## 4. Rule sets and project overrides

### 4.1 `eslint.configs.recommended`

Core correctness rules (e.g. `no-undef`, `no-unused-vars`, `no-redeclare`, `no-constant-condition`).

### 4.2 `tseslint.configs.recommendedTypeChecked`

Adds type-aware rules. The ones that matter most here, with the **effective** severity after the
project overrides:

| Rule                                               | Effective | Note                                                        |
| -------------------------------------------------- | :-------: | ----------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`               |    off    | Project override                                            |
| `@typescript-eslint/no-floating-promises`          |   warn    | Down from error                                             |
| `@typescript-eslint/no-unsafe-argument`            |   warn    | Down from error                                             |
| `@typescript-eslint/no-unsafe-assignment`          |   error   |                                                             |
| `@typescript-eslint/no-unsafe-member-access`       |   error   |                                                             |
| `@typescript-eslint/no-unsafe-call`                |   error   |                                                             |
| `@typescript-eslint/no-unsafe-return`              |   error   |                                                             |
| `@typescript-eslint/no-unused-vars`                |   error   | Base `no-unused-vars` is off                                |
| `@typescript-eslint/no-misused-promises`           |   error   |                                                             |
| `@typescript-eslint/await-thenable`                |   error   |                                                             |
| `@typescript-eslint/require-await`                 |   error   |                                                             |
| `@typescript-eslint/restrict-template-expressions` |   error   |                                                             |
| `@typescript-eslint/no-base-to-string`             |   error   |                                                             |
| `@typescript-eslint/ban-ts-comment`                |   error   | `@ts-ignore` banned; `@ts-expect-error` needs a description |

### 4.3 Prettier plugin

| Rule                | Severity | Options                   |
| ------------------- | :------: | ------------------------- |
| `prettier/prettier` |  error   | `{ "endOfLine": "auto" }` |

Prettier problems are lint errors, so `npm run lint:check` fails on unformatted code.

### 4.4 Project-specific overrides

```js
'@typescript-eslint/no-explicit-any': 'off',
'@typescript-eslint/no-floating-promises': 'warn',
'@typescript-eslint/no-unsafe-argument': 'warn',
'prettier/prettier': ['error', { endOfLine: 'auto' }],
```

There are no other project-level rule additions or removals.

## 5. Import boundary rules (`no-restricted-imports`)

This is the core architecture enforcement. Eight rule scopes exist: base, business-module, domain,
listener, platform, shared-business, infra/config/bootstrap, and test/prisma.

### 5.1 Banned raw clients

`prismaPaths` — banned in business, platform, domain, listeners, shared-business, tests and Prisma
scripts:

| Specifier                        | Reason                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `prisma/generated/prisma/client` | Prisma is infrastructure-only                                                                                       |
| `@prisma/client`                 | Bare specifier resolves to the npm stub and breaks the compiled build; import the generated client by relative path |
| `@prisma/adapter-pg`             | Prisma is infrastructure-only                                                                                       |

`transportPaths` — banned in business/domain/listeners/shared-business, and partially in platform:

| Specifier                    | Reason                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| `amqplib`                    | RabbitMQ is infrastructure-only (use `MessageQueuePort`)         |
| `kafkajs`                    | Kafka is infrastructure-only                                     |
| `ioredis` / `redis`          | Redis is infrastructure-only (use infrastructure `RedisService`) |
| `@golevelup/nestjs-rabbitmq` | RabbitMQ is infrastructure-only                                  |
| `@ssut/nestjs-sqs`           | SQS is infrastructure-only                                       |
| `@nestjs/schedule`           | Scheduler belongs to platform, not business                      |

Platform has its own reduced list: Prisma paths plus `amqplib`, `kafkajs`, `ioredis`, `redis`.
Platform **may** use `@nestjs/schedule` and the RabbitMQ/SQS Nest packages.

Listeners get the transport list minus the broker subscribe packages (they may import the
decorators) but keep the raw-client bans.

### 5.2 Business module isolation

Declared workspace modules (`businessModules`):

```js
[
  'procurement/product',
  'party/vendor',
  'procurement/purchase-order',
  'procurement/good-receipt-note',
  'inventory/stock-movement',
  'sales/invoice',
];
```

For each declared module, every file under `src/business/<module>/**/*.ts` **except**
`src/business/<module>/public/**` may not import:

- another declared module's `domain/**`
- another declared module's `application/queries/**`
- another declared module's `application/usecases/**`
- another declared module's `application/integrations/**`
- another declared module's `application/facades/**`
- another declared module's `infrastructure/**`
- anything under `@infrastructure/**`

And always the raw client list.

What a business module **may** import:

- its own internals
- `@platform/**` exported tokens
- `@business/shared-business/**` primitives
- another module's `public/**`
- another module's `application/outbound-ports/**` (the port a producer adapter implements)
- `@common/**` HTTP/application utilities

### 5.3 Domain layer

Files: `src/business/**/domain/**/*.ts` and `src/business/shared-business/domain/**/*.ts`.

Restates the raw-client list and adds NestJS bans:

| Specifier               | Reason                           |
| ----------------------- | -------------------------------- |
| `@nestjs/common`        | Domain must not depend on NestJS |
| `@nestjs/core`          | Domain must not depend on NestJS |
| `@nestjs/config`        | Domain must not depend on NestJS |
| `@nestjs/event-emitter` | Domain must not depend on NestJS |

`@nestjs/schedule` is already banned by the shared raw-client list.

### 5.4 Listeners

The config defines two listener scopes (the second matches the layout the repo actually uses):

- `src/business/**/application/integrations/listens/**`
- `src/business/**/integrations/consumes/listeners/**`

Both may import broker packages **for subscribe decorators only** (`@RabbitSubscribe`,
`@SqsMessageHandler`, the custom Kafka decorator). They may not import:

- Prisma paths
- raw `amqplib` / `kafkajs` / `ioredis` / `redis`
- `@nestjs/schedule`
- `@infrastructure/**`

Listeners must delegate to use cases.

### 5.5 Platform

Files: `src/platform/**/*.ts`.

| Forbidden                                | Why                                                              |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Prisma paths                             | Platform uses repositories/services, not the client              |
| `amqplib`, `kafkajs`, `ioredis`, `redis` | Use platform ports/adapters                                      |
| `@business/**`                           | Platform is independent of business; bridge from `src/bootstrap` |
| relative `../../../business/...`         | Same rule, enforced by regex                                     |

`PlatformModule` is intentionally not `@Global()`; consumers must import it explicitly.

### 5.6 `shared-business`

Files: `src/business/shared-business/**/*.ts`.

Forbidden: raw clients, `@platform/**`, `@infrastructure/**`, and any concrete business module
(`@business/*/*/**`). Only framework-free primitives are allowed.

### 5.7 `infrastructure`, `config`, `bootstrap`

`no-restricted-imports` is turned **off** for these folders — they own the third-party clients and
may import anything.

### 5.8 Tests and Prisma scripts

Files: `test/**/*.ts`, `prisma/**/*.ts`. Only the Prisma paths are banned (bare `@prisma/client`,
`prisma/generated/prisma/client`, `@prisma/adapter-pg`). Note that `npm run lint` does not include
`prisma/`, so the Prisma rule only applies when linting that folder explicitly.

### 5.9 Resolved-config examples

Verify any file with:

```bash
npx eslint --print-config src/business/procurement/purchase-order/domain/aggregates/purchase-order.aggregate.ts
```

- **Domain file** → 14 banned paths (Prisma + transports + 4 NestJS packages), **no** cross-module
  `patterns`.
- **Application file in a declared module** → raw clients + `patterns` for the other five declared
  modules' internal folders + `@infrastructure/**`.
- **Platform file** → Prisma + four raw transport clients + regex banning all business imports.

### 5.10 Enforcement gaps

These are real gaps between the documented architecture and what ESLint currently rejects:

1. **Stale `businessModules` list.** `procurement/product`, `procurement/good-receipt-note`, and
   `inventory/stock-movement` no longer exist. The actual modules `product-management/product`,
   `product-management/product-pricing`, `procurement/purchase-goods-receipt`, and the flat
   `inventory`, `finance`, `pricing` contexts therefore get **no** module-isolation rule.
2. **`usecases` vs `use-cases`.** The forbidden group is `application/usecases/**`, but the repo
   uses `application/use-cases/**`. Cross-module imports of use-case folders are not blocked.
3. **Domain and listener blocks drop `patterns`.** Because later blocks replace rule options, a
   domain file or listener can import another module's internals without an ESLint error. The Jest
   architecture test catches this case, but it is not part of `npm test` or `lint:check`.
4. **`application/integrations/listens`** appears in an `ignores` list, but that folder does not
   exist; real listeners live in `integrations/consumes/listeners`, which the second listener block
   covers.
5. **Own-module `public/**` is ignored by the module-isolation block**, so those files fall back to
   the base block: raw clients are still banned, but `@infrastructure/**` is **not** forbidden
   there. `public/` contracts must stay infrastructure-free by convention.

## 6. Prettier

### 6.1 Options (`.prettierrc`)

| Option            | Value   | Effect                                                   |
| ----------------- | ------- | -------------------------------------------------------- |
| `singleQuote`     | `true`  | `'text'`                                                 |
| `trailingComma`   | `all`   | Trailing commas in multiline structures                  |
| `printWidth`      | `100`   | Wrap at 100 columns                                      |
| `tabWidth`        | `2`     | Two spaces                                               |
| `semi`            | `true`  | Always print semicolons                                  |
| `bracketSpacing`  | `true`  | `{ a: 1 }`                                               |
| `arrowParens`     | `avoid` | `x => x` instead of `(x) => x`                           |
| `endOfLine`       | `lf`    | LF line endings                                          |
| `bracketSameLine` | `true`  | Closing `>` of multiline JSX/HTML stays on the last line |

### 6.2 Ignored paths (`.prettierignore`)

`dist`, `build`, `node_modules`, `coverage`, `*.tsbuildinfo`, `prisma/generated`, `prisma/*.db`,
`.env`, `.env.local`, `.idea`, `.vscode`, `*.sublime-workspace`, `package-lock.json`,
`nest-cli.json`, `tsconfig*.json`.

`src/generated/**` is not listed here, but the `format` scripts only target `src` and `test`, so the
generated client is effectively unformatted/unchecked.

### 6.3 ESLint ↔ Prettier interplay

- The ESLint plugin passes `endOfLine: 'auto'`; the CLI Prettier run uses `.prettierrc`
  (`lf`). On a CRLF checkout the two can disagree.
- `eslint-config-prettier` (inside `eslintPluginPrettierRecommended`) disables formatting rules that
  would conflict with Prettier.
- Do not add stylistic ESLint rules; formatting belongs to Prettier.

## 7. EditorConfig

```ini
root = true
[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2
[*.{ts,tsx,js,jsx,mjs,cjs}] indent_size = 2
[Makefile] indent_style = tab
```

## 8. TypeScript

### 8.1 `tsconfig.json` compiler options

| Option                             | Value                   |
| ---------------------------------- | ----------------------- |
| `module`                           | `nodenext`              |
| `moduleResolution`                 | `nodenext`              |
| `target`                           | `ES2023`                |
| `resolvePackageJsonExports`        | `true`                  |
| `esModuleInterop`                  | `true`                  |
| `allowSyntheticDefaultImports`     | `true`                  |
| `experimentalDecorators`           | `true`                  |
| `emitDecoratorMetadata`            | `true`                  |
| `declaration`                      | `true`                  |
| `removeComments`                   | `true`                  |
| `sourceMap`                        | `true`                  |
| `outDir`                           | `./dist`                |
| `baseUrl`                          | `./`                    |
| `rootDirs`                         | `["src"]`               |
| `incremental`                      | `true`                  |
| `skipLibCheck`                     | `true`                  |
| `strictNullChecks`                 | `true`                  |
| `forceConsistentCasingInFileNames` | `true`                  |
| `noImplicitAny`                    | `false`                 |
| `strictBindCallApply`              | `false`                 |
| `noFallthroughCasesInSwitch`       | `false`                 |
| `include`                          | `src/**/*`, `test/**/*` |

### 8.2 Effective strictness

`strict` is **not** enabled. Only `strictNullChecks` is on. Consequently:

- `noImplicitAny` — off
- `strictFunctionTypes` — off
- `strictPropertyInitialization` — off
- `useUnknownInCatchVariables` — off (caught errors are `any`)
- `alwaysStrict` — off

`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess`, and
`exactOptionalPropertyTypes` are not enabled. Unused variables are still caught by
`@typescript-eslint/no-unused-vars`.

### 8.3 Build and test configs

`tsconfig.build.json`:

- extends `tsconfig.json`
- `rootDir: ./src`, `incremental: false`
- excludes `node_modules`, `test`, `dist`, `**/*spec.ts`, `**/*e2e-spec.ts`, `prisma/generated`

`tsconfig.jest.json`:

- extends `tsconfig.json`
- `isolatedModules: true`
- `module: CommonJS`, `moduleResolution: Node`, `resolvePackageJsonExports: false`
- `declaration: false`
- `include: ["src/**/*.ts"]`

### 8.4 Path aliases

Authoritative (`tsconfig.json`):

| Alias               | Target                    |
| ------------------- | ------------------------- |
| `@config/*`         | `src/config/*`            |
| `@common/*`         | `src/common/*`            |
| `@bootstrap/*`      | `src/bootstrap/*`         |
| `@infrastructure/*` | `src/infrastructure/*`    |
| `@platform/*`       | `src/platform/*`          |
| `@business/*`       | `src/business/*`          |
| `@test/*`           | `test/*`                  |
| `@prisma/client`    | `src/generated/client.ts` |

There is **no** `@shared-kernel/*` alias. `jest.architecture.config.ts`, `test/jest-e2e.json`,
`prisma/seed.ts`, and some docs still reference `src/shared-kernel`, which does not exist. Unit Jest
mapping in `package.json` also omits `@common/*`. Use `@common/*` in code.

### 8.5 Prisma client import rule

Always import the generated client by relative path:

```ts
import { PrismaClient } from '../../generated/client';
```

The bare `@prisma/client` specifier is rejected by ESLint and breaks the compiled build because the
npm stub requires a missing `.prisma/client/default` path. `@prisma/client` in `tsconfig.paths` is a
compile-time alias only; ESLint still bans the bare specifier.

## 9. Jest architecture tests

`test/architecture/architecture.spec.ts` is an additional, tooling-independent boundary check. It
walks `src/business/**` and asserts:

1. **Domain** — no NestJS, Prisma, brokers, `@infrastructure`, `@platform`, or another module's
   `domain`/`infrastructure`/`application`.
2. **Application** — no `@infrastructure`, no raw clients, no another module's internals.
3. **Infrastructure** — no another module's internals.
4. **Cross-module imports** — only through the target module's `public/`.
5. **No circular module dependencies.**

Exceptions:

- `shared-business` may import NestJS base classes and is allowed from every layer.
- `purchase-order` domain types may import `@platform/platform-common/recurring/` type definitions.

Run it with:

```bash
npx jest --config jest.architecture.config.ts
```

It is **not** executed by `npm test` (rootDir is `src`, matching only `src/**/*.spec.ts`) and not by
`lint:check`. There are currently no `src/**/*.spec.ts` files, so `npm test` passes without running
anything (`--passWithNoTests`).

## 10. Suppressions and escape hatches

| Mechanism                                    | Where                         | Policy                                                    |
| -------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| `/* eslint-disable */` + `// @ts-nocheck`    | `src/generated/**` (56 files) | Generated; ESLint ignores the folder                      |
| `// @ts-expect-error deviceItem metadata`    | 10 list-response DTOs         | Allowed because `ban-ts-comment` requires a description   |
| `@ts-ignore`                                 | none                          | Rejected by `@typescript-eslint/ban-ts-comment`           |
| Inline `eslint-disable` in hand-written code | none                          | Avoid; if unavoidable, scope it to one line with a reason |

Prefer fixing the type or narrowing with a guard over suppressing. Do not edit `src/generated/**`.

## 11. Verification battery

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:check
npm run format:check
npm run docs:di
npm run build
NODE_ENV=test node -e "(async()=>{const{NestFactory}=require('@nestjs/core');const{AppModule}=require('./dist/app.module.js');const a=await NestFactory.create(AppModule,{preview:true});await a.init();await a.close();})()"
```

`npm run docs:di` is referenced in `AGENTS.md`/`README.md` but is **not defined** in
`package.json` today.

## 12. Checklist when adding code

1. Put domain code under `domain/` with no `@nestjs/*`, Prisma, broker, platform, or infrastructure
   imports.
2. Application code injects ports only; never import `@infrastructure`.
3. Cross-module access goes through the other module's `public/**` or its
   `application/outbound-ports/**`.
4. Import `@common/*`, not the retired `@shared-kernel/*`.
5. Import the Prisma client by relative path.
6. Side effects (events, messages) go through `OutboxWriterPort` inside `@Transactional()`.
7. Run `tsc`, `lint:check`, `format:check`, `build`, and the Jest architecture config.
8. If you add a business module, also update `businessModules` in `eslint.config.mjs` (see §13).

## 13. Known drift

| Item                             | Current state                                                               | Recommended fix                                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `businessModules` paths          | Names modules that no longer exist; misses current ones                     | Replace with `party/vendor`, `product-management/product`, `product-management/product-pricing`, `procurement/purchase-order`, `procurement/purchase-goods-receipt`, `sales/invoice`, `inventory`, `finance` |
| Cross-module folder name         | Rule blocks `application/usecases/**`; code uses `application/use-cases/**` | Update `internalGroups`                                                                                                                                                                                      |
| Domain/listener `patterns`       | Lost when later blocks replace options                                      | Restate cross-module patterns in the domain and listener blocks                                                                                                                                              |
| `@shared-kernel/*`               | Referenced by tests/seed/docs; alias does not exist                         | Replace with `@common/*`                                                                                                                                                                                     |
| `@common/*` in unit Jest mapping | Missing from `package.json` `moduleNameMapper`                              | Add it                                                                                                                                                                                                       |
| `docs:di` script                 | Referenced but undefined                                                    | Add the script or drop it from the battery                                                                                                                                                                   |
| `strict`                         | Not enabled; only `strictNullChecks`                                        | Enable `strict` incrementally, then remove the individual relaxations                                                                                                                                        |
| `tsc` state                      | Fails with ~25 errors (unfinished utility refactor)                         | Fix before relying on the battery                                                                                                                                                                            |
| Architecture tests               | Not wired into `npm test`/CI                                                | Add `test:architecture` to the verification battery                                                                                                                                                          |
| `public/**` fallback             | Raw clients banned, `@infrastructure/**` allowed                            | Add an `@infrastructure/**` pattern to the base block                                                                                                                                                        |

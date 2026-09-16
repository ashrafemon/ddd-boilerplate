# platform/configuration — Company configuration

> Resolves per-company settings (code, currency, auto-approve threshold) for
> the whole system, keyed by an explicit id, the authenticated organization,
> or a single-tenant default.

## What it does

`CompanyConfigPort.getCompanyConfig(companyId?)` reads `company_configs`
through `TransactionHost` (so it joins the caller's transaction). Company
resolution order: **explicit argument → CLS `organizationId` →
`DEFAULT_COMPANY_ID`**. A missing row for a *context-resolved* company in
`TENANCY_MODE=multi` is a hard `NotFoundException` — never default billing
data across companies. For the unscoped default it logs a warning and returns
built-in defaults (first boot / unseeded DB).

## Public API

```ts
import { CompanyConfigPort, DEFAULT_COMPANY_ID } from '@platform/configuration/ports/company-config.port';
const company = await this.companyConfig.getCompanyConfig(); // context-scoped
const other   = await this.companyConfig.getCompanyConfig(id);
```

## Layout | bindings | tables | config
`ports/company-config.port.ts` (token + `CompanyConfig`),
`repositories/company-config.repository.ts` (Prisma impl + resolution),
`configuration.module.ts`. Writes/reads `company_configs`. Config:
`security.tenancy.mode` + `app.name`. Imports `ContextModule`.

## Who calls it / how called
Business modules (`party`, `product`, `purchase-order`, `GRN`, `invoice`) via
their own module-local `CompanyConfigPort` bound to a `CompanyConfigAdapter`
that forwards here — `imports: [PlatformModule]`. Platform consumers: none.

## Tenancy & gotchas
- The whole point is context-correct company data; do not cache the result
  across requests without honoring the org scope.
- `company_configs.companyId` is `@unique`; `DEFAULT_COMPANY_ID` is a fixed
  UUID seed. Extend `CompanyConfig` fields + migration + mapper together.

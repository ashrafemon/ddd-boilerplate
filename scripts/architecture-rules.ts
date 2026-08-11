import { readdirSync, readFileSync, statSync } from 'fs';
import { join, normalize, relative, resolve } from 'path';

const SRC = resolve(__dirname, '..', 'src');

const FORBIDDEN_LIBS_FOR_DOMAIN = [
  '@prisma/client',
  'prisma',
  'ioredis',
  'kafkajs',
  '@golevelup',
  '@aws-sdk',
  '@ssut',
  '@nestjs/core',
  '@nestjs/platform',
  '@sentry',
  'prom-client',
  '@nestjs-cls',
  '@andreafspeziale',
  '@nestjs/terminus',
  '@nestjs/schedule',
];

const FORBIDDEN_LIBS_FOR_APPLICATION = [
  '@prisma/client',
  'ioredis',
  'kafkajs',
  '@golevelup',
  '@aws-sdk',
  '@ssut',
  '@sentry',
  'prom-client',
  '@nestjs/core',
];

const FORBIDDEN_LIBS_FOR_PRESENTATION = ['@prisma/client', '@nestjs/core'];

export interface ArchitectureViolation {
  file: string;
  rule: string;
  importPath: string;
  message: string;
}


function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const re =
    /(?:import\s+(?:type\s+)?[^'"]*?from\s*|import\s*|export\s+(?:type\s+)?[^'"]*?from\s*|require\s*\()\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveTo(importer: string, spec: string): string {
  if (spec.startsWith('.')) {
    const resolved = normalize(join(dirnameOf(importer), spec));
    return relative(SRC, resolved).replace(/\\/g, '/').replace(/\.ts$/, '');
  }
  return spec;
}

function dirnameOf(file: string): string {
  const idx = file.lastIndexOf('/');
  return idx === -1 ? file : file.slice(0, idx);
}

function isForbiddenLib(spec: string, forbidden: string[]): boolean {
  return forbidden.some((lib) => spec === lib || spec.startsWith(lib + '/'));
}


function moduleNameOf(file: string): string | null {
  const parts = file.split('/');
  const businessIndex = parts.indexOf('business');
  if (businessIndex === -1) return null;
  const candidate = parts[businessIndex + 1];
  return candidate && candidate !== 'shared-business' ? candidate : null;
}

/**
 * Platform contracts are the interfaces the platform layer exposes: `*.port`
 * files and the integration-message type. Domain code may depend on these but
 * not on platform service implementations.
 */
function isPlatformContract(to: string): boolean {
  return (
    to.startsWith('platform/') &&
    (to.endsWith('.port') || to.endsWith('/integration-message'))
  );
}

/**
 * Enforces the architectural dependency rules of the boilerplate.
 */
export function checkArchitecture(): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];

  for (const file of walk(SRC)) {
    const from = relative(SRC, file).replace(/\\/g, '/').replace(/\.ts$/, '');
    const source = readFileSync(file, 'utf8');
    const module = moduleNameOf(from);

    for (const spec of importsOf(source)) {
      const to = resolveTo(from, spec);

      // Rule 1: domain must not import infrastructure, platform services or
      // forbidden libs. Platform ports are the only allowed platform imports.
      if (from.includes('/domain/')) {
        if (to.startsWith('infrastructure/') || to.includes('/infrastructure/')) {
          violations.push({
            file: from,
            rule: 'domain-must-not-import-infrastructure',
            importPath: to,
            message: 'Domain code must not depend on infrastructure implementations.',
          });
        }
        if (to.startsWith('platform/') && !isPlatformContract(to)) {
          violations.push({
            file: from,
            rule: 'domain-must-not-import-platform-services',
            importPath: to,
            message: 'Domain code may depend on platform ports only, never on platform services.',
          });
        }
        if (!spec.startsWith('.') && isForbiddenLib(spec, FORBIDDEN_LIBS_FOR_DOMAIN)) {
          violations.push({
            file: from,
            rule: 'domain-must-not-import-forbidden-lib',
            importPath: spec,
            message: `Domain code must not import "${spec}".`,
          });
        }
      }

      // Rule 2: application must not import infrastructure or forbidden libs.
      // Platform (ports + services) is allowed: the application orchestrates
      // sagas, message routing and platform services through the platform.
      if (from.includes('/application/')) {
        if (to.startsWith('infrastructure/') || to.includes('/infrastructure/')) {
          violations.push({
            file: from,
            rule: 'application-must-not-import-infrastructure',
            importPath: to,
            message: 'Application code must reach infrastructure only through ports.',
          });
        }
        if (!spec.startsWith('.') && isForbiddenLib(spec, FORBIDDEN_LIBS_FOR_APPLICATION)) {
          violations.push({
            file: from,
            rule: 'application-must-not-import-forbidden-lib',
            importPath: spec,
            message: `Application code must not import "${spec}".`,
          });
        }
      }

      // Rule 3: presentation must not import domain, infrastructure or forbidden libs.
      if (from.includes('/presentation/')) {
        if (to.includes('/domain/') || to.startsWith('infrastructure/') || to.includes('/infrastructure/')) {
          violations.push({
            file: from,
            rule: 'presentation-must-not-import-domain-or-infrastructure',
            importPath: to,
            message: 'Presentation must invoke application ports only.',
          });
        }
        if (!spec.startsWith('.') && isForbiddenLib(spec, FORBIDDEN_LIBS_FOR_PRESENTATION)) {
          violations.push({
            file: from,
            rule: 'presentation-must-not-import-forbidden-lib',
            importPath: spec,
            message: `Presentation must not import "${spec}".`,
          });
        }
      }

      // Rule 4: modules must not import other modules directly (only outbound
      // adapters may import the provider module's application ports).
      if (module && moduleNameOf(to) && moduleNameOf(to) !== module) {
        const isOutboundAdapter = from.includes('/infrastructure/outbound');
        const importsApplicationPort = to.includes('/application/port');
        if (!(isOutboundAdapter && importsApplicationPort)) {
          violations.push({
            file: from,
            rule: 'no-direct-cross-module-import',
            importPath: to,
            message: `Module "${module}" must not import module "${moduleNameOf(to)}" directly. Use the ModulePortAccessor through an outbound adapter.`,
          });
        }
      }

      // Rule 5: shared layers must stay clean.
      if (from.startsWith('shared-business/')) {
        if (
          moduleNameOf(to) !== null ||
          to.startsWith('infrastructure/') ||
          to.startsWith('platform/')
        ) {
          violations.push({
            file: from,
            rule: 'shared-business-must-not-depend-on-modules-or-platform',
            importPath: to,
            message: 'Shared Business must only contain reusable business concepts.',
          });
        }
      }

      if (from.startsWith('shared-kernel/')) {
        if (
          (to.startsWith('business/') && moduleNameOf(to) !== null) ||
          to.startsWith('platform/') ||
          to.startsWith('infrastructure/')
        ) {
          violations.push({
            file: from,
            rule: 'shared-kernel-must-not-depend-on-platform',
            importPath: to,
            message: 'Shared Kernel must not depend on business modules, platform or infrastructure.',
          });
        }
      }

      // Rule 6: infrastructure implements platform ports with client adapters.
      // It must not depend on business logic or platform services.
      if (from.startsWith('infrastructure/')) {
        if (to.startsWith('business/')) {
          violations.push({
            file: from,
            rule: 'infrastructure-must-not-depend-on-business',
            importPath: to,
            message: 'Infrastructure must not depend on business modules.',
          });
        }
      }

      // Rule 7: platform manages platform services; it must not depend on
      // business modules (shared business value objects are allowed).
      // Client adapters and ports live below it.
      if (from.startsWith('platform/')) {
        if (to.startsWith('business/') && moduleNameOf(to) !== null) {
          violations.push({
            file: from,
            rule: 'platform-must-not-depend-on-business',
            importPath: to,
            message: 'Platform must not depend on business modules.',
          });
        }
      }
    }
  }

  return violations;
}


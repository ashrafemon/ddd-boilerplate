import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { glob } from 'glob';

const ROOT = join(__dirname, '..', '..');
const BUSINESS_ROOT = join(ROOT, 'src', 'business');

/**
 * Architecture tests — enforce hexagonal/modular-monolith boundaries.
 *
 * Rules enforced:
 *   1. Domain layer: may NOT import NestJS, Prisma, RabbitMQ, Infrastructure,
 *      Application, or another module's domain/infrastructure/application.
 *   2. Application layer: may NOT import Infrastructure or another module's
 *      domain/infrastructure directly — must go through public/ APIs.
 *   3. Infrastructure layer: may import domain/application of its OWN module
 *      only — never another module's internals.
 *   4. Cross-module imports must go through target module's public/ directory.
 *   5. No circular module dependencies at the module level.
 */

const DOMAIN_PATTERN = /\/domain\//;
const APPLICATION_PATTERN = /\/application\//;
const INFRASTRUCTURE_PATTERN = /\/infrastructure\//;

const DOMAIN_FORBIDDEN_IMPORTS = [
  '@nestjs/',
  '@platform/',
  '@infrastructure/',
  'prisma',
  'amqplib',
  'kafkajs',
  'ioredis',
  'redis',
];

const APPLICATION_FORBIDDEN_IMPORTS = [
  '@infrastructure/',
  'amqplib',
  'kafkajs',
  'ioredis',
  'redis',
];

const PUBLIC_IMPORT_PREFIX = '@business/';

const LAYER_DIRS = new Set([
  'domain',
  'application',
  'infrastructure',
  'presentation',
  'public',
  'integrations',
]);

function getModulePath(filePath: string): string | null {
  const rel = relative(BUSINESS_ROOT, filePath);
  const parts = rel.split('/');
  if (parts.length < 1) return null;
  const ctx = parts[0]; // bounded context (e.g. 'procurement', 'inventory', 'finance')
  if (parts.length >= 2 && !LAYER_DIRS.has(parts[1])) {
    return join(ctx, parts[1]); // e.g. 'procurement/purchase-order'
  }
  return ctx; // e.g. 'inventory', 'finance', 'pricing'
}

function getLayer(filePath: string): 'domain' | 'application' | 'infrastructure' | 'other' {
  if (DOMAIN_PATTERN.test(filePath)) return 'domain';
  if (APPLICATION_PATTERN.test(filePath)) return 'application';
  if (INFRASTRUCTURE_PATTERN.test(filePath)) return 'infrastructure';
  return 'other';
}

function getImportSource(importLine: string): string | null {
  const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function collectImportSources(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      const src = getImportSource(trimmed);
      if (src) imports.push(src);
    }
  }
  return imports;
}

function getImportTargetModule(importSource: string): string | null {
  if (!importSource.startsWith(PUBLIC_IMPORT_PREFIX)) return null;
  const parts = importSource.slice(PUBLIC_IMPORT_PREFIX.length).split('/');
  if (parts.length < 1) return null;
  const ctx = parts[0];
  if (parts.length >= 2 && !LAYER_DIRS.has(parts[1])) {
    return join(ctx, parts[1]);
  }
  return ctx;
}

function findBusinessFiles(): string[] {
  return glob.sync(join(BUSINESS_ROOT, '**', '*.ts'), {
    ignore: ['**/node_modules/**', '**/*.d.ts'],
  });
}

describe('Architecture: Hexagonal Layer Boundaries', () => {
  const files = findBusinessFiles();
  const fileInfos = files.map(f => ({
    path: f,
    module: getModulePath(f)!,
    layer: getLayer(f),
    imports: collectImportSources(f),
  }));

  describe('Domain layer', () => {
    it('must not import framework/infrastructure/another module internals', () => {
      const violations: string[] = [];

      for (const info of fileInfos) {
        if (info.layer !== 'domain') continue;

        // shared-business (shared kernel) may import NestJS for base classes
        if (info.path.includes('/shared-business/')) continue;

        for (const imp of info.imports) {
          if (imp.startsWith(PUBLIC_IMPORT_PREFIX)) {
            // shared-business is a shared kernel — allowed for all layers
            if (imp.startsWith('@business/shared-business/')) continue;

            const targetModule = getImportTargetModule(imp);
            if (
              targetModule &&
              targetModule !== info.module &&
              (imp.includes('/domain/') ||
                imp.includes('/infrastructure/') ||
                imp.includes('/application/'))
            ) {
              violations.push(
                `${relative(ROOT, info.path)} imports ${imp} — domain must not import another module's domain/infrastructure/application`,
              );
            }
            continue;
          }

          const isForbidden = DOMAIN_FORBIDDEN_IMPORTS.some(prefix => imp.startsWith(prefix));
          // Platform recurring types are shared type definitions used by
          // purchase-order domain types — allowed exception.
          const isRecurringType = imp.startsWith('@platform/platform-common/recurring/');
          if (isForbidden && !isRecurringType) {
            violations.push(
              `${relative(ROOT, info.path)} imports ${imp} — domain layer must not import framework/infrastructure`,
            );
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Application layer', () => {
    it('must not import infrastructure or another module internals', () => {
      const violations: string[] = [];

      for (const info of fileInfos) {
        if (info.layer !== 'application') continue;

        for (const imp of info.imports) {
          if (imp.startsWith('@infrastructure/')) {
            violations.push(
              `${relative(ROOT, info.path)} imports ${imp} — application layer must not import infrastructure`,
            );
            continue;
          }

          if (imp.startsWith(PUBLIC_IMPORT_PREFIX)) {
            // shared-business is a shared kernel — allowed for all layers
            if (imp.startsWith('@business/shared-business/')) continue;

            const targetModule = getImportTargetModule(imp);
            if (
              targetModule &&
              targetModule !== info.module &&
              (imp.includes('/domain/') ||
                imp.includes('/infrastructure/') ||
                imp.includes('/application/'))
            ) {
              violations.push(
                `${relative(ROOT, info.path)} imports ${imp} — application must import another module only through public/`,
              );
            }
            continue;
          }

          const isForbidden = APPLICATION_FORBIDDEN_IMPORTS.some(prefix => imp.startsWith(prefix));
          if (isForbidden) {
            violations.push(
              `${relative(ROOT, info.path)} imports ${imp} — application layer must not import raw clients`,
            );
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Infrastructure layer', () => {
    it('must not import another module domain/infrastructure/application', () => {
      const violations: string[] = [];

      for (const info of fileInfos) {
        if (info.layer !== 'infrastructure') continue;

        for (const imp of info.imports) {
          if (!imp.startsWith(PUBLIC_IMPORT_PREFIX)) continue;

          // shared-business is a shared kernel — allowed for all layers
          if (imp.startsWith('@business/shared-business/')) continue;

          const targetModule = getImportTargetModule(imp);
          if (
            targetModule &&
            targetModule !== info.module &&
            (imp.includes('/domain/') ||
              imp.includes('/infrastructure/') ||
              imp.includes('/application/'))
          ) {
            violations.push(
              `${relative(ROOT, info.path)} imports ${imp} — infrastructure must import another module only through public/`,
            );
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});

describe('Architecture: No Circular Module Dependencies', () => {
  it('must not have circular module imports', () => {
    const files = findBusinessFiles();
    const moduleEdges = new Map<string, Set<string>>();

    for (const f of files) {
      const module = getModulePath(f);
      if (!module) continue;

      const imports = collectImportSources(f);
      const targetModules = new Set<string>();

      for (const imp of imports) {
        if (!imp.startsWith(PUBLIC_IMPORT_PREFIX)) continue;

        const parts = imp.slice(PUBLIC_IMPORT_PREFIX.length).split('/');
        const ctx = parts[0];
        const targetModule =
          parts.length >= 2 && !LAYER_DIRS.has(parts[1]) ? join(ctx, parts[1]) : ctx;
        if (targetModule !== module) {
          targetModules.add(targetModule);
        }
      }

      if (targetModules.size > 0) {
        moduleEdges.set(module, targetModules);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = moduleEdges.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of moduleEdges.keys()) {
      if (!visited.has(node)) {
        expect(hasCycle(node)).toBe(false);
      }
    }
  });
});

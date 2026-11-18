import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const PLATFORM_ROOT = join(ROOT, 'src', 'platform');

/**
 * Platform shape tests — enforce `docs/platform-standard.md`.
 *
 * Migration is staged per module (standard §10): `MIGRATED` lists the modules
 * that already follow the inbound/outbound anatomy; every module is expected
 * to join it in the change that touches it. The global rules apply to the whole
 * platform tree from day one:
 *   - no `errors/` folder, no `*.errors.ts` (use NestJS built-in exceptions)
 *   - no module-local `*.config.ts` (env belongs to `src/config`)
 *   - no import of the retired `platform-common/errors` domain hierarchy
 *
 * Migrated-module rules:
 *   - the module root holds only `<capability>.module.ts`
 *   - top level is limited to inbound/, outbound/, http/, use-cases/, types/,
 *     services/
 *   - inbound/ and outbound/ hold ports/ and adapters/ only
 *   - use-cases/ files are `<verb>-<noun>.usecase.ts`
 *   - http/requests and http/responses hold `*.dto.ts`
 *   - no empty folders
 *   - inbound/adapters implements an inbound port, outbound/adapters implements
 *     an outbound port, use cases depend on ports only, and everything else
 *     that composes them is a service
 */

const MIGRATED = [
  'platform-common/idempotency',
  'platform-common/cache',
  'platform-common/locking',
  'platform-common/outbox',
];

/**
 * A class that exists in order to implement a port is an adapter, never a
 * service (standard §3). `services/` is for orchestration of use cases only.
 * These two predate the rule and must move to `outbound/adapters/` (or
 * `inbound/adapters/`) in the change that migrates their module — messaging in
 * Phase 2, events in Phase 3. The list may only shrink.
 */
const PENDING_PORT_SERVICES = [
  'platform-common/events/services/event-bus.service.ts',
  'platform-common/messaging/services/message-queue.service.ts',
];

const ALLOWED_TOP_LEVEL = new Set([
  'inbound',
  'outbound',
  'http',
  'use-cases',
  'types',
  'services',
  // Test layout (docs/testing-business-modules.md): api/, integrations/,
  // contracts/, components/, security/ live under this one folder.
  'specifications',
]);

const ALLOWED_PORT_DIRS = new Set(['ports', 'adapters']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function dirs(dir: string): string[] {
  return readdirSync(dir).filter(entry => statSync(join(dir, entry)).isDirectory());
}

function files(dir: string): string[] {
  return readdirSync(dir).filter(entry => !statSync(join(dir, entry)).isDirectory());
}

function platformFiles(): string[] {
  return walk(PLATFORM_ROOT);
}

/** Strips comments so a prose mention of `implements X` cannot trip the scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Type names exported by any `ports/` folder or `*.port.ts` file. */
function portTypeNames(files: string[]): Set<string> {
  const names = new Set<string>();
  const portFiles = files.filter(file => file.includes('/ports/') || file.endsWith('.port.ts'));
  const declaration = /export\s+(?:abstract\s+class|interface|type)\s+([A-Za-z0-9_]+)/g;
  for (const file of portFiles) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(declaration)) names.add(match[1]);
  }
  return names;
}

/** Types named in a class's `implements` clause, generics stripped. */
function implementedTypes(source: string): string[] {
  const clause = /implements\s+([^{]+)/.exec(stripComments(source));
  if (!clause) return [];
  return clause[1]
    .split(',')
    .map(part => part.replace(/<[\s\S]*$/, '').trim())
    .filter(Boolean);
}

const SOURCE_FILES = platformFiles().filter(file => file.endsWith('.ts'));

describe('platform shape — global rules', () => {
  it('has no errors/ folder and no *.errors.ts file', () => {
    const offenders = SOURCE_FILES.filter(file => {
      const rel = relative(PLATFORM_ROOT, file);
      return rel.includes('/errors/') || rel.startsWith('errors/') || rel.endsWith('.errors.ts');
    });
    expect(offenders).toEqual([]);
  });

  it('never imports the retired DomainException hierarchy', () => {
    const offenders = SOURCE_FILES.filter(file =>
      /platform-common\/errors|domain\.exception/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps configuration out of platform modules', () => {
    const offenders = SOURCE_FILES.filter(file => {
      const base = file.split('/').pop() ?? '';
      return base.endsWith('.config.ts') || base === 'configuration.ts';
    });
    expect(offenders).toEqual([]);
  });

  it('implements ports in adapters, never in services/', () => {
    const ports = portTypeNames(SOURCE_FILES);
    const offenders = SOURCE_FILES.filter(file => /\/services\//.test(file))
      .filter(file => implementedTypes(readFileSync(file, 'utf8')).some(type => ports.has(type)))
      .map(file => relative(PLATFORM_ROOT, file));

    expect(offenders.filter(file => !PENDING_PORT_SERVICES.includes(file))).toEqual([]);
    // The pending list may only shrink: every entry must still be a violation.
    expect(PENDING_PORT_SERVICES.filter(file => !offenders.includes(file))).toEqual([]);
  });

  it('names adapter files as adapters', () => {
    const offenders = SOURCE_FILES.filter(
      file => /\/(inbound|outbound)\/adapters\//.test(file) && file.endsWith('.service.ts'),
    );
    expect(offenders).toEqual([]);
  });
});

describe('platform shape — migrated modules', () => {
  it.each(MIGRATED)('%s conforms to the inbound/outbound anatomy', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const name = dir.split('/').pop() ?? '';
    expect(existsSync(dir)).toBe(true);

    // Root: only the module file.
    expect(files(dir)).toEqual([`${name}.module.ts`]);

    // Top level: known folders only.
    const topLevel = dirs(dir);
    expect(topLevel.filter(entry => !ALLOWED_TOP_LEVEL.has(entry))).toEqual([]);

    // Hexagon: ports and adapters only inside inbound/ and outbound/.
    for (const side of ['inbound', 'outbound']) {
      if (!topLevel.includes(side)) continue;
      const sideDir = join(dir, side);
      expect(dirs(sideDir).filter(entry => !ALLOWED_PORT_DIRS.has(entry))).toEqual([]);
      expect(files(sideDir)).toEqual([]);
    }

    // Naming: one use case per file, DTOs only under http/requests|responses.
    // Specs mirror their subject (`*.spec.ts`) and are exempt from the rule.
    const useCases = join(dir, 'use-cases');
    if (existsSync(useCases)) {
      expect(
        files(useCases).filter(
          entry => !entry.endsWith('.spec.ts') && !entry.endsWith('.usecase.ts'),
        ),
      ).toEqual([]);
    }
    for (const dtoDir of ['http/requests', 'http/responses']) {
      const full = join(dir, dtoDir);
      if (!existsSync(full)) continue;
      expect(
        files(full).filter(entry => !entry.endsWith('.spec.ts') && !entry.endsWith('.dto.ts')),
      ).toEqual([]);
    }

    // No empty folders — a folder exists only when it holds a file.
    const emptyDirs = walk(dir)
      .reduce<string[]>((acc, file) => {
        let current = join(file, '..');
        while (current.startsWith(dir)) {
          acc.push(current);
          current = join(current, '..');
        }
        return acc;
      }, [])
      .filter((value, index, all) => all.indexOf(value) === index)
      .filter(current => dirs(current).length === 0 && files(current).length === 0);
    expect(emptyDirs).toEqual([]);
  });
});

/** Port type names declared under `<module>/<side>/ports/`. */
function sidePortNames(moduleDir: string, side: string): Set<string> {
  const portDir = join(moduleDir, side, 'ports');
  if (!existsSync(portDir)) return new Set();
  return portTypeNames(files(portDir).map(entry => join(portDir, entry)));
}

/** Adapter files of one side, excluding specs. */
function sideAdapterFiles(moduleDir: string, side: string): string[] {
  const adapterDir = join(moduleDir, side, 'adapters');
  if (!existsSync(adapterDir)) return [];
  return files(adapterDir)
    .filter(entry => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'))
    .map(entry => join(adapterDir, entry));
}

describe('platform shape — ports and adapters (migrated modules)', () => {
  it.each(MIGRATED)('%s implements its inbound ports in inbound/adapters', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const ports = sidePortNames(dir, 'inbound');
    expect(ports.size).toBeGreaterThan(0);

    for (const file of sideAdapterFiles(dir, 'inbound')) {
      const implemented = implementedTypes(readFileSync(file, 'utf8'));
      expect({
        file: relative(PLATFORM_ROOT, file),
        ports: implemented.filter(t => ports.has(t)),
      }).not.toBeNull();
      expect(implemented.some(type => ports.has(type))).toBe(true);
    }
  });

  it.each(MIGRATED)('%s implements its outbound ports in outbound/adapters', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const ports = sidePortNames(dir, 'outbound');
    expect(ports.size).toBeGreaterThan(0);

    for (const file of sideAdapterFiles(dir, 'outbound')) {
      const implemented = implementedTypes(readFileSync(file, 'utf8'));
      expect(implemented.some(type => ports.has(type))).toBe(true);
    }
  });

  it.each(MIGRATED)('%s calls outbound ports from use cases, never adapters', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const useCaseDir = join(dir, 'use-cases');
    if (!existsSync(useCaseDir)) return;

    const offenders = files(useCaseDir)
      .filter(entry => entry.endsWith('.usecase.ts'))
      .filter(entry =>
        /from '(\.\.\/)+(inbound|outbound)\/adapters\//.test(
          readFileSync(join(useCaseDir, entry), 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it.each(MIGRATED)('%s keeps port implementations out of services/', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const servicesDir = join(dir, 'services');
    if (!existsSync(servicesDir)) return;

    const ports = new Set([...sidePortNames(dir, 'inbound'), ...sidePortNames(dir, 'outbound')]);
    const offenders = files(servicesDir)
      .filter(entry => entry.endsWith('.ts'))
      .filter(entry =>
        implementedTypes(readFileSync(join(servicesDir, entry), 'utf8')).some(type =>
          ports.has(type),
        ),
      );
    expect(offenders).toEqual([]);
  });
});

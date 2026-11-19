import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const PLATFORM_ROOT = join(ROOT, 'src', 'platform');

/**
 * Platform shape tests — enforce `docs/platform-standard.md`.
 *
 * Module anatomy (flattened — no inbound/outbound split):
 *   - the module root holds only `<capability>.module.ts`
 *   - top level is limited to ports/, adapters/, repositories/, http/,
 *     use-cases/, types/, services/
 *   - ports/ holds inbound port tokens (abstract classes)
 *   - adapters/ holds inbound adapters + non-repo outbound adapters
 *     (Redis, broker SDKs, EventEmitter2)
 *   - repositories/ holds Prisma repositories
 *   - use-cases/ files are `<verb>-<noun>.usecase.ts` with a single execute()
 *   - http/requests and http/responses hold `*.dto.ts`
 *   - no empty folders
 *
 * Global rules:
 *   - no `errors/` folder, no `*.errors.ts`
 *   - no module-local `*.config.ts`
 *   - no import of the retired `platform-common/errors` domain hierarchy
 */

const MIGRATED = [
  'platform-common/idempotency',
  'platform-common/cache',
  'platform-common/locking',
  'platform-common/outbox',
  'platform-common/messaging',
  'platform-common/events',
  'platform-common/inbox',
  'platform-common/saga',
  'platform-common/saga-inbox',
  'platform-common/saga-outbox',
  'platform-common/numbering',
  'platform-common/audit',
  'platform-common/health',
];

/**
 * A class that exists in order to implement a port is an adapter, never a
 * service (standard §3). `services/` is for orchestration of use cases only.
 */
const PENDING_PORT_SERVICES: string[] = [];

const ALLOWED_TOP_LEVEL = new Set([
  'ports',
  'adapters',
  'repositories',
  'http',
  'use-cases',
  'types',
  'services',
  // Test layout (docs/testing-business-modules.md): api/, integrations/,
  // contracts/, components/, security/ live under this one folder.
  'specifications',
]);

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
  // Standard §3: a port is an abstract class used as the DI token.
  const declaration = /export\s+abstract\s+class\s+([A-Za-z0-9_]+)/g;
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
    // Files under adapters/ that end with .service.ts are flagged only if they
    // do NOT implement any port — a class implementing a port is an adapter
    // regardless of its file name.
    const ports = portTypeNames(SOURCE_FILES);
    const offenders = SOURCE_FILES.filter(
      file =>
        /\/adapters\//.test(file) &&
        file.endsWith('.service.ts') &&
        !implementedTypes(readFileSync(file, 'utf8')).some(type => ports.has(type)),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * Use-case purity: a `*.usecase.ts` class may declare only one public method,
   * `execute()`. Any helper, sub-step or per-row dispatch belongs in a
   * `services/` class that the use case composes. This keeps every use case a
   * single, named operation — the unit controllers and services call.
   */
  it('use cases expose only execute() as their public method', () => {
    const useCaseFiles = SOURCE_FILES.filter(file => file.endsWith('.usecase.ts'));
    const offenders: string[] = [];

    for (const file of useCaseFiles) {
      const source = stripComments(readFileSync(file, 'utf8'));
      // Match method declarations with an access modifier or `async` that are
      // not `execute` and not `constructor`. Private/protected helpers are also
      // forbidden here — the rule is "one method, execute()", full stop.
      const methodPattern =
        /(?:^|\n)\s*(?:public|private|protected)\s+(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      for (const match of source.matchAll(methodPattern)) {
        const name = match[1];
        if (name !== 'execute' && name !== 'constructor') {
          offenders.push(`${relative(PLATFORM_ROOT, file)} → ${name}()`);
          break;
        }
      }
      // Also catch modifier-less method declarations (e.g. `async foo()` or
      // `foo():`) that are not `execute`/`constructor`.
      const barePattern =
        /(?:^|\n)\s*(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g;
      for (const match of source.matchAll(barePattern)) {
        const name = match[1];
        if (name === 'execute' || name === 'constructor') continue;
        // Skip control-flow keywords that look like calls.
        if (
          name === 'if' ||
          name === 'for' ||
          name === 'while' ||
          name === 'switch' ||
          name === 'catch' ||
          name === 'return' ||
          name === 'function'
        ) {
          continue;
        }
        // Skip calls like `this.foo(` — those are invocations, not declarations.
        const before = source.slice(Math.max(0, (match.index ?? 0) - 20), match.index);
        if (/this\.$/.test(before)) continue;
        offenders.push(`${relative(PLATFORM_ROOT, file)} → ${name}()`);
        break;
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('platform shape — migrated modules', () => {
  it.each(MIGRATED)('%s conforms to the flattened anatomy', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const name = dir.split('/').pop() ?? '';
    expect(existsSync(dir)).toBe(true);

    // Root: only the module file.
    expect(files(dir)).toEqual([`${name}.module.ts`]);

    // Top level: known folders only.
    const topLevel = dirs(dir);
    expect(topLevel.filter(entry => !ALLOWED_TOP_LEVEL.has(entry))).toEqual([]);
    expect(topLevel).not.toContain('inbound');
    expect(topLevel).not.toContain('outbound');

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

/** Port type names declared under `<module>/ports/`. */
function modulePortNames(moduleDir: string): Set<string> {
  const portDir = join(moduleDir, 'ports');
  if (!existsSync(portDir)) return new Set();
  return portTypeNames(files(portDir).map(entry => join(portDir, entry)));
}

/** Adapter files under `<module>/adapters/`, excluding specs. */
function moduleAdapterFiles(moduleDir: string): string[] {
  const adapterDir = join(moduleDir, 'adapters');
  if (!existsSync(adapterDir)) return [];
  return files(adapterDir)
    .filter(entry => entry.endsWith('.ts') && !entry.endsWith('.spec.ts'))
    .map(entry => join(adapterDir, entry));
}

describe('platform shape — ports and adapters (migrated modules)', () => {
  // Every declared inbound port has an adapter in adapters/ that implements it.
  // Driver adapters that implement no port (cron ticks, broker listener hosts)
  // are allowed: they live in adapters/ because they compose use cases.
  it.each(MIGRATED)('%s implements every port in adapters/', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const ports = modulePortNames(dir);
    if (ports.size === 0) return;

    const implemented = new Set(
      moduleAdapterFiles(dir).flatMap(file => implementedTypes(readFileSync(file, 'utf8'))),
    );
    expect([...ports].filter(port => !implemented.has(port))).toEqual([]);
  });

  // Use cases inject concrete repository/adapter classes directly (no outbound
  // port tokens). They may still import inbound ports from their own module's
  // ports/ directory (e.g. RequestContextPort) or from other modules' ports/.
  // TypeScript enforces that any imported symbol exists — deleted outbound port
  // tokens will fail tsc, so no separate architecture check is needed here.

  it.each(MIGRATED)('%s keeps port implementations out of services/', modulePath => {
    const dir = join(PLATFORM_ROOT, modulePath);
    const servicesDir = join(dir, 'services');
    if (!existsSync(servicesDir)) return;

    const ports = modulePortNames(dir);
    if (ports.size === 0) return;

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

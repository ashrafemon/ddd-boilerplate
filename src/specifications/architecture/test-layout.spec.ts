import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const SRC = join(ROOT, 'src');

/**
 * Test-layout tests — enforce `docs/testing-business-modules.md`.
 *
 * Unit specs live beside the file they test. Everything that needs a real
 * HTTP boot, real IO, a cross-module contract or generated inputs lives under
 * a `specifications/` folder, one folder per kind:
 *   api/          *.api-spec.ts
 *   integrations/ *.integration-spec.ts
 *   contracts/    *.contract.spec.ts
 *   components/   *.component-spec.ts
 *   security/     *.security.spec.ts
 *   properties/   *.property-spec.ts
 *
 * The project-level folder `src/specifications/` is the one exception: it holds
 * cross-cutting suites (architecture/), shared fakes (support/) and helpers
 * (utils/), so it is not part of any module.
 */

const KINDS = new Map([
  ['api', '.api-spec.ts'],
  ['integrations', '.integration-spec.ts'],
  ['contracts', '.contract.spec.ts'],
  ['components', '.component-spec.ts'],
  ['security', '.security.spec.ts'],
  ['properties', '.property-spec.ts'],
]);

const KIND_SUFFIXES = [...KINDS.values()];

/** Project-level specifications root and the folders it may hold. */
const PROJECT_SPECS = join(SRC, 'specifications');
const PROJECT_FOLDERS = new Set(['architecture', 'support', 'utils', 'data']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function allDirs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(full, ...allDirs(full));
  }
  return out;
}

const FILES = walk(SRC);
const MODULE_SPEC_DIRS = allDirs(SRC).filter(
  dir => dir.endsWith('/specifications') && dir !== PROJECT_SPECS,
);

function kindOf(file: string): { folder: string; suffix: string } | null {
  for (const [folder, suffix] of KINDS) {
    if (file.endsWith(suffix)) return { folder, suffix };
  }
  return null;
}

describe('test layout — project specifications', () => {
  it('holds only cross-cutting folders at src/specifications', () => {
    const offenders = readdirSync(PROJECT_SPECS)
      .filter(entry => !PROJECT_FOLDERS.has(entry))
      .map(entry => relative(ROOT, join(PROJECT_SPECS, entry)));
    expect(offenders).toEqual([]);
  });

  it('keeps shared fakes out of src proper', () => {
    const offenders = FILES.filter(
      file => !file.startsWith(PROJECT_SPECS) && /\.(fakes|stubs|doubles)\.ts$/.test(file),
    ).map(file => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});

describe('test layout — module specifications', () => {
  it('has at least one module specifications folder to police', () => {
    expect(MODULE_SPEC_DIRS.length).toBeGreaterThan(0);
  });

  it('only holds the six known kinds, as flat folders', () => {
    const offenders: string[] = [];
    for (const dir of MODULE_SPEC_DIRS) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const isKindFolder = statSync(full).isDirectory() && KINDS.has(entry);
        if (!isKindFolder) offenders.push(relative(ROOT, full));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('puts every out-of-process spec in its own kind folder', () => {
    const offenders = FILES.filter(file => {
      const kind = kindOf(file);
      if (!kind) return false;
      return !file.split('\\').join('/').includes(`/specifications/${kind.folder}/`);
    }).map(file => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('keeps unit specs beside the source, never inside specifications/', () => {
    const offenders = FILES.filter(
      file =>
        file.endsWith('.spec.ts') &&
        !kindOf(file) &&
        /\/specifications\//.test(file) &&
        !file.startsWith(PROJECT_SPECS),
    ).map(file => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('does not use __tests__ folders', () => {
    const offenders = allDirs(SRC)
      .filter(dir => dir.endsWith('/__tests__'))
      .map(dir => relative(ROOT, dir));
    expect(offenders).toEqual([]);
  });

  it('uses a recognised suffix for every spec file', () => {
    const offenders = FILES.filter(file => file.endsWith('.ts') && /-spec\.ts$/.test(file))
      .filter(file => !KIND_SUFFIXES.some(suffix => file.endsWith(suffix)))
      .map(file => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});

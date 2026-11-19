/**
 * Post-generation organizer for the Prisma client model files.
 *
 * `prisma generate` always writes the client flat into `src/generated`, with one
 * file per model: `src/generated/models/<Model>.ts`. The schema, however, is
 * authored folder-wise (`prisma/schema/<context>/*.prisma`). This script nests
 * each emitted model file under its owning schema context so the generated
 * client mirrors the schema layout:
 *
 *   prisma/schema/procurement/purchase-order.prisma
 *     -> src/generated/models/procurement/PurchaseOrder.ts
 *
 * Run it AFTER every `prisma generate` (`npm run db:generate` and `postinstall`
 * already do). It never hand-edits a model: it moves the emitted file, adjusts
 * its two relative imports (`enums.js`, `internal/prismaNamespace`) and rewrites
 * the `models.ts` barrel, so nothing else in the codebase changes.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

const ROOT = resolve(__dirname, '..');
const SCHEMA_DIR = join(ROOT, 'prisma', 'schema');
const MODELS_DIR = join(ROOT, 'src', 'generated', 'models');
const MODELS_BARREL = join(ROOT, 'src', 'generated', 'models.ts');

/** `<Model>` -> `<context folder>` derived from `prisma/schema/<context>/*.prisma`. */
function buildModelFolders(): Map<string, string> {
  const map = new Map<string, string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.prisma')) continue;

      const context = relative(SCHEMA_DIR, dir).split(/[\\/]/)[0];
      if (!context) continue;

      for (const match of readFileSync(full, 'utf8').matchAll(/^model\s+(\w+)/gm)) {
        map.set(match[1], context);
      }
    }
  };

  walk(SCHEMA_DIR);
  return map;
}

function rewriteImports(file: string): void {
  const src = readFileSync(file, 'utf8')
    .replace(/"\.\.\/enums\.js"/g, '"../../enums.js"')
    .replace(/"\.\.\/internal\/prismaNamespace\.js"/g, '"../../internal/prismaNamespace.js"')
    .replace(/"\.\.\/commonInputTypes\.js"/g, '"../../commonInputTypes.js"');

  writeFileSync(file, src);
}

function main(): void {
  if (!existsSync(MODELS_DIR)) {
    console.log('src/generated/models missing (client not generated yet) — skipping');
    return;
  }

  const folders = buildModelFolders();
  const moved: string[] = [];

  for (const entry of readdirSync(MODELS_DIR)) {
    if (!entry.endsWith('.ts')) continue;

    const model = entry.slice(0, -3);
    const context = folders.get(model);
    if (!context) continue;

    const targetDir = join(MODELS_DIR, context);
    mkdirSync(targetDir, { recursive: true });

    const dest = join(targetDir, entry);
    renameSync(join(MODELS_DIR, entry), dest);
    rewriteImports(dest);
    moved.push(model);
  }

  if (moved.length > 0) {
    const barrel = readFileSync(MODELS_BARREL, 'utf8').replace(
      /(export type \* from '\.\/models\/)([A-Za-z0-9]+)(\.js')/g,
      (_match, prefix: string, model: string, ext: string) => {
        const context = folders.get(model);
        return `${prefix}${context ? `${context}/` : ''}${model}${ext}`;
      },
    );
    writeFileSync(MODELS_BARREL, barrel);
  }

  if (moved.length === 0) {
    console.log('Prisma models already organized — nothing to do');
    return;
  }

  const contexts = [...new Set(moved.map(model => folders.get(model)))].sort();
  console.log(
    `Organized ${moved.length} Prisma models into src/generated/models/{${contexts.join(',')}}/`,
  );
}

main();

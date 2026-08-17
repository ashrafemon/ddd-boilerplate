/**
 * Barrel Sync Utility
 *
 * Syncs index.ts barrel files for a given directory structure.
 * Scans directories and auto-generates export statements for all .ts files.
 *
 * Usage:
 *   npx tsx scripts/generators/sync-barrels.ts [path]
 *   npx tsx scripts/generators/sync-barrels.ts src/business/catalog/product
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();

async function syncBarrel(dir: string, exclude: string[] = []): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    const entries = await readdir(dir);
    const files = entries
      .filter(f => f.endsWith('.ts') && !exclude.includes(f) && !f.endsWith('.spec.ts'))
      .sort();

    const lines = files.map(f => {
      const name = f.replace(/\.ts$/, '');
      if (name === 'index') return null;
      return `export * from './${name}';`;
    }).filter(Boolean);

    const content = lines.join('\n') + '\n';
    const indexPath = join(dir, 'index.ts');

    try {
      const existing = await readFile(indexPath, 'utf-8');
      if (existing.trim() === content.trim()) {
        skipped++;
      } else {
        await writeFile(indexPath, content, 'utf-8');
        updated++;
      }
    } catch {
      await writeFile(indexPath, content, 'utf-8');
      created++;
    }
  } catch {
    // Directory doesn't exist
  }

  return { created, updated, skipped };
}

async function syncAllBarrels(modulePath: string): Promise<void> {
  const barrelDirs = [
    join(modulePath, 'domain', 'entities'),
    join(modulePath, 'domain', 'value-objects'),
    join(modulePath, 'domain', 'events'),
    join(modulePath, 'domain', 'factories'),
    join(modulePath, 'domain', 'ports'),
    join(modulePath, 'application', 'usecase'),
    join(modulePath, 'application', 'consumers'),
    join(modulePath, 'application', 'adapters'),
    join(modulePath, 'application', 'ports'),
    join(modulePath, 'application', 'ports', 'outbound'),
    join(modulePath, 'infrastructure', 'persistence'),
    join(modulePath, 'presentation', 'http', 'controllers'),
    join(modulePath, 'presentation', 'http', 'request'),
  ];

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const dir of barrelDirs) {
    const result = await syncBarrel(dir);
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }

  console.log(`\n📦 Barrel sync complete for: ${modulePath}`);
  console.log(`   Created: ${totalCreated}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const targetPath = args[0] ? join(ROOT, args[0]) : join(ROOT, 'src/business');

  console.log(`\n🔍 Scanning: ${targetPath}`);

  try {
    const entries = await readdir(targetPath);
    const contextDirs = entries.filter(e => {
      const stat = await readdir(targetPath).catch(() => []);
      return stat.includes(e);
    });

    for (const context of entries) {
      const contextPath = join(targetPath, context);
      try {
        const modules = await readdir(contextPath);
        for (const module of modules) {
          const modulePath = join(contextPath, module);
          await syncAllBarrels(modulePath);
        }
      } catch {
        // Not a directory or can't read
      }
    }
  } catch (err) {
    console.error(`❌ Failed to scan ${targetPath}:`, err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Barrel sync failed:', err);
  process.exit(1);
});

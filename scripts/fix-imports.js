const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const allFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'coverage') continue;
      walk(full);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      allFiles.push(full);
    }
  }
})(SRC);

const rels = allFiles.map((file) => path.relative(SRC, file).replace(/\\/g, '/').replace(/\.ts$/, ''));

function resolveSpecifier(spec, fileDir) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const suffix = path.posix.normalize(spec).replace(/^(\.\/)+/, '').replace(/^(\.\.\/)+/, '');
  if (!suffix || suffix === '.' || suffix === '..') return null;

  const candidates = rels.filter((rel) => rel === suffix || rel.endsWith('/' + suffix));
  if (candidates.length === 0) return null;

  let chosen = candidates[0];
  if (candidates.length > 1) {
    const fileDirAbs = path.resolve(fileDir);
    const scorer = (rel) => {
      const abs = path.resolve(SRC, rel);
      const dir = path.dirname(abs);
      let score = 0;
      for (let i = 0; i < Math.min(fileDirAbs.split(path.sep).length, dir.split(path.sep).length); i++) {
        if (fileDirAbs.split(path.sep)[i] === dir.split(path.sep)[i]) score++;
        else break;
      }
      return score;
    };
    candidates.sort((a, b) => scorer(b) - scorer(a));
    chosen = candidates[0];
  }

  let rel = path.relative(fileDir, path.resolve(SRC, chosen)).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel.replace(/\.ts$/, '');
}

let changed = 0;

for (const file of allFiles) {
  const fileDir = path.dirname(file);
  const original = fs.readFileSync(file, 'utf8');
  let next = original.replace(/(from\s*['"])(\.\.?[^'"]*['"])/g, (whole, fromKw, specQuote) => {
    const spec = specQuote.slice(0, -1);
    const fixed = resolveSpecifier(spec, fileDir);
    return fixed ? fromKw + fixed + "'" : whole;
  });

  if (next !== original) {
    fs.writeFileSync(file, next);
    changed++;
  }
}

console.log(`Fixed imports in ${changed} files`);

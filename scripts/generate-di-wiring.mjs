/**
 * Generates docs/DI-WIRING.md — the NestJS dependency graph of this repo.
 *
 * Resolves real wiring: every @Module provider/controller/bootstrap class is located by its
 * source file; constructor dependencies are resolved through that file's own imports (alias
 * aware), so module-local tokens (each module's own CompanyConfigPort/NumberingPort) are
 * attributed correctly. Ownership = nearest enclosing *.module.ts directory; module class-name
 * collisions (infrastructure vs platform) get distinct node ids.
 *
 * Re-run after refactors: `npm run docs:di`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';

const SRC = 'src';
const OUT = 'docs/DI-WIRING.md';
const ALIASES = {
  '@config': 'src/config',
  '@shared-kernel': 'src/shared-kernel',
  '@bootstrap': 'src/bootstrap',
  '@infrastructure': 'src/infrastructure',
  '@platform': 'src/platform',
  '@business': 'src/business',
  '@prisma/client': 'src/generated/client.ts',
};
const EXTERNAL = new Set([
  'TransactionHost',
  'SchedulerRegistry',
  'ModuleRef',
  'EventEmitter2',
  'AmqpConnection',
  'FileStorageService',
  'Queue',
  'ClsService',
  'Reflector',
  'HttpService',
  'ConfigModule',
]);

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const walk = d =>
  readdirSync(d).flatMap(e => {
    const p = join(d, e);
    if (p.includes('generated')) return [];
    return statSync(p).isDirectory()
      ? walk(p)
      : p.endsWith('.ts') && !p.endsWith('.spec.ts')
        ? [p]
        : [];
  });

const files = walk(SRC);
const src = new Map(files.map(f => [f, strip(readFileSync(f, 'utf8'))]));
const defined = new Map();
for (const f of files)
  for (const m of src.get(f).matchAll(/export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g))
    (defined.get(m[1]) ?? defined.set(m[1], []).get(m[1])).push(f);

const tryTs = p =>
  src.has(p + '.ts')
    ? p + '.ts'
    : src.has(p)
      ? p
      : src.has(join(p, 'index.ts'))
        ? join(p, 'index.ts')
        : null;
const resolveSpec = (fromFile, spec) => {
  for (const [a, t] of Object.entries(ALIASES))
    if (spec === a || spec.startsWith(a + '/')) {
      const rest = spec.slice(a.length).replace(/^\//, '');
      return tryTs(rest ? posix.normalize(posix.join(t, rest)) : t);
    }
  if (spec.startsWith('.')) return tryTs(posix.normalize(posix.join(dirname(fromFile), spec)));
  return null;
};

const importsOf = new Map();
for (const f of files) {
  const map = new Map();
  for (const m of src
    .get(f)
    .matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolveSpec(f, m[2]);
    if (target)
      for (const n of m[1].split(','))
        map.set(
          n
            .trim()
            .split(/\s+as\s+/)
            .pop(),
          target,
        );
  }
  importsOf.set(f, map);
}

const bal = (s, i, o, c) => {
  let d = 0;
  for (; i < s.length; i++) {
    if (s[i] === o) d++;
    else if (s[i] === c && !--d) return i;
  }
  return -1;
};
const splitTop = body => {
  const out = [];
  let cur = '',
    d = 0;
  for (const ch of body) {
    if ('([{'.includes(ch)) d++;
    if (')]}'.includes(ch)) d--;
    if (ch === ',' && !d) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

const modules = [];
for (const f of files.filter(x => x.endsWith('.module.ts'))) {
  const text = src.get(f);
  const dm = text.match(/@Module\s*\(\s*\{/);
  const modName = text.match(/export class (\w+)/)?.[1];
  if (!modName) continue;
  let arg = '';
  if (dm) {
    const open = text.indexOf('{', dm.index);
    arg = text.slice(open + 1, bal(text, open, '{', '}'));
  }
  const arr = name => {
    const a = arg.match(new RegExp(`${name}:\\s*\\[`));
    if (!a) return [];
    const o = arg.indexOf('[', a.index);
    return splitTop(arg.slice(o + 1, bal(arg, o, '[', ']')));
  };
  const providers = [];
  for (const e of arr('providers')) {
    const obj = e.match(/provide:\s*([\w$]+)[\s\S]*?(useClass|useExisting):\s*([\w$]+)/);
    if (obj && !/forRoot|forFeature|forChild|register/.test(e))
      providers.push({ token: obj[1], impl: obj[3], kind: obj[2] });
    else if (/^[A-Z][\w$]*$/.test(e) && !e.endsWith('Module'))
      providers.push({ token: e, impl: e, kind: 'class' });
  }
  modules.push({
    file: f,
    dir: dirname(f),
    modName,
    imports: arr('imports').filter(x => /Module/.test(x)),
    controllers: arr('controllers').filter(x => /^[A-Z][\w$]*$/.test(x)),
    exports: arr('exports').filter(x => /^[A-Z][\w$]*$/.test(x)),
    providers,
    bootDeps: [],
  });
}

/* unique id + display label per module (CacheModule exists in infra AND platform) */
const dupCount = new Map();
for (const m of modules) dupCount.set(m.modName, (dupCount.get(m.modName) ?? 0) + 1);
for (const m of modules) {
  const tag = m.dir
    .split('/')
    .filter(s => !s.includes('module') && !['src', 'platform', 'business'].includes(s))
    .slice(0, 2)
    .join('/');
  m.id = dupCount.get(m.modName) > 1 ? `${m.modName}_${tag.replace(/\W/g, '_')}` : m.modName;
  m.display = dupCount.get(m.modName) > 1 ? `${m.modName} (${m.dir})` : m.modName;
}

const moduleOf = file => moduleByFile(file, m => file.startsWith(m.dir + '/') || file === m.file);
const moduleByFile = (file, match) =>
  modules.filter(match).sort((a, b) => b.dir.length - a.dir.length)[0];

const locate = (name, mod) => {
  const defs = defined.get(name) ?? [];
  if (!defs.length) return null;
  if (mod) {
    const inMod = defs.find(d => d.startsWith(mod.dir + '/') || d === mod.file);
    if (inMod) return inMod;
  }
  return defs.length === 1 ? defs[0] : defs[0];
};

const deps = (name, mod) => {
  const file = locate(name, mod);
  if (!file) return [];
  const text = src.get(file);
  const cm = new RegExp(`class\\s+${name}\\b[^{]*\\{`).exec(text);
  if (!cm) return [];
  const bodyStart = cm.index + cm[0].length;
  const cs = text.slice(bodyStart).match(/constructor\s*\(/);
  if (!cs) return [];
  const open = bodyStart + cs.index + cs[0].length - 1;
  const params = splitTop(text.slice(open + 1, bal(text, open, '(', ')')));
  const imps = importsOf.get(file);
  const out = [];
  for (let p of params) {
    const inj = p.match(/@Inject\(([\w$]+)\)/);
    p = p.replace(/@\w+(\([^)]*\))?\s*/g, '').trim();
    const colon = p.lastIndexOf(':');
    if (colon < 0) continue;
    let type = p
      .slice(colon + 1)
      .trim()
      .replace(/<.*$/, '')
      .replace(/\s*=.*$/, '')
      .replace(/\?\s*$/, '')
      .trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(type)) continue;
    if (inj && /^[A-Za-z_$][\w$]*$/.test(inj[1])) type = inj[1];
    out.push({ type, file: imps.get(type) ?? locate(type, mod) });
  }
  return out;
};

for (const m of modules) m.bootDeps = deps(m.modName, m).map(d => d.type);

/* cross-module token edges */
const ownerOfToken = t => {
  const f = defined.get(t)?.[0];
  const m = f && moduleOf(f);
  return m && /Module$/.test(m.modName) ? m : null;
};
const cross = new Map();
for (const m of modules) {
  for (const cls of [...new Set([...m.controllers, ...m.providers.map(p => p.impl)])]) {
    for (const { type, file } of deps(cls, m)) {
      if (!file || EXTERNAL.has(type)) continue;
      const owner = moduleOf(file);
      if (owner && owner.modName !== m.modName && /Module$/.test(owner.modName)) {
        const key = `${m.id}|${owner.id}`;
        (
          cross.get(key) ?? cross.set(key, { from: m, to: owner, toks: new Set() }).get(key)
        ).toks.add(type);
      }
    }
  }
}

/* ---------- safe-mermaid rendering ---------- */
/* Only constructs proven in mermaid docs: unquoted alphanumeric node ids,
   "quoted labels" in [...], plain pipe edge labels (ASCII). Never quoted
   node ids, never \n in labels, never [(cylinders)]. */
const BLOCKS = [];
function newGraph(dir) {
  const ids = new Map();
  const lines = [];
  let root = null;
  const nid = label => {
    if (ids.has(label)) return ids.get(label);
    let base =
      label
        .replace(/[^A-Za-z0-9_]/g, '_')
        .replace(/^_+/, '')
        .replace(/^(\d)/, 'n$1') || 'node';
    let id = base,
      i = 2;
    while ([...ids.values()].includes(id)) id = `${base}_${i++}`;
    ids.set(label, id);
    lines.push(`    ${id}["${label.replace(/"/g, String.fromCharCode(39))}"]`);
    return id;
  };
  const edge = (a, b, lbl) => {
    const ai = nid(a);
    const bi = nid(b);
    lines.push(
      `    ${ai} -->|${lbl
        .replace(/[^\w .,()/+-]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')}| ${bi}`,
    );
  };
  const dashed = (a, b, lbl) => {
    const ai = nid(a);
    const bi = nid(b);
    lines.push(`    ${ai} -.->|${lbl}| ${bi}`);
  };
  const render = () => {
    const body = ['flowchart LR', ...lines].join('\n');
    const block = '```mermaid\n' + body + '\n```';
    validate(block, dir);
    return block;
  };
  return { nid, edge, dashed, render };
}

function validate(block, where) {
  const body = block.replace(/```mermaid\n/, '').replace(/\n```$/, '');
  const problems = [];
  body
    .split('\n')
    .slice(1)
    .forEach((l, i) => {
      if (!l.trim()) return;
      if (/^\s*"/.test(l))
        problems.push(`quoted node id (line ${i + 2}): ${l.trim().slice(0, 60)}`);
      if (/\\n/.test(l)) problems.push(`literal \\n in label (line ${i + 2})`);
      if (/\[\(/.test(l)) problems.push(`cylinder shape (line ${i + 2})`);
      const lbl = l.match(/(?:-->|-\.->)\|([^|]*)\|/);
      if (lbl && !/^[\w .,()/+-]+$/.test(lbl[1]))
        problems.push(`unsafe edge label (line ${i + 2}): ${lbl[1]}`);
    });
  if (problems.length) {
    console.error(
      `\nMERMAID SYNTAX PROBLEMS in ${where}:\n` + problems.map(x => '  - ' + x).join('\n'),
    );
    process.exitCode = 1;
  }
}

const ownerTag = mod => mod.display.replace(/\s*\(.*\)$/, '');
let out = `# DI Wiring — who injects whom, which token binds to which implementation

**Generated** by \`scripts/generate-di-wiring.mjs\` (\`npm run docs:di\`) from real source:
\`@Module\` provider bindings + every constructor, with each dependency resolved through the
consuming file's own imports — so module-local tokens (each module's own \`CompanyConfigPort\` /
\`NumberingPort\`) are attributed to the right module, and only genuinely cross-boundary edges
appear. Blocks are validated for mermaid-safe syntax at generation time.

- solid \`-->|injects|\` — constructor dependency
- dashed \`-.->\` — Nest binding declared in the module (\`useClass\` / \`useExisting\`)
- \`TransactionHost / Queue / AmqpConnection …\` — library providers (write TX host, BullMQ, brokers)
- \`injects via OwnerModule\` — the token is provided by a DIFFERENT module (cross-boundary)
- \`XModule bootstrap\` — what the module class injects to register opt-in handlers

---

## Cross-module graph (Nest imports + token ownership)

`;
{
  const g = newGraph('cross-module graph');
  for (const { from, to, toks } of cross.values())
    g.edge(g.nid(from.display), g.nid(to.display), [...toks].join(', '));
  out += g.render() + '\n\n---\n\n## Per-module wiring\n\n';
}

const groups = [
  [
    'Business — catalog/product',
    m => m.file.startsWith('src/business/catalog') && m.file.includes('product/'),
  ],
  [
    'Business — party/vendor',
    m => m.file.startsWith('src/business/party') && m.file.includes('vendor/'),
  ],
  [
    'Business — procurement',
    m =>
      m.file.startsWith('src/business/procurement') &&
      /(purchase-order|good-receipt-note)\//.test(m.file),
  ],
  [
    'Business — sales/invoice',
    m => m.file.startsWith('src/business/sales') && m.file.includes('invoice/'),
  ],
  [
    'Platform — core (outbox · events · messaging · context · database)',
    m => /src\/platform\/(outbox|events|messaging|context|database)\//.test(m.file),
  ],
  [
    'Platform — capabilities (configuration · audit · numbering · notification · cache · storage · observability)',
    m =>
      /src\/platform\/(configuration|audit|numbering|notification|cache|storage|observability)\//.test(
        m.file,
      ),
  ],
  [
    'Platform — services (scheduler · recurring · condition-engine · batch-operation · import)',
    m =>
      /src\/platform\/(scheduler|recurring|condition-engine|batch-operation|import)\//.test(m.file),
  ],
  [
    'Composition-only modules',
    m =>
      /business\.module\.ts$|\/(catalog|party|procurement|sales)\.module\.ts$|app\.module\.ts$/.test(
        m.file,
      ),
  ],
];

for (const [g, pred] of groups) {
  const mods = modules.filter(pred);
  if (!mods.length) continue;
  out += `### ${g}\n\n`;
  for (const mod of mods) {
    out += `#### ${mod.display} — \`${relative('', mod.file)}\`\n\n`;
    out += `imports: ${mod.imports.join(', ') || '—'} · exports: ${mod.exports.join(', ') || '—'}\n\n`;
    if (!mod.providers.length && !mod.controllers.length) {
      out += '_Composition only._\n\n';
      continue;
    }
    const graph = newGraph(mod.modName);
    for (const p of mod.providers) if (p.kind !== 'class') graph.dashed(p.token, p.impl, p.kind);
    for (const cls of [...mod.controllers, ...mod.providers.map(p => p.impl)]) {
      for (const { type, file } of deps(cls, mod)) {
        const owner = file && !EXTERNAL.has(type) ? moduleOf(file) : null;
        const crossM = owner && owner.modName !== mod.modName && /Module$/.test(owner.modName);
        graph.edge(
          cls,
          EXTERNAL.has(type) ? `${type} (library)` : type,
          crossM ? `injects via ${ownerTag(owner)}` : 'injects',
        );
      }
    }
    for (const d of mod.bootDeps) graph.edge(`${mod.modName} bootstrap`, d, 'registers or injects');
    out += graph.render() + '\n\n';
  }
}

out += `> Companion: [\`docs/FLOWCHARTS.md\`](FLOWCHARTS.md) — the runtime flows these wires power.
> \`TransactionHost\` = CLS-backed transactional Prisma client (write side);
> \`PrismaReadPort\` is bound in \`DatabaseModule\` to \`PrismaReadService\` (read replica).
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(
  process.exitCode ? 'wrote ' + OUT + '  (WITH VALIDATION ERRORS — fixed above)' : 'wrote',
  OUT,
);

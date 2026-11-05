const fs = require('fs');
const path = require('path');
// find all port names in purchase-order module
const portFiles = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p = path.join(dir,e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.port.ts')) portFiles.push(p);
  }
}
walk('src/business/procurement/purchase-order');
// map port class name -> impl files
const implMap = {};
for (const pf of portFiles) {
  const txt = fs.readFileSync(pf,'utf8');
  const m = txt.match(/export abstract class (\w+)/);
  if (!m) continue;
  const portName = m[1];
  // search all src for implements/extends portName
  const impls = [];
  function search(d) {
    for (const e of fs.readdirSync(d,{withFileTypes:true})) {
      const p = path.join(d,e.name);
      if (e.isDirectory()) { if (!['node_modules','dist','.git'].includes(e.name)) search(p); }
      else if (e.name.endsWith('.ts')) {
        const t = fs.readFileSync(p,'utf8');
        const re = new RegExp(`(class\\s+\\w+[^{]*?(implements|extends)\\s+[^\\n]*\\b${portName}\\b)`, 'g');
        if (re.test(t)) {
          // extract class name
          const cm = t.match(new RegExp(`class\\s+(\\w+)[^{]*?(implements|extends)[^\\n]*\\b${portName}\\b`));
          impls.push({ cls: cm?cm[1]:path.basename(p), loc: p.replace(/\\/g,'/') });
        }
      }
    }
  }
  search('src');
  implMap[portName] = impls;
}
console.log(JSON.stringify(implMap, null, 2));

// Import boundaries between the two entries (DOCS/PLAN/09-FRONTEND.md §3):
// - src/exam may import only src/shared (and itself);
// - src/shared may import neither entry, nor the panel's heavy libraries.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'src');
const heavyForShared = ['@tiptap', 'mathlive', 'recharts', '@tanstack/react-table'];
const rules = {
  exam: (target) => target.startsWith('exam/') || target.startsWith('shared/'),
  shared: (target) => target.startsWith('shared/'),
};

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

const problems = [];
for (const area of Object.keys(rules)) {
  for (const file of files(join(root, area))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2];
      let target = null;
      if (spec.startsWith('@/')) target = spec.slice(2);
      else if (spec.startsWith('.')) target = relative(root, resolve(dirname(file), spec));
      if (target !== null && !rules[area](target)) problems.push(`${relative(root, file)} imports ${spec}`);
      if (area === 'shared' && heavyForShared.some((h) => spec.startsWith(h))) problems.push(`${relative(root, file)} imports heavy ${spec}`);
    }
  }
}

if (problems.length) {
  console.error('Import boundary violations:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('import boundaries ok');

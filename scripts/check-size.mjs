// Bundle budget (DOCS/PLAN/09-FRONTEND.md §3): the exam entry's initial JavaScript must stay
// small for weak lab PCs. Lazily loaded chunks (KaTeX) are reported but not counted.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = { exam: 200 * 1024 };
const dist = resolve(import.meta.dirname, '..', 'dist');
let failed = false;

for (const [entry, budget] of Object.entries(BUDGET)) {
  const dir = [join(dist, entry), join(dist, 'all')].find((d) => existsSync(join(d, entry, 'index.html')));
  if (!dir) {
    console.error(`no build of ${entry}: run "npm run build:${entry}" first`);
    process.exit(1);
  }
  const html = readFileSync(join(dir, entry, 'index.html'), 'utf8');
  const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  let total = 0;
  for (const f of initial) total += gzipSync(readFileSync(join(dir, f))).length;
  const lazy = readdirSync(join(dir, 'assets')).filter((f) => f.endsWith('.js') && !initial.includes(`assets/${f}`));
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(`${entry}: initial JS ${kb(total)} gzip (budget ${kb(budget)}); lazy chunks: ${lazy.join(', ') || 'none'}`);
  if (total > budget) {
    console.error(`  over budget by ${kb(total - budget)}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);

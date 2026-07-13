import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(repo, '..');
const canonical = join(repo, 'contracts', 'v1');
const consumers = ['tardis', 'tardis-edge', 'tardis-embed', 'tardis-admin'];
const files = [
  'key-record.valid.json',
  'resolution.object.valid.json',
  'resolution.surface.valid.json',
  'analytics-event.valid.json',
  'key-record.invalid-bare-origin.json',
  'resolution.object.invalid-no-assets.json',
  'resolution.surface.invalid-default.json',
  'analytics-event.invalid-type.json',
];

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const failures = [];
for (const file of files) {
  const expected = digest(join(canonical, file));
  for (const consumer of consumers) {
    const path = join(workspace, consumer, 'contracts', 'v1', file);
    let actual;
    try {
      actual = digest(path);
    } catch {
      failures.push(`${consumer}: missing contracts/v1/${file}`);
      continue;
    }
    if (actual !== expected) failures.push(`${consumer}: drifted contracts/v1/${file}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Verified ${files.length} contract fixtures across ${consumers.length} repositories.`,
);

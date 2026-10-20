// Keeps the standard consistent: every fixture has a golden for every viewport, vectors are well formed, every screen
// validates against the schema, the mock API behaves as documented, and nothing private is in the repository.
import Ajv from 'ajv';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORTS = ['375x812', '768x1024'];
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const jsonFiles = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).sort();
const walk = (dir) => readdirSync(dir).flatMap((n) => (n === 'node_modules' || n === '.git' ? [] : statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

function nodeIds(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => nodeIds(n, out));
  else if (node && typeof node === 'object') {
    if (node.type === 'stack' && typeof node.id === 'string') out.push(node.id);
    // Only the default tab is mounted, so only its stacks are in the golden.
    if (node.type === 'tabs') nodeIds([node.control, node.tabs[0]], out);
    else Object.values(node).forEach((v) => nodeIds(v, out));
  }
  return out;
}

const validate = new Ajv({ strict: false }).compile(readJson(join(root, 'schema', 'paywall.schema.json')));
const assertValid = (label, screen) => assert.ok(validate(screen), `${label}: ${JSON.stringify(validate.errors?.[0])}`);

for (const group of ['layout', 'components']) {
  test(`${group}: every fixture has a complete golden and is a valid screen`, () => {
    const fixtures = jsonFiles(`fixtures/${group}`);
    assert.ok(fixtures.length > 0);
    assert.deepEqual(jsonFiles(`golden/${group}`), fixtures, 'fixtures and goldens differ');
    for (const file of fixtures) {
      const fixture = readJson(join(root, 'fixtures', group, file));
      assert.equal(typeof fixture.description, 'string', `${file}: description`);
      assertValid(`${group}/${file}`, fixture.paywall);
      const ids = nodeIds(fixture.paywall.components_config.base.stack);
      assert.equal(new Set(ids).size, ids.length, `${file}: duplicate node ids`);
      const golden = readJson(join(root, 'golden', group, file));
      assert.deepEqual(Object.keys(golden.viewports).sort(), [...VIEWPORTS].sort(), `${file}: viewports`);
      for (const viewport of VIEWPORTS) {
        const nodes = golden.viewports[viewport].nodes;
        for (const id of ids) assert.ok(nodes[id], `${file}@${viewport}: node ${id} missing from golden`);
      }
    }
  });
}

test('icons: every icon has a frame', () => {
  const icons = readJson(join(root, 'fixtures/icons/icons.json'));
  const frames = readJson(join(root, 'golden/icons/icons.json'));
  assert.deepEqual(Object.keys(frames).sort(), Object.keys(icons).sort());
  for (const svg of Object.values(icons)) assert.match(svg, /^<svg /);
});

test('vectors are well formed', () => {
  const files = jsonFiles('vectors');
  assert.ok(files.length > 0);
  for (const file of files) {
    const vectors = readJson(join(root, 'vectors', file));
    assert.equal(typeof vectors.source, 'string', `${file}: source`);
    assert.ok(Array.isArray(vectors.cases) && vectors.cases.length > 0, `${file}: cases`);
    for (const c of vectors.cases) assert.ok('input' in c && 'expected' in c, `${file}: case shape`);
  }
});

test('schema: rejects a screen that is not one', () => {
  assert.equal(validate({}), false);
  assert.equal(validate({ id: 'x', default_locale: 'en_US', components_localizations: {} }), false);
  // A real fixture with one value that no renderer accepts.
  const [name] = jsonFiles('fixtures/layout');
  const screen = readJson(join(root, 'fixtures/layout', name)).paywall;
  const broken = JSON.parse(JSON.stringify(screen));
  broken.components_config.base.stack.dimension = { type: 'horizontal', alignment: 'bogus', distribution: 'start' };
  assert.equal(validate(screen), true);
  assert.equal(validate(broken), false);
});

test('mock API screens are valid screens', () => {
  const placements = readJson(join(root, 'mock-api/ui/placements.json'));
  for (const [name, p] of Object.entries(placements)) assertValid(`placement ${name}`, p.paywall);
  const paywalls = readJson(join(root, 'mock-api/ui/paywalls.json'));
  for (const [id, p] of Object.entries(paywalls)) assertValid(`screen ${id}`, p.paywall ?? p);
});

test('mock API serves placements, screens, events and an offline switch', async () => {
  const child = spawn(process.execPath, [join(root, 'mock-api/server.cjs'), '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    const port = await new Promise((resolve, reject) => {
      child.stdout.on('data', (d) => { const m = /:(\d+)/.exec(String(d)); if (m) resolve(Number(m[1])); });
      child.on('exit', (code) => reject(new Error(`mock API exited early (${code})`)));
    });
    const base = `http://127.0.0.1:${port}`;
    const placement = await (await fetch(`${base}/v1/sdk/placements/onboarding`)).json();
    assert.equal(placement.placement, 'onboarding');
    assert.equal((await fetch(`${base}/v1/sdk/placements/nope`)).status, 404);
    const screen = await fetch(`${base}/v1/sdk/paywalls/flow_done`);
    assert.equal(screen.status, 200);
    await fetch(`${base}/v1/sdk/events`, { method: 'POST', body: JSON.stringify({ events: [{ type: 'view' }] }) });
    assert.deepEqual(await (await fetch(`${base}/__admin/events`)).json(), [{ type: 'view' }]);
    assert.deepEqual(await (await fetch(`${base}/__admin/offline?on=1`)).json(), { offline: true });
    await assert.rejects(fetch(`${base}/v1/sdk/placements/onboarding`));
  } finally {
    child.kill();
  }
});

test('the published templates are a small set and valid screens', () => {
  const names = jsonFiles('fixtures/templates');
  assert.ok(names.length >= 1 && names.length <= 12, `expected a small set of templates, found ${names.length}`);
  for (const file of names) {
    const template = readJson(join(root, 'fixtures/templates', file));
    assertValid(`templates/${file}`, template.paywall ?? template);
  }
});

test('nothing private is in the repository', () => {
  const FORBIDDEN_TEXT = /packages\/ui-sdk|apps\/(dashboard|api|web)|sdks\/|\.svelte\b|\bs_[a-z-]+\.d\.ts|sourceMappingURL|sk_(live|test)_|SUPABASE|POLAR_/;
  const problems = [];
  for (const file of walk(root)) {
    const rel = relative(root, file);
    if (/(^|\/)templates(\/|$)/.test(rel) && !/^fixtures\/templates\/[a-z-]+\.json$/.test(rel)) problems.push(`${rel}: only fixtures/templates/*.json is allowed`);
    if (statSync(file).size > 1_000_000) problems.push(`${rel}: larger than 1 MB`);
    if (rel === 'tests/spec.test.mjs' || rel === 'package-lock.json') continue;
    if (!/\.(json|md|mjs|js|yml)$/.test(rel)) continue;
    if (FORBIDDEN_TEXT.test(readFileSync(file, 'utf8'))) problems.push(`${rel}: mentions something private`);
  }
  assert.deepEqual(problems, []);
  assert.ok(existsSync(join(root, 'LICENSE')));
});

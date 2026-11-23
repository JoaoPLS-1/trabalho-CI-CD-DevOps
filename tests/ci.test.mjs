import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkLinks } from '../scripts/ci/check-links.mjs';

const guard = fileURLToPath(new URL('../scripts/ci/check-files.sh', import.meta.url));
const bash = process.platform === 'win32'
  ? join(dirname(dirname(execFileSync('where.exe', ['git'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0])), 'bin', 'bash.exe')
  : 'bash';

function fixture(t, html = '<!doctype html><html><body><h1 id="inicio">Pagina</h1></body></html>') {
  const root = mkdtempSync(join(tmpdir(), 'devops-ci-'));
  t.after(() => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '/') || resolve(root).startsWith(resolve(tmpdir()) + '\\'));
    rmSync(root, { recursive: true, force: true });
  });
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  writeFileSync(join(root, 'index.html'), html);
  execFileSync('git', ['add', '.'], { cwd: root });
  return root;
}

function runGuard(root, check) {
  const result = spawnSync(bash, [guard.replaceAll('\\', '/'), check], { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.notEqual(result.status, null, result.stderr);
  return result.status;
}

test('aprova index.html na raiz', (t) => {
  assert.equal(runGuard(fixture(t), 'index'), 0);
});

for (const name of ['home.html', 'index-teste.html']) {
  test(`reprova index renomeado para ${name}`, (t) => {
    const root = fixture(t);
    renameSync(join(root, 'index.html'), join(root, name));
    assert.notEqual(runGuard(root, 'index'), 0);
  });
}

test('limite exato de 500 KB e arquivo com espacos em subpasta', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'assets'));
  const file = join(root, 'assets', 'arquivo grande.bin');
  writeFileSync(file, Buffer.alloc(500000));
  assert.equal(runGuard(root, 'size'), 0);
  writeFileSync(file, Buffer.alloc(500001));
  assert.notEqual(runGuard(root, 'size'), 0);
});

test('metadados Git e dependencias ficam fora do limite de tamanho', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'node_modules', 'dependencia.bin'), Buffer.alloc(500001));
  writeFileSync(join(root, '.git', 'metadata.bin'), Buffer.alloc(500001));
  assert.equal(runGuard(root, 'size'), 0);
});

for (const term of ['TO' + 'DO', 'FIX' + 'ME', 'sen' + 'ha', 'pass' + 'word']) {
  test('reprova marcador bloqueado sem distinguir maiusculas', (t) => {
    const root = fixture(t);
    writeFileSync(join(root, 'index.html'), `<!-- ${term.toLowerCase()} -->`);
    assert.notEqual(runGuard(root, 'text'), 0);
  });
}

test('aprova texto limpo e reprova termo em arquivo fora do HTML', (t) => {
  const root = fixture(t);
  assert.equal(runGuard(root, 'text'), 0);
  writeFileSync(join(root, 'config.txt'), 'PASS' + 'WORD=exemplo');
  execFileSync('git', ['add', '.'], { cwd: root });
  assert.notEqual(runGuard(root, 'text'), 0);
});

test('valida caminhos relativos, absolutos, imagens, CSS e ancora', async (t) => {
  const root = fixture(t, '<html><head><link rel="stylesheet" href="/style.css"></head><body><h1 id="inicio">Pagina</h1><a href="#inicio">Inicio</a><img src="foto.svg"><a href="sub/pagina.html">Outra</a></body></html>');
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'sub', 'pagina.html'), '<html><body><a href="../index.html">Inicio</a></body></html>');
  writeFileSync(join(root, 'style.css'), 'body { color: black; }');
  writeFileSync(join(root, 'foto.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  execFileSync('git', ['add', '.'], { cwd: root });
  assert.equal((await checkLinks(root)).passed, true);
});

for (const markup of [
  '<a href="ausente.html">Link</a>',
  '<img src="ausente.png">',
  '<link rel="stylesheet" href="ausente.css">',
  '<a href="#inexistente">Ancora</a>',
  '<a href="http://[invalido">URL</a>',
  '<img src="foto.svg" srcset="ausente.svg 2x">',
]) {
  test('reprova referencia quebrada em pagina sem navegacao ate ela', async (t) => {
    const root = fixture(t);
    writeFileSync(join(root, 'isolada.html'), `<html><head></head><body>${markup}</body></html>`);
    writeFileSync(join(root, 'foto.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.equal((await checkLinks(root)).passed, false);
  });
}

test('valida URL externa e reprova HTTP 404 e 403', async (t) => {
  const server = createServer((req, res) => {
    res.writeHead(req.url === '/ok' ? 200 : req.url === '/negado' ? 403 : 404);
    res.end('Resposta');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise((done) => { server.close(done); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [path, passed] of [['/ok', true], ['/ausente', false], ['/negado', false]]) {
    const root = fixture(t, `<html><body><a href="${origin}${path}">Externo</a></body></html>`);
    assert.equal((await checkLinks(root)).passed, passed);
  }
});

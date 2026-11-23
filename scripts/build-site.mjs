import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const extensions = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.svg', '.png', '.jpg', '.jpeg',
  '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf',
  '.mp4', '.webm', '.mp3', '.ogg', '.pdf', '.txt', '.xml', '.webmanifest',
]);

export function buildSite(root = process.cwd()) {
  root = resolve(root);
  const index = join(root, 'index.html');
  if (!existsSync(index) || !lstatSync(index).isFile()) {
    throw new Error('index.html deve existir na raiz como arquivo regular.');
  }
  const output = join(root, '_site');
  // Uma pasta nova evita misturar arquivos antigos com o artefato aprovado.
  mkdirSync(output);
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  let copied = 0;
  for (const file of files) {
    const parts = file.split('/');
    if (parts.some((part) => part.startsWith('.'))) continue;
    if (['scripts', 'tests', 'docs', 'node_modules', '_site'].includes(parts[0])) continue;
    if (['package.json', 'package-lock.json'].includes(file)) continue;
    if (!extensions.has(extname(file).toLowerCase())) continue;
    const source = join(root, file);
    if (!lstatSync(source).isFile()) throw new Error('Arquivo de publicacao irregular: ' + file);
    const target = join(output, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    copied++;
  }
  if (!existsSync(join(output, 'index.html'))) throw new Error('index.html precisa estar versionado.');
  writeFileSync(join(output, '.nojekyll'), '');
  return { output, copied };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = buildSite();
    console.log(`Site preparado em ${result.output}: ${result.copied} arquivos.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LinkChecker, LinkState } from 'linkinator';

export async function checkLinks(root = process.cwd()) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((file) => /\.html$/i.test(file));
  if (files.length === 0) throw new Error('Nenhum HTML versionado para verificar.');
  const checker = new LinkChecker();
  const result = await checker.check({
    path: files,
    serverRoot: resolve(root),
    recurse: false,
    checkFragments: true,
    checkCss: true,
    timeout: 15000,
    concurrency: 10,
    // Respostas de acesso negado tambem devem reprovar.
    statusCodes: { '403': 'error', '999': 'error' },
  });
  for (const link of result.links.filter((item) => item.state === LinkState.BROKEN)) {
    console.error('Link invalido:', link.url, 'Origem:', link.parent ?? '(pagina inicial)');
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await checkLinks();
    console.log(`Verificacao de links: ${result.passed ? 'aprovada' : 'reprovada'}.`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

# Trabalho CI/CD — DevOps

[![CI](https://github.com/JoaoPLS-1/trabalho-CI-CD-DevOps/actions/workflows/ci.yml/badge.svg?event=pull_request)](https://github.com/JoaoPLS-1/trabalho-CI-CD-DevOps/actions/workflows/ci.yml)
[![CD - GitHub Pages](https://github.com/JoaoPLS-1/trabalho-CI-CD-DevOps/actions/workflows/cd.yml/badge.svg?branch=main&event=push)](https://github.com/JoaoPLS-1/trabalho-CI-CD-DevOps/actions/workflows/cd.yml)

## Etapa 1: integração contínua

Validar Pull Requests para `main` e bloquear o merge quando a validação falhar.

- `index.html`: página inicial na raiz, exigida pelo GitHub Pages.
- `package.json` e `package-lock.json`: linter e instalação reproduzível.
- `.htmlvalidate.json`: regras recomendadas do HTML-Validate.
- `.htmlvalidateignore`: exclui dependências da validação.
- `.github/workflows/ci.yml`: pipeline de integração contínua.

## Executar localmente

Use Node.js 24 (ou Node.js 22.16+).

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
```

## Pipeline

O único evento é `pull_request`, com destino à branch `main`.
O job `Validar HTML` usa um runner `ubuntu-latest` e executa, em ordem:

1. Baixar o código com `actions/checkout`.
2. Verificar `index.html` na raiz; encerrar com erro se faltar.
3. Preparar Node.js 24 com `actions/setup-node`.
4. Instalar dependências com `npm ci`, usando o lockfile versionado.
5. Executar `npm run lint` em cada arquivo HTML do projeto.

A verificação de existência ocorre imediatamente após o checkout, necessário
para acessar os arquivos, antes de preparar Node.js ou instalar dependências.
O workflow possui apenas permissão de leitura do conteúdo do repositório.

## Proteção da main

Configuração já aplicada no GitHub, separadamente do arquivo YAML:

- Pull Request obrigatório para alterar a `main`.
- Check `Validar HTML` obrigatório para permitir o merge.
- Branch atualizada em relação à `main` antes do merge.
- Regras também aplicadas aos administradores.
- Force push e exclusão da branch bloqueados.

Não há exigência de aprovação por outro revisor nesta etapa.
Confira em **Settings → Branches → main → Edit**.

## Fluxo de trabalho

```sh
git switch main
git pull --ff-only
git switch -c feat/minha-alteracao
# Edite os arquivos e valide com npm run lint.
git add <arquivos-alterados>
git commit -m "feat: descreve a alteracao"
git push -u origin feat/minha-alteracao
```

Abra um Pull Request para `main` e aguarde o check `Validar HTML`.
Se falhar, corrija os arquivos e envie outro commit na mesma branch.
O novo commit dispara novamente a pipeline.

## Demonstrar os bloqueios

Em branches de teste separadas, abra PRs para `main`:

| Cenário | Resultado esperado |
| --- | --- |
| HTML válido com `index.html` na raiz | CI aprovada |
| Remover `index.html` | Primeiro step após checkout falha; instalação não executa |
| Inserir `<img>` sem `src` e `alt` | Linter falha e merge fica bloqueado |
| Corrigir o erro e enviar outro commit | CI executa novamente e libera merge quando aprovada |

Feche os PRs com erros sem fazer merge. Guarde capturas da execução e do bloqueio
para comprovar a atividade.

## Validação e escopo

Verificado localmente: instalação com `npm ci`, HTML válido aprovado, HTML inválido
rejeitado e step de existência aprovado/reprovado conforme a presença do arquivo.
A execução real da pipeline pode ser acompanhada na aba **Actions** e no PR.

Esta entrega cobre as Etapas 1 e 2: validação de PRs e publicação automática.

## Referências

- [HTML-Validate: CLI](https://html-validate.org/usage/cli.html)
- [GitHub: proteção de branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## Novos critérios obrigatórios da CI

Depois do checkout, a primeira verificação exige um arquivo regular
`index.html` na raiz. Renomeá-lo para `home.html` ou `index-teste.html`
reprova imediatamente, antes de instalar dependências.

Em seguida, a CI verifica tamanho e termos bloqueados. Depois da instalação,
executa o linter, a validação de links e a suíte de testes. Todas essas etapas
integram o check obrigatório `Validar HTML`; qualquer falha bloqueia o merge.

### Tamanho

O limite é decimal: 500 KB = 500.000 bytes. O comando GNU
`find ... -size +500000c` rejeita cada arquivo acima desse limite, inclusive
em subpastas e com espaços no nome. Exatamente 500.000 bytes são permitidos.
Metadados `.git` e dependências `node_modules` ficam fora dessa verificação.

### Texto

A varredura com `git grep` verifica os arquivos de texto versionados,
incluindo documentação e configuração, sem distinguir maiúsculas de minúsculas.
Os quatro termos do enunciado são bloqueados inclusive em comentários e
dentro de expressões maiores. Binários são ignorados.
A saída lista apenas os arquivos reprovados, sem imprimir conteúdo sensível.
A definição dos termos no script e nos testes usa partes concatenadas para
evitar que a regra reprove a própria implementação.

### Links e imagens

O Linkinator verifica todas as páginas HTML versionadas, inclusive páginas
sem links de navegação apontando para elas. Um servidor temporário local
permite validar caminhos relativos, caminhos a partir da raiz, imagens,
folhas de estilo, âncoras e referências de imagem em `srcset`.

URLs HTTP/HTTPS externas são consultadas. URLs inválidas, caminhos inexistentes,
erros HTTP e falhas de rede reprovam; respostas 403 também reprovam.
O limite por requisição é 15 segundos. Links externos precisam estar acessíveis
ao runner no momento da execução. E-mail e telefone seguem o tratamento
padrão do Linkinator para URLs de ação.

### Executar todas as verificações

Use Node.js 24 e Bash com GNU find e Git. No Windows, use Git Bash.
Adicione arquivos novos com `git add` antes de validar: a varredura de texto e
a descoberta de páginas usam os arquivos versionados.

```sh
npm ci --ignore-scripts --no-audit --no-fund
bash scripts/ci/check-files.sh all
npm run lint
npm run check:links
npm test
```

### Testes automatizados

Os 18 testes em `tests/ci.test.mjs` cobrem renomeação da página inicial,
limite exato e excesso de tamanho, os quatro termos bloqueados,
texto fora do HTML, referências relativas e absolutas, imagens e CSS,
âncoras inexistentes, páginas isoladas, URLs inválidas, `srcset`
e respostas HTTP 404 e 403.

O check obrigatório impede integrar código reprovado à branch principal.
A publicação após o merge é descrita na Etapa 2.

Referências adicionais:
[Linkinator](https://github.com/JustinBeckwith/linkinator) e
[GNU find: tamanho](https://www.gnu.org/software/findutils/manual/html_node/find_html/Size.html).

## Etapa 2: publicação automática

O workflow `.github/workflows/cd.yml` dispara em cada `push` para `main`,
incluindo o commit gerado pelo merge de um PR aprovado.

1. Revalida a página inicial, tamanho, texto, linter e links.
2. Executa `npm run build` para preparar o diretório `_site/`.
3. Envia o artefato com `actions/upload-pages-artifact@v3`.
4. O job `publicar`, dependente da preparação, usa
   `actions/configure-pages@v5` e `actions/deploy-pages@v4`.

O workflow tem `contents: read`. Apenas o job de publicação recebe
`pages: write` para publicar e `id-token: write` para autenticar a origem
do deploy. O ambiente `github-pages` aceita a branch protegida e não exige
aprovação manual. O Pages usa **GitHub Actions** como fonte de publicação.

A concorrência do grupo `github-pages` evita publicações simultâneas.
Qualquer erro na preparação impede que o job de publicação seja executado.

### Conteúdo publicado

O build copia arquivos versionados de HTML, CSS, JavaScript, imagens,
fontes, mídia, PDF, texto, XML, JSON e webmanifest, preservando os caminhos.
Pastas de ferramentas `scripts/`, `tests/`, `docs/`, dependências,
arquivos ocultos e manifests do npm ficam fora do artefato.
A página inicial permanece na raiz, e `.nojekyll` é gerado para servir o site
estático diretamente.

Para inspecionar o artefato local, execute `npm run build` em uma cópia sem
`_site/` existente. O build exige uma pasta de saída nova para evitar arquivos
antigos na publicação. A pasta gerada é ignorada pelo Git e pelo linter.

### Verificar a entrega

- Acompanhe o workflow **CD - GitHub Pages** na aba **Actions**.
- Após o merge em `main`, a publicação ocorre automaticamente.
- O ambiente **github-pages** informa a URL do site.
- Os 20 testes incluem o isolamento dos arquivos públicos e a rejeição
  de página inicial renomeada no build.

Referência:
[GitHub Pages com workflows personalizados](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Etapa 4: notificações por e-mail

Foi escolhida a notificação nativa do GitHub Actions, sem serviço SMTP,
credenciais adicionais ou action externa para enviar mensagens.

### Ativação na conta

A configuração é pessoal e precisa ser feita por cada integrante responsável:

1. Abra [Configurações de notificações](https://github.com/settings/notifications).
2. Em **System → Actions**, habilite **Email**.
3. Selecione **Only notify for failed workflows** e salve.
4. Confira o endereço verificado e as opções de recebimento em
   [Configurações de e-mail](https://github.com/settings/emails).
5. Acompanhe o repositório pela opção **Watch**.

O envio é realizado pelo GitHub quando uma execução falha, incluindo o
workflow **CD - GitHub Pages**. Isso cobre erros na preparação, build e
publicação, mesmo quando o job de publicação fica sem executar porque
a preparação falhou.

A documentação do GitHub define essas notificações para execuções
disparadas pelo próprio usuário. Cada integrante que integra PRs e dispara
o deploy deve habilitar a preferência na própria conta. Essa opção não
é uma lista de distribuição que envia cada falha a qualquer endereço da equipe.
Para alertar um canal compartilhado independentemente de quem disparou
a execução, seria necessário adicionar SMTP ou webhook em uma etapa futura.

Para receber também os resultados de sucesso, desmarque o filtro de falhas.
Essa preferência da conta não pode ser ativada por um arquivo YAML do projeto.

### Teste sem afetar o site

O workflow `.github/workflows/test-notification.yml` existe apenas para
demonstrar o recebimento:

1. Habilite o e-mail de falhas na conta.
2. Abra **Actions → Teste de notificacao por e-mail → Run workflow**.
3. Escolha `main`, marque a confirmação e execute.
4. O job termina com erro intencional usando `exit 1`.
5. Confira o e-mail, inclusive a pasta de spam, e guarde uma captura para a atividade.

Ele usa apenas `workflow_dispatch`, sem checkout, secrets ou permissões de
escrita, e não executa a publicação. Seu erro intencional não altera os
badges dos workflows CI e CD nem a página publicada.
Sem a confirmação, o job é ignorado.

A aprovação da CI demonstra que o código continua válido. O recebimento
do e-mail precisa ser confirmado na caixa do destinatário; o estado
`failure` da execução de teste, sozinho, não comprova entrega de mensagem.

### Pesquisa

- [GitHub: configurar notificações do Actions](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications)
- [GitHub: destinatários de notificações de execuções](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)

## Etapa 5: matriz de versoes do Node.js

O job de qualidade usa `strategy.matrix` com Node.js 22 e 24. Essas versoes
sao compativeis com as dependencias atuais; as versoes 18 e 20 citadas
como exemplo no enunciado nao atendem aos requisitos atuais do projeto.

As duas combinacoes podem executar simultaneamente em `ubuntu-latest`,
com `max-parallel: 2` e `fail-fast: false`. Assim, uma falha nao cancela
a outra versao, e cada resultado fica visivel na aba Actions.

O check obrigatorio `Validar HTML` depende da matriz completa e so aprova
quando cada versao termina com sucesso. Falhas e cancelamentos bloqueiam
o merge. A protecao da main permanece ativa durante essa mudanca.

### Entrega

- Configuracoes: pasta `.github/workflows/`.
- Evidencias: pasta `docs/evidencias/`, com prints da falha de HTML e do deploy.
- [Site publico no GitHub Pages](https://joaopls-1.github.io/trabalho-CI-CD-DevOps/).
- Acesso da colaboradora: convite para `09116428-collab`, com permissao de escrita.
  O acesso passa a valer quando ela aceitar o convite.

### Prints e comprovantes

- [Print da falha proposital de HTML](docs/evidencias/01-ci-html-invalido.png).
- [Print do deploy aprovado](docs/evidencias/02-deploy-sucesso.png).
- [Detalhes das evidencias e links das execucoes](docs/evidencias/README.md).

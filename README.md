# Trabalho CI/CD — DevOps

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
5. Executar `npm run lint` em todos os arquivos HTML do projeto.

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

Esta entrega cobre a Etapa 1. O `index.html` está na raiz para publicação futura;
a ativação do GitHub Pages e a automação de deploy não fazem parte desta etapa.

## Referências

- [HTML-Validate: CLI](https://html-validate.org/usage/cli.html)
- [GitHub: proteção de branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

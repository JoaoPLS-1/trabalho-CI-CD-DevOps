#!/usr/bin/env bash
set -euo pipefail

case "${1:-all}" in
  index)
    if [[ ! -f index.html || -L index.html ]]; then
      echo "::error::O arquivo index.html deve existir na raiz como arquivo regular."
      exit 1
    fi
    ;;
  size)
    # KB decimal: exatamente 500000 bytes e permitido.
    oversized="$(find . -type d \( -name .git -o -name node_modules \) -prune -o -type f -size +500000c -print)"
    if [[ -n "$oversized" ]]; then
      echo "::error::Arquivos acima de 500 KB:"
      printf '%s\n' "$oversized"
      exit 1
    fi
    ;;
  text)
    # Partes separadas evitam que a regra encontre a propria definicao.
    pattern='TO''DO|FIX''ME|sen''ha|pass''word'
    if git grep -I -i -l -E "$pattern" -- .; then
      echo "::error::Termos bloqueados encontrados nos arquivos listados."
      exit 1
    else
      status=$?
      if [[ "$status" -ne 1 ]]; then
        echo "::error::Falha ao executar a varredura de texto."
        exit "$status"
      fi
    fi
    ;;
  all)
    bash "$0" index
    bash "$0" size
    bash "$0" text
    ;;
  *)
    echo "Uso: bash scripts/ci/check-files.sh [index|size|text|all]" >&2
    exit 2
    ;;
esac

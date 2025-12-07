#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"

latexmk -pdf -interaction=nonstopmode -use-biber main.tex
latexmk -c

echo "Paper compiled successfully."


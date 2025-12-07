# Paper Instructions

## Requirements

- TeX Live 2023 (or newer) or MiKTeX with `biblatex`, `biblatex-apa`, `biber`, `cleveref`, `algorithmic`, and `booktabs` packages.
- Python environment for generating figures and tables (`notebooks/09_paper_results.ipynb`).

## Build

```bash
cd paper
./compile.sh
```

## Structure

- `main.tex`: Entry point referencing section files.
- `sections/`: Methodology, experiments, and results chapters.
- `figures/`, `tables/`: Generated assets (exported from notebooks/scripts).
- `references.bib`: BibLaTeX database (APA style).
- `appendix.tex`: Supplemental material.

## Workflow

1. Update figures/tables using notebooks.
2. Export assets into `paper/figures` and `paper/tables`.
3. Update section `.tex` files with new content.
4. Run `compile.sh` or `latexmk` until references settle.
5. Review PDF and commit final artifacts to version control or release bundle.


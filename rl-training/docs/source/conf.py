"""Sphinx configuration for the Agentic Multi-Agent RL Trading System docs."""

from __future__ import annotations

import os
import sys
from datetime import datetime


ROOT_DIR = os.path.abspath(os.path.join(__file__, "..", ".."))
SRC_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "src"))

sys.path.insert(0, SRC_DIR)

project = "Agentic Multi-Agent RL Trading System"
author = "Agentic RL Team"
copyright = f"{datetime.utcnow():%Y}, {author}"
release = "0.1.0"

extensions = [
    "myst_parser",
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
    "sphinxcontrib.mermaid",
]

autosummary_generate = True
autodoc_typehints = "description"

myst_enable_extensions = [
    "colon_fence",
]

source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

templates_path = ["_templates"]
exclude_patterns: list[str] = []

html_theme = "alabaster"
html_static_path = ["_static"]


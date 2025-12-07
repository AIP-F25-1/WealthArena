# Contributing Guidelines

## Branching & Workflow

- Fork the repository or create a feature branch from `main`.
- Keep changes focused; open separate PRs for unrelated features.
- Run formatting (`black`, `flake8`) and tests (`pytest`) before submitting.

## Coding Standards

- Python 3.10 with type hints where practical.
- Follow modular design: data, features, agents, orchestration separated by domain.
- Maintain ASCII-only files unless Unicode is necessary.
- Log with `src.utils.get_logger` to ensure consistent formatting.

## Tests

- Add unit tests under `tests/` mirroring module structure.
- Include integration/system tests for new pipelines or scripts.
- Use fixtures in `tests/conftest.py` to avoid duplication.

## Documentation

- Update relevant docs (`docs/`, `README.md`, `IMPLEMENTATION_GUIDE.md`) when introducing new features.
- Record breaking changes in `docs/changelog.md`.
- Ensure new configuration options are documented in `config/*.yaml` comments or docs.

## Commit Messages

- Use imperative mood (“Add”, “Fix”, “Refactor”).
- Reference related issues or checklist items when applicable.

## Support

- Report bugs with detailed reproduction steps, dataset references, and environment info.
- Use GitHub Discussions (or equivalent) for questions and design proposals.


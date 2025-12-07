# Running Code Coverage for SonarQube

This guide explains how to generate code coverage reports for SonarQube integration.

## Prerequisites

Make sure you have the required packages installed:

```bash
pip install pytest pytest-cov
```

Or install all requirements:

```bash
pip install -r requirements.txt
```

## Generate Coverage Report

### Quick Command (What your colleague needs)

```bash
pytest --cov=. --cov-report=xml
```

This will:
- Run all tests in the project
- Generate a `coverage.xml` file in the root directory
- This XML file is what SonarQube needs for coverage analysis

### Alternative: With HTML Report (for local viewing)

```bash
pytest --cov=. --cov-report=xml --cov-report=html
```

This generates both:
- `coverage.xml` - for SonarQube
- `htmlcov/index.html` - for viewing coverage in your browser

### Run Specific Tests

```bash
# Run only unit tests
pytest --cov=. --cov-report=xml -m unit

# Run only integration tests
pytest --cov=. --cov-report=xml -m integration

# Exclude slow tests
pytest --cov=. --cov-report=xml -m "not slow"
```

### Coverage for Specific Modules

```bash
# Coverage for src directory only
pytest --cov=src --cov-report=xml

# Coverage for specific module
pytest --cov=src/environments --cov-report=xml
```

## Configuration Files

The following configuration files are set up:

1. **pytest.ini** - Pytest configuration
   - Test discovery patterns
   - Output options
   - Markers for organizing tests

2. **.coveragerc** - Coverage configuration
   - Excludes unnecessary files (logs, data, checkpoints, etc.)
   - Configures XML output for SonarQube
   - Sets reporting options

## Output Files

After running coverage:
- **coverage.xml** - Upload this to SonarQube
- **htmlcov/** - View this locally in your browser (if HTML report generated)
- **.coverage** - Internal coverage data file (don't commit this)

## Add to .gitignore

Make sure these are in your `.gitignore`:

```
# Coverage reports
.coverage
coverage.xml
htmlcov/
.pytest_cache/
```

## Viewing Coverage Locally

```bash
# Generate HTML report
pytest --cov=. --cov-report=html

# Open in browser (Windows)
start htmlcov/index.html

# Open in browser (Mac)
open htmlcov/index.html

# Open in browser (Linux)
xdg-open htmlcov/index.html
```

## Troubleshooting

### Issue: "No module named pytest"
```bash
pip install pytest pytest-cov
```

### Issue: "No data to report"
Make sure you have test files:
- Files should be named `test_*.py` or `*_test.py`
- Test functions should start with `test_`
- Test classes should start with `Test`

### Issue: Coverage is 0% or very low
- Make sure tests are actually running: `pytest -v`
- Check that your source code is being imported in tests
- Verify .coveragerc isn't excluding too much

### Issue: Tests are failing
Fix failing tests first, then run coverage:
```bash
# See which tests are failing
pytest -v

# Run a specific test file
pytest test_system.py -v

# Run a specific test function
pytest test_system.py::test_function_name -v
```

## CI/CD Integration

### For GitHub Actions:

```yaml
- name: Run tests with coverage
  run: |
    pip install pytest pytest-cov
    pytest --cov=. --cov-report=xml

- name: Upload coverage to SonarQube
  # Your SonarQube upload step here
```

### For GitLab CI:

```yaml
test:
  script:
    - pip install pytest pytest-cov
    - pytest --cov=. --cov-report=xml
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `pytest --cov=. --cov-report=xml` | Generate coverage.xml for SonarQube |
| `pytest --cov=. --cov-report=html` | Generate HTML coverage report |
| `pytest --cov=. --cov-report=term` | Show coverage in terminal |
| `pytest --cov=src` | Coverage for src directory only |
| `pytest -v` | Run tests with verbose output |
| `pytest -k "test_name"` | Run tests matching pattern |
| `pytest -m unit` | Run tests with "unit" marker |

## What to Share with Your Colleague

The most important file for SonarQube is:
- **coverage.xml** (generated after running the pytest command)

This file contains all the coverage data that SonarQube needs.


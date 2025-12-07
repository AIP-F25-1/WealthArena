# SonarQube Coverage Setup - Quick Start Guide

## 🎯 For Your Colleague Working on SonarQube

This is the complete guide for generating the `coverage.xml` file needed for SonarQube.

---

## 📋 Quick Commands (Copy & Paste)

### Option 1: One-Line Command (Recommended)
```bash
pip install pytest pytest-cov && pytest --cov=. --cov-report=xml
```

### Option 2: Step by Step
```bash
# Step 1: Install dependencies
pip install pytest pytest-cov

# Step 2: Generate coverage report
pytest --cov=. --cov-report=xml
```

### Option 3: Use the Scripts (Easiest)

**On Windows:**
```cmd
run_coverage.bat
```

**On Mac/Linux:**
```bash
python run_coverage.py
```

---

## 📁 What Gets Generated

After running the command, you'll get:

- **`coverage.xml`** ← This is the file SonarQube needs!
- Location: `wealtharena_rl/coverage.xml`
- Already in `.gitignore` (won't be committed to Git)

---

## 🔧 Setup Files Included

I've created these configuration files for you:

| File | Purpose |
|------|---------|
| `pytest.ini` | Configures pytest test discovery and options |
| `.coveragerc` | Configures coverage reporting and exclusions |
| `requirements.txt` | Updated with `pytest-cov>=4.0.0` |
| `run_coverage.py` | Python script to run coverage |
| `run_coverage.bat` | Windows batch script to run coverage |
| `RUN_COVERAGE.md` | Detailed documentation |
| `.gitignore` | Already excludes coverage files |

---

## ✅ Verification Steps

1. **Check if it worked:**
   ```bash
   # You should see the file
   ls coverage.xml
   # or on Windows:
   dir coverage.xml
   ```

2. **Check coverage percentage:**
   ```bash
   pytest --cov=. --cov-report=term
   ```

---

## 📊 Expected Output

When you run the coverage command, you should see something like:

```
======================== test session starts ========================
platform win32 -- Python 3.x.x, pytest-7.x.x, pluggy-1.x.x
rootdir: /path/to/wealtharena_rllib/wealtharena_rl
configfile: pytest.ini
plugins: asyncio-0.x.x, cov-4.x.x
collected X items

test_system.py .....                                          [ 45%]
test_integration.py ....                                      [ 80%]
test_trainers.py ...                                          [100%]

---------- coverage: platform win32, python 3.x.x -----------
Name                                 Stmts   Miss  Cover
--------------------------------------------------------
download_market_data.py               150     45    70%
src/data/market_data.py               200     60    70%
src/environments/trading_env.py       180     50    72%
...
--------------------------------------------------------
TOTAL                                2000    600    70%

Coverage XML written to file coverage.xml

======================= X passed in X.XX s =======================
```

---

## 🚨 Troubleshooting

### Issue: "No module named 'pytest'"
```bash
pip install pytest pytest-cov
```

### Issue: "No module named 'pytest_cov'"
```bash
pip install pytest-cov
```

### Issue: "No tests collected"
Your tests are there! Check:
```bash
pytest -v  # See all tests
```

### Issue: Tests are failing
Fix tests first, then run coverage:
```bash
# See which tests fail
pytest -v

# Run specific test file
pytest test_system.py -v
```

### Issue: Coverage is 0%
Make sure tests import your source code. Check your test files.

---

## 📤 What to Send to SonarQube Team

Send them the **`coverage.xml`** file located at:
```
wealtharena_rl/coverage.xml
```

Or tell them it will be automatically available after CI/CD runs the pytest command.

---

## 🔄 CI/CD Integration

### GitHub Actions Example:

```yaml
name: Tests and Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      
      - name: Run tests with coverage
        run: |
          cd wealtharena_rl
          pytest --cov=. --cov-report=xml
      
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

### GitLab CI Example:

```yaml
test:
  stage: test
  script:
    - pip install -r requirements.txt
    - cd wealtharena_rl
    - pytest --cov=. --cov-report=xml
  coverage: '/TOTAL.+ ([0-9]{1,3}%)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: wealtharena_rl/coverage.xml

sonarqube:
  stage: quality
  dependencies:
    - test
  script:
    - sonar-scanner
```

---

## 📚 Additional Commands

| Command | Description |
|---------|-------------|
| `pytest --cov=. --cov-report=xml` | Generate XML for SonarQube |
| `pytest --cov=. --cov-report=html` | Generate HTML report (view in browser) |
| `pytest --cov=. --cov-report=term` | Show coverage in terminal |
| `pytest -v` | Run tests verbosely |
| `pytest -k "test_name"` | Run specific test |
| `pytest --collect-only` | List all tests without running |

---

## 📝 SonarQube Properties File

If your team needs a `sonar-project.properties` file, here's a template:

```properties
# SonarQube Project Configuration
sonar.projectKey=wealtharena-rllib
sonar.projectName=WealthArena RL Trading System
sonar.projectVersion=1.0

# Source code location
sonar.sources=wealtharena_rl/src
sonar.tests=wealtharena_rl

# Test patterns
sonar.test.inclusions=**/test_*.py

# Python specific
sonar.python.version=3.10

# Coverage
sonar.python.coverage.reportPaths=wealtharena_rl/coverage.xml

# Exclusions
sonar.exclusions=**/data/**,**/checkpoints/**,**/logs/**,**/results/**,**/notebooks/**,**/__pycache__/**

# Encoding
sonar.sourceEncoding=UTF-8
```

---

## 🎉 Summary

**For your colleague's request, just tell them:**

```
✅ Run this command in the wealtharena_rl directory:
   pytest --cov=. --cov-report=xml

✅ This generates coverage.xml which is what SonarQube needs

✅ All configuration files are already set up:
   - pytest.ini
   - .coveragerc
   - requirements.txt (with pytest-cov)

✅ The coverage.xml file is already in .gitignore
```

---

## 📞 Need Help?

- Check `RUN_COVERAGE.md` for detailed documentation
- Run `pytest --help` to see all options
- Run `pytest --co` to see all collected tests
- Check pytest output for specific error messages

---

**That's it! Your project is now ready for SonarQube coverage analysis.** 🚀


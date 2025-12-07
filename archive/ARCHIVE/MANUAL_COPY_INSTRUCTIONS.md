# Manual Copy Instructions for WealthArena Production Folder

Since automated copying has encountered issues, please follow these manual instructions to populate the production folder.

## Directory Structure

```
WealthArena_Production/
├── frontend/          (from WealthArena/)
├── backend/           (from WealthArena_Backend/)
├── chatbot/           (from wealtharena_chatbot/)
├── rl-service/        (from services/rl-service/)
├── rl-training/       (from wealtharena_rl/)
├── data-pipeline/     (from Financial_Assets_Pipeline/)
├── database/          (from database_schemas/)
├── infrastructure/    (from azure_infrastructure/ + scripts/)
└── docs/              (from root PHASE*.md files)
```

## Copy Commands

### Frontend (WealthArena → frontend)

**Include**:
- All `app/` directory (page components)
- All `components/` directory (reusable components)
- All `contexts/` directory (React contexts)
- All `services/` directory (API services)
- All `config/`, `constants/`, `hooks/`, `utils/` directories
- `package.json`, `tsconfig.json`, `app.json`
- `babel.config.js`, `metro.config.js`, `tailwind.config.js`
- `.env.example`, `.env.azure`, `.env.gcp`
- `assets/` directory (images, fonts, icons)
- Documentation: `README.md`, `PHASE8_TESTING_GUIDE.md`, `PHASE9_TESTING_GUIDE.md`, `PHASE10_TESTING_GUIDE.md`

**Exclude**:
- `node_modules/`
- `.expo/`, `.expo-shared/`
- `dist/`, `build/`
- `android/`, `ios/`
- `.env` (actual secrets)

**Command**:
```powershell
robocopy WealthArena WealthArena_Production\frontend /E /XD node_modules .expo .expo-shared dist build android ios /XF *.log .env /NFL /NDL
```

### Backend (WealthArena_Backend → backend)

**Include**:
- All `src/` directory (routes, config, middleware, utils)
- `package.json`, `tsconfig.json`
- `.env.example`
- Documentation: `README_PHASE4.md`, `TESTING_GUIDE.md`
- `app.yaml` (for GCP App Engine)

**Exclude**:
- `node_modules/`
- `dist/` (compiled TypeScript)
- `.env` (actual secrets)
- `*.log`
- `test-db.js`

**Command**:
```powershell
robocopy WealthArena_Backend WealthArena_Production\backend /E /XD node_modules dist /XF *.log .env test-db.js /NFL /NDL
```

### Chatbot (wealtharena_chatbot → chatbot)

**Include**:
- All `app/` directory (api, llm, models subdirectories)
- `main.py`
- `requirements.txt`
- `.env.example`
- `chatbot_setup/` directory
- Documentation: `README_PHASE5.md`, `TESTING_GUIDE.md`
- `app.yaml` (for GCP App Engine)
- `Dockerfile` (reference)
- `run_chatbot.bat`

**Exclude**:
- `__pycache__/`
- `*.pyc`
- `data/chroma_db/`
- `data/chat_history/`
- `.env` (actual secrets)
- `*.log`

**Command**:
```powershell
robocopy wealtharena_chatbot WealthArena_Production\chatbot /E /XD __pycache__ data /XF *.pyc *.log .env /NFL /NDL
```

### RL Service (services/rl-service → rl-service)

**Include**:
- All `api/` directory (inference_server.py, db_connector.py, gcs_model_loader.py)
- `requirements.txt`
- `.env.example`
- Documentation: `README_PHASE6.md`, `TESTING_GUIDE.md`
- `app.yaml` (for GCP App Engine)
- `Dockerfile` (reference)
- `run_rl_service.bat`

**Exclude**:
- `__pycache__/`
- `*.pyc`
- `models/` (trained model checkpoints)
- `.env` (actual secrets)
- `*.log`

**Command**:
```powershell
robocopy services\rl-service WealthArena_Production\rl-service /E /XD __pycache__ models /XF *.pyc *.log .env /NFL /NDL
```

### RL Training (wealtharena_rl → rl-training)

**Include**:
- All `src/` directory (training, environments, models, backtesting, utils)
- `requirements.txt`
- `config/` directory
- `backend/` directory (model_service.py)
- Documentation: `README_PHASE7.md`

**Exclude**:
- `checkpoints/`
- `logs/`
- `mlruns/`
- `data/raw/`
- `data/processed/`
- `__pycache__/`
- `*.pyc`
- `.env`
- `results/`

**Command**:
```powershell
robocopy wealtharena_rl WealthArena_Production\rl-training /E /XD checkpoints logs mlruns data results __pycache__ /XF *.pyc *.log .env /NFL /NDL
```

### Data Pipeline (Financial_Assets_Pipeline → data-pipeline)

**Include**:
- `asx_market_data_adls.py`, `processAndStore.py`, `dbConnection.py`
- `download_crypto.py`, `download_forex.py`, `download_commodities.py`
- `run_all_downloaders.py`
- `export_to_rl_training.py`
- Batch files: `run_data_refresh.bat`, `run_signal_generation.bat`, `run_full_pipeline.bat`
- Configuration: `azureCred.env.example`, `sqlDB.env.example`
- Documentation: `README_PHASE2.md`, `README.md`

**Exclude**:
- `data/raw/`
- `logs/`
- `__pycache__/`
- `*.pyc`
- `.env` (actual secrets)
- `*_summary.json`

**Command**:
```powershell
robocopy Financial_Assets_Pipeline WealthArena_Production\data-pipeline /E /XD __pycache__ data logs /XF *.pyc *.log *.json .env /NFL /NDL
```

### Database (database_schemas → database)

**Include**: All SQL schema files

**No Exclusions**: All small text files

**Command**:
```powershell
robocopy database_schemas WealthArena_Production\database /E /NFL /NDL
```

### Infrastructure

**Create subdirectories**:

```powershell
mkdir WealthArena_Production\infrastructure\azure_infrastructure
mkdir WealthArena_Production\infrastructure\azure_deployment
mkdir WealthArena_Production\infrastructure\gcp_deployment
mkdir WealthArena_Production\infrastructure\data_pipeline_standalone
```

**Azure Infrastructure**:
```powershell
robocopy azure_infrastructure WealthArena_Production\infrastructure\azure_infrastructure /E /XF *.log .env /NFL /NDL
```

**Azure Deployment**:
```powershell
robocopy scripts\azure_deployment WealthArena_Production\infrastructure\azure_deployment /E /XF *.log .env /NFL /NDL
```

**GCP Deployment**:
```powershell
robocopy scripts\gcp_deployment WealthArena_Production\infrastructure\gcp_deployment /E /XF *.log .env /NFL /NDL
```

**Data Pipeline Standalone**:
```powershell
robocopy scripts\data_pipeline WealthArena_Production\infrastructure\data_pipeline_standalone /E /XF *.log .env /NFL /NDL
```

### Documentation (root PHASE*.md → docs/)

**Copy all phase files**:
```powershell
Copy-Item PHASE*.md WealthArena_Production\docs\
Copy-Item TEST_EXECUTION_CHECKLIST.md WealthArena_Production\docs\
Copy-Item BUG_TRACKING_TEMPLATE.md WealthArena_Production\docs\
Copy-Item DEMO_PREPARATION_GUIDE.md WealthArena_Production\docs\
Copy-Item DEPLOYMENT_GUIDE.md WealthArena_Production\docs\
Copy-Item AZURE_INFRASTRUCTURE_SETUP_COMPLETE.md WealthArena_Production\docs\
Copy-Item "Overall Architecture.txt" WealthArena_Production\docs\
Copy-Item "Inception Paper.txt" WealthArena_Production\docs\
Copy-Item "Master Connective Pipeline.txt" WealthArena_Production\docs\
Copy-Item "Integration Pipeline.txt" WealthArena_Production\docs\
Copy-Item ASSET_CLASS_COVERAGE.md WealthArena_Production\docs\
```

**Copy testing guides from subdirectories**:
```powershell
Copy-Item WealthArena_Backend\TESTING_GUIDE.md WealthArena_Production\docs\TESTING_GUIDE_backend.md
Copy-Item wealtharena_chatbot\TESTING_GUIDE.md WealthArena_Production\docs\TESTING_GUIDE_chatbot.md
Copy-Item services\rl-service\TESTING_GUIDE.md WealthArena_Production\docs\TESTING_GUIDE_rl-service.md
```

## Verification

After copying, verify:

1. **Frontend**:
   - [ ] `package.json` exists
   - [ ] `app.json` exists
   - [ ] `.env.example` exists (no `.env` with secrets)

2. **Backend**:
   - [ ] `package.json` exists
   - [ ] `src/routes/index.ts` exists
   - [ ] `.env.example` exists

3. **Chatbot**:
   - [ ] `requirements.txt` exists
   - [ ] `main.py` exists
   - [ ] `app/main.py` exists
   - [ ] `.env.example` exists

4. **RL Service**:
   - [ ] `requirements.txt` exists
   - [ ] `api/inference_server.py` exists
   - [ ] `.env.example` exists

5. **RL Training**:
   - [ ] `requirements.txt` exists
   - [ ] `src/training/master_trainer.py` exists
   - [ ] `config/quick_training.yaml` exists

6. **Data Pipeline**:
   - [ ] All downloader scripts exist
   - [ ] `processAndStore.py` exists
   - [ ] `.env.example` files exist

7. **Database**:
   - [ ] `azure_sql_schema.sql` exists
   - [ ] `postgresql_schema.sql` exists

8. **Infrastructure**:
   - [ ] `azure_infrastructure/setup_master.ps1` exists
   - [ ] `azure_deployment/` scripts exist
   - [ ] `gcp_deployment/` scripts exist

9. **Documentation**:
   - [ ] All PHASE*.md files copied
   - [ ] README.md created
   - [ ] DEPLOYMENT_CHECKLIST.md created
   - [ ] .gitignore created

## Production Folder Size

Expected size after manual copy:
- **Total**: ~200-500MB (excluding large data files, checkpoints, node_modules)
- **Frontend**: ~50-100MB
- **Backend**: ~5-10MB
- **Chatbot**: ~20-30MB
- **RL Service**: ~5-10MB
- **RL Training**: ~30-50MB
- **Data Pipeline**: ~10-20MB
- **Database**: ~1MB
- **Infrastructure**: ~2-5MB
- **Docs**: ~5-10MB

## Next Steps

1. Review all copied files
2. Ensure no `.env` files with secrets
3. Verify `.gitignore` is comprehensive
4. Initialize Git repository:
   ```powershell
   cd WealthArena_Production
   git init
   git add .
   git commit -m "Initial commit: WealthArena production-ready code"
   ```
5. Follow `DEPLOYMENT_CHECKLIST.md` for deployment


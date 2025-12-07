# Phase 3A: Airflow Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- Python 3.8+ installed
- Root `.env` file created with all required variables
- PostgreSQL schema file created (`services/data-pipeline/init_postgres_schema.sql`)

## Step 1: Generate Airflow Fernet Key

The Fernet key is already generated in the `.env` file. If you need to regenerate it:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add the output to `.env` as `AIRFLOW_FERNET_KEY=<generated-key>`

## Step 2: Verify Environment Configuration

```bash
cat .env
# Verify all required variables are set
```

Ensure these variables are present:
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- `AIRFLOW_PORT`, `AIRFLOW_FERNET_KEY`
- `ALPHA_VANTAGE_API_KEY` (if you have one)
- `RL_SERVICE_PORT`

## Step 3: Start Airflow Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f airflow-webserver
docker-compose logs -f airflow-scheduler
```

**Note:** The first startup may take 2-5 minutes while:
- PostgreSQL initializes with TimescaleDB extension
- Airflow database is initialized
- Admin user is created
- 4 DAGs are loaded

## Step 4: Access Airflow Web UI

- **URL**: http://localhost:8080
- **Username**: admin
- **Password**: admin

**Important:** Change the admin password immediately after first login!

## Step 5: Verify DAGs

1. Navigate to the DAGs page in Airflow UI
2. Verify 4 DAGs are visible:
   - `01_ingest_market_data`
   - `02_feature_engineering`
   - `03_train_rl_models`
   - `04_generate_signals`
3. All DAGs should be **paused** by default (`AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION: 'true'`)

## Step 6: Configure Connections

### Verify postgres_default Connection

```bash
# List all connections
docker-compose exec airflow-webserver airflow connections list

# Should see postgres_default connection already created
```

### If Connection is Missing

The connection should be auto-created during initialization. If not, create it manually:

```bash
docker-compose exec airflow-webserver airflow connections add postgres_default \
  --conn-uri postgresql+psycopg2://wealtharena:wealtharena123@postgres:5432/wealtharena
```

### Verify Connection Works

```bash
docker-compose exec airflow-webserver airflow connections test postgres_default
```

## Step 7: Test DAG Execution

### Test Data Ingestion DAG

```bash
# Unpause the DAG
docker-compose exec airflow-webserver airflow dags unpause 01_ingest_market_data

# Trigger manual run
docker-compose exec airflow-webserver airflow dags trigger 01_ingest_market_data

# Monitor execution
docker-compose logs -f airflow-scheduler
```

**In Airflow UI:**
1. Go to the DAG run
2. Click on the run to see task status
3. Tasks should execute in order: `download_stocks` → `download_crypto` → `validate_data_quality`
4. All tasks should turn **green** (success)

### Test Feature Engineering DAG

```bash
# Unpause and trigger
docker-compose exec airflow-webserver airflow dags unpause 02_feature_engineering
docker-compose exec airflow-webserver airflow dags trigger 02_feature_engineering
```

**Note:** This DAG has a dependency on `01_ingest_market_data`, so it will wait for data ingestion to complete.

### Test Signal Generation DAG

```bash
# Ensure RL service is running first
docker-compose ps rl-service

# Unpause and trigger
docker-compose exec airflow-webserver airflow dags unpause 04_generate_signals
docker-compose exec airflow-webserver airflow dags trigger 04_generate_signals
```

**Expected Tasks:**
1. `wait_for_feature_engineering` - ExternalTaskSensor (waits for feature DAG)
2. `check_rl_service_health` - Health check
3. `generate_signals` - Signal generation

## Step 8: Verify Data in PostgreSQL

### Connect to PostgreSQL

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U wealtharena -d wealtharena

# Or using psql directly
psql -h localhost -p 5432 -U wealtharena -d wealtharena
```

### Check Tables

```sql
-- List all tables
\dt

-- Should see:
-- market_data, candle_data, processed_features, trading_signals, take_profit_levels
```

### Query Market Data

```sql
-- Check stock data
SELECT symbol, COUNT(*) FROM market_data GROUP BY symbol;

-- Check crypto data
SELECT symbol, asset_type, COUNT(*) FROM market_data WHERE asset_type = 'crypto' GROUP BY symbol, asset_type;

-- Check candle data
SELECT symbol, time_frame, COUNT(*) FROM candle_data GROUP BY symbol, time_frame;

-- Check processed features
SELECT symbol, as_of, sma_20, sma_50 FROM processed_features ORDER BY as_of DESC LIMIT 10;

-- Check trading signals
SELECT signal_id, symbol, signal, confidence, entry_price FROM trading_signals ORDER BY signal_id DESC LIMIT 10;

-- Check take profit levels
SELECT tpl.signal_id, tpl.level, tpl.price, tpl.percent_gain 
FROM take_profit_levels tpl 
ORDER BY tpl.signal_id DESC LIMIT 10;
```

### Exit PostgreSQL

```sql
\q
```

## Step 9: Verify Schedules

### Check DAG Schedules in Airflow UI

1. Go to DAGs page
2. Click on a DAG
3. Go to "Schedule" tab
4. Verify schedules:
   - `01_ingest_market_data`: Daily at 6 AM UTC
   - `02_feature_engineering`: Daily at 7 AM UTC
   - `03_train_rl_models`: Weekly Sunday at 2 AM UTC
   - `04_generate_signals`: Daily at 8 AM UTC

### Check Next Execution Times

```bash
docker-compose exec airflow-webserver airflow dags next-execution 01_ingest_market_data
docker-compose exec airflow-webserver airflow dags next-execution 02_feature_engineering
docker-compose exec airflow-webserver airflow dags next-execution 03_train_rl_models
docker-compose exec airflow-webserver airflow dags next-execution 04_generate_signals
```

## Troubleshooting

### Issue: Airflow webserver not starting

**Check logs:**
```bash
docker-compose logs airflow-webserver
```

**Common causes:**
- Database connection failed
- Fernet key missing or invalid
- Port 8080 already in use

**Solution:**
```bash
# Restart services
docker-compose restart airflow-webserver

# Check for port conflicts
netstat -an | findstr 8080
```

### Issue: DAGs not appearing

**Check DAGs directory:**
```bash
docker-compose exec airflow-webserver ls -la /opt/airflow/dags
```

**Should see:**
- 01_ingest_market_data.py
- 02_feature_engineering.py
- 03_train_rl_models.py
- 04_generate_signals.py

**Solution:**
```bash
# Restart scheduler
docker-compose restart airflow-scheduler

# Wait 30 seconds for DAGs to load
# Refresh Airflow UI
```

### Issue: postgres_default connection not found

**Solution:**
```bash
# Create connection manually
docker-compose exec airflow-webserver airflow connections add postgres_default \
  --conn-uri postgresql+psycopg2://wealtharena:wealtharena123@postgres:5432/wealtharena

# Or re-run init
docker-compose up airflow-init
```

### Issue: RL service not reachable from DAG

**Check service status:**
```bash
docker-compose ps rl-service
```

**Check network connectivity:**
```bash
docker-compose exec airflow-webserver curl http://rl-service:5002/health
```

**Expected response:**
```json
{"status": "healthy"}
```

**Solution:**
```bash
# Restart RL service
docker-compose restart rl-service

# Check logs
docker-compose logs rl-service
```

### Issue: DAG tasks failing with "Connection refused"

**Check all services are running:**
```bash
docker-compose ps
```

All services should show "Up" status.

**Solution:**
```bash
# Restart all services
docker-compose down
docker-compose up -d

# Wait 2-3 minutes for everything to start
```

### Issue: "No module named 'yfinance'" error

**Check if yfinance is installed in Airflow image:**
```bash
docker-compose exec airflow-webserver pip list | grep yfinance
```

**Solution:**
If missing, rebuild Airflow image with required packages. Check `services/data-pipeline/Dockerfile.airflow`.

## Next Steps

✅ **Airflow Setup Complete!**

Proceed to:
- **Phase 3B: Databricks Setup** (see `PHASE3_DATABRICKS_SETUP_GUIDE.md`)
- **Phase 3C: End-to-End Pipeline Testing** (see `PHASE3_PIPELINE_TESTING_GUIDE.md`)

## Additional Configuration

### Email Notifications (Optional)

To receive email notifications for DAG failures:

1. Add SMTP configuration to `docker-compose.yml`:
```yaml
environment:
  AIRFLOW__SMTP__SMTP_HOST: smtp.gmail.com
  AIRFLOW__SMTP__SMTP_STARTTLS: 'true'
  AIRFLOW__SMTP__SMTP_SSL: 'false'
  AIRFLOW__SMTP__SMTP_USER: your-email@gmail.com
  AIRFLOW__SMTP__SMTP_PASSWORD: your-app-password
  AIRFLOW__SMTP__SMTP_PORT: 587
  AIRFLOW__SMTP__SMTP_MAIL_FROM: your-email@gmail.com
```

2. Update DAG `default_args`:
```python
default_args = {
    'email': ['your-email@gmail.com'],
    'email_on_failure': True,
    'email_on_retry': False,
}
```

### Production Considerations

1. **Change default passwords** in `.env` file
2. **Use proper Fernet key** (regenerate for production)
3. **Enable SSL** for Airflow web interface
4. **Set up proper logging** to external storage (CloudWatch, ELK, etc.)
5. **Configure resource limits** in docker-compose.yml
6. **Use external PostgreSQL** for production (Azure Database for PostgreSQL)
7. **Enable authentication** via OAuth or LDAP
8. **Set up monitoring** (Prometheus + Grafana)

## Useful Commands

```bash
# View all logs
docker-compose logs -f

# Restart specific service
docker-compose restart <service-name>

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build

# Access Airflow shell
docker-compose exec airflow-webserver bash

# List DAGs
docker-compose exec airflow-webserver airflow dags list

# Test task execution locally
docker-compose exec airflow-webserver airflow tasks test <dag-id> <task-id> <execution-date>

# Clear failed tasks
docker-compose exec airflow-webserver airflow tasks clear <dag-id> --state failed
```


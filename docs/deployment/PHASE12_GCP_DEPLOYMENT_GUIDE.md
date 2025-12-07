# Phase 12: GCP Cloud Deployment Guide (No Docker)

## Overview

Deploy all three WealthArena services to Google Cloud Platform (GCP) App Engine using native runtimes (Node.js 20, Python 3.11) with `gcloud app deploy` command. This provides a redundant deployment alongside Azure for reliability and addresses Azure student subscription limitations.

## Prerequisites

- ✅ Google Cloud account with $300 free credits (new accounts)
- ✅ gcloud CLI installed (version 400.0.0+)
- ✅ Phases 1-10 completed (database schema, services tested locally)
- ✅ Phase 11 completed (Azure deployment for reference)
- ✅ Trained RL models (optional, can use mock mode)

## Architecture Comparison

**Azure (Phase 11):**
- Azure Web Apps (Node.js 20, Python 3.11)
- Azure SQL Database (SQL Server)
- Azure Blob Storage
- Deployment: `az webapp up`

**GCP (Phase 12):**
- App Engine Standard (Backend) + Flexible (Chatbot, RL)
- Cloud SQL (PostgreSQL 15)
- Cloud Storage
- Deployment: `gcloud app deploy`

## Step-by-Step Deployment

### Step 1: Install and Configure gcloud CLI

**Install gcloud CLI:**
- Download from: https://cloud.google.com/sdk/docs/install
- Run installer and follow prompts
- Verify installation: `gcloud --version`

**Authenticate:**
```bash
gcloud auth login
```

This opens browser for Google account authentication.

**Set default project (after creation):**
```bash
gcloud config set project wealtharena-prod
```

---

### Step 2: Create GCP Project and Enable APIs

**Create project:**
```bash
gcloud projects create wealtharena-prod --name="WealthArena Production"
```

**Set billing account (required for App Engine):**
```bash
# List billing accounts
gcloud billing accounts list

# Link to project
gcloud billing projects link wealtharena-prod --billing-account=<BILLING_ACCOUNT_ID>
```

**Enable required APIs:**
```bash
gcloud services enable appengine.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable iam.googleapis.com
```

**Initialize App Engine:**
```bash
gcloud app create --region=us-central1
```

**Expected Duration:** 5-10 minutes

---

### Step 3: Provision Cloud SQL (PostgreSQL)

**Create Cloud SQL instance:**
```bash
gcloud sql instances create wealtharena-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00
```

**Expected Duration:** 5-8 minutes

**Create database:**
```bash
gcloud sql databases create wealtharena_db --instance=wealtharena-db
```

**Create user:**
```bash
gcloud sql users create wealtharena_admin \
  --instance=wealtharena-db \
  --password=WealthArena2024!@#$%
```

**Get connection name:**
```bash
gcloud sql instances describe wealtharena-db --format="value(connectionName)"

# Expected: wealtharena-prod:us-central1:wealtharena-db
```

---

### Step 4: Deploy PostgreSQL Schema

**Option A: Using Cloud SQL Proxy (Recommended)**

**Download Cloud SQL Proxy:**
```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.windows.amd64.exe
```

**Start proxy:**
```bash
.\cloud-sql-proxy wealtharena-prod:us-central1:wealtharena-db
```

**Connect via psql:**
```bash
psql -h 127.0.0.1 -U wealtharena_admin -d wealtharena_db -f database_schemas/postgresql_schema.sql
```

**Option B: Using Public IP (Temporary)**

**Add your IP to authorized networks:**
```bash
gcloud sql instances patch wealtharena-db --authorized-networks=<YOUR_IP>/32
```

**Get public IP:**
```bash
gcloud sql instances describe wealtharena-db --format="value(ipAddresses[0].ipAddress)"
```

**Connect directly:**
```bash
psql -h <PUBLIC_IP> -U wealtharena_admin -d wealtharena_db -f database_schemas/postgresql_schema.sql
```

**Verify schema:**
```bash
psql -h 127.0.0.1 -U wealtharena_admin -d wealtharena_db -c "\dt"

# Expected: List of 14 tables
```

---

### Step 5: Create Cloud Storage Bucket

**Create bucket:**
```bash
gsutil mb -l us-central1 -c STANDARD gs://wealtharena-models
```

**Set access control:**
```bash
gsutil pap set enforced gs://wealtharena-models
```

**Verify bucket:**
```bash
gsutil ls

# Expected: gs://wealtharena-models/
```

---

### Step 6: Create Secret Manager Secrets

**Create secrets:**
```bash
echo -n "WealthArena2024!@#$%" | gcloud secrets create db-password --data-file=-
echo -n "your-jwt-secret-256-bits" | gcloud secrets create jwt-secret --data-file=-
```

**Grant access to App Engine default service account:**
```bash
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:wealtharena-prod@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:wealtharena-prod@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

### Step 7: Deploy Backend Service

**Navigate to backend:**
```bash
cd WealthArena_Backend
```

**Deploy:**
```bash
gcloud app deploy app.yaml --project wealtharena-prod --version v1 --quiet
```

**Monitor deployment:**
```bash
gcloud app logs tail -s default
```

**Test:**
```bash
curl https://wealtharena-prod.appspot.com/api/health
```

**Expected Duration:** 5-8 minutes

---

### Step 8: Deploy Chatbot Service

**Navigate to chatbot:**
```bash
cd wealtharena_chatbot
```

**Deploy:**
```bash
gcloud app deploy app.yaml --project wealtharena-prod --version v1 --quiet
```

**Expected Duration:** 15-25 minutes (large dependencies)

**Test:**
```bash
curl https://chatbot-dot-wealtharena-prod.appspot.com/healthz
```

---

### Step 9: Deploy RL Service

**Navigate to RL service:**
```bash
cd services/rl-service
```

**Deploy:**
```bash
gcloud app deploy app.yaml --project wealtharena-prod --version v1 --quiet
```

**Expected Duration:** 20-30 minutes (Ray and PyTorch)

**Test:**
```bash
curl https://rl-service-dot-wealtharena-prod.appspot.com/health
```

---

### Step 10: Upload Model Checkpoints

**Upload to Cloud Storage:**
```bash
gsutil -m cp -r wealtharena_rl/checkpoints/* gs://wealtharena-models/latest/
```

**Verify uploads:**
```bash
gsutil ls -r gs://wealtharena-models/latest/
```

**Expected:** 25 files (5 asset classes × 5 files each)

---

### Step 11: Test End-to-End Integration

**Test service health:**
```bash
curl https://wealtharena-prod.appspot.com/api/health
curl https://chatbot-dot-wealtharena-prod.appspot.com/healthz
curl https://rl-service-dot-wealtharena-prod.appspot.com/health
```

**Test backend proxies:**
```bash
curl https://wealtharena-prod.appspot.com/api/chatbot/health
curl https://wealtharena-prod.appspot.com/api/rl-agent/health
```

**Test database connection:**
```bash
curl "https://wealtharena-prod.appspot.com/api/signals/top?limit=1"
```

**Test frontend:**
1. Copy .env.gcp to .env in WealthArena directory
2. Restart Expo: `npm start`
3. Open app on device
4. Test login, dashboard, signals, portfolio
5. Verify all data loads from GCP backend

---

## Troubleshooting

### Issue: Project creation fails - "Project ID already exists"

**Solution:** Use different project ID: `wealtharena-prod-2` or `wealtharena-demo`

### Issue: Billing account required

**Solution:** Link billing account (free credits available for new accounts)

### Issue: App Engine region cannot be changed

**Solution:** Region is permanent after `gcloud app create`. Delete project and recreate if wrong region.

### Issue: Cloud SQL connection timeout

**Solution:** 
- Verify Cloud SQL instance is running: `gcloud sql instances describe wealtharena-db`
- Check App Engine has Cloud SQL Client role
- Verify connection name in app.yaml matches actual instance

### Issue: Chatbot/RL service build timeout

**Solution:**
- Use App Engine Flexible (already recommended)
- Increase timeout: `gcloud config set app/cloud_build_timeout 2400` (40 minutes)
- Or pre-build dependencies and use custom runtime

### Issue: RL service out of memory

**Solution:**

Increase memory in app.yaml:
```yaml
resources:
  memory_gb: 8
```

Note: Higher memory increases cost.

### Issue: Models not loading in RL service

**Solution:**
- Verify models uploaded to Cloud Storage: `gsutil ls gs://wealtharena-models/latest/`
- Check RL service logs: `gcloud app logs tail -s rl-service`
- Verify download logic in inference_server.py

---

## Cost Management

**Estimated Costs:**
- App Engine Standard (Backend): ~$36/month
- App Engine Flexible (Chatbot): ~$72/month
- App Engine Flexible (RL Service): ~$108/month
- Cloud SQL db-f1-micro: ~$7/month
- Cloud Storage: ~$0.50/month
- **Total: ~$220/month**

**For 2-Week Demo:**
- Total cost: ~$110
- Within $300 free credits ✅

**Cost Optimization:**
- Use min_instances: 0 to scale to zero when idle
- Stop services when not in use: `gcloud app services set-traffic <service> --splits v1=0`
- Delete project after demo: `gcloud projects delete wealtharena-prod`

---

## Monitoring

**View logs:**
```bash
# Backend logs
gcloud app logs tail -s default

# Chatbot logs
gcloud app logs tail -s chatbot

# RL service logs
gcloud app logs tail -s rl-service
```

**View metrics in Cloud Console:**
- Navigate to: https://console.cloud.google.com/appengine
- Select service
- View: Requests, Latency, Errors, Instance count

---

## Next Steps

After completing Phase 12:
1. ✅ Verify all services deployed to GCP
2. ✅ Test frontend with GCP backend
3. ✅ Compare performance: Azure vs GCP
4. ✅ Document deployment URLs
5. ➡️ Proceed to Phase 13: End-to-End Testing
6. ➡️ Prepare demo presentation

## Success Criteria

✅ **Infrastructure Provisioned:**
- GCP project created
- App Engine initialized
- Cloud SQL instance running
- Cloud Storage bucket created
- Secrets configured

✅ **Services Deployed:**
- Backend: https://wealtharena-prod.appspot.com
- Chatbot: https://chatbot-dot-wealtharena-prod.appspot.com
- RL Service: https://rl-service-dot-wealtharena-prod.appspot.com

✅ **Database:**
- PostgreSQL schema deployed
- Tables created (14 tables)
- Sample data inserted

✅ **Integration:**
- Backend → Chatbot proxy working
- Backend → RL Service proxy working
- All services → Cloud SQL connected
- RL Service → Cloud Storage (models) working

✅ **Frontend:**
- .env.gcp configured with GCP URLs
- Mobile app connects to GCP backend
- All pages functional

**Phase 12 Status:** ✅ GCP Deployment Complete

**Total Deployment Time:** 60-90 minutes (including schema adaptation and testing)


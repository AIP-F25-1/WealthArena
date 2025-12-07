# GCP Deployment Scripts

Quick reference for deploying WealthArena to Google Cloud Platform.

## Scripts Overview

### Infrastructure Setup

- **setup_gcp_infrastructure.ps1** - Provision all GCP resources (project, Cloud SQL, Storage, secrets)
- **Execution time:** 10-15 minutes
- **Run once:** Before first deployment

### Service Deployment

- **deploy_all_services.ps1** - Deploy all three services (Backend, Chatbot, RL)
- **Execution time:** 40-60 minutes
- **Run:** For initial deployment and updates

### Individual Service Deployment

- **deploy_backend.ps1** - Deploy backend only (5-8 min)
- **deploy_chatbot.ps1** - Deploy chatbot only (15-25 min)
- **deploy_rl_service.ps1** - Deploy RL service only (20-30 min)

### Utilities

- **upload_models.ps1** - Upload model checkpoints to Cloud Storage (5-10 min)
- **configure_app_settings.ps1** - Configure environment variables for all services
- **test_deployments.ps1** - Run health checks and integration tests

## Quick Start

**First-Time Deployment:**

```powershell
# 1. Setup infrastructure
cd scripts/gcp_deployment
.\setup_gcp_infrastructure.ps1

# 2. Deploy all services
.\deploy_all_services.ps1

# 3. Test deployment
.\test_deployments.ps1
```

**Update Deployment:**

```powershell
# Deploy specific service
.\deploy_backend.ps1
# or
.\deploy_chatbot.ps1
# or
.\deploy_rl_service.ps1
```

## Service URLs

After deployment:

- Backend: https://wealtharena-prod.appspot.com
- Chatbot: https://chatbot-dot-wealtharena-prod.appspot.com
- RL Service: https://rl-service-dot-wealtharena-prod.appspot.com

## Common Commands

**View logs:**

```bash
gcloud app logs tail -s default  # Backend
gcloud app logs tail -s chatbot  # Chatbot
gcloud app logs tail -s rl-service  # RL Service
```

**Stop services (save costs):**

```bash
gcloud app services set-traffic default --splits v1=0
gcloud app services set-traffic chatbot --splits v1=0
gcloud app services set-traffic rl-service --splits v1=0
```

**Start services:**

```bash
gcloud app services set-traffic default --splits v1=1
gcloud app services set-traffic chatbot --splits v1=1
gcloud app services set-traffic rl-service --splits v1=1
```

**Delete project (cleanup):**

```bash
gcloud projects delete wealtharena-prod
```

## Troubleshooting

See PHASE12_GCP_DEPLOYMENT_GUIDE.md for detailed troubleshooting steps.

## Cost Estimate

- **2-week demo:** ~$110 (within $300 free credits)
- **Monthly:** ~$220

## Support

For issues:

1. Check deployment logs
2. Review PHASE12_GCP_DEPLOYMENT_GUIDE.md
3. Check GCP Console for error messages
4. Compare with working Azure deployment (Phase 11)


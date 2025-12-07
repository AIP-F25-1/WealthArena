# Phase 13: Azure Resource Name Conflicts Resolution

## Problem Analysis

### Issues Discovered
All planned resource names are already taken globally across Azure:
- ❌ Storage Account: `stwealtharenadev` - Already taken (different subscription)
- ❌ SQL Server: `sql-wealtharena-dev` - Already exists
- ❌ Cosmos DB: `cosmos-wealtharena-dev` - DNS taken
- ❌ Container Registry: `acrwealtharenadev` - DNS taken
- ❌ Key Vault: `kv-wealtharena-dev` - Exists elsewhere
- ❌ Data Factory: `adf-wealtharena-dev` - Name in use

### Root Cause
Previous deployments (possibly different subscription or deleted but not purged) have reserved these globally unique names.

### Current Status
✅ Resource Group: `rg-wealtharena-northcentralus` - Created successfully  
✅ Databricks: `databricks-wealtharena-dev` - Created successfully  
❌ All other resources: Name conflicts

---

## Solution: Use Unique Suffixed Names

Azure resource names must be globally unique. We'll add a unique suffix to all names.

### New Resource Names

**Use a unique 4-character suffix appended to each resource:**

| Resource Type | Original Name | New Name Pattern | Example |
|--------------|---------------|------------------|---------|
| Storage Account | stwealtharenadev | stwealtharena{suffix} | stwealtharenawx82 |
| SQL Server | sql-wealtharena-dev | sql-wealtharena-{suffix} | sql-wealtharena-wx82 |
| Cosmos DB | cosmos-wealtharena-dev | cosmos-wealtharena-{suffix} | cosmos-wealtharena-wx82 |
| Container Registry | acrwealtharenadev | acrwealtharena{suffix} | acrwealtharenawx82 |
| Key Vault | kv-wealtharena-dev | kv-wealtharena-{suffix} | kv-wealtharena-wx82 |
| Data Factory | adf-wealtharena-dev | adf-wealtharena-{suffix} | adf-wealtharena-wx82 |

**Generate 4-character suffix:** Random alphanumeric (e.g., wx82, bz45, ck78)

---

## Implementation Options

### Option A: Modify setup_master.ps1 with Suffix Parameter ⭐ RECOMMENDED

**Pros:**
- Clean, reusable solution
- Single deployment
- Professional approach

**Cons:**
- Requires script modification
- Need to update all references

**Action:**
```powershell
# Modify setup_master.ps1 to accept a unique suffix
param(
    [string]$UniqueSuffix = $(Get-Random -Minimum 1000 -Maximum 9999),
    # ... other params
)

# Use suffix in resource names
$storageAccount = "stwealtharena$UniqueSuffix"
$sqlServer = "sql-wealtharena-$UniqueSuffix"
# etc.
```

---

### Option B: Create New setup_master_with_suffix.ps1 ⚡ FASTEST

**Pros:**
- Immediate solution
- No modification of existing script
- Clear separation

**Cons:**
- Duplicate code
- Maintenance overhead

**Action:**
Copy setup_master.ps1 and hardcode unique suffix in all resource names.

---

### Option C: Use Azure Management Portal ⚙️ MANUAL

**Pros:**
- Visual creation
- Direct control
- No scripting

**Cons:**
- Time-consuming
- Error-prone
- Not repeatable

---

### Option D: Accept Minimal Deployment

**Pros:**
- Only create what's needed
- Fastest option
- Focus on testing

**Cons:**
- Incomplete infrastructure
- Some features won't work
- Not production-ready

**Minimal Resources for Testing:**
1. ✅ Databricks (already created)
2. Create: SQL Database with unique name
3. Skip: Storage Account, Cosmos DB, Container Registry, etc.

---

## Recommendation

**Use Option B: Create setup_master_unique.ps1**

**Rationale:**
- Fastest to implement (5 minutes)
- Zero risk to existing scripts
- Clean deployment path
- Can test immediately

---

## Execution Plan

### Step 1: Generate Unique Suffix
```powershell
$suffix = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 4 | ForEach-Object {[char]$_})
# Example result: "wx82"
```

### Step 2: Create Modified Script
Copy `setup_master.ps1` to `setup_master_unique.ps1` with all resource names updated to include suffix.

### Step 3: Deploy
```powershell
.\azure_infrastructure\setup_master_unique.ps1 -Suffix "wx82"
```

### Step 4: Update Configuration Files
Update all `.env` files and configuration references to use new resource names.

---

## Next Steps

**Please choose:**

**A)** Create setup_master_unique.ps1 with random suffix  
**B)** Create setup_master_unique.ps1 with specified suffix (you provide)  
**C)** Use Azure Portal to create resources manually  
**D)** Deploy minimal resources only (SQL + Databricks)

**Awaiting your choice...**

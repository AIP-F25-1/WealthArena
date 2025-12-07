# Quick Configuration Guide for sqlDB.env

Your automation script detected placeholder credentials in `sqlDB.env`. Follow these steps to configure it.

## ✅ What's Working

- ✅ ODBC Driver 18 is installed
- ✅ Validation is working correctly
- ✅ Clear error messages are being shown

## 🔧 Next Steps: Configure Your Credentials

### Method 1: Interactive Helper Script (Easiest)

```powershell
cd data-pipeline
.\configure_sqldb.ps1
```

The script will:
- Prompt you for each credential
- Validate your inputs
- Automatically update `sqlDB.env`
- Show your current IP address for firewall rules

### Method 2: Manual Configuration

1. **Open `data-pipeline/sqlDB.env` in a text editor**

2. **Find your Azure SQL credentials:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to: **SQL Databases** → Your Database → **Connection Strings**
   - Or: **SQL Servers** → Your Server → **Overview**

3. **Update these four values:**

   ```env
   SQL_SERVER=your-actual-server.database.windows.net
   SQL_DB=your-actual-database-name
   SQL_UID=your-actual-username
   SQL_PWD=your-actual-password
   ```

   **Example:**
   ```env
   SQL_SERVER=myserver.database.windows.net
   SQL_DB=WealthArenaDB
   SQL_UID=sqladmin
   SQL_PWD=MySecurePassword123!
   ```

4. **Save the file**

## 🔥 Configure Firewall Rule

After configuring credentials, you'll also need to allow your IP address in Azure SQL firewall:

### Option A: Azure Portal (Recommended)

1. Go to **Azure Portal** → **SQL Servers** → Your Server
2. Click **Networking** or **Firewalls and virtual networks**
3. Click **Add client IP** (this auto-detects your current IP)
   - OR manually add: `216.165.208.205` (your current IP from previous logs)
4. Click **Save**
5. Wait 2-5 minutes for the change to take effect

### Option B: Azure CLI

```powershell
az sql server firewall-rule create \
  --resource-group <your-resource-group> \
  --server <your-server-name> \
  --name AllowMyIP \
  --start-ip-address 216.165.208.205 \
  --end-ip-address 216.165.208.205
```

## ✅ Verify Configuration

After configuring, test your connection:

```powershell
cd data-pipeline
python -c "from dbConnection import get_conn; conn = get_conn(); print('✅ Connected successfully!')"
```

## 🚀 Re-run Phase 3

Once configured and firewall rule is added:

```powershell
.\master_automation.ps1 -StartFromPhase 3
```

## 📝 Where to Find Credentials

### If you already have an Azure SQL Database:

1. **Azure Portal** → **SQL Databases**
2. Click your database name
3. In the **Overview** section, you'll see:
   - **Server name**: This is your `SQL_SERVER`
   - **Database name**: This is your `SQL_DB`
4. For username/password: These were set when you created the SQL Server

### If you need to create an Azure SQL Database:

1. Follow Phase 1 setup instructions
2. Or use Azure Portal → Create SQL Database
3. During creation, you'll set the admin username and password

## ⚠️ Troubleshooting

### "Placeholder detected" after configuration
- Make sure you saved the file
- Check for typos in placeholder patterns (e.g., "your-sql-server" vs "your_server")
- Ensure no trailing spaces

### "Firewall blocking" error
- Wait 2-5 minutes after adding firewall rule
- Verify your IP address hasn't changed
- Check Azure Portal → Networking to confirm the rule exists

### "Login failed for user"
- Verify username format (may need `@server-name` suffix)
- Check password is correct
- Ensure user has proper permissions

## 📚 More Help

- **Detailed Setup**: See `SETUP_INSTRUCTIONS.md`
- **Phase 2 Guide**: See `README_PHASE2.md`
- **Automation Guide**: See `../README_AUTOMATION.md`

---

**Once configured, your Phase 3 will proceed to process and store your market data! 🎉**


# 🔧 Database Connection Troubleshooting

## Current Issue

**Error:** `Login failed for user 'wealtharenaadmin'`

This means the backend cannot connect to your Azure SQL Database.

---

## ✅ Solutions (Try in Order)

### Solution 1: Enable SQL Server Authentication

Your Azure SQL is probably set to **Azure AD Only** authentication.

1. **Go to Azure Portal** → https://portal.azure.com
2. **Find your SQL Server** (NOT the database):
   - Search for "wealtharenadb" in the top search bar
   - Click on your **SQL server** (has a server icon 🖥️)
3. **In the left menu, click "Authentication"**
4. **Select "SQL and Azure AD authentication"**
5. **Set SQL admin login:**
   - Username: `wealtharenaadmin`
   - Password: `WealthArena@admin`
6. **Click "Save"**
7. **Wait 2-3 minutes** for changes to apply

---

### Solution 2: Check Firewall Rules

Your IP address might be blocked.

1. **In Azure Portal** → Your SQL Server
2. **Left menu** → "Security" → "Networking"
3. **Add your current IP:**
   - Click "Add your client IPv4 address"
   - Or manually add: `0.0.0.0` to `255.255.255.255` (⚠️ Not recommended for production!)
4. **Enable:**
   - ☑️ "Allow Azure services and resources to access this server"
5. **Click "Save"**

---

### Solution 3: Verify Database Exists

1. **In Azure Portal** → Your SQL Server
2. **Click "SQL databases"** in the left menu
3. **Verify "wealtharenadb" exists**
4. **If not, create it:**
   - Click "+ Create database"
   - Name: `wealtharenadb`
   - Use the same server
   - Click "Review + Create"

---

### Solution 4: Test Connection with Azure Data Studio

1. **Download Azure Data Studio**: https://aka.ms/azuredatastudio
2. **Click "New Connection"**
3. **Enter:**
   - Server: `wealtharenadb.database.windows.net`
   - Authentication type: `SQL Login`
   - User name: `wealtharenaadmin`
   - Password: `WealthArena@admin`
   - Database: `wealtharenadb`
4. **Click "Connect"**

If this fails, your credentials are wrong or SQL auth is disabled.

---

### Solution 5: Create SQL Admin User

If you used Azure AD during setup, you need to create a SQL user:

1. **Connect to your database using Azure Portal Query Editor**
2. **Run this SQL:**

\`\`\`sql
CREATE LOGIN wealtharenaadmin WITH PASSWORD = 'WealthArena@admin';
CREATE USER wealtharenaadmin FROM LOGIN wealtharenaadmin;
ALTER ROLE db_owner ADD MEMBER wealtharenaadmin;
\`\`\`

---

## 🧪 Test the Connection

After fixing, run:

\`\`\`bash
cd WealthArena_Backend
node test-db.js
\`\`\`

You should see:
\`\`\`
✅ Connected to Azure SQL Database successfully!
\`\`\`

---

## 📊 Alternative: Use a Different Database

If Azure SQL is too complex, you can use a local database for testing:

### Option A: SQL Server LocalDB (Windows)

\`\`\`bash
# Install SQL Server Express
# Then update .env:
DB_HOST=localhost
DB_NAME=WealthArenaDB
DB_USER=sa
DB_PASSWORD=YourPassword123!
DB_ENCRYPT=false
\`\`\`

### Option B: Mock Database Mode

Create a file `WealthArena_Backend/.env.local`:

\`\`\`env
USE_MOCK_DB=true
\`\`\`

This will run the backend with in-memory mock data (no real database needed).

---

## 🆘 Still Having Issues?

1. **Check the actual error** by running:
   \`\`\`bash
   npm run dev
   \`\`\`
   
2. **Verify your .env file**:
   \`\`\`bash
   cat .env
   \`\`\`

3. **Check if port 1433 is blocked** by your firewall

4. **Try pinging the server**:
   \`\`\`bash
   Test-NetConnection -ComputerName wealtharenadb.database.windows.net -Port 1433
   \`\`\`

---

## ✅ Once Fixed

Run these commands to start everything:

\`\`\`bash
# Terminal 1 - Backend
cd WealthArena_Backend
npm run dev

# Terminal 2 - Frontend
cd WealthArena
npm start
\`\`\`

The backend should show:
\`\`\`
🚀 ========================================
🚀  WealthArena Backend Server Started
🚀 ========================================
\`\`\`


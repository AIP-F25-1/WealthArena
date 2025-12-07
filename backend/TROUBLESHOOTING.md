# Backend Troubleshooting Guide

## Overview

This guide covers common issues and solutions for the WealthArena backend service, including database connectivity, CORS configuration, environment variables, port conflicts, Key Vault access, health checks, and deployment errors.

## Database Connection Issues

### Azure SQL Database Connection

#### Error: "Login failed for user 'wealtharenaadmin'"

**Cause:** Azure SQL is set to Azure AD Only authentication, or SQL authentication is disabled.

**Solution 1: Enable SQL Server Authentication**

1. Go to [Azure Portal](https://portal.azure.com)
2. Find your SQL Server (NOT the database):
   - Search for "wealtharenadb" in the top search bar
   - Click on your **SQL server** (has a server icon 🖥️)
3. In the left menu, click "Authentication"
4. Select "SQL and Azure AD authentication"
5. Set SQL admin login:
   - Username: `wealtharenaadmin`
   - Password: `WealthArena@admin`
6. Click "Save"
7. Wait 2-3 minutes for changes to apply

**Solution 2: Check Firewall Rules**

1. In Azure Portal → Your SQL Server
2. Left menu → "Security" → "Networking"
3. Add your current IP:
   - Click "Add your client IPv4 address"
   - Or manually add: `0.0.0.0` to `255.255.255.255` (⚠️ Not recommended for production!)
4. Enable:
   - ☑️ "Allow Azure services and resources to access this server"
5. Click "Save"

**Solution 3: Verify Database Exists**

1. In Azure Portal → Your SQL Server
2. Click "SQL databases" in the left menu
3. Verify "wealtharenadb" exists
4. If not, create it:
   - Click "+ Create database"
   - Name: `wealtharenadb`
   - Use the same server
   - Click "Review + Create"

**Solution 4: Test Connection with Azure Data Studio**

1. Download Azure Data Studio: https://aka.ms/azuredatastudio
2. Click "New Connection"
3. Enter:
   - Server: `wealtharenadb.database.windows.net`
   - Authentication type: `SQL Login`
   - User name: `wealtharenaadmin`
   - Password: `WealthArena@admin`
   - Database: `wealtharenadb`
4. Click "Connect"

If this fails, your credentials are wrong or SQL auth is disabled.

**Solution 5: Create SQL Admin User**

If you used Azure AD during setup, you need to create a SQL user:

1. Connect to your database using Azure Portal Query Editor
2. Run this SQL:

```sql
CREATE LOGIN wealtharenaadmin WITH PASSWORD = 'WealthArena@admin';
CREATE USER wealtharenaadmin FROM LOGIN wealtharenaadmin;
ALTER ROLE db_owner ADD MEMBER wealtharenaadmin;
```

#### Test Database Connection

After fixing, run:

```bash
cd backend
node test-db.js
```

You should see:
```
✅ Connected to Azure SQL Database successfully!
```

#### Alternative: Use Local Database

**Option A: SQL Server LocalDB (Windows)**

```bash
# Install SQL Server Express
# Then update .env:
DB_HOST=localhost
DB_NAME=WealthArenaDB
DB_USER=sa
DB_PASSWORD=YourPassword123!
DB_ENCRYPT=false
```

**Option B: PostgreSQL (Local)**

```bash
# Install PostgreSQL
# Then update .env:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wealtharenadb
DB_USER=postgres
DB_PASSWORD=YourPassword123!
```

**Option C: Mock Database Mode**

Create a file `backend/.env.local`:

```env
USE_MOCK_DB=true
```

This will run the backend with in-memory mock data (no real database needed).

### PostgreSQL Connection Issues

#### Error: "Connection refused" or "ECONNREFUSED"

**Solutions:**

1. **Verify PostgreSQL is running:**
   ```bash
   # Windows
   Get-Service postgresql*
   
   # macOS/Linux
   sudo systemctl status postgresql
   ```

2. **Check connection string in `.env`:**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=wealtharenadb
   DB_USER=postgres
   DB_PASSWORD=YourPassword123!
   ```

3. **Test connection:**
   ```bash
   psql -h localhost -U postgres -d wealtharenadb
   ```

4. **Check firewall rules:**
   - Ensure port 5432 is open
   - Check PostgreSQL `pg_hba.conf` for allowed connections

### Database Connection Pooling Issues

#### Error: "Too many connections" or "Connection pool exhausted"

**Solutions:**

1. **Reduce connection pool size in `.env`:**
   ```env
   DB_POOL_MIN=2
   DB_POOL_MAX=10
   ```

2. **Check for connection leaks:**
   - Ensure all database connections are properly closed
   - Use connection pooling libraries correctly

3. **Increase database connection limit:**
   - For Azure SQL: Check service tier limits
   - For PostgreSQL: Adjust `max_connections` in `postgresql.conf`

## CORS Errors

### Error: "CORS policy blocking requests"

**Symptoms:**
- Browser console shows CORS errors
- API requests fail with CORS-related errors
- Frontend cannot connect to backend

**Solutions:**

1. **Check `ALLOWED_ORIGINS` in `.env`:**
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006,https://yourdomain.com
   ```

2. **Verify frontend URL is in allowed origins list:**
   - Check the exact URL (including port) in browser
   - Add it to `ALLOWED_ORIGINS` if missing

3. **For development, ensure CORS middleware is configured:**
   ```typescript
   // In backend/src/app.ts or similar
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
     credentials: true
   }));
   ```

4. **Check CORS headers in response:**
   ```bash
   curl -I http://localhost:3000/api/health
   ```
   Should include `Access-Control-Allow-Origin` header

5. **For production, use specific origins:**
   ```env
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```
   Never use `*` in production!

## Environment Variables

### Error: "Environment variable not found" or "undefined"

**Solutions:**

1. **Verify `.env` file exists:**
   ```bash
   ls -la backend/.env
   ```

2. **Check `.env` file format:**
   ```env
   # Correct format (no spaces around =)
   DB_HOST=localhost
   DB_PORT=5432
   
   # Wrong format
   DB_HOST = localhost  # ❌
   ```

3. **Load environment variables:**
   ```bash
   # Use dotenv or similar
   npm install dotenv
   ```
   
   In your code:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();
   ```

4. **Check for typos in variable names:**
   - Compare `.env` with `.env.example`
   - Ensure variable names match exactly

5. **Restart server after changing `.env`:**
   ```bash
   # Stop server (Ctrl+C)
   # Start again
   npm run dev
   ```

### Missing Environment Variables

**Common required variables:**

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wealtharenadb
DB_USER=postgres
DB_PASSWORD=YourPassword123!

# Server
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

# Azure Key Vault (if using)
AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# JWT (if using)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## Port Conflicts

### Error: "listen EADDRINUSE: address already in use :::3000"

**Solutions:**

1. **Find and kill process using port:**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # macOS/Linux
   lsof -ti:3000 | xargs kill
   ```

2. **Change port in `.env`:**
   ```env
   PORT=3001
   ```

3. **Use different port for development:**
   ```bash
   PORT=3001 npm run dev
   ```

4. **Check if another instance is running:**
   ```bash
   # Windows
   Get-Process node
   
   # macOS/Linux
   ps aux | grep node
   ```

## Key Vault Access Issues

### Error: "Not authorized" or "Access denied"

**Solutions:**

1. **Verify Azure credentials:**
   ```bash
   az login
   az account show
   ```

2. **Check Key Vault access policy:**
   - Go to Azure Portal → Your Key Vault
   - Click "Access policies"
   - Verify your service principal or user has access
   - Add "Get" and "List" permissions for secrets

3. **Verify environment variables:**
   ```env
   AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   AZURE_TENANT_ID=your-tenant-id
   ```

4. **Test Key Vault access:**
   ```bash
   az keyvault secret show --vault-name your-keyvault --name your-secret-name
   ```

5. **Use managed identity (recommended for Azure services):**
   - Enable managed identity on your Azure service
   - Grant Key Vault access to managed identity
   - Remove client ID/secret from environment variables

## Health Checks

### Error: "/api/health" returns 404

**Solutions:**

1. **Verify health route is registered:**
   ```typescript
   // In your routes file
   app.get('/api/health', (req, res) => {
     res.json({ status: 'healthy' });
   });
   ```

2. **Check route order:**
   - Health route should be registered before generic `/api` routes
   - Ensure it's not being caught by a catch-all route

3. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

4. **Check server is running:**
   ```bash
   # Check if server is listening
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000  # macOS/Linux
   ```

### Health Check Failing

**Symptoms:** Health check returns 500 or unhealthy status

**Solutions:**

1. **Check database connectivity:**
   ```typescript
   // In health check
   try {
     await db.query('SELECT 1');
     // Database is healthy
   } catch (error) {
     // Database connection failed
   }
   ```

2. **Check external dependencies:**
   - Verify all required services are running
   - Check API endpoints are accessible

3. **Review health check logic:**
   - Ensure health check doesn't fail on non-critical errors
   - Return appropriate status codes

## Metrics Endpoint Issues

### Error: "/api/metrics" returns 404

**Solutions:**

1. **Verify metrics route is registered:**
   ```typescript
   // In your routes file
   import { metricsRouter } from './routes/metrics';
   app.use('/api/metrics', metricsRouter);
   ```

2. **Check route order:**
   - Metrics route should be registered before generic `/api` routes
   - Ensure it's not being caught by a catch-all route

3. **Verify Prometheus client is installed:**
   ```bash
   npm list prom-client
   ```

4. **Test metrics endpoint:**
   ```bash
   curl http://localhost:3000/api/metrics
   ```

### Metrics Not Showing

**Solutions:**

1. **Check Prometheus client initialization:**
   ```typescript
   import { Registry, Counter, Histogram } from 'prom-client';
   
   const register = new Registry();
   const httpRequestCounter = new Counter({
     name: 'http_requests_total',
     help: 'Total number of HTTP requests',
     registers: [register]
   });
   ```

2. **Verify metrics are being collected:**
   - Check middleware is recording metrics
   - Verify counters/histograms are being incremented

3. **Check metrics format:**
   - Metrics should be in Prometheus text format
   - Content-Type should be `text/plain`

## Module Not Found Errors

### Error: "Cannot find module '...'"

**Solutions:**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Check `package.json` includes the module:**
   ```bash
   npm list <module-name>
   ```

3. **Clear node_modules and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Check import paths:**
   ```typescript
   // Correct
   import { something } from './module';
   
   // Wrong
   import { something } from './Module';  // Case sensitive
   ```

5. **Verify TypeScript paths (if using):**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

## Performance Issues

### Slow Response Times

**Solutions:**

1. **Check database query performance:**
   ```sql
   -- Enable query logging
   SET log_min_duration_statement = 1000;  -- Log queries > 1s
   ```

2. **Review middleware stack:**
   - Remove unnecessary middleware
   - Optimize middleware order

3. **Monitor memory usage:**
   ```bash
   # Check Node.js memory usage
   node --max-old-space-size=4096 server.js
   ```

4. **Check for memory leaks:**
   - Use Node.js memory profiler
   - Monitor heap size over time

5. **Optimize database queries:**
   - Add indexes for frequently queried columns
   - Use connection pooling
   - Implement query caching

### High Memory Usage

**Solutions:**

1. **Review connection pooling settings:**
   ```env
   DB_POOL_MIN=2
   DB_POOL_MAX=10
   ```

2. **Check for unclosed database connections:**
   - Ensure all connections are properly closed
   - Use connection pooling libraries

3. **Monitor for memory leaks:**
   - Use Node.js memory profiler
   - Check for circular references
   - Review event listener cleanup

4. **Increase memory limit:**
   ```bash
   node --max-old-space-size=4096 server.js
   ```

## Deployment Issues

### Common Deployment Errors

#### Error: "Build failed" or "Deployment failed"

**Solutions:**

1. **Check build logs:**
   - Review deployment logs for specific errors
   - Check for missing dependencies

2. **Verify environment variables:**
   - Ensure all required variables are set in deployment environment
   - Check for typos or missing values

3. **Check Node.js version:**
   - Verify deployment environment matches local Node.js version
   - Update `package.json` engines if needed:
     ```json
     "engines": {
       "node": ">=18.0.0"
     }
     ```

4. **Verify dependencies:**
   - Ensure `package-lock.json` is committed
   - Check for platform-specific dependencies

#### Error: "Service unavailable" or "502 Bad Gateway"

**Solutions:**

1. **Check application logs:**
   ```bash
   # Azure App Service
   az webapp log tail --name your-app-name --resource-group your-resource-group
   ```

2. **Verify health check endpoint:**
   - Ensure `/api/health` is accessible
   - Check health check is returning 200 OK

3. **Check resource limits:**
   - Verify CPU and memory limits are sufficient
   - Check for resource exhaustion

4. **Review startup time:**
   - Ensure application starts within timeout period
   - Optimize startup process if needed

## Logging

### Enable Debug Logging

```bash
# Set NODE_ENV to development
NODE_ENV=development npm run dev

# Or set LOG_LEVEL
LOG_LEVEL=debug npm run dev
```

### Check Application Logs

```bash
# Local development
npm run dev
# Check console output

# Production (Azure App Service)
az webapp log tail --name your-app-name --resource-group your-resource-group

# Production (Docker)
docker logs <container-id>
```

### Log File Locations

- **Local development:** Console output
- **Azure App Service:** Application Insights or Log Stream
- **Docker:** Container logs
- **File-based logging:** Check configured log directory

## Getting Help

### Before Asking for Help

1. **Check application logs** for detailed error messages
2. **Review error messages** and stack traces
3. **Verify environment configuration** in `.env` file
4. **Check database connectivity** using test scripts
5. **Review recent code changes** that might have caused the issue

### Useful Debugging Commands

```bash
# Test database connection
node test-db.js

# Check server status
curl http://localhost:3000/api/health

# View environment variables (without secrets)
node -e "console.log(process.env)"

# Check port usage
netstat -ano | findstr :3000  # Windows
lsof -i :3000  # macOS/Linux

# Test API endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/metrics
```

### Common Issues Checklist

- [ ] Database connection configured correctly
- [ ] Environment variables set properly
- [ ] Port not in use by another process
- [ ] CORS configured for frontend URL
- [ ] Dependencies installed (`npm install`)
- [ ] Server is running and accessible
- [ ] Health check endpoint returns 200 OK
- [ ] Logs show no critical errors

## Additional Resources

- **Azure SQL Troubleshooting**: https://docs.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-connectivity-issues
- **PostgreSQL Troubleshooting**: https://www.postgresql.org/docs/current/runtime-config-logging.html
- **Node.js Debugging**: https://nodejs.org/en/docs/guides/debugging-getting-started/

---

*Last Updated: 2025*
*Status: Production Ready* ✅

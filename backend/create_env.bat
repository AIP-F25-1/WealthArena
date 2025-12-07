@echo off
REM Create .env file for backend service

if exist .env (
    echo .env file already exists. Skipping creation.
    exit /b 0
)

(
echo # WealthArena Backend Environment Configuration
echo.
echo # Azure SQL Database Configuration ^(Phase 1 credentials^)
echo DB_HOST=sql-wealtharena-dev.database.windows.net
echo DB_NAME=wealtharena_db
echo DB_USER=wealtharena_admin
echo DB_PASSWORD=WealthArena2024!@#$%%
echo DB_PORT=1433
echo DB_ENCRYPT=true
echo.
echo # Azure Storage ^(optional for Phase 1^)
echo AZURE_STORAGE_ACCOUNT=stwealtharenadev
echo AZURE_STORAGE_CONNECTION_STRING=your-storage-connection-string
echo.
echo # Azure Cosmos DB ^(optional - backend doesn't use this yet^)
echo AZURE_COSMOS_ACCOUNT=cosmos-wealtharena-dev
echo AZURE_COSMOS_CONNECTION_STRING=your-cosmos-connection-string
echo.
echo # Server Configuration
echo PORT=3000
echo NODE_ENV=development
echo.
echo # Redis Configuration ^(optional for Phase 1^)
echo REDIS_HOST=localhost
echo REDIS_PORT=6379
echo REDIS_PASSWORD=
echo REDIS_DB=0
echo.
echo # JWT ^& Security
echo JWT_SECRET=wealtharena-jwt-secret-change-this-in-production-12345
echo JWT_EXPIRES_IN=7d
echo BCRYPT_ROUNDS=10
echo.
echo # OpenAI API ^(for AI features^)
echo OPENAI_API_KEY=your-openai-api-key-here
echo.
echo # Alpha Vantage API ^(for market data^)
echo ALPHA_VANTAGE_API_KEY=your-alpha-vantage-api-key-here
echo.
echo # CORS Configuration
echo ALLOWED_ORIGINS=http://localhost:5001,http://localhost:8081,http://localhost:3000
echo.
echo # API Configuration
echo API_VERSION=v1
echo.
echo # Service URLs
echo CHATBOT_API_URL=http://localhost:5001
echo RL_API_URL=http://localhost:5002
) > .env

echo Created .env file successfully


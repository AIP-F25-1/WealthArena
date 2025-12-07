# dbConnection.py
from __future__ import annotations

import os, re, socket, sys
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
import pyodbc
from dotenv import load_dotenv

ENV_PATH = Path(__file__).with_name("sqlDB.env")
load_dotenv(ENV_PATH)

DEF_DRIVER = "ODBC Driver 18 for SQL Server"
DEF_PORT   = 1433  # Default SQL Server port, but can be overridden for PostgreSQL (5432)
DEBUG      = os.getenv("SQL_CONN_DEBUG", "false").strip().lower() in {"1","true","yes"}

def _log(msg: str):
    if DEBUG:
        print(f"[dbConnection] {msg}")

def _need(k: str) -> str:
    v = os.getenv(k)
    if not v:
        raise RuntimeError(f"Missing env var {k} in {ENV_PATH}")
    return v

def _mask(s: str) -> str:
    # mask password in URI/ODBC strings
    s = re.sub(r"(PWD|Password)=([^;]+)", r"\1=****", s, flags=re.I)
    s = re.sub(r"://([^:]+):([^@]+)@", r"://\\1:****@", s)
    return s

def _tcp_preflight(host: str, port: int, timeout=4) -> None:
    _log(f"TCP preflight -> {host}:{port}")
    with socket.create_connection((host, port), timeout=timeout):
        return

def _sanitize_server(raw: str) -> tuple[str, int]:
    s = (raw or "").strip()
    if not s:
        raise RuntimeError("SQL_SERVER is empty")
    if ";" in s or "?" in s:
        raise RuntimeError("SQL_SERVER must be host[,port] (optionally tcp:). Don’t append attributes here.")
    if s.lower().startswith("tcp:"):
        s = s[4:]
    if "," in s:
        host, port_s = s.split(",", 1)
        try: port = int(port_s)
        except ValueError: port = DEF_PORT
    else:
        host, port = s, DEF_PORT
    host = host.strip()
    if not host:
        raise RuntimeError("SQL_SERVER resolved to empty host")
    return host, port

def _pick_airflow_conn_uri() -> str | None:
    prefs = ["AIRFLOW_CONN_AZURE_SQL", "AIRFLOW_CONN_AZURE_SQL_DEFAULT", "AIRFLOW_CONN_MSSQL_DEFAULT"]
    for k in prefs:
        v = os.getenv(k)
        if v: return v
    for k, v in os.environ.items():
        if not k.startswith("AIRFLOW_CONN_") or not v: continue
        vl = v.lower()
        if vl.startswith(("mssql://","mssql+pyodbc://","sqlserver://","sqlserver+pyodbc://","tsql://")):
            return v
    return None

# ------------ ODBC helpers ------------
_ODBC_KV = re.compile(r"(?:^|;)\s*([^=;]+)\s*=\s*([^;]*)")

def _odbc_get(dsn: str, key: str) -> str | None:
    for k, v in _ODBC_KV.findall(dsn):
        if k.strip().lower() == key.lower():
            return v.strip()
    return None

def _extract_server_port_from_odbc(odbc_str: str) -> tuple[str|None, int]:
    # Accept SERVER=host or SERVER=tcp:host,port or SERVER=host,port
    server = _odbc_get(odbc_str, "SERVER") or _odbc_get(odbc_str, "Server")
    if not server:
        return None, DEF_PORT
    s = server.strip()
    if s.lower().startswith("tcp:"):
        s = s[4:]
    if "," in s:
        h, p = s.split(",", 1)
        try: port = int(p)
        except: port = DEF_PORT
        return h.strip(), port
    return s, DEF_PORT

def _connect_from_pyodbc_string(odbc_conn_str: str):
    if "DRIVER=" not in odbc_conn_str.upper():
        raise RuntimeError("String doesn't look like an ODBC connection string.")
    host, port = _extract_server_port_from_odbc(odbc_conn_str)
    if host:
        try:
            _tcp_preflight(host, port)
        except Exception as e:
            raise RuntimeError(
                f"TCP preflight failed to {host}:{port}. "
                "Whitelist worker egress IP on Azure SQL, check VNet/private endpoint, firewall, and DNS."
            ) from e
    _log(f"pyodbc.connect(ODBC): {_mask(odbc_conn_str)}")
    if host:
        print(f"[INFO] Attempting connection to {host}:{port}")
    return pyodbc.connect(odbc_conn_str)

def _connect_from_uri(uri: str):
    s = uri.strip()
    # Accept raw ODBC string passed as env
    if s.upper().startswith("DRIVER="):
        return _connect_from_pyodbc_string(s)

    p = urlparse(s)
    scheme = (p.scheme or "").lower()

    # Airflow/SQLAlchemy format with pyodbc + odbc_connect
    if scheme in {"mssql+pyodbc", "sqlserver+pyodbc"}:
        qs = parse_qs(p.query or "")
        if "odbc_connect" in qs and qs["odbc_connect"]:
            odbc_decoded = unquote(qs["odbc_connect"][0])
            return _connect_from_pyodbc_string(odbc_decoded)
        # else fall through to plain mssql handling
        scheme = "mssql"

    if scheme in {"mssql", "sqlserver", "tsql"}:
        user = unquote(p.username or "")
        pwd  = unquote(p.password or "")
        host = p.hostname or ""
        port = p.port or DEF_PORT
        db   = (p.path or "/").lstrip("/")

        qs = parse_qs(p.query or "")
        driver  = (qs.get("driver", [DEF_DRIVER])[0]).replace("+", " ")
        encrypt = qs.get("Encrypt", ["yes"])[0]
        tsc     = qs.get("TrustServerCertificate", ["no"])[0]

        try:
            if host:
                _tcp_preflight(host, int(port))
        except Exception as e:
            raise RuntimeError(
                f"TCP preflight failed to {host}:{port}. "
                "Whitelist worker egress IP on Azure SQL, check VNet/private endpoint, firewall, and DNS."
            ) from e

        conn_str = (
            f"DRIVER={{{driver}}};SERVER=tcp:{host},{port};DATABASE={db};"
            f"UID={user};PWD={pwd};Encrypt={encrypt};TrustServerCertificate={tsc};"
            "MultiSubnetFailover=Yes;Connection Timeout=30;"
        )
        _log(f"pyodbc.connect(URI->ODBC): {_mask(conn_str)}")
        print(f"[INFO] Attempting connection to {host}:{port} (database: {db})")
        return pyodbc.connect(conn_str)

    # Generic rescue: look for odbc_connect even with odd schemes
    qs = parse_qs(p.query or "")
    if "odbc_connect" in qs and qs["odbc_connect"]:
        odbc_decoded = unquote(qs["odbc_connect"][0])
        return _connect_from_pyodbc_string(odbc_decoded)

    raise RuntimeError("Unsupported SQL URI/driver format.")

def _connect_from_parts():
    driver = os.getenv("SQL_DRIVER", DEF_DRIVER)
    server_raw = _need("SQL_SERVER")
    db     = _need("SQL_DB")
    uid    = _need("SQL_UID")
    pwd    = _need("SQL_PWD")
    # Get port from env or use default based on driver
    port_env = os.getenv("SQL_PORT")
    if port_env:
        try:
            default_port = int(port_env)
        except ValueError:
            default_port = DEF_PORT
    else:
        # Auto-detect port based on driver: PostgreSQL uses 5432, SQL Server uses 1433
        if "PostgreSQL" in driver:
            default_port = 5432
        else:
            default_port = DEF_PORT

    # Check for placeholder values
    # Only flag obvious placeholders, not valid values that happen to contain common words
    placeholder_patterns = [
        # For SQL_SERVER: flag if starts with "your-" or "your_" (localhost is valid for local development)
        ("SQL_SERVER", server_raw, lambda v: v.lower().startswith("your-") or 
                                                v.lower().startswith("your_")),
        # For SQL_DB: flag if starts with "your_" or exact match to placeholder
        ("SQL_DB", db, lambda v: v.lower().startswith("your_") or 
                               v.lower() in ["your_database_name", "your_database", "your_db", "test"]),
        # For SQL_UID: only flag if starts with "your_" or is an exact match to common defaults
        # Don't flag valid usernames like "wealtharena_admin" just because they contain "admin"
        ("SQL_UID", uid, lambda v: v.lower().startswith("your_") or 
                                 v.lower() in ["your_username", "your_user", "sa", "admin", "root"]),
        # For SQL_PWD: flag if starts with "your_" or matches common placeholder passwords
        ("SQL_PWD", pwd, lambda v: v.lower().startswith("your_") or 
                                  v.lower() in ["your_password", "your_password_here", "password", "123456", "your_password_here"]),
    ]
    
    placeholder_found = []
    for var_name, value, check_func in placeholder_patterns:
        if check_func(value):
            placeholder_found.append(f"{var_name}={value}")
    
    if placeholder_found:
        error_msg = (
            f"\n{'='*70}\n"
            f"❌ CONFIGURATION ERROR: Placeholder credentials detected!\n"
            f"{'='*70}\n"
            f"The following environment variables still contain placeholder values:\n"
            f"{chr(10).join('  - ' + p for p in placeholder_found)}\n\n"
            f"CONFIGURATION REQUIRED:\n"
            f"  1. Open data-pipeline/sqlDB.env in a text editor\n"
            f"  2. Replace ALL placeholder values with your actual database credentials:\n"
            f"     - SQL_SERVER: Your database server (localhost for local)\n"
            f"     - SQL_DB: Your database name\n"
            f"     - SQL_UID: Your database username\n"
            f"     - SQL_PWD: Your database password\n"
            f"     - SQL_PORT: Database port (5432 for PostgreSQL, 1433 for SQL Server)\n\n"
            f"  3. Save the file and try again\n"
            f"{'='*70}\n"
        )
        print(error_msg, file=sys.stderr)
        raise RuntimeError("Placeholder credentials detected in sqlDB.env. Please configure with actual Azure SQL credentials.")

    host, port_from_server = _sanitize_server(server_raw)
    # Use port from server string if provided, otherwise use default_port
    port = port_from_server if port_from_server != DEF_PORT else default_port
    try:
        _tcp_preflight(host, port)
    except Exception as e:
        db_type = "PostgreSQL" if "PostgreSQL" in driver else "SQL Server"
        raise RuntimeError(
            f"TCP preflight failed to {host}:{port}. "
            f"Check that {db_type} is running and accessible. "
            f"For PostgreSQL, ensure it's listening on port {port}. "
            f"For SQL Server, check firewall and network settings."
        ) from e

    # Build connection string based on driver type
    if "PostgreSQL" in driver:
        # PostgreSQL ODBC connection string
        conn_str = (
            f"DRIVER={{{driver}}};SERVER={host};PORT={port};DATABASE={db};UID={uid};PWD={pwd};"
        )
    else:
        # SQL Server ODBC connection string
        conn_str = (
            f"DRIVER={{{driver}}};SERVER=tcp:{host},{port};DATABASE={db};UID={uid};PWD={pwd};"
            "Encrypt=yes;TrustServerCertificate=no;MultiSubnetFailover=Yes;Connection Timeout=30;"
        )
    _log(f"pyodbc.connect(parts): {_mask(conn_str)}")
    print(f"[INFO] Attempting connection to {host}:{port} (database: {db})")
    try:
        return pyodbc.connect(conn_str)
    except pyodbc.InterfaceError as e:
        if "IM002" in str(e) or "Data source name not found" in str(e):
            available_drivers = ", ".join(pyodbc.drivers()) if pyodbc.drivers() else "None"
            
            # Detect which driver is needed based on configuration
            is_postgres = "PostgreSQL" in driver
            required_driver = "PostgreSQL ODBC Driver" if is_postgres else "ODBC Driver 18 for SQL Server"
            
            if is_postgres:
                error_msg = (
                    f"\n{'='*70}\n"
                    f"❌ CRITICAL ERROR: PostgreSQL ODBC Driver is not installed!\n"
                    f"{'='*70}\n"
                    f"Error: {str(e)}\n\n"
                    f"Your sqlDB.env is configured for PostgreSQL (SQL_DRIVER={driver}),\n"
                    f"but the PostgreSQL ODBC driver is not installed.\n\n"
                    f"Available ODBC drivers: {available_drivers}\n\n"
                    f"INSTALLATION REQUIRED:\n"
                    f"  1. Chocolatey (as Administrator): choco install psqlodbc -y\n"
                    f"  2. Or download from: https://www.postgresql.org/ftp/odbc/versions/msi/\n"
                    f"     - Download psqlodbc_XX_XX-x64.zip (for 64-bit Windows)\n"
                    f"     - Extract and run psqlodbc_x64.msi as Administrator\n"
                    f"  3. Verify installation: Run 'odbcad32.exe' and check Drivers tab for 'PostgreSQL Unicode'\n"
                    f"  4. Restart terminal/PowerShell after installation\n\n"
                    f"ALTERNATIVE: Switch to SQL Server (driver already installed)\n"
                    f"  Edit data-pipeline/sqlDB.env and change:\n"
                    f"  SQL_DRIVER={{ODBC Driver 18 for SQL Server}}\n"
                    f"  (Then update SQL_SERVER, SQL_DB, SQL_UID, SQL_PWD for SQL Server)\n\n"
                    f"For detailed setup instructions, see:\n"
                    f"  - data-pipeline/SETUP_INSTRUCTIONS.md\n"
                    f"  - data-pipeline/README_PHASE2.md\n"
                    f"{'='*70}\n"
                )
                error_title = "PostgreSQL ODBC Driver is not installed"
            else:
                error_msg = (
                    f"\n{'='*70}\n"
                    f"❌ CRITICAL ERROR: ODBC Driver 18 for SQL Server is not installed!\n"
                    f"{'='*70}\n"
                    f"Error: {str(e)}\n\n"
                    f"Available ODBC drivers: {available_drivers}\n\n"
                    f"INSTALLATION REQUIRED:\n"
                    f"  1. Windows: winget install --id Microsoft.msodbcsql.18 -e\n"
                    f"  2. Or download from: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server\n"
                    f"  3. Verify installation: Run 'odbcad32.exe' and check Drivers tab\n"
                    f"  4. Ensure driver bitness matches your Python installation\n"
                    f"     (64-bit Python requires 64-bit ODBC driver)\n"
                    f"  5. Restart terminal/PowerShell after installation\n\n"
                    f"For detailed setup instructions, see:\n"
                    f"  - data-pipeline/SETUP_INSTRUCTIONS.md\n"
                    f"  - data-pipeline/README_PHASE2.md\n"
                    f"{'='*70}\n"
                )
                error_title = "ODBC Driver 18 for SQL Server is not installed"
            
            print(error_msg, file=sys.stderr)
            raise RuntimeError(f"{error_title}. See error message above for installation instructions.") from e
        raise
    except pyodbc.ProgrammingError as e:
        error_str = str(e)
        if "not allowed to access the server" in error_str or "firewall" in error_str.lower() or "40615" in error_str:
            # Extract IP address from error if available
            import re
            ip_match = re.search(r"IP address '([\d\.]+)'", error_str)
            client_ip = ip_match.group(1) if ip_match else "your current IP"
            
            error_msg = (
                f"\n{'='*70}\n"
                f"❌ AZURE SQL FIREWALL ERROR: Your IP address is not allowed!\n"
                f"{'='*70}\n"
                f"Error: {str(e)}\n\n"
                f"Client IP Address: {client_ip}\n\n"
                f"SOLUTION: Add your IP address to Azure SQL firewall rules\n\n"
                f"Method 1: Azure Portal (Recommended)\n"
                f"  1. Go to Azure Portal → SQL Servers → {host}\n"
                f"  2. Navigate to 'Networking' or 'Firewalls and virtual networks'\n"
                f"  3. Click 'Add client IP' or 'Add firewall rule'\n"
                f"  4. Enter IP: {client_ip}\n"
                f"  5. Click 'Save'\n"
                f"  6. Wait 2-5 minutes for the change to take effect\n\n"
                f"Method 2: Azure CLI\n"
                f"  az sql server firewall-rule create \\\n"
                f"    --resource-group <your-resource-group> \\\n"
                f"    --server {host.split('.')[0]} \\\n"
                f"    --name AllowMyIP \\\n"
                f"    --start-ip-address {client_ip} \\\n"
                f"    --end-ip-address {client_ip}\n\n"
                f"Method 3: Allow Azure Services\n"
                f"  Enable 'Allow Azure services and resources to access this server'\n"
                f"  (Note: This is less secure but allows all Azure services)\n\n"
                f"After adding the firewall rule, wait a few minutes and retry.\n"
                f"{'='*70}\n"
            )
            print(error_msg, file=sys.stderr)
            raise RuntimeError(f"Azure SQL firewall blocking access from IP {client_ip}. Add firewall rule and retry.") from e
        raise

def get_conn():
    uri = (
        os.getenv("AZURE_SQL_CONN_URI")
        or os.getenv("SQL_CONN_URI")
        or os.getenv("AIRFLOW_CONN_AZURE_SQL")
        or os.getenv("AIRFLOW_CONN_AZURE_SQL_DEFAULT")
        or os.getenv("AIRFLOW_CONN_MSSQL_DEFAULT")
        or _pick_airflow_conn_uri()
    )
    if uri:
        _log(f"Resolved SQL URI: {_mask(uri)}")
        return _connect_from_uri(uri)
    return _connect_from_parts()

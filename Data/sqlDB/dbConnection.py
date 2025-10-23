# dbConnection.py
from __future__ import annotations

import os, re, socket
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
import pyodbc
from dotenv import load_dotenv

ENV_PATH = Path(__file__).with_name("sqlDB.env")
load_dotenv(ENV_PATH)

DEF_DRIVER = "ODBC Driver 18 for SQL Server"
DEF_PORT   = 1433
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
            "MultiSubnetFailover=Yes;"
        )
        _log(f"pyodbc.connect(URI->ODBC): {_mask(conn_str)}")
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

    host, port = _sanitize_server(server_raw)
    try:
        _tcp_preflight(host, port)
    except Exception as e:
        raise RuntimeError(
            f"TCP preflight failed to {host}:{port}. "
            "Whitelist worker egress IP on Azure SQL, check VNet/private endpoint, firewall, and DNS."
        ) from e

    conn_str = (
        f"DRIVER={{{driver}}};SERVER=tcp:{host},{port};DATABASE={db};UID={uid};PWD={pwd};"
        "Encrypt=yes;TrustServerCertificate=no;MultiSubnetFailover=Yes;"
    )
    _log(f"pyodbc.connect(parts): {_mask(conn_str)}")
    return pyodbc.connect(conn_str)

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

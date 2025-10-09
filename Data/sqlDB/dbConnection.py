# dbConnection.py
import os
from pathlib import Path
import pyodbc
from dotenv import load_dotenv

# explicitly load sqlDB.env from the same folder
ENV_PATH = Path(__file__).with_name("sqlDB.env")
load_dotenv(ENV_PATH)

def _need(name):
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing env var {name}. Ensure it exists in {ENV_PATH}")
    return val

def get_conn():
    server = _need("SQL_SERVER")
    db     = _need("SQL_DB")
    uid    = _need("SQL_UID")
    pwd    = _need("SQL_PWD")

    cn = pyodbc.connect(
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={server};DATABASE={db};UID={uid};PWD={pwd};"
        "Encrypt=yes;TrustServerCertificate=no;Login Timeout=60;"
    )
    return cn

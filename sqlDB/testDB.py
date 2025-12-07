import pyodbc

cn = pyodbc.connect(
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=wealtharena.database.windows.net;"
    "DATABASE=wealthArenaDB;"
    "UID=waadmin;"
    "PWD=wealthArena2025;"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
    "Login Timeout=60;"
)
cur = cn.cursor()
cur.execute("SELECT DB_NAME(), SUSER_SNAME()")
print(cur.fetchone())   # expect ('master','waadmin')
cn.close()


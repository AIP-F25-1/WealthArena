from dbConnection import get_conn
cn = get_conn()
cur = cn.cursor()
cur.execute("SELECT DB_NAME(), SUSER_SNAME()")
print(cur.fetchone())     # expect: ('wealthArenaDB','waadmin')
cn.close()

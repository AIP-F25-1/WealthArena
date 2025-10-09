def get_conn():
    class DummyCursor:
        def __init__(self):
            self.fast_executemany = False
        def cursor(self):
            return self
        def executemany(self, *a, **k):
            return None
        def execute(self, *a, **k):
            return None
        def fetchone(self):
            return None
    class DummyConn:
        def __init__(self):
            self._c = DummyCursor()
        def cursor(self):
            return self._c
        def commit(self):
            return None
        def close(self):
            return None
    return DummyConn()

import sys
import types
from pathlib import Path

# Ensure repository root is on sys.path so 'Data' modules import properly
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Provide lightweight stubs for heavy runtime deps that are not required for unit testing
def _make_mod(name: str):
    m = types.ModuleType(name)
    return m

# dotenv
dotenv = _make_mod('dotenv')
dotenv.load_dotenv = lambda *a, **k: None
sys.modules['dotenv'] = dotenv

# pyodbc (provide a dummy connect function)
pyodbc = _make_mod('pyodbc')
def _pyodbc_connect(*a, **k):
    class DummyCursor:
        def __init__(self):
            self._rows = []
        def execute(self, *a, **k):
            return None
        def fetchone(self):
            return None
        def executemany(self, *a, **k):
            self._rows.append((a, k))
    import sys
    import types
    from pathlib import Path

    # Ensure repository root is on sys.path so 'Data' modules import properly
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    # Provide lightweight stubs for heavy runtime deps that are not required for unit testing
    def _make_mod(name: str):
        m = types.ModuleType(name)
        return m

    # dotenv
    dotenv = _make_mod('dotenv')
    dotenv.load_dotenv = lambda *a, **k: None
    sys.modules['dotenv'] = dotenv

    # pyodbc (provide a dummy connect function)
    pyodbc = _make_mod('pyodbc')
    def _pyodbc_connect(*a, **k):
        class DummyCursor:
            def __init__(self):
                self._rows = []
            def execute(self, *a, **k):
                return None
            def fetchone(self):
                return None
            def executemany(self, *a, **k):
                self._rows.append((a, k))
        class DummyConn:
            def cursor(self):
                return DummyCursor()
            def commit(self):
                return None
            def close(self):
                return None
        return DummyConn()
    pyodbc.connect = _pyodbc_connect
    sys.modules['pyodbc'] = pyodbc

    # requests (very small stub with get().json and raise_for_status)
    requests = _make_mod('requests')
    class _DummyResp:
        def __init__(self, content=b'', json_data=None):
            self.content = content
            self._json = json_data or []
        def json(self):
            return self._json
        def raise_for_status(self):
            return None
    requests.get = lambda *a, **k: _DummyResp(b'', [])
    sys.modules['requests'] = requests

    # fsspec (filesystem factory used at import time in some modules)
    fsspec = _make_mod('fsspec')
    class _FakeFS:
        def glob(self, pattern):
            return []
        def open(self, path, mode='rb'):
            raise FileNotFoundError(path)
    fsspec.filesystem = lambda *a, **k: _FakeFS()
    sys.modules['fsspec'] = fsspec

    # azure packages (blobs and identity)
    azure = _make_mod('azure')
    azure.storage = _make_mod('azure.storage')
    azure.storage.blob = _make_mod('azure.storage.blob')

    # BlobServiceClient stub: supports from_connection_string and account_url constructor
    class _BlobContainerClientStub:
        def upload_blob(self, name=None, data=None, overwrite=False, content_settings=None):
            return None

    class _BlobServiceClientStub:
        def __init__(self, account_url=None, credential=None):
            self._account_url = account_url
            self._credential = credential

        @classmethod
        def from_connection_string(cls, conn_str):
            return cls()

        def get_container_client(self, container_name=None):
            return _BlobContainerClientStub()

    azure.storage.blob.BlobServiceClient = _BlobServiceClientStub

    # ContentSettings used by upload helpers
    class ContentSettings:
        def __init__(self, content_type=None):
            self.content_type = content_type

    azure.storage.blob.ContentSettings = ContentSettings

    azure.storage.filedatalake = _make_mod('azure.storage.filedatalake')

    class _FileClientStub:
        def upload_data(self, data, overwrite=True):
            return None

    class _FileSystemClientStub:
        def create_file_system(self):
            return None
        def create_directory(self, name):
            return None
        def get_file_client(self, path):
            return _FileClientStub()

    class _DataLakeServiceClientStub:
        def __init__(self, *a, **k):
            pass
        @classmethod
        def from_connection_string(cls, conn_str):
            return cls()
        def get_file_system_client(self, filesystem):
            return _FileSystemClientStub()

    azure.storage.filedatalake.DataLakeServiceClient = _DataLakeServiceClientStub

    sys.modules['azure'] = azure
    sys.modules['azure.storage'] = azure.storage
    sys.modules['azure.storage.blob'] = azure.storage.blob
    sys.modules['azure.storage.filedatalake'] = azure.storage.filedatalake

    azure_identity = _make_mod('azure.identity')
    azure_identity.DefaultAzureCredential = lambda *a, **k: None
    sys.modules['azure.identity'] = azure_identity

    # praw, yfinance (stubs so imports succeed)
    praw = _make_mod('praw')
    sys.modules['praw'] = praw

    yfinance = _make_mod('yfinance')
    class _DummyTicker:
        def __init__(self, sym):
            self.sym = sym
        def history(self, *a, **k):
            import pandas as pd
            return pd.DataFrame()
    yfinance.Ticker = _DummyTicker
    yfinance.download = lambda *a, **k: None
    sys.modules['yfinance'] = yfinance

    # Ensure simple alias modules that some imports use (flat import names)
    sys.modules['azure.storage.blob'] = azure.storage.blob
    sys.modules['azure.storage.filedatalake'] = azure.storage.filedatalake

    # Provide a lightweight stub for dbConnection if code imports it as a top-level module
    db_conn_stub = types.SimpleNamespace(get_conn=lambda: None)
    sys.modules['dbConnection'] = db_conn_stub

    print('tests.conftest: repo root added to sys.path and stubs injected')

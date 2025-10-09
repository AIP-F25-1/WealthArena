"""Lightweight fsspec stub used for tests to avoid importing adlfs/real fsspec.
This provides filesystem(protocol, **kwargs) -> object with glob/open used by the codebase.
"""
from pathlib import Path
class _FakeFS:
    def __init__(self, *a, **k):
        pass
    def glob(self, pattern):
        # interpret simple local patterns like 'abfs://container/prefix/*.csv'
        # return empty list to indicate no remote files during tests
        return []
    def open(self, path, mode='rb'):
        # Map abfs paths to local nonexistent -> raise FileNotFoundError for tests that expect missing files
        raise FileNotFoundError(path)

def filesystem(protocol='file', **kwargs):
    return _FakeFS()

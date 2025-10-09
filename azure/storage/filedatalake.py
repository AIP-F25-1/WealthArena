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

class DataLakeServiceClient:
    def __init__(self, *a, **k):
        pass
    @classmethod
    def from_connection_string(cls, conn_str):
        return cls()
    def get_file_system_client(self, filesystem):
        return _FileSystemClientStub()

class ContentSettings:
    def __init__(self, content_type=None):
        self.content_type = content_type

class _BlobContainerClientStub:
    def upload_blob(self, name=None, data=None, overwrite=False, content_settings=None):
        return None

class BlobServiceClient:
    def __init__(self, account_url=None, credential=None):
        self._account_url = account_url
        self._credential = credential

    @classmethod
    def from_connection_string(cls, conn_str):
        return cls()

    def get_container_client(self, container_name=None):
        return _BlobContainerClientStub()

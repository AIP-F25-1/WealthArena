class Ticker:
    def __init__(self, sym):
        self.sym = sym
    def history(self, *a, **k):
        # return empty-like DataFrame when imported by tests
        try:
            import pandas as pd
            return pd.DataFrame()
        except Exception:
            return None

def download(*a, **k):
    return None

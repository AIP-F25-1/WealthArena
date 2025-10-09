import os
import io
from pathlib import Path
import tempfile

from Data.stocksData import asx_market_data_adls as stocks_mod
from Data.newsData import news_scrape_finnhub_asx as news_mod
from Data.redditData import reddit_scrape_asx as reddit_mod


def test_find_header_index_and_parse_errors():
    text = "No header here\nJust data\n".encode('utf-8')
    try:
        stocks_mod._parse_asx_csv_bytes(text)
        assert False, "Expected RuntimeError for missing header"
    except RuntimeError:
        pass

    # now with header present later in file
    good = "junk line\nCompany Name,ASX code,GICS Industry Group\nA,AAA,Ind\n".encode('utf-8')
    df = stocks_mod._parse_asx_csv_bytes(good)
    assert 'ASX code' in df.columns or 'Company Name' in df.columns


def test_canonical_company_rows_and_renames(tmp_path):
    import pandas as pd
    df = pd.DataFrame({'ASX code': ['BHP', 'WPL', 'BAD$', ''] , 'Company Name': ['A','B','C','D']})
    canon = stocks_mod._canonical_company_rows(df)
    # BAD$ and empty filtered out, WPL should be present (renames applied later when mapping)
    assert '__code__' in canon.columns


def test_adls_gen2sink_upload_file(tmp_path):
    # create a small temp file
    f = tmp_path / 'test.txt'
    f.write_text('hello', encoding='utf-8')
    # instantiate sink (our tests.conftest stub for DataLakeServiceClient will provide methods)
    sink = stocks_mod.ADLSGen2Sink('conn', 'filesystem', 'myprefix')
    rp = sink.upload_file(f, remote_name='remote.txt')
    assert rp.endswith('remote.txt')


def test_news_match_tickers_various():
    symbols = {'BHP.AX', 'CBA.AX', 'XYZ.AX'}
    item1 = {'related': 'BHP.AX,XYZ.AX', 'headline': '', 'summary': ''}
    assert news_mod.match_tickers(item1, symbols) == ['BHP.AX', 'XYZ.AX']

    item2 = {'related': '', 'headline': 'BHP.AX rallied and CBA.AX fell', 'summary': ''}
    assert news_mod.match_tickers(item2, symbols) == ['BHP.AX', 'CBA.AX']


def test_is_asx_broad_many_keywords():
    for kw in news_mod.KEYWORDS_L[:5]:
        item = {'headline': f"Some story mentioning {kw}", 'summary': ''}
        assert news_mod.is_asx_broad(item) is True


def test_reddit_get_blob_and_upload(tmp_path, monkeypatch):
    # Set environment to use connection string path
    monkeypatch.setenv('AZURE_STORAGE_CONNECTION_STRING', 'fake')
    svc = reddit_mod.get_blob_service_client()
    # create a file
    f = tmp_path / 'foo.jsonl'
    f.write_text('x', encoding='utf-8')
    # should not raise
    reddit_mod.upload_file(svc, 'container', 'path/blob.jsonl', f, 'application/json')

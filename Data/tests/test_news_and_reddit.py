import json
from pathlib import Path
import tempfile
import csv

from Data.newsData.news_scrape_finnhub_asx import match_tickers, is_asx_broad, load_asx_symbols_from_csv
from Data.redditData.reddit_scrape_asx import mk_row, write_jsonl, write_csv
import pandas as pd

def test_match_tickers_simple():
    symbols = {'BHP.AX', 'CBA.AX'}
    item = {'headline': 'Markets: BHP.AX rises', 'summary': ''}
    assert match_tickers(item, symbols) == ['BHP.AX']

def test_is_asx_broad_keywords():
    item = {'headline': 'Australian markets react', 'summary': ''}
    assert is_asx_broad(item) is True
    item2 = {'headline': 'Some random news', 'summary': 'unrelated content here'}
    assert is_asx_broad(item2) is False

def test_load_asx_symbols_from_csv(tmp_path):
    csv_path = tmp_path / 'asx.csv'
    csv_path.write_text('ASX code,Company name,GICS Industry Group\nBHP,BHP Group,Materials\nCBA,Common Bank,Financials', encoding='utf-8')
    syms, info = load_asx_symbols_from_csv(csv_path)
    assert 'BHP.AX' in syms
    assert 'CBA.AX' in syms

def test_mk_row_and_write(tmp_path):
    class DummyP:
        id = 'abc'
        created_utc = 1600000000
        is_self = True
        selftext = 'body'
        title = 'title'
        author = 'user'
        score = 10
        num_comments = 2
        permalink = '/r/ASX/abc'
        url = 'http://example.com'
        over_18 = False
        link_flair_text = 'None'

    row = mk_row(DummyP(), 'ASX')
    assert row['subreddit'] == 'ASX'

    rows = [row]
    jsonl_path = tmp_path / 'out.jsonl'
    csv_path = tmp_path / 'out.csv'
    write_jsonl(jsonl_path, rows)
    write_csv(csv_path, rows)
    assert jsonl_path.exists()
    assert csv_path.exists()

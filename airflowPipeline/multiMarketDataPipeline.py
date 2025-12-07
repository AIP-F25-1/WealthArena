from __future__ import annotations
import os, subprocess
from datetime import timedelta
import pendulum
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.task_group import TaskGroup
from airflow.hooks.base import BaseHook
from airflow.models import Variable

PIPELINE_DIR = "/opt/airflow/dags/marketDataPipeline"

MARKETS = {
    "ASX": {"create":"createSchemaASX.py","scrape":"scrapeASXStocksData.py","process":"processAndStoreASX.py","adls_prefix":"asxStocks","azure_prefix":"asxStocks"},
    "Crypto": {"create":"createSchemaCrypto.py","scrape":"scrapeCryptoData.py","process":"processAndStoreCrypto.py","adls_prefix":"asxCrypto","azure_prefix":"asxCrypto"},
    "Forex": {"create":"createSchemaForex.py","scrape":"scrapeForexData.py","process":"processAndStoreForex.py","adls_prefix":"asxForex","azure_prefix":"asxForex"},
    "Commodities": {"create":"createSchemaCommodities.py","scrape":"scrapeCommoditiesAU.py","process":"processAndStoreCommodities.py","adls_prefix":"asxCommodities","azure_prefix":"asxCommodities"},
}
MARKET_ORDER = ["Crypto","Forex","Commodities","ASX"]

AZURE_STORAGE_CONNECTION_STRING = Variable.get("AZURE_STORAGE_CONNECTION_STRING", default_var=None)
AZURE_STORAGE_FILESYSTEM       = Variable.get("AZURE_STORAGE_FILESYSTEM", default_var="raw")
AZURE_UPLOAD                   = Variable.get("AZURE_UPLOAD", default_var="true")
ADLS_DELETE_SOURCE             = Variable.get("ADLS_DELETE_SOURCE", default_var="true")
TRUNCATE_PRICES_BEFORE         = Variable.get("TRUNCATE_PRICES_BEFORE", default_var="false")
BATCH_ROWS                     = Variable.get("BATCH_ROWS", default_var="75000")
MERGE_EVERY_ROWS               = Variable.get("MERGE_EVERY_ROWS", default_var="200000")

def _build_sql_uri_from_conn(conn_id: str) -> str:
    c = BaseHook.get_connection(conn_id)
    host, port = c.host, (c.port or 1433)
    schema, login, pwd = (c.schema or ""), (c.login or ""), (c.password or "")
    driver = "ODBC+Driver+18+for+SQL+Server"
    return (f"mssql://{login}:{pwd}@{host}:{port}/{schema}"
            f"?driver={driver}&Encrypt=yes&TrustServerCertificate=no")

def _run_script(pyfile: str, extra_env: dict | None = None):
    env = os.environ.copy()
    if extra_env:
        env.update({k: str(v) for k,v in extra_env.items() if v is not None})
    full_path = os.path.join(PIPELINE_DIR, pyfile)
    p = subprocess.run(["python", full_path], cwd=PIPELINE_DIR, env=env,
                       capture_output=True, text=True)
    if p.stdout: print(p.stdout)
    if p.stderr: print(p.stderr)
    p.check_returncode()

def build_market_group(dag: DAG, market_name: str, cfg: dict):
    with TaskGroup(group_id=f"{market_name.lower()}_pipeline", tooltip=f"{market_name} pipeline") as tg:
        base_env = {
            "AZURE_SQL_CONN_URI": _build_sql_uri_from_conn("azure_sql_default"),
            "AZURE_STORAGE_CONNECTION_STRING": AZURE_STORAGE_CONNECTION_STRING,
            "AZURE_STORAGE_FILESYSTEM": AZURE_STORAGE_FILESYSTEM,
            "AZURE_UPLOAD": AZURE_UPLOAD,
            "ADLS_CONTAINER": AZURE_STORAGE_FILESYSTEM,
            "ADLS_RAW_PREFIX": cfg["adls_prefix"],
            "AZURE_PREFIX": cfg["azure_prefix"],
            "ADLS_DELETE_SOURCE": ADLS_DELETE_SOURCE,
            "TRUNCATE_PRICES_BEFORE": TRUNCATE_PRICES_BEFORE,
            "BATCH_ROWS": BATCH_ROWS,
            "MERGE_EVERY_ROWS": MERGE_EVERY_ROWS,
        }
        create_task = PythonOperator(
            task_id=f"create_schema_{market_name.lower()}",
            python_callable=_run_script,
            op_kwargs={"pyfile": cfg["create"], "extra_env": base_env},
            dag=dag, retries=1, retry_delay=timedelta(minutes=2),
        )
        scrape_task = PythonOperator(
            task_id=f"scrape_{market_name.lower()}",
            python_callable=_run_script,
            op_kwargs={"pyfile": cfg["scrape"], "extra_env": base_env},
            dag=dag, retries=2, retry_delay=timedelta(minutes=3),
            execution_timeout=timedelta(hours=4),
        )
        process_task = PythonOperator(
            task_id=f"process_and_store_{market_name.lower()}",
            python_callable=_run_script,
            op_kwargs={"pyfile": cfg["process"], "extra_env": base_env},
            dag=dag, retries=1, retry_delay=timedelta(minutes=5),
            execution_timeout=timedelta(hours=8),
        )
        create_task >> scrape_task >> process_task
    return tg

default_args = {"owner":"data-eng","depends_on_past":False,"email_on_failure":False,"email_on_retry":False,"retries":0}

UTC = pendulum.timezone("UTC")
CRON_UTC = "0 15 * * *"  # 02:00 Australia/Sydney (AEDT) == 15:00 UTC
START_DATE_UTC = pendulum.datetime(2025, 11, 12, 15, 0, tz=UTC)

with DAG(
    dag_id="multi_market_data_pipeline",
    description="Create schema, scrape, and process/store for Crypto, Forex, Commodities, then ASX (last)",
    default_args=default_args,
    schedule=CRON_UTC,
    start_date=START_DATE_UTC,
    catchup=False,              # NO backfills
    max_active_runs=1,
    dagrun_timeout=timedelta(hours=24),
    tags=["markets","asx","crypto","forex","commodities"],
) as dag:
    groups = {m: build_market_group(dag, m, MARKETS[m]) for m in MARKET_ORDER}
    groups["Crypto"] >> groups["Forex"] >> groups["Commodities"] >> groups["ASX"]
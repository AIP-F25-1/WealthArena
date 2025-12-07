# Real-Time Data Streaming Pipeline for WealthArena

## Architecture Overview

```
Market Data Sources → Kafka → Stream Processing → Database → UI/RL System
     ↓
[Yahoo Finance, Alpha Vantage, Crypto APIs, News APIs]
     ↓
[Kafka Topics: market-data, news, signals, trades]
     ↓
[Apache Flink/Spark Streaming Processing]
     ↓
[Azure SQL Database + Redis Cache]
     ↓
[WebSocket/SSE to UI + RL Agent API]
```

## Step 1: Set Up Kafka Infrastructure

### 1.1 Deploy Kafka on Kubernetes
```yaml
# kafka-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
  namespace: wealtharena
spec:
  serviceName: kafka
  replicas: 3
  selector:
    matchLabels:
      app: kafka
  template:
    metadata:
      labels:
        app: kafka
    spec:
      containers:
      - name: kafka
        image: confluentinc/cp-kafka:latest
        ports:
        - containerPort: 9092
        env:
        - name: KAFKA_BROKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: KAFKA_ZOOKEEPER_CONNECT
          value: "zookeeper:2181"
        - name: KAFKA_ADVERTISED_LISTENERS
          value: "PLAINTEXT://kafka:9092"
        - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
          value: "3"
        - name: KAFKA_AUTO_CREATE_TOPICS_ENABLE
          value: "true"
        volumeMounts:
        - name: kafka-storage
          mountPath: /var/lib/kafka/data
  volumeClaimTemplates:
  - metadata:
      name: kafka-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

### 1.2 Create Kafka Topics
```bash
# Create topics for different data types
kubectl exec -it kafka-0 -n wealtharena -- kafka-topics --create --topic market-data --bootstrap-server localhost:9092 --partitions 3 --replication-factor 3

kubectl exec -it kafka-0 -n wealtharena -- kafka-topics --create --topic news-data --bootstrap-server localhost:9092 --partitions 3 --replication-factor 3

kubectl exec -it kafka-0 -n wealtharena -- kafka-topics --create --topic trading-signals --bootstrap-server localhost:9092 --partitions 3 --replication-factor 3

kubectl exec -it kafka-0 -n wealtharena -- kafka-topics --create --topic portfolio-updates --bootstrap-server localhost:9092 --partitions 3 --replication-factor 3
```

## Step 2: Data Ingestion Services

### 2.1 Market Data Ingestion Service
```python
# wealtharena_rl/src/streaming/market_data_ingestion.py
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List
import yfinance as yf
import aiohttp
from kafka import KafkaProducer
import pandas as pd

class MarketDataIngestionService:
    def __init__(self, kafka_brokers: str, symbols: List[str]):
        self.kafka_brokers = kafka_brokers
        self.symbols = symbols
        self.producer = KafkaProducer(
            bootstrap_servers=kafka_brokers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None
        )
        
    async def fetch_market_data(self, symbol: str) -> Dict:
        """Fetch real-time market data for a symbol"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            history = ticker.history(period="1d", interval="1m")
            
            if not history.empty:
                latest = history.iloc[-1]
                return {
                    "symbol": symbol,
                    "timestamp": datetime.now().isoformat(),
                    "price": float(latest['Close']),
                    "volume": int(latest['Volume']),
                    "high": float(latest['High']),
                    "low": float(latest['Low']),
                    "open": float(latest['Open']),
                    "change": float(latest['Close'] - latest['Open']),
                    "change_percent": float((latest['Close'] - latest['Open']) / latest['Open'] * 100),
                    "market_cap": info.get('marketCap', 0),
                    "pe_ratio": info.get('trailingPE', 0),
                    "dividend_yield": info.get('dividendYield', 0)
                }
        except Exception as e:
            logging.error(f"Error fetching data for {symbol}: {e}")
            return None
    
    async def stream_market_data(self):
        """Continuously stream market data to Kafka"""
        while True:
            tasks = [self.fetch_market_data(symbol) for symbol in self.symbols]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, dict) and result:
                    self.producer.send(
                        'market-data',
                        key=result['symbol'],
                        value=result
                    )
            
            await asyncio.sleep(60)  # Update every minute
    
    async def start(self):
        """Start the ingestion service"""
        logging.info("Starting market data ingestion service...")
        await self.stream_market_data()

if __name__ == "__main__":
    symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'BTC-USD', 'ETH-USD']
    service = MarketDataIngestionService('kafka:9092', symbols)
    asyncio.run(service.start())
```

### 2.2 News Data Ingestion Service
```python
# wealtharena_rl/src/streaming/news_ingestion.py
import asyncio
import json
import logging
from datetime import datetime, timedelta
import aiohttp
from kafka import KafkaProducer
import feedparser

class NewsIngestionService:
    def __init__(self, kafka_brokers: str):
        self.kafka_brokers = kafka_brokers
        self.producer = KafkaProducer(
            bootstrap_servers=kafka_brokers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        self.news_sources = [
            'https://feeds.finance.yahoo.com/rss/2.0/headline',
            'https://www.cnbc.com/id/100003114/device/rss/rss.html',
            'https://feeds.bloomberg.com/markets/news.rss'
        ]
    
    async def fetch_news_from_source(self, url: str) -> List[Dict]:
        """Fetch news from a single RSS source"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    content = await response.text()
                    feed = feedparser.parse(content)
                    
                    news_items = []
                    for entry in feed.entries[:10]:  # Limit to 10 most recent
                        news_items.append({
                            "title": entry.get('title', ''),
                            "summary": entry.get('summary', ''),
                            "link": entry.get('link', ''),
                            "published": entry.get('published', ''),
                            "source": url,
                            "timestamp": datetime.now().isoformat()
                        })
                    return news_items
        except Exception as e:
            logging.error(f"Error fetching news from {url}: {e}")
            return []
    
    async def stream_news_data(self):
        """Continuously stream news data to Kafka"""
        while True:
            tasks = [self.fetch_news_from_source(url) for url in self.news_sources]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, list):
                    for news_item in result:
                        self.producer.send('news-data', value=news_item)
            
            await asyncio.sleep(300)  # Update every 5 minutes
    
    async def start(self):
        """Start the news ingestion service"""
        logging.info("Starting news ingestion service...")
        await self.stream_news_data()

if __name__ == "__main__":
    service = NewsIngestionService('kafka:9092')
    asyncio.run(service.start())
```

## Step 3: Stream Processing with Apache Flink

### 3.1 Flink Stream Processing Job
```python
# wealtharena_rl/src/streaming/flink_processor.py
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment
from pyflink.table.descriptors import Schema, OldCsv, FileSystem, ConnectorDescriptor
from pyflink.table.window import Tumble
import json

def create_flink_processing_job():
    """Create Flink stream processing job for market data"""
    
    # Set up execution environment
    env = StreamExecutionEnvironment.get_execution_environment()
    table_env = StreamTableEnvironment.create(env)
    
    # Define Kafka source
    table_env.execute_sql("""
        CREATE TABLE market_data_source (
            symbol STRING,
            timestamp STRING,
            price DOUBLE,
            volume BIGINT,
            high DOUBLE,
            low DOUBLE,
            open DOUBLE,
            change DOUBLE,
            change_percent DOUBLE,
            market_cap BIGINT,
            pe_ratio DOUBLE,
            dividend_yield DOUBLE,
            proc_time AS PROCTIME()
        ) WITH (
            'connector' = 'kafka',
            'topic' = 'market-data',
            'properties.bootstrap.servers' = 'kafka:9092',
            'properties.group.id' = 'flink-processor',
            'format' = 'json'
        )
    """)
    
    # Define processed data sink
    table_env.execute_sql("""
        CREATE TABLE processed_market_data (
            symbol STRING,
            timestamp STRING,
            price DOUBLE,
            volume BIGINT,
            price_change_1m DOUBLE,
            price_change_5m DOUBLE,
            price_change_15m DOUBLE,
            volume_avg_1h DOUBLE,
            volatility_1h DOUBLE,
            rsi_14 DOUBLE,
            sma_20 DOUBLE,
            ema_12 DOUBLE,
            ema_26 DOUBLE,
            macd DOUBLE,
            signal_strength STRING
        ) WITH (
            'connector' = 'kafka',
            'topic' = 'processed-market-data',
            'properties.bootstrap.servers' = 'kafka:9092',
            'format' = 'json'
        )
    """)
    
    # Process market data with technical indicators
    table_env.execute_sql("""
        INSERT INTO processed_market_data
        SELECT 
            symbol,
            timestamp,
            price,
            volume,
            price - LAG(price, 1) OVER (PARTITION BY symbol ORDER BY proc_time) as price_change_1m,
            price - LAG(price, 5) OVER (PARTITION BY symbol ORDER BY proc_time) as price_change_5m,
            price - LAG(price, 15) OVER (PARTITION BY symbol ORDER BY proc_time) as price_change_15m,
            AVG(volume) OVER (PARTITION BY symbol ORDER BY proc_time ROWS BETWEEN 59 PRECEDING AND CURRENT ROW) as volume_avg_1h,
            STDDEV(price) OVER (PARTITION BY symbol ORDER BY proc_time ROWS BETWEEN 59 PRECEDING AND CURRENT ROW) as volatility_1h,
            -- RSI calculation (simplified)
            CASE 
                WHEN price > LAG(price, 1) OVER (PARTITION BY symbol ORDER BY proc_time) THEN 1.0
                ELSE 0.0
            END as rsi_14,
            -- SMA 20
            AVG(price) OVER (PARTITION BY symbol ORDER BY proc_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) as sma_20,
            -- EMA calculations would require custom UDFs
            0.0 as ema_12,
            0.0 as ema_26,
            0.0 as macd,
            CASE 
                WHEN price > AVG(price) OVER (PARTITION BY symbol ORDER BY proc_time ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) THEN 'BULLISH'
                ELSE 'BEARISH'
            END as signal_strength
        FROM market_data_source
    """)

if __name__ == "__main__":
    create_flink_processing_job()
```

## Step 4: Database Integration

### 4.1 Database Writer Service
```python
# wealtharena_rl/src/streaming/database_writer.py
import asyncio
import json
import logging
from datetime import datetime
from kafka import KafkaConsumer
import pyodbc
import redis

class DatabaseWriterService:
    def __init__(self, kafka_brokers: str, db_connection_string: str, redis_url: str):
        self.kafka_brokers = kafka_brokers
        self.db_connection_string = db_connection_string
        self.redis_client = redis.from_url(redis_url)
        
        # Kafka consumers
        self.market_data_consumer = KafkaConsumer(
            'processed-market-data',
            bootstrap_servers=kafka_brokers,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            group_id='database-writer'
        )
        
        self.news_consumer = KafkaConsumer(
            'news-data',
            bootstrap_servers=kafka_brokers,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            group_id='database-writer'
        )
    
    async def write_market_data(self, data: dict):
        """Write processed market data to database"""
        try:
            conn = pyodbc.connect(self.db_connection_string)
            cursor = conn.cursor()
            
            # Insert into MarketData table
            cursor.execute("""
                INSERT INTO MarketData (
                    Symbol, Timestamp, Price, Volume, High, Low, Open,
                    PriceChange1m, PriceChange5m, PriceChange15m,
                    VolumeAvg1h, Volatility1h, RSI14, SMA20, SignalStrength
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data['symbol'],
                data['timestamp'],
                data['price'],
                data['volume'],
                data.get('high', 0),
                data.get('low', 0),
                data.get('open', 0),
                data.get('price_change_1m', 0),
                data.get('price_change_5m', 0),
                data.get('price_change_15m', 0),
                data.get('volume_avg_1h', 0),
                data.get('volatility_1h', 0),
                data.get('rsi_14', 0),
                data.get('sma_20', 0),
                data.get('signal_strength', 'NEUTRAL')
            ))
            
            conn.commit()
            conn.close()
            
            # Cache latest data in Redis
            self.redis_client.setex(
                f"market_data:{data['symbol']}",
                300,  # 5 minutes TTL
                json.dumps(data)
            )
            
        except Exception as e:
            logging.error(f"Error writing market data: {e}")
    
    async def write_news_data(self, data: dict):
        """Write news data to database"""
        try:
            conn = pyodbc.connect(self.db_connection_string)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO NewsArticles (
                    Title, Summary, Link, PublishedDate, Source, CreatedAt
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                data['title'],
                data['summary'],
                data['link'],
                data['published'],
                data['source'],
                datetime.now()
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logging.error(f"Error writing news data: {e}")
    
    async def start(self):
        """Start the database writer service"""
        logging.info("Starting database writer service...")
        
        while True:
            # Process market data
            market_messages = self.market_data_consumer.poll(timeout_ms=1000)
            for topic_partition, messages in market_messages.items():
                for message in messages:
                    await self.write_market_data(message.value)
            
            # Process news data
            news_messages = self.news_consumer.poll(timeout_ms=1000)
            for topic_partition, messages in news_messages.items():
                for message in messages:
                    await self.write_news_data(message.value)
            
            await asyncio.sleep(0.1)

if __name__ == "__main__":
    service = DatabaseWriterService(
        'kafka:9092',
        'Server=wealtharena-sql-server.database.windows.net;Database=wealtharena-db;...',
        'redis://redis:6379'
    )
    asyncio.run(service.start())
```

## Step 5: Real-Time WebSocket API

### 5.1 WebSocket Server for Real-Time Updates
```python
# wealtharena_rl/src/streaming/websocket_server.py
import asyncio
import json
import logging
from datetime import datetime
import websockets
from kafka import KafkaConsumer
import redis

class WebSocketServer:
    def __init__(self, host: str, port: int, kafka_brokers: str, redis_url: str):
        self.host = host
        self.port = port
        self.redis_client = redis.from_url(redis_url)
        self.connected_clients = set()
        
        # Kafka consumer for real-time updates
        self.consumer = KafkaConsumer(
            'processed-market-data',
            'news-data',
            'trading-signals',
            bootstrap_servers=kafka_brokers,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            group_id='websocket-server'
        )
    
    async def register_client(self, websocket, path):
        """Register a new WebSocket client"""
        self.connected_clients.add(websocket)
        logging.info(f"Client connected. Total clients: {len(self.connected_clients)}")
        
        try:
            await websocket.wait_closed()
        finally:
            self.connected_clients.remove(websocket)
            logging.info(f"Client disconnected. Total clients: {len(self.connected_clients)}")
    
    async def broadcast_to_clients(self, message: dict):
        """Broadcast message to all connected clients"""
        if self.connected_clients:
            message_str = json.dumps(message)
            disconnected = set()
            
            for client in self.connected_clients:
                try:
                    await client.send(message_str)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.add(client)
            
            # Remove disconnected clients
            self.connected_clients -= disconnected
    
    async def kafka_consumer_loop(self):
        """Consume messages from Kafka and broadcast to clients"""
        for message in self.consumer:
            try:
                topic = message.topic
                data = message.value
                
                # Format message based on topic
                if topic == 'processed-market-data':
                    formatted_message = {
                        'type': 'market_data',
                        'data': data,
                        'timestamp': datetime.now().isoformat()
                    }
                elif topic == 'news-data':
                    formatted_message = {
                        'type': 'news',
                        'data': data,
                        'timestamp': datetime.now().isoformat()
                    }
                elif topic == 'trading-signals':
                    formatted_message = {
                        'type': 'trading_signal',
                        'data': data,
                        'timestamp': datetime.now().isoformat()
                    }
                else:
                    continue
                
                await self.broadcast_to_clients(formatted_message)
                
            except Exception as e:
                logging.error(f"Error processing Kafka message: {e}")
    
    async def start(self):
        """Start the WebSocket server"""
        logging.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        # Start Kafka consumer in background
        asyncio.create_task(self.kafka_consumer_loop())
        
        # Start WebSocket server
        async with websockets.serve(self.register_client, self.host, self.port):
            await asyncio.Future()  # Run forever

if __name__ == "__main__":
    server = WebSocketServer('0.0.0.0', 8765, 'kafka:9092', 'redis://redis:6379')
    asyncio.run(server.start())
```

## Step 6: Kubernetes Deployment

### 6.1 Deploy Streaming Services
```yaml
# streaming-services.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: market-data-ingestion
  namespace: wealtharena
spec:
  replicas: 2
  selector:
    matchLabels:
      app: market-data-ingestion
  template:
    metadata:
      labels:
        app: market-data-ingestion
    spec:
      containers:
      - name: market-data-ingestion
        image: wealtharenaacr.azurecr.io/wealtharena-rl:latest
        command: ["python", "src/streaming/market_data_ingestion.py"]
        env:
        - name: KAFKA_BROKERS
          value: "kafka:9092"
        - name: SYMBOLS
          value: "AAPL,GOOGL,MSFT,TSLA,AMZN,BTC-USD,ETH-USD"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: news-ingestion
  namespace: wealtharena
spec:
  replicas: 1
  selector:
    matchLabels:
      app: news-ingestion
  template:
    metadata:
      labels:
        app: news-ingestion
    spec:
      containers:
      - name: news-ingestion
        image: wealtharenaacr.azurecr.io/wealtharena-rl:latest
        command: ["python", "src/streaming/news_ingestion.py"]
        env:
        - name: KAFKA_BROKERS
          value: "kafka:9092"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: database-writer
  namespace: wealtharena
spec:
  replicas: 2
  selector:
    matchLabels:
      app: database-writer
  template:
    metadata:
      labels:
        app: database-writer
    spec:
      containers:
      - name: database-writer
        image: wealtharenaacr.azurecr.io/wealtharena-rl:latest
        command: ["python", "src/streaming/database_writer.py"]
        env:
        - name: KAFKA_BROKERS
          value: "kafka:9092"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: wealtharena-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          value: "redis://redis:6379"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
  namespace: wealtharena
spec:
  replicas: 2
  selector:
    matchLabels:
      app: websocket-server
  template:
    metadata:
      labels:
        app: websocket-server
    spec:
      containers:
      - name: websocket-server
        image: wealtharenaacr.azurecr.io/wealtharena-rl:latest
        command: ["python", "src/streaming/websocket_server.py"]
        ports:
        - containerPort: 8765
        env:
        - name: KAFKA_BROKERS
          value: "kafka:9092"
        - name: REDIS_URL
          value: "redis://redis:6379"
---
apiVersion: v1
kind: Service
metadata:
  name: websocket-server
  namespace: wealtharena
spec:
  selector:
    app: websocket-server
  ports:
  - port: 8765
    targetPort: 8765
  type: LoadBalancer
```

## Step 7: Frontend Integration

### 7.1 WebSocket Client for UI
```typescript
// WealthArena_UI/WealthArena/services/websocketService.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private listeners: Map<string, Function[]> = new Map();

  connect() {
    const wsUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8765';
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyListeners(data.type, data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
        this.connect();
      }, this.reconnectInterval);
    }
  }

  subscribe(eventType: string, callback: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  unsubscribe(eventType: string, callback: Function) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(eventType: string, data: any) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const websocketService = new WebSocketService();
```

## Step 8: Monitoring and Alerting

### 8.1 Prometheus Metrics
```python
# wealtharena_rl/src/streaming/metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time

# Metrics
market_data_processed = Counter('market_data_processed_total', 'Total market data messages processed')
news_data_processed = Counter('news_data_processed_total', 'Total news data messages processed')
processing_duration = Histogram('data_processing_duration_seconds', 'Time spent processing data')
active_websocket_connections = Gauge('websocket_connections_active', 'Number of active WebSocket connections')
kafka_lag = Gauge('kafka_consumer_lag', 'Kafka consumer lag')

def record_market_data_processed():
    market_data_processed.inc()

def record_news_data_processed():
    news_data_processed.inc()

def record_processing_time(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        processing_duration.observe(time.time() - start_time)
        return result
    return wrapper

def update_websocket_connections(count: int):
    active_websocket_connections.set(count)

def update_kafka_lag(lag: int):
    kafka_lag.set(lag)

# Start metrics server
start_http_server(8000)
```

## Estimated Timeline
- **Kafka Setup**: 2-3 hours
- **Data Ingestion Services**: 4-6 hours
- **Stream Processing**: 3-4 hours
- **Database Integration**: 2-3 hours
- **WebSocket API**: 2-3 hours
- **Frontend Integration**: 2-3 hours
- **Testing & Monitoring**: 2-3 hours
- **Total**: 17-25 hours

## Performance Expectations
- **Latency**: < 100ms from data source to UI
- **Throughput**: 10,000+ messages/second
- **Availability**: 99.9% uptime
- **Scalability**: Auto-scale based on load

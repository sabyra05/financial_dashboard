# Financial Real-Time Dashboard 📈

A high-performance, asynchronous microservices architecture designed to fetch, store, and broadcast real-time financial market data (cryptocurrency quotes) to clients via WebSockets.

Built with an emphasis on **Event-Driven Architecture**, **Polyglot Persistence**, and high scalability.

## 🏗 Architecture Overview

The system is fully containerized and strictly separates the data collection process from the client-facing web server.

1. **Market Worker (Data Ingestion):** An isolated Python process that continuously fetches active tickers from a relational database, connects to external exchanges, and retrieves live data from external sources (Binance, Coinbase and etc.).
2. **Hot Path (Real-Time):** Live ticks are published immediately to a **Redis Pub/Sub** broker.
3. **Cold Path (Persistence):** Live ticks are batched and written to **InfluxDB** for historical analysis and charting.
4. **Web API (FastAPI):** A lightweight server that manages WebSocket connections. A background Redis Listener catches hot-path data and broadcasts it instantly to subscribed clients via Room-based routing (`exchange:symbol`).

## 🛠 Tech Stack

* **Backend Framework:** FastAPI, Python 3.11, Pydantic, SQLAlchemy
* **Message Broker:** Redis (Pub/Sub mechanism)
* **Databases:** 
  * **PostgreSQL:** Relational DB for user management and active ticker configuration.
  * **InfluxDB:** Time-Series DB optimized for high-throughput tick data storage.
* **Infrastructure:** Docker, Docker Compose

## 🔑 Key Components & Classes

### 1. Web API Layer
* **`WebsocketManager`** (Connection Manager)
  * Manages isolated rooms using a Hash Map (`dict[str, set[WebSocket]]`).
  * `connect()` / `disconnect()`: Handles base WebSocket handshakes.
  * `subscribe(websocket, data: SubscribeModel)`: Validates payload via Pydantic and adds the client to specific ticker rooms.
  * `broadcast(ticker, exchange, msg)`: Delivers $O(1)$ updates strictly to targeted room subscribers.
* **`start_redis_listener()`**
  * A background task running in the FastAPI `lifespan`. Uses `psubscribe("ticker:*")` to catch real-time updates from the worker and triggers the manager's `broadcast()`.

### 2. Market Worker Layer
* **`MainWorker`** (Orchestrator)
  * `ticker_sync_loop()`: Periodically syncs the list of required tickers from PostgreSQL.
  * `collect_and_aggregate()`: The main event loop that commands adapters to fetch data and routes it to Redis and InfluxDB.
* **`BaseExchangeAdapter` & `BinanceExchange`**
  * Abstract interface and concrete implementation for exchange connections.
  * `connect()`, `disconnect()`, `fetch_prices()`: Standardized contract to ensure unified data formats regardless of the external API used.

## 🚀 Quick Start (Docker)

The entire infrastructure (Databases, Message Broker, Worker, and Web API) is orchestrated via Docker Compose.

**1. Clone the repository and navigate to the project directory:**
```bash
git clone https://github.com/your-username/financial_dashboard.git
cd financial_dashboard
```

**2. Setup Environment Variables:**
Create a `.env` file in the root directory based on the provided example.
```bash
cp .env.example .env
```
*(Ensure all passwords and the InfluxDB token are populated).*

**3. Build and run the containers in the background:**
```bash
docker compose up -d --build
```

**4. Check the logs to ensure the worker is fetching data:**
```bash
docker compose logs -f worker
```

**Endpoints:**
* **REST API Docs:** `http://localhost:8000/docs`
* **WebSocket Endpoint:** `ws://localhost:8000/ticker/ws`
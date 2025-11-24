# 🚀 Distributed Order Execution Engine

A high-performance backend system for executing cryptocurrency orders on Solana. It features a concurrent queue system, real-time WebSocket updates, and intelligent DEX routing between Raydium and Meteora.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Fastify](https://img.shields.io/badge/Fastify-4.0-green)
![BullMQ](https://img.shields.io/badge/BullMQ-Queue-orange)

## 🌟 Key Features
- **Intelligent DEX Routing:** Automatically compares quotes from Raydium vs. Meteora and routes to the best price.
- **Concurrent Processing:** Handles up to 10 orders simultaneously using BullMQ workers.
- **Reliability:** Implements exponential back-off strategies (retries up to 3 times on failure).
- **Real-Time Updates:** Pushes order status (`pending` → `routing` → `confirmed`) via WebSockets.
- **Persistent Storage:** Orders are safely stored in PostgreSQL; Active queues managed in Redis.

---

## 🛠️ Tech Stack
- **Runtime:** Node.js & TypeScript
- **API Framework:** Fastify (Chosen for low overhead and native WebSocket support)
- **Queue System:** BullMQ + Redis (For robust job processing and retries)
- **Database:** PostgreSQL (Permanent history)
- **Testing:** Jest + Supertest

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v16+)
- PostgreSQL (running on default port 5432)
- Redis (running on default port 6379)

### 1. Clone & Install
Run the following commands to get the code and install dependencies:

```bash
git clone <your-repo-url>
cd order-execution-engine
npm install
```

2. Configure Environment
Create a file named .env in the root directory and add the following configuration:

```bash
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
# Replace 'password' with your actual Postgres password
DATABASE_URL=postgres://postgres:password@localhost:5432/order_execution_engine
```


3. Run the System
The system requires two separate processes to run (Producer & Consumer). Open two terminal windows:

Terminal 1 (API Server): This starts the Fastify server to accept HTTP requests and WebSocket connections.

Bash

npm run dev
Terminal 2 (Background Worker): This starts the BullMQ worker to process the order queue.

Bash

npx ts-node src/worker.ts
🧪 Running Tests
The project includes 10 unit/integration tests covering routing logic, API validation, and queue configuration.

To run the test suite:

Bash

npm test
Expected Output: 10 passed, 10 total

📐 Design Decisions
1. Why Market Orders?
I chose Market Orders for this implementation because they represent the most fundamental atomic unit of a DEX interaction.

Reasoning: Immediate execution focuses the architecture on latency and throughput rather than state management (waiting for price triggers). This allowed me to prioritize building a robust concurrent queue system that can handle bursts of traffic.

2. Extensibility (Adding Limit/Sniper Orders)
This architecture is designed to be easily extended to support other order types:

Limit Orders: We would add a price_target field to the Database. Instead of processing immediately, the Worker would add the job to a "Delayed Queue" or a scheduled Cron job that checks prices every minute against the target.

Sniper Orders: We would implement a listener for on-chain events (using Solana web3.js logs). Detecting a specific TokenMint creation event would trigger the orderQueue.add() event instantly.

3. Architecture: Producer-Consumer Pattern
I separated the API (Producer) from the Worker (Consumer) to ensure scalability.

If user traffic spikes, the API remains responsive because it simply offloads tasks to Redis.

The heavy lifting (DEX routing/execution) happens in the background. We can scale the concurrency setting in worker.ts or spin up multiple worker instances on different servers to handle thousands of orders/minute without blocking the API.

📡 API Documentation
1. Submit Order
Creates a new market order and adds it to the execution queue.

Endpoint: POST /orders

Request Body:

JSON

{
  "type": "market",
  "side": "buy",
  "amount": 100
}
Success Response:

JSON

{
  "status": "success",
  "message": "Order received and queued",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
2. WebSocket Stream
Listen for real-time status updates for a specific order.

Connection URL: ```text ws://localhost:3000/ws/orders/:orderId


**Events Stream:**
```json
{"status": "routing", "message": "Checking DEX prices..."}
{"status": "submitted", "route": "Meteora", "message": "Routing to Meteora"}
{"status": "confirmed", "txHash": "sol_tx_123abc...", "orderId": "..."}
🌐 Live Deployment
The API is deployed and accessible at:

[INSERT YOUR RENDER/RAILWAY URL HERE]

🎥 Video Demo
[INSERT YOUTUBE VIDEO LINK HERE]
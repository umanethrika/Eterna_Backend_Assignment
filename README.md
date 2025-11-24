# Distributed Order Execution Engine

A high-performance backend system for executing cryptocurrency orders on Solana. It features a concurrent queue system, real-time WebSocket updates, and intelligent DEX routing between Raydium and Meteora.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Fastify](https://img.shields.io/badge/Fastify-4.0-green)
![BullMQ](https://img.shields.io/badge/BullMQ-Queue-orange)

## Key Features

* **Intelligent DEX Routing:** Automatically compares quotes from Raydium vs. Meteora and routes to the best price.
* **Concurrent Processing:** Handles up to 10 orders simultaneously using BullMQ workers.
* **Reliability:** Implements exponential back-off strategies (retries up to 3 times on failure).
* **Real-Time Updates:** Pushes order status (`pending` → `routing` → `confirmed`) via WebSockets.
* **Persistent Storage:** Orders are safely stored in PostgreSQL; Active queues managed in Redis.

---

## Tech Stack

* **Runtime:** Node.js & TypeScript
* **API Framework:** Fastify (Chosen for low overhead and native WebSocket support)
* **Queue System:** BullMQ + Redis (For robust job processing and retries)
* **Database:** PostgreSQL (Permanent history)
* **Testing:** Jest + Supertest

---

## Deployment Guide (Render)

This system is designed to be deployed on **Render.com** using a single Web Service that runs both the API and the Background Worker.

### Prerequisites
* A GitHub account with this repository cloned.
* A [Render](https://render.com) account.

### Step 1: Cloud Infrastructure Setup
Before deploying the code, create the necessary data stores on Render:

1.  **Create a Database (PostgreSQL):**
    * Go to the Render Dashboard and click **New +** → **PostgreSQL**.
    * Name: `order-db`.
    * Plan: **Free**.
    * **Important:** Copy the `Internal Connection URL` provided after creation.

2.  **Create a Queue (Redis):**
    * Click **New +** → **Redis**.
    * Name: `order-queue`.
    * Plan: **Free**.
    * **Important:** Copy the `Internal Host` (e.g., `red-xxxxx`) provided after creation.

### Step 2: Deploy the Web Service
1.  Click **New +** → **Web Service**.
2.  Connect your GitHub repository (`order-execution-engine`).
3.  Configure the build settings:
    * **Runtime:** Node
    * **Build Command:** `npm install && npm run build`
    * **Start Command:** `npm start`
    * **Instance Type:** Free

### Step 3: Configure Environment Variables
In the Web Service settings, verify the following Environment Variables are set to connect the app to your cloud infrastructure:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgres://...` | Paste the **Internal Connection URL** from Step 1. |
| `REDIS_HOST` | `red-xxxx...` | Paste the **Internal Host** from Step 1. |
| `REDIS_PORT` | `6379` | Default Redis port. |
| `PORT` | `10000` | The port Render exposes for the API. |

---

## Verifying Functionality (Tests)
To verify the internal logic (Routing, Queue Configuration, Validation) without deploying, you can run the integration test suite locally:

```bash
npm install
npm test
Expected Output:

10 passed, 10 total
```

## Design Decisions
### 1. Why Market Orders?
I chose Market Orders for this implementation because they represent the most fundamental atomic unit of a DEX interaction.

Reasoning: Immediate execution focuses the architecture on latency and throughput rather than state management (waiting for price triggers). This allowed me to prioritize building a robust concurrent queue system that can handle bursts of traffic.

### 2. Extensibility (Adding Limit/Sniper Orders)
This architecture is designed to be easily extended to support other order types:

Limit Orders: We would add a price_target field to the Database. Instead of processing immediately, the Worker would add the job to a "Delayed Queue" or a scheduled Cron job that checks prices every minute against the target.

Sniper Orders: We would implement a listener for on-chain events (using Solana web3.js logs). Detecting a specific TokenMint creation event would trigger the orderQueue.add() event instantly.

### 3. Architecture: Producer-Consumer Pattern
I separated the API (Producer) from the Worker (Consumer) to ensure scalability.

If user traffic spikes, the API remains responsive because it simply offloads tasks to Redis.

The heavy lifting (DEX routing/execution) happens in the background. We can scale the concurrency setting in worker.ts or spin up multiple worker instances on different servers to handle thousands of orders/minute without blocking the API.

## API Documentation
### 1. Submit Order
Creates a new market order and adds it to the execution queue.

Endpoint: POST https://order-execution-engine-2em3.onrender.com/orders

Request Body:
```JSON
{
  "type": "market",
  "side": "buy",
  "amount": 100
}
```
Success Response:
```JSON
{
  "status": "success",
  "message": "Order received and queued",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```
### 2. WebSocket Stream
Listen for real-time status updates for a specific order.

Events Stream:

```
{"status": "routing", "message": "Checking DEX prices..."}
{"status": "submitted", "route": "Meteora", "message": "Routing to Meteora"}
{"status": "confirmed", "txHash": "sol_tx_123abc...", "orderId": "..."}
```
## Live Deployment
The API is deployed and accessible at:

https://order-execution-engine-2em3.onrender.com

## Video Demo
https://youtu.be/wyLpdm7R1fY


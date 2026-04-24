# Event-Driven Microservices with Node.js, Kafka and Redis

Production-style event-driven order pipeline built with Node.js, Kafka, and Redis.

## Project summary

This project demonstrates how to design and run a resilient microservice workflow for order processing:

- An HTTP API accepts orders and publishes events
- A core processor handles retries, idempotency, and DLQ routing
- A worker service handles downstream notification processing

It is structured to show practical backend engineering decisions that are important in real systems: loose coupling, failure handling, duplicate protection, and observable event flow.

## What was implemented

- **Service decomposition** into `api`, `core`, and `worker`
- **Asynchronous communication** over Kafka topics (`order.created`, `order.processed`, `order.failed`)
- **Idempotency layer** in Redis to prevent duplicate terminal processing
- **Retry with backoff** for transient failures in core and worker
- **Dead-letter flow (DLQ)** for permanently failed orders
- **Containerized local stack** with Docker Compose (Kafka, Zookeeper, Redis, services)
- **Production-oriented defaults** (env-based behavior, clean startup and health checks)

## Architecture

```text
Client
  |
  v
API (POST /orders)
  |
  v
Kafka topic: order.created
  |
  v
Core service
  |-- success --> Kafka topic: order.processed --> Worker (notification)
  |
  `-- max retries exceeded --> Kafka topic: order.failed --> Worker (DLQ logging)
```

## Tech stack

- Node.js
- Express
- Kafka (`kafkajs`)
- Redis (`ioredis`)
- Docker + Docker Compose

## Local setup

### Prerequisites

- Docker
- Docker Compose

### Start

```bash
docker compose up --build -d
```

### Stop

```bash
docker compose down
```

### View logs

```bash
docker compose logs -f api core worker
```

## Quick verification

### 1) Health check

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok","service":"api"}
```

### 2) Submit an order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"product":"Keyboard","quantity":2}'
```

Expected:

```json
{"message":"Order accepted","orderId":"ord_..."}
```

### 3) Confirm pipeline execution in logs

You should observe:

- `api` publishes `order.created`
- `core` consumes and publishes `order.processed`
- `worker` consumes and sends notification

## Reliability features

### Idempotency

The core service writes terminal order state to Redis:

- completed orders are marked as done
- permanently failed orders are marked as failed

If Kafka redelivers the same order, core skips it when terminal state exists.

### Retries and DLQ

- Core and worker both retry failed operations with bounded attempts and delay
- On terminal core failure, event is sent to `order.failed` for DLQ handling

## Environment variables

### API

- `PORT` (default `3000`)
- `KAFKA_BROKERS` (default `localhost:9092`)

### Core

- `KAFKA_BROKERS` (default `localhost:9092`)
- `REDIS_HOST` (default `localhost`)
- `REDIS_PORT` (default `6379`)
- `IDEMPOTENCY_TTL_SECONDS` (default `86400`)
- `CORE_MAX_RETRIES` (default `3`)
- `CORE_RETRY_DELAY_MS` (default `500`)

### Worker

- `KAFKA_BROKERS` (default `localhost:9092`)
- `WORKER_MAX_RETRIES` (default `3`)
- `WORKER_RETRY_DELAY_MS` (default `500`)

### Runtime mode

- `NODE_ENV=production` disables simulation-only failure triggers
- `KAFKAJS_NO_PARTITIONER_WARNING=1` suppresses partitioner migration warning

## Repository layout

```text
services/
  api/
    src/index.js
    src/producer.js
  core/
    src/index.js
    src/consumer.js
    src/producer.js
    src/store.js
  worker/
    src/index.js
    src/consumer.js
docker-compose.yml
```

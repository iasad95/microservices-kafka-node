# pure-node

Production-style event-driven order processing with Node.js, Kafka, and Redis.

## What this project does

This system accepts orders over HTTP and processes them asynchronously:

- `api` receives `POST /orders` and publishes `order.created`
- `core` consumes `order.created`, applies retry and idempotency, then publishes:
  - `order.processed` on success
  - `order.failed` after max retries
- `worker` consumes:
  - `order.processed` to send notifications
  - `order.failed` to log dead-letter events

## Architecture at a glance

```text
Client --> API --> Kafka(order.created) --> Core --> Kafka(order.processed) --> Worker
                                           |
                                           +--> Kafka(order.failed) ---------> Worker (DLQ log)
```

## Prerequisites

- Docker
- Docker Compose

## Quick start

Start all services:

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

## Verify everything is working

1) Check health:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok","service":"api"}
```

2) Send a valid order:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"product":"Keyboard","quantity":2}'
```

Expected API response:

```json
{"message":"Order accepted","orderId":"ord_..."}
```

3) Check service logs:

```bash
docker compose logs -f api core worker
```

You should see:

- `api` publishing `order.created`
- `core` publishing `order.processed`
- `worker` sending notification

## Useful test scenarios

Core retry + DLQ scenario (non-production mode):

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"product":"fail","quantity":1}'
```

Worker retry scenario (non-production mode):

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"product":"fail-notify","quantity":1}'
```

## Idempotency behavior

The `core` service stores terminal processing state in Redis:

- successful orders are marked as completed
- permanently failed orders are marked as failed

If Kafka redelivers the same order, `core` skips it when a terminal marker exists.

## Environment variables

### API

- `PORT` (default: `3000`)
- `KAFKA_BROKERS` (default: `localhost:9092`)

### Core

- `KAFKA_BROKERS` (default: `localhost:9092`)
- `REDIS_HOST` (default: `localhost`)
- `REDIS_PORT` (default: `6379`)
- `IDEMPOTENCY_TTL_SECONDS` (default: `86400`)
- `CORE_MAX_RETRIES` (default: `3`)
- `CORE_RETRY_DELAY_MS` (default: `500`)

### Worker

- `KAFKA_BROKERS` (default: `localhost:9092`)
- `WORKER_MAX_RETRIES` (default: `3`)
- `WORKER_RETRY_DELAY_MS` (default: `500`)

### General

- `NODE_ENV=production` disables built-in simulation triggers (`fail`, `fail-notify`)
- `KAFKAJS_NO_PARTITIONER_WARNING=1` suppresses KafkaJS partitioner warning

## Project structure

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

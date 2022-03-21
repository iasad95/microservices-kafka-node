'use strict';

const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  lazyConnect: true,
});

const TTL = Number(process.env.IDEMPOTENCY_TTL_SECONDS) || 86400;

const doneKey = (id) => `idemp:done:${id}`;
const failedKey = (id) => `idemp:failed:${id}`;

async function connect() {
  await redis.connect();
  console.log('[core] redis connected');
}

async function isTerminal(orderId) {
  const [done, failed] = await redis.mget(doneKey(orderId), failedKey(orderId));
  return done === '1' || failed === '1';
}

async function markCompleted(orderId) {
  await redis.set(doneKey(orderId), '1', 'EX', TTL);
}

async function markFailedTerminal(orderId) {
  await redis.set(failedKey(orderId), '1', 'EX', TTL);
}

module.exports = { connect, isTerminal, markCompleted, markFailedTerminal };

'use strict';

const { Kafka } = require('kafkajs');
const store = require('./store');
const { publish } = require('./producer');

const kafka = new Kafka({
  clientId: 'core-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { initialRetryTime: 3000, retries: 10 },
});

const consumer = kafka.consumer({ groupId: 'core-group' });

const MAX_RETRIES = Number(process.env.CORE_MAX_RETRIES) || 3;
const RETRY_DELAY_MS = Number(process.env.CORE_RETRY_DELAY_MS) || 500;
const demoFailures = process.env.NODE_ENV !== 'production';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOrder(order) {
  if (demoFailures && order.product === 'fail') {
    throw new Error('simulated processing failure');
  }

  const processed = {
    ...order,
    status: 'processed',
    processedAt: new Date().toISOString(),
  };

  await publish('order.processed', processed);
  console.log(`[core] published order.processed  orderId=${order.id}  total=${order.quantity} units of "${order.product}"`);
}

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.created', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const order = JSON.parse(message.value.toString());
      console.log(`[core] received order.created  orderId=${order.id}`);

      if (await store.isTerminal(order.id)) {
        console.log(`[core] duplicate skipped  orderId=${order.id}`);
        return;
      }

      let lastError;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await processOrder(order);
          await store.markCompleted(order.id);
          return;
        } catch (err) {
          lastError = err;
          console.log(`[core] processing failed  orderId=${order.id}  attempt=${attempt}/${MAX_RETRIES}  error="${err.message}"`);
          if (attempt < MAX_RETRIES) await sleep(attempt * RETRY_DELAY_MS);
        }
      }

      await publish('order.failed', {
        ...order,
        error: lastError.message,
        retries: MAX_RETRIES,
        failedAt: new Date().toISOString(),
      });
      await store.markFailedTerminal(order.id);
      console.log(`[core] sent to DLQ  orderId=${order.id}`);
    },
  });

  console.log('[core] consumer ready, listening on order.created');
}

module.exports = { start };

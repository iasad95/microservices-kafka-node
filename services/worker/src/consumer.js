'use strict';

const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'worker-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { initialRetryTime: 3000, retries: 10 },
});

const consumer = kafka.consumer({ groupId: 'worker-group' });

const MAX_RETRIES = Number(process.env.WORKER_MAX_RETRIES) || 3;
const RETRY_DELAY_MS = Number(process.env.WORKER_RETRY_DELAY_MS) || 500;
const demoFailures = process.env.NODE_ENV !== 'production';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendNotification(order) {
  if (demoFailures && order.product === 'fail-notify') {
    throw new Error('simulated notification failure');
  }

  console.log(`[worker] [notify] Sending confirmation to customer for order ${order.id}`);
  console.log(`[worker] [notify] Subject: Your order is confirmed`);
  console.log(`[worker] [notify] Body: ${order.quantity}x "${order.product}" — processed at ${order.processedAt}`);
  console.log(`[worker] notification sent  orderId=${order.id}`);
}

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.processed', fromBeginning: false });
  await consumer.subscribe({ topic: 'order.failed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const payload = JSON.parse(message.value.toString());

      if (topic === 'order.failed') {
        console.log(`[worker] [DLQ] failed order received  orderId=${payload.id}  error="${payload.error}"  retries=${payload.retries}  failedAt=${payload.failedAt}`);
        return;
      }

      console.log(`[worker] received order.processed  orderId=${payload.id}`);

      let lastError;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await sendNotification(payload);
          return;
        } catch (err) {
          lastError = err;
          console.log(`[worker] notification failed  orderId=${payload.id}  attempt=${attempt}/${MAX_RETRIES}  error="${err.message}"`);
          if (attempt < MAX_RETRIES) await sleep(attempt * RETRY_DELAY_MS);
        }
      }

      console.log(`[worker] notification permanently failed  orderId=${payload.id}  error="${lastError.message}"`);
    },
  });

  console.log('[worker] consumer ready, listening on order.processed and order.failed');
}

module.exports = { start };

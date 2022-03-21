'use strict';

const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'api',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { initialRetryTime: 3000, retries: 10 },
});

const producer = kafka.producer();

async function connect() {
  await producer.connect();
  console.log('[api] kafka producer connected');
}

async function publish(topic, payload) {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(payload) }],
  });
}

module.exports = { connect, publish };

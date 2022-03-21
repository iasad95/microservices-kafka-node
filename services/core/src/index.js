'use strict';

const store = require('./store');
const { connect } = require('./producer');
const consumer = require('./consumer');

async function start() {
  await store.connect();
  await connect();
  await consumer.start();
  console.log('[core] service running');
}

start().catch((err) => {
  console.error('[core] startup failed', err);
  process.exit(1);
});

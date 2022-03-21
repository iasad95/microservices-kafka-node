'use strict';

const consumer = require('./consumer');

async function start() {
  await consumer.start();
  console.log('[worker] service running');
}

start().catch((err) => {
  console.error('[worker] startup failed', err);
  process.exit(1);
});

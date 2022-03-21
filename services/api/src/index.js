'use strict';

const express = require('express');
const { connect, publish } = require('./producer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api' });
});

app.post('/orders', async (req, res) => {
  const { product, quantity } = req.body;
  const qty = Number(quantity);

  if (!product || typeof product !== 'string' || !Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'product (string) and quantity (positive integer) are required' });
  }

  const order = {
    id: `ord_${Date.now()}`,
    product,
    quantity: qty,
    createdAt: new Date().toISOString(),
  };

  await publish('order.created', order);
  console.log(`[api] published order.created  orderId=${order.id}`);

  return res.status(202).json({ message: 'Order accepted', orderId: order.id });
});

async function start() {
  await connect();
  app.listen(PORT, () => console.log(`[api] listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('[api] startup failed', err);
  process.exit(1);
});

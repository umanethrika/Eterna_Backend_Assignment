import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../config/db';
import { orderQueue } from '../config/queue';
import { randomUUID } from 'crypto';

// Define what the user must send in the JSON body
interface OrderRequest {
  type: 'market' | 'limit' | 'sniper';
  side: 'buy' | 'sell';
  amount: number;
}

export const createOrder = async (req: FastifyRequest<{ Body: OrderRequest }>, reply: FastifyReply) => {
  const { type, side, amount } = req.body;

  // 1. Generate a unique ID for this order
  const orderId = randomUUID();

  try {
    // 2. Save to Database (Status: Pending)
    await pool.query(
      'INSERT INTO orders (order_id, type, side, amount, status) VALUES ($1, $2, $3, $4, $5)',
      [orderId, type, side, amount, 'pending']
    );

    // 3. Add to the Queue with Retry Logic
    await orderQueue.add('execute-order', {
      orderId,
      type,
      side,
      amount
    }, {
      attempts: 3, // Retry up to 3 times
      backoff: {
        type: 'exponential', // Wait longer each time (1s, 2s, 4s...)
        delay: 1000 // Start with 1 second delay
      }
    });

    req.log.info(`Order ${orderId} added to queue`);

    // 4. Respond immediately to the user
    return reply.status(201).send({
      status: 'success',
      message: 'Order received and queued',
      orderId
    });

  } catch (error) {
    req.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
};
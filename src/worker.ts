import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import connection from './config/redis';
import { pool } from './config/db';
import { MockDexRouter } from './utils/mockDex';
import dotenv from 'dotenv';

dotenv.config();

const dexRouter = new MockDexRouter();
const redisPublisher = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null
});

console.log('Worker started! Listening for orders...');

const worker = new Worker('order-execution-queue', async (job) => {
  const { orderId, amount } = job.data;
  console.log(`Processing Order #${orderId} (Attempt ${job.attemptsMade + 1})`);

  try {
    // PHASE 1: ROUTING
    await updateStatus(orderId, 'routing', { message: 'Checking DEX prices...' });
    
    // Simulate a random failure for testing retries (Uncomment to test!)
    // if (Math.random() < 0.3) throw new Error("Random Network Glitch!");

    const [raydiumQuote, meteoraQuote] = await Promise.all([
      dexRouter.getRaydiumQuote(amount),
      dexRouter.getMeteoraQuote(amount)
    ]);

    const bestQuote = raydiumQuote.price < meteoraQuote.price ? raydiumQuote : meteoraQuote;
    console.log(`Best Route: ${bestQuote.dex}`);

    // PHASE 2: EXECUTING
    await updateStatus(orderId, 'submitted', { 
      message: `Routing to ${bestQuote.dex}`, 
      route: bestQuote.dex 
    });
    
    const result = await dexRouter.executeSwap(bestQuote.dex, amount);

    // PHASE 3: CONFIRMED
    await pool.query(
      `UPDATE orders SET status = $1, tx_hash = $2 WHERE order_id = $3`,
      ['confirmed', result.txHash, orderId]
    );
    
    await redisPublisher.publish('order-updates', JSON.stringify({ 
      orderId, 
      status: 'confirmed', 
      txHash: result.txHash 
    }));

    console.log(`Order ${orderId} Complete!`);

  } catch (error: any) {
    console.error(`Attempt ${job.attemptsMade + 1} Failed for ${orderId}: ${error.message}`);
    // IMPORTANT: We throw the error so BullMQ knows to retry!
    throw error;
  }

}, { 
  connection, 
  concurrency: 10
});

// Listener for when a job fails PERMANENTLY (after all retries)
worker.on('failed', async (job, err) => {
  if (job) {
    const { orderId } = job.data;
    console.error(`Order ${orderId} FAILED PERMANENTLY after all attempts.`);
    
    // Update DB to failed
    await pool.query('UPDATE orders SET status = $1 WHERE order_id = $2', ['failed', orderId]);
    
    // Notify User
    await redisPublisher.publish('order-updates', JSON.stringify({ 
      orderId, 
      status: 'failed', 
      error: err.message
    }));
  }
});

async function updateStatus(orderId: string, status: string, data: any = {}) {
  await pool.query('UPDATE orders SET status = $1 WHERE order_id = $2', [status, orderId]);
  const payload = JSON.stringify({ orderId, status, ...data });
  await redisPublisher.publish('order-updates', payload);
}
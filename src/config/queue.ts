import { Queue } from 'bullmq';
import connection from './redis';

export const ORDER_QUEUE_NAME = 'order-execution-queue';

// Create a new queue instance connected to Redis
export const orderQueue = new Queue(ORDER_QUEUE_NAME, {
  connection
});
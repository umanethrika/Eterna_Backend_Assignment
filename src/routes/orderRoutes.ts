import { FastifyInstance } from 'fastify';
import { createOrder } from '../controllers/orderController';

export default async function orderRoutes(fastify: FastifyInstance) {
  // POST http://localhost:3000/orders
  fastify.post('/orders', createOrder);
}
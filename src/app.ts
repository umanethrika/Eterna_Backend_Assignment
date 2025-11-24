import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Redis } from 'ioredis';
import { initDB } from './config/db';
import './config/redis'; 
import orderRoutes from './routes/orderRoutes';
import './worker';

// Load the websocket plugin
const websocket = require('@fastify/websocket');

const server = Fastify({ logger: true });

const start = async () => {
  try {
    // 1. Register Plugins
    await server.register(cors, { origin: true });
    await server.register(websocket); // Must be registered before routes
    await server.register(orderRoutes);

    // 2. Initialize Database
    await initDB();

    // 3. Setup Redis Subscriber
    const redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });

    redisSubscriber.subscribe('order-updates', (err) => {
      if (err) console.error('Failed to subscribe to Redis channel:', err);
      else console.log('Subscribed to order updates channel');
    });

    // 4. Define WebSocket Route (Standard Syntax with Safety Fix)
    server.register(async function (fastify) {
      // We use 'as any' to stop TypeScript from complaining about the options
      fastify.get('/ws/orders/:orderId', { websocket: true } as any, (connection: any, req: any) => {
        // SAFETY FIX: Handle both object structures (SocketStream vs Raw Socket)
        const socket = connection.socket || connection;
        
        const { orderId } = req.params;
        
        if (!socket) {
          console.error("WebSocket connection object is missing!");
          return;
        }

        console.log(`Client connected via WebSocket for order: ${orderId}`);

        const messageHandler = (channel: string, message: string) => {
          if (channel === 'order-updates') {
            try {
              const data = JSON.parse(message);
              // Only send updates for THIS order
              if (data.orderId === orderId) {
                // Check if socket is still open before sending
                if (socket.readyState === 1) { 
                  socket.send(JSON.stringify(data));
                }
              }
            } catch (err) {
              console.error("Error parsing message:", err);
            }
          }
        };

        // Listen for Redis messages
        redisSubscriber.on('message', messageHandler);

        // Cleanup when client disconnects
        socket.on('close', () => {
          console.log(`Client disconnected: ${orderId}`);
          redisSubscriber.removeListener('message', messageHandler);
        });
        
        // Handle errors to prevent crash
        socket.on('error', (err: any) => {
          console.error(`Socket error for order ${orderId}:`, err);
        });
      });
    });

    // 5. Start Server
    await server.listen({ port: 3000 });
    console.log('Server is running at http://localhost:3000');

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
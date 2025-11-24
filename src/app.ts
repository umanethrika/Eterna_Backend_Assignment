import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'path'; // Import Path module
import { Redis } from 'ioredis';
import { initDB } from './config/db';
import './config/redis'; 
import orderRoutes from './routes/orderRoutes';
import './worker'; // Runs the worker in the same process (Required for Free Tier)

// Load plugins
const websocket = require('@fastify/websocket');
const fastifyStatic = require('@fastify/static'); // Import Static Plugin

const server = Fastify({ logger: true });

const start = async () => {
  try {
    // 1. Register Plugins
    await server.register(cors, { origin: true });
    await server.register(websocket); // Must be registered before routes
    
    // REGISTER STATIC FILES (This serves the HTML dashboard)
    // Points to the 'public' folder in your root directory
    await server.register(fastifyStatic, {
      root: path.join(__dirname, '../public'), 
    });

    await server.register(orderRoutes);

    // 2. Initialize Database
    await initDB();
    const PORT = parseInt(process.env.PORT || '3000');

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

    // 5. SERVE THE DASHBOARD ON HOME PAGE
    server.get('/', async (req, reply) => {
      // Cast reply to 'any' to stop TypeScript from complaining
      return (reply as any).sendFile('index.html');
    });

    // 6. Start Server
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Server is running at http://0.0.0.0:${PORT}`);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
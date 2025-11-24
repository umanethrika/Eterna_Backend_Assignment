import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // Required by BullMQ
});

connection.on('connect', () => {
  console.log('✅ Connected to Redis');
});

connection.on('error', (err) => {
  // This will help us debug if Redis isn't running yet
  console.log('❌ Redis Connection Failed (Is Redis installed?)');
});

export default connection;
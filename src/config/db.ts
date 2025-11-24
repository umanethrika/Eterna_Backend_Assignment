import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const initDB = async () => {
  try {
    // Connect to the database
    const client = await pool.connect();
    
    // Create the 'orders' table if it doesn't exist
    // Storing: ID, type (market/limit), input token, output token, status, and transaction hash
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        side VARCHAR(10) NOT NULL,
        amount DECIMAL NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        tx_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Connected to PostgreSQL & Verified Tables');
    client.release();
  } catch (err) {
    console.error('❌ Database Connection Error:', err);
    process.exit(1); // Stop the app if DB fails
  }
};
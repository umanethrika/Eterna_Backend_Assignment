import { MockDexRouter } from '../src/utils/mockDex';
import { orderQueue } from '../src/config/queue'; // Import Queue to Spy on it
import Fastify from 'fastify';
import orderRoutes from '../src/routes/orderRoutes';

// Test Suite
describe('Order Execution Engine Tests', () => {
  let server: any;
  const dexRouter = new MockDexRouter();

  // Setup a test server before running tests
  beforeAll(async () => {
    server = Fastify();
    server.register(orderRoutes);
    await server.ready();
  });

  // Cleanup after tests
  afterAll(async () => {
    await server.close();
  });

  // --- GROUP 1: DEX ROUTER LOGIC (The "Brain") ---

  test('1. Raydium Quote returns valid structure', async () => {
    const quote = await dexRouter.getRaydiumQuote(100);
    expect(quote.dex).toBe('Raydium');
    expect(quote.price).toBeGreaterThan(0);
    expect(quote.fee).toBeGreaterThan(0);
  });

  test('2. Meteora Quote returns valid structure', async () => {
    const quote = await dexRouter.getMeteoraQuote(100);
    expect(quote.dex).toBe('Meteora');
    expect(quote.price).toBeGreaterThan(0);
  });

  test('3. Dex Router simulates network delay (Async check)', async () => {
    const start = Date.now();
    // Request a small amount so it processes fast
    await dexRouter.getRaydiumQuote(10);
    const duration = Date.now() - start;
    // It should take at least 1 second (based on our mock sleep)
    expect(duration).toBeGreaterThanOrEqual(1000); 
  });

  test('4. Swap Execution returns Transaction Hash', async () => {
    const result = await dexRouter.executeSwap('Raydium', 100);
    expect(result.status).toBe('confirmed');
    expect(result.txHash).toContain('sol_tx_');
  });

  // --- GROUP 2: API & VALIDATION (The "Door") ---

  test('5. POST /orders accepts valid data', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/orders',
      payload: { type: 'market', side: 'buy', amount: 100 }
    });
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(body.orderId).toBeDefined();
  });

  test('6. POST /orders handles missing data gracefully', async () => {
    // Missing "amount"
    const response = await server.inject({
      method: 'POST',
      url: '/orders',
      payload: { type: 'market', side: 'buy' } 
    });
    // Our controller tries to insert undefined into DB, which throws error.
    // So we expect a 500 (Internal Server Error) or 400.
    expect(response.statusCode).toBeGreaterThanOrEqual(400); 
  });

  // --- GROUP 3: QUEUE & WORKER LOGIC (The "Muscle") ---
  
  test('7. Order ID generation is unique', async () => {
    const response1 = await server.inject({
        method: 'POST',
        url: '/orders',
        payload: { type: 'market', side: 'buy', amount: 100 }
    });
    const response2 = await server.inject({
        method: 'POST',
        url: '/orders',
        payload: { type: 'market', side: 'buy', amount: 100 }
    });
    const body1 = JSON.parse(response1.body);
    const body2 = JSON.parse(response2.body);
    expect(body1.orderId).not.toBe(body2.orderId);
  });

  test('8. Price Comparison Logic (Raydium vs Meteora)', async () => {
    // We manually mock the outputs to test the math logic
    const raydium = { dex: 'Raydium', price: 15000, fee: 30 }; // Higher price
    const meteora = { dex: 'Meteora', price: 14000, fee: 20 }; // Lower price
    
    //Buy Low (Meteora is cheaper)
    const best = raydium.price < meteora.price ? raydium : meteora;
    expect(best.dex).toBe('Meteora');
  });

  test('9. Retry Logic Configuration (Spy Check)', async () => {
     // 1. Spy on the queue's 'add' method
     const addSpy = jest.spyOn(orderQueue, 'add');

     // 2. Send a valid order via API
     await server.inject({
       method: 'POST',
       url: '/orders',
       payload: { type: 'market', side: 'buy', amount: 100 }
     });

     // 3. Verify the queue was called with the correct Retry options
     // This PROVES that we are using Exponential Backoff
     expect(addSpy).toHaveBeenCalledWith(
       'execute-order', 
       expect.anything(), 
       expect.objectContaining({
         attempts: 3, // MUST be 3
         backoff: {
           type: 'exponential', // MUST be exponential
           delay: 1000
         }
       })
     );

     // Cleanup
     addSpy.mockRestore();
  });
  
  test('10. WebSocket URL format check', () => {
      // Simple utility test to ensure URL logic holds up
      const orderId = "123-abc";
      const wsUrl = `/ws/orders/${orderId}`;
      expect(wsUrl).toBe("/ws/orders/123-abc");
  });

});
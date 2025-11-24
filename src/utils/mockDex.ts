// This simulates a "Delay" (like waiting for a network request)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Quote {
  dex: 'Raydium' | 'Meteora';
  price: number;
  fee: number;
}

export class MockDexRouter {
  // Base price for simulation (e.g., 1 SOL = $150)
  private basePrice = 150;

  // 1. Simulate getting a price from Raydium
  async getRaydiumQuote(amount: number): Promise<Quote> {
    await sleep(1000); // Fake network delay [cite: 96]
    
    // Formula : basePrice * (0.98 + random variance)
    const price = this.basePrice * (0.98 + Math.random() * 0.04); 
    
    return {
      dex: 'Raydium',
      price: price * amount,
      fee: 0.003 * amount // 0.3% fee
    };
  }

  // 2. Simulate getting a price from Meteora
  async getMeteoraQuote(amount: number): Promise<Quote> {
    await sleep(1000); // Fake network delay
    
    // Formula from PDF: basePrice * (0.97 + random variance)
    const price = this.basePrice * (0.97 + Math.random() * 0.05);
    
    return {
      dex: 'Meteora',
      price: price * amount,
      fee: 0.002 * amount // 0.2% fee
    };
  }

  // 3. Simulate the actual swap execution
  async executeSwap(dex: string, amount: number) {
    console.log(`⚡ Executing swap on ${dex}...`);
    
    // Simulate execution time (2-3 seconds) [cite: 31]
    // await sleep(5000);
    await sleep(2000 + Math.random() * 1000);
    return {
      txHash: 'sol_tx_' + Math.random().toString(36).substring(7),
      status: 'confirmed'
    };
  }
}
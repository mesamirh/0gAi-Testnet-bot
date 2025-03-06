const ethers = require('ethers');
const { CONFIG, TOKEN_DECIMALS, AVAILABLE_PAIRS, ROUTER_ABI, ERC20_ABI } = require('./config');

class ZeroGSwapBot {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.router = null;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    async initializeWithPrivateKey(privateKey) {
        try {
            if (!privateKey || privateKey === 'your_private_key_here') {
                throw new Error('Invalid private key provided');
            }
            
            const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            
            this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
            this.wallet = new ethers.Wallet(formattedKey, this.provider);
            this.router = new ethers.Contract(CONFIG.UNISWAP.ROUTER, ROUTER_ABI, this.wallet);
            
            console.log(`Initialized with wallet: ${this.wallet.address}`);
        } catch (error) {
            console.error('Initialization failed:', error.message);
            throw error;
        }
    }

    async getGasPrice() {
        const gasPrice = await this.provider.getFeeData();
        // Increase gas price by 20% to help with mempool congestion
        return gasPrice.gasPrice * BigInt(120) / BigInt(100);
    }

    async performSwapWithRetry(pair, amount, attempt = 1) {
        try {
            const params = {
                tokenIn: pair.token0.address,
                tokenOut: pair.token1.address,
                fee: pair.fee,
                recipient: this.wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
                amountIn: amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            };

            // Get current gas price and increase it
            const gasPrice = await this.getGasPrice();
            
            const tx = await this.router.exactInputSingle(params, {
                gasPrice: gasPrice,
                gasLimit: 300000 // Set a reasonable gas limit
            });

            console.log(`🔄 Swap transaction sent: ${tx.hash}`);
            await tx.wait();
            console.log('✅ Swap completed successfully');
        } catch (error) {
            if (error.message.includes('mempool is full')) {
                if (attempt <= this.maxRetries) {
                    console.log(`⚠️ Mempool full, retrying in ${this.retryDelay/1000} seconds (Attempt ${attempt}/${this.maxRetries})`);
                    await new Promise(r => setTimeout(r, this.retryDelay));
                    return this.performSwapWithRetry(pair, amount, attempt + 1);
                }
            }
            console.error(`Swap failed: ${error.message}`);
            throw error;
        }
    }

    async startRandomSwaps(txCount, delayInSeconds) {
        try {
            for (let i = 0; i < txCount; i++) {
                console.log(`\n📊 Starting swap ${i + 1}/${txCount}`);
                
                // Select random pair
                const pair = AVAILABLE_PAIRS[Math.floor(Math.random() * AVAILABLE_PAIRS.length)];
                
                // Random amount between 0.01 and 0.1
                const amount = ethers.parseEther((0.01 + Math.random() * 0.09).toFixed(6));
                
                await this.performSwapWithRetry(pair, amount);
                
                if (i < txCount - 1) {
                    const delay = typeof delayInSeconds === 'string' ? 
                        Math.floor(Math.random() * 3600) : // Random delay up to 1 hour
                        delayInSeconds;
                    
                    console.log(`⏳ Waiting ${delay} seconds before next swap...`);
                    await new Promise(r => setTimeout(r, delay * 1000));
                }
            }
        } catch (error) {
            console.error(`Swap failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = ZeroGSwapBot;
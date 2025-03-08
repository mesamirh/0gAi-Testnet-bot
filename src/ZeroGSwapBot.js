const ethers = require('ethers');
const { CONFIG, TOKEN_DECIMALS, AVAILABLE_PAIRS, ROUTER_ABI, ERC20_ABI } = require('./config');

class ZeroGSwapBot {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.router = null;
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
        this.currentRpcIndex = 0;
        this.maxGasRetries = 5;
        this.gasIncreaseFactor = 1.2; // 20% increase each retry
        this.mempoolRetryDelay = 10000; // 10 seconds
    }

    async tryConnectRPC() {
        for (let i = 0; i < CONFIG.RPC_URLS.length; i++) {
            const rpcIndex = (this.currentRpcIndex + i) % CONFIG.RPC_URLS.length;
            const rpcUrl = CONFIG.RPC_URLS[rpcIndex];
            
            try {
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                await provider.getNetwork(); // Test the connection
                console.log(`✅ Connected to RPC: ${rpcUrl}`);
                this.currentRpcIndex = rpcIndex; // Remember the working RPC
                return provider;
            } catch (error) {
                console.log(`⚠️ Failed to connect to RPC ${rpcUrl}: ${error.message}`);
                continue;
            }
        }
        throw new Error('All RPC endpoints failed');
    }

    async initializeWithPrivateKey(privateKey) {
        try {
            if (!privateKey || privateKey === 'your_private_key_here') {
                throw new Error('Invalid private key provided');
            }
            
            const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
            
            // Try to connect to an RPC
            this.provider = await this.tryConnectRPC();
            this.wallet = new ethers.Wallet(formattedKey, this.provider);
            this.router = new ethers.Contract(CONFIG.UNISWAP.ROUTER, ROUTER_ABI, this.wallet);
            
            console.log(`Initialized with wallet: ${this.wallet.address}`);
        } catch (error) {
            console.error('Initialization failed:', error.message);
            throw error;
        }
    }

    async executeWithRpcFailover(operation) {
        for (let attempt = 0; attempt < CONFIG.RPC_URLS.length; attempt++) {
            try {
                return await operation();
            } catch (error) {
                const isRetryableError = 
                    error.message.includes('403') || 
                    error.message.includes('failed') ||
                    error.message.includes('timeout') ||
                    error.message.includes('network error');

                if (isRetryableError) {
                    console.log(`⚠️ RPC failed, trying next endpoint...`);
                    this.provider = await this.tryConnectRPC();
                    this.wallet = this.wallet.connect(this.provider);
                    this.router = this.router.connect(this.wallet);
                    continue;
                }
                throw error;
            }
        }
        throw new Error('All RPC endpoints failed');
    }

    async getGasPrice() {
        return this.executeWithRpcFailover(async () => {
            try {
                const feeData = await this.provider.getFeeData();
                // Start with 20% higher than base fee
                return feeData.gasPrice * BigInt(120) / BigInt(100);
            } catch (error) {
                console.log(`⚠️ Error getting gas price: ${error.message}`);
                // Fallback gas price if getFeeData fails
                return ethers.parseUnits('5', 'gwei');
            }
        });
    }

    async performSwapWithRetry(pair, amount, attempt = 1) {
        return this.executeWithRpcFailover(async () => {
            let lastError;
            let currentGasPrice = await this.getGasPrice();

            for (let i = 0; i < this.maxGasRetries; i++) {
                try {
                    const params = {
                        tokenIn: pair.token0.address,
                        tokenOut: pair.token1.address,
                        fee: pair.fee,
                        recipient: this.wallet.address,
                        deadline: Math.floor(Date.now() / 1000) + 60 * 20,
                        amountIn: amount,
                        amountOutMinimum: 0,
                        sqrtPriceLimitX96: 0
                    };

                    // Use custom gas limit if provided, otherwise use default
                    const gasLimit = CONFIG.GAS_SETTINGS.CUSTOM_GAS_LIMIT || CONFIG.GAS_SETTINGS.DEFAULT_GAS_LIMIT;

                    const tx = await this.router.exactInputSingle(params, {
                        gasPrice: currentGasPrice,
                        gasLimit: gasLimit
                    });

                    console.log(`🔄 Swap transaction sent: ${tx.hash}`);
                    console.log(`⛽ Using gas limit: ${gasLimit}`);
                    await tx.wait();
                    console.log('✅ Swap completed successfully');
                    return;
                } catch (error) {
                    lastError = error;
                    if (error.message.includes('mempool is full')) {
                        console.log(`⚠️ Mempool is full, waiting ${this.mempoolRetryDelay/1000} seconds...`);
                        await new Promise(r => setTimeout(r, this.mempoolRetryDelay));
                        
                        // Increase gas price for next attempt
                        currentGasPrice = BigInt(Math.floor(Number(currentGasPrice) * this.gasIncreaseFactor));
                        console.log(`📈 Increasing gas price to ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei`);
                        continue;
                    }
                    throw error;
                }
            }
            throw lastError;
        });
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
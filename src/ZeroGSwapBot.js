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
        this.maxGasRetries = CONFIG.GAS_SETTINGS.MAX_RETRY_COUNT;
        this.mempoolRetryDelay = CONFIG.GAS_SETTINGS.INITIAL_RETRY_DELAY;
        this.lastSuccessfulGasPrice = null;
        this.gasIncreaseFactor = 1.2; // 20% increase each retry
    }

    async tryConnectRPC() {
        const startIndex = this.currentRpcIndex;
        const maxAttempts = CONFIG.RPC_URLS.length * 2; // Try each RPC twice
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const rpcIndex = (startIndex + Math.floor(attempt / 2)) % CONFIG.RPC_URLS.length;
            const rpcUrl = CONFIG.RPC_URLS[rpcIndex];
            
            try {
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                await provider.getNetwork(); // Test the connection
                
                // Additional connection test
                const blockNumber = await provider.getBlockNumber();
                if (!blockNumber) {
                    throw new Error('Could not get block number');
                }
                
                console.log(`✅ Connected to RPC: ${rpcUrl}`);
                this.currentRpcIndex = rpcIndex;
                return provider;
            } catch (error) {
                console.log(`⚠️ RPC ${rpcUrl} attempt ${Math.floor(attempt / 2) + 1}/2 failed: ${error.message}`);
                // Add delay between retries
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
        }
        throw new Error('All RPC connection attempts failed');
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
        const maxAttempts = 5; // Maximum number of operation retry attempts
        let lastError;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                if (attempt > 0) {
                    // Wait before retry
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    console.log(`⏳ Waiting ${delay/1000}s before retry...`);
                    await new Promise(r => setTimeout(r, delay));
                    
                    // Try to reconnect to RPC
                    this.provider = await this.tryConnectRPC();
                    this.wallet = this.wallet.connect(this.provider);
                    this.router = this.router.connect(this.wallet);
                }
                
                return await operation();
            } catch (error) {
                lastError = error;
                const isRetryableError = 
                    error.message.includes('403') || 
                    error.message.includes('failed') ||
                    error.message.includes('timeout') ||
                    error.message.includes('network') ||
                    error.message.includes('connection') ||
                    error.message.includes('server error') ||
                    error.message.includes('internal json-rpc error');

                if (isRetryableError && attempt < maxAttempts - 1) {
                    console.log(`⚠️ Operation failed (attempt ${attempt + 1}/${maxAttempts}): ${error.message}`);
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`);
    }

    async getGasPrice() {
        return this.executeWithRpcFailover(async () => {
            try {
                const feeData = await this.provider.getFeeData();
                let baseGasPrice;
                
                // Handle null gasPrice from getFeeData()
                if (!feeData || !feeData.gasPrice) {
                    console.log('⚠️ Could not get network gas price, using base gas price');
                    baseGasPrice = ethers.parseUnits(CONFIG.GAS_SETTINGS.BASE_GAS_PRICE, 'gwei');
                } else {
                    baseGasPrice = feeData.gasPrice;
                }
                
                // Use the minimum of base gas price and our maximum
                let gasPrice = baseGasPrice;
                const minGasPrice = ethers.parseUnits(CONFIG.GAS_SETTINGS.BASE_GAS_PRICE, 'gwei');
                const maxGasPrice = ethers.parseUnits(CONFIG.GAS_SETTINGS.MAX_GAS_PRICE, 'gwei');
                
                if (gasPrice < minGasPrice) gasPrice = minGasPrice;
                if (gasPrice > maxGasPrice) gasPrice = maxGasPrice;
                
                // If we have a successful previous transaction, use that price
                if (this.lastSuccessfulGasPrice && 
                    this.lastSuccessfulGasPrice < maxGasPrice && 
                    this.lastSuccessfulGasPrice > minGasPrice) {
                    gasPrice = this.lastSuccessfulGasPrice;
                }
                
                console.log(`📊 Network gas price: ${ethers.formatUnits(baseGasPrice, 'gwei')} gwei`);
                console.log(`⛽ Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
                
                return gasPrice;
            } catch (error) {
                console.log(`⚠️ Error getting gas price: ${error.message}`);
                // Return default gas price on error
                const defaultGasPrice = ethers.parseUnits(CONFIG.GAS_SETTINGS.BASE_GAS_PRICE, 'gwei');
                console.log(`⚙️ Using default gas price: ${ethers.formatUnits(defaultGasPrice, 'gwei')} gwei`);
                return defaultGasPrice;
            }
        });
    }

    async checkBalance(gasPrice, gasLimit) {
        try {
            // Get balance using provider instead of wallet
            const balance = await this.provider.getBalance(this.wallet.address);
            const txCost = gasPrice * BigInt(gasLimit);
            
            console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ${CONFIG.CURRENCY_SYMBOL}`);
            console.log(`💸 Transaction cost: ${ethers.formatEther(txCost)} ${CONFIG.CURRENCY_SYMBOL}`);
            
            if (balance < txCost) {
                throw new Error(`Insufficient funds. Need ${ethers.formatEther(txCost)} ${CONFIG.CURRENCY_SYMBOL}, have ${ethers.formatEther(balance)} ${CONFIG.CURRENCY_SYMBOL}`);
            }
            
            return balance;
        } catch (error) {
            console.error('Error checking balance:', error.message);
            throw error;
        }
    }

    async performSwapWithRetry(pair, amount, attempt = 1) {
        return this.executeWithRpcFailover(async () => {
            let lastError;
            let currentGasPrice = await this.getGasPrice();
            const maxRetries = CONFIG.GAS_SETTINGS.MAX_RETRY_COUNT;
            let retryCount = 0;

            while (retryCount < maxRetries) {
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

                    // Get fresh nonce for each attempt
                    const nonce = await this.wallet.getNonce();
                    
                    // Estimate gas first
                    const estimatedGas = await this.router.exactInputSingle.estimateGas(params);
                    console.log(`⛽ Estimated gas: ${estimatedGas.toString()}`);

                    // Add buffer to estimated gas
                    const gasLimit = estimatedGas + BigInt(50000);

                    // Check if we can afford the transaction
                    await this.checkBalance(currentGasPrice, gasLimit);

                    const tx = await this.router.exactInputSingle(params, {
                        gasPrice: currentGasPrice,
                        gasLimit: gasLimit,
                        nonce: nonce,
                        type: 0 // Legacy transaction type
                    });

                    console.log(`🔄 Transaction sent: ${tx.hash}`);
                    console.log(`⛽ Using gas price: ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei`);

                    // Wait for 2 confirmations
                    const receipt = await tx.wait(2);
                    
                    // Store successful gas price
                    this.lastSuccessfulGasPrice = currentGasPrice;
                    console.log('✅ Swap completed successfully');
                    return;
                } catch (error) {
                    lastError = error;

                    if (error.message.includes('insufficient funds')) {
                        throw new Error('Insufficient funds for transaction');
                    }

                    if (error.message.includes('mempool is full') || 
                        error.message.includes('replacement fee too low')) {
                        
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            throw new Error(`Failed after ${maxRetries} attempts - mempool issues`);
                        }

                        // Calculate backoff delay
                        const backoffDelay = CONFIG.GAS_SETTINGS.INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
                        console.log(`⏳ Waiting ${backoffDelay/1000} seconds before retry...`);
                        await new Promise(r => setTimeout(r, backoffDelay));

                        // Double the gas price for next attempt
                        currentGasPrice = currentGasPrice * BigInt(CONFIG.GAS_SETTINGS.GAS_INCREASE_FACTOR);
                        const maxGasPrice = ethers.parseUnits(CONFIG.GAS_SETTINGS.MAX_GAS_PRICE, 'gwei');
                        
                        if (currentGasPrice > maxGasPrice) {
                            currentGasPrice = maxGasPrice;
                        }

                        console.log(`📈 New gas price: ${ethers.formatUnits(currentGasPrice, 'gwei')} gwei`);
                        continue;
                    }

                    throw error;
                }
            }
            throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
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
                    let delay;
                    if (typeof delayInSeconds === 'string') {
                        // Random delay between MIN and MAX swap delay
                        delay = Math.floor(
                            CONFIG.GAS_SETTINGS.MIN_SWAP_DELAY + 
                            Math.random() * (CONFIG.GAS_SETTINGS.MAX_SWAP_DELAY - CONFIG.GAS_SETTINGS.MIN_SWAP_DELAY)
                        );
                    } else {
                        // Use configured delay but cap it at MAX_SWAP_DELAY
                        delay = Math.min(delayInSeconds, CONFIG.GAS_SETTINGS.MAX_SWAP_DELAY);
                    }
                    
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
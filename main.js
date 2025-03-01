require('dotenv').config();
const ethers = require('ethers');
const readline = require('readline');

const CONFIG = {
    CHAIN_ID: 16600,
    RPC_URL: 'https://evmrpc-testnet.0g.ai',
    NETWORK_NAME: '0G-Newton-Testnet',
    CURRENCY_SYMBOL: 'A0GI',
    TOKENS: {
        USDT: '0x9A87C2412d500343c073E5Ae5394E3bE3874F76b',
        BTC: '0x1e0d871472973c562650e991ed8006549f8cbefc',
        ETH: '0xce830D0905e0f7A9b300401729761579c5FB6bd6',
        A0GI: '0x493eA9950586033eA8894B5E684bb4DF6979A0D3',
    },
    UNISWAP: {
        ROUTER: '0xD86b764618c6E3C078845BE3c3fCe50CE9535Da7',
        FACTORY: '0xe1aAD0bac492F6F46BFE1992080949401e1E90aD',
        QUOTER: '0x8B4f88a752Fd407ec911A716075Ca7809ADdBadd'
    },
    FEE_TIERS: [500, 3000, 10000]
};

// Add these constants at the top after CONFIG
const SWAP_DELAY = process.env.SWAP_DELAY || 60; // Default 60 seconds between swaps
const MIN_BALANCE_FOR_SWAP = process.env.MIN_BALANCE_FOR_SWAP || "0.1"; // Minimum balance required to swap

// Add at top with other constants
const MIN_DELAY = 30; // Minimum 30 seconds between swaps
const MAX_DELAY = 300; // Maximum 300 seconds (5 minutes) between swaps

// Add token decimals mapping
const TOKEN_DECIMALS = {
    USDT: 18,
    BTC: 18,
    ETH: 18,
    A0GI: 18  // verify this is the correct decimal for A0GI
};

// Add after CONFIG object
const AVAILABLE_PAIRS = [
    ['USDT', 'BTC'],  // USDT-BTC pool exists
    ['USDT', 'ETH'],  // USDT-ETH pool exists
    ['BTC', 'USDT'],  // BTC-USDT pool exists
    ['ETH', 'USDT']   // ETH-USDT pool exists
];

// Update ROUTER_ABI to include multicall function
const ROUTER_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
    "function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)"
];

// Update the QUOTER_ABI
const QUOTER_ABI = [
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"  // Add this line
];

class ZeroGSwapBot {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.router = null;
    }

    async initialize() {
        try {
            const privateKey = process.env.WALLET_PRIVATE_KEY;
            if (!privateKey || privateKey === 'your_private_key_here') {
                throw new Error('Invalid private key in .env file');
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

    async checkBalance(token) {
        const tokenAddress = CONFIG.TOKENS[token];
        if (!tokenAddress) {
            throw new Error('Invalid token symbol');
        }
        
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
        const balance = await tokenContract.balanceOf(this.wallet.address);
        const decimals = await tokenContract.decimals().catch(() => TOKEN_DECIMALS[token]);
        console.log(`${token} Balance: ${ethers.formatUnits(balance, decimals)}`);
        return balance;
    }

    async getAllBalances() {
        const balances = {};
        for (const [symbol, address] of Object.entries(CONFIG.TOKENS)) {
            try {
                const contract = new ethers.Contract(address, ERC20_ABI, this.wallet);
                const balance = await contract.balanceOf(this.wallet.address);
                const decimals = await contract.decimals().catch(() => TOKEN_DECIMALS[symbol]);
                
                balances[symbol] = {
                    raw: balance,
                    formatted: ethers.formatUnits(balance, decimals)
                };
                console.log(`${symbol}: ${balances[symbol].formatted}`);
            } catch (error) {
                console.error(`❌ Error getting ${symbol} balance:`, error);
                balances[symbol] = {
                    raw: BigInt(0),
                    formatted: '0.0'
                };
            }
        }
        return balances;
    }

    async findSwappableToken(balances) {
        // Get tokens with sufficient balance, excluding A0GI
        const swappableTokens = Object.entries(balances)
            .filter(([symbol, balance]) => 
                symbol !== 'A0GI' && 
                parseFloat(balance.formatted) >= parseFloat(MIN_BALANCE_FOR_SWAP)
            )
            .map(([symbol]) => symbol);

        if (swappableTokens.length === 0) {
            throw new Error('No tokens with sufficient balance for swap');
        }

        // Log available tokens for swapping
        console.log('\nSwappable tokens:', swappableTokens.join(', '));
        
        // Return random token from available ones
        return swappableTokens[Math.floor(Math.random() * swappableTokens.length)];
    }

    getRandomToken(fromToken) {
        // Get available destination tokens based on existing pools
        const availableTokens = AVAILABLE_PAIRS
            .filter(pair => pair[0] === fromToken)
            .map(pair => pair[1]);

        if (availableTokens.length === 0) {
            throw new Error(`No available trading pairs for ${fromToken}`);
        }

        // Log available destination tokens
        console.log('Available destination tokens:', availableTokens.join(', '));
        
        return availableTokens[Math.floor(Math.random() * availableTokens.length)];
    }

    getRandomAmount(balance, symbol) {
        // Convert balance to float
        const balanceFloat = parseFloat(balance);
        
        // Generate random percentage between 10% and 100%
        const percentage = Math.random() * 0.9 + 0.1; // 0.1 to 1.0
        
        // Calculate random amount
        let amount = balanceFloat * percentage;
        
        // Format based on token type
        switch(symbol) {
            case 'BTC':
                amount = parseFloat(amount.toFixed(8)); // BTC precision
                break;
            case 'ETH':
                amount = parseFloat(amount.toFixed(6)); // ETH precision
                break;
            default:
                amount = parseFloat(amount.toFixed(2)); // Default precision
        }
        
        return amount.toString();
    }

    async startRandomSwaps(txCount, delayInSeconds) {
        // Show initial status once
        console.log('\n🤖 Bot Status:');
        console.log(`🎯 Target: ${txCount} transactions`);
        if (delayInSeconds === 'random') {
            console.log(`⌛ Delay: Random (${MIN_DELAY}-${MAX_DELAY} seconds)`);
        } else {
            console.log(`⌛ Delay: ~${delayInSeconds.toFixed(1)} seconds`);
        }
        console.log(`💰 Min Balance: ${MIN_BALANCE_FOR_SWAP}`);
        console.log('\n📊 Initial Balances:');
        const balances = await this.getAllBalances();

        let completedTx = 0;

        while (completedTx < txCount) {
            let swapSuccess = false;
            while (!swapSuccess) {
                try {
                    // Find token with sufficient balance
                    const fromToken = await this.findSwappableToken(balances);
                    const toToken = this.getRandomToken(fromToken);
                    
                    // Get random amount
                    const amount = this.getRandomAmount(balances[fromToken].formatted, fromToken);
                    
                    console.log(`\n🔄 Swap ${completedTx + 1}/${txCount}:`);
                    console.log(`📤 From: ${fromToken} (${amount})`);
                    console.log(`📥 To: ${toToken}`);
                    
                    await this.executeSwap(fromToken, toToken, amount);
                    
                    // Update balances after successful swap
                    const newBalances = await this.getAllBalances();
                    Object.assign(balances, newBalances);
                    
                    swapSuccess = true;
                    completedTx++;

                    if (completedTx < txCount) {
                        let nextDelay;
                        if (delayInSeconds === 'random') {
                            // Generate random delay between MIN_DELAY and MAX_DELAY
                            nextDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY);
                        } else {
                            // Use configured delay with ±10% variation
                            nextDelay = delayInSeconds * (0.9 + Math.random() * 0.2);
                        }
                        
                        console.log(`\n⏳ Progress: ${completedTx}/${txCount} swaps`);
                        console.log(`⏱️  Waiting ${nextDelay.toFixed(1)}s for next swap...`);
                        await new Promise(resolve => setTimeout(resolve, nextDelay * 1000));
                    }
                } catch (error) {
                    console.error('❌ Swap failed:', error.message);
                    console.log('\n🔄 Retrying immediately with different tokens...');
                }
            }
        }

        console.log('\n✅ All scheduled swaps completed!');
        console.log(`📊 Final Balances:`);
        await this.getAllBalances();
    }

    async executeSwap(fromToken, toToken, amount) {
        try {
            // Check if pair is available
            const isPairAvailable = AVAILABLE_PAIRS.some(
                ([from, to]) => from === fromToken && to === toToken
            );

            if (!isPairAvailable) {
                throw new Error(`No liquidity pool exists for ${fromToken}-${toToken} pair`);
            }

            // Add validation to prevent A0GI swaps
            if (fromToken === 'A0GI' || toToken === 'A0GI') {
                throw new Error('A0GI swaps are not supported');
            }

            const tokenIn = CONFIG.TOKENS[fromToken];
            const tokenOut = CONFIG.TOKENS[toToken];
            if (!tokenIn || !tokenOut) {
                throw new Error('Invalid token symbols');
            }

            // Create token contract instances
            const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, this.wallet);
            
            // Convert amount to Wei
            const amountIn = ethers.parseUnits(amount.toString(), 18);
            
            // Check token balance
            const balance = await tokenInContract.balanceOf(this.wallet.address);
            if (balance < amountIn) {
                throw new Error(`Insufficient ${fromToken} balance. Required: ${amount}, Available: ${ethers.formatUnits(balance, 18)}`);
            }

            console.log('\n📝 Swap Progress:');
            
            // Check and approve tokens if needed
            const allowance = await tokenInContract.allowance(this.wallet.address, CONFIG.UNISWAP.ROUTER);
            if (allowance < amountIn) {
                console.log('👉 Approving tokens...');
                const approveTx = await tokenInContract.approve(CONFIG.UNISWAP.ROUTER, ethers.MaxUint256);
                await approveTx.wait();
                console.log('✅ Tokens approved');
            }

            // Check if pool exists first
            const factoryContract = new ethers.Contract(CONFIG.UNISWAP.FACTORY, [
                "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
            ], this.provider);

            // Find available pool with any fee tier
            let pool = null;
            let usableFeeTier = null;

            for (const feeTier of CONFIG.FEE_TIERS) {
                const poolAddress = await factoryContract.getPool(tokenIn, tokenOut, feeTier);
                if (poolAddress && poolAddress !== ethers.ZeroAddress) {
                    pool = poolAddress;
                    usableFeeTier = feeTier;
                    break;
                }
            }

            if (!pool) {
                throw new Error(`No liquidity pool exists for ${fromToken}-${toToken} pair`);
            }

            // Use the found fee tier for swap
            const params = {
                tokenIn,
                tokenOut,
                fee: usableFeeTier,
                recipient: this.wallet.address,
                deadline: Math.floor(Date.now() / 1000) + 60 * 20,
                amountIn,
                amountOutMinimum: 0, // Accept any amount for now
                sqrtPriceLimitX96: 0
            };

            console.log(`🔄 Executing swap (fee tier: ${usableFeeTier})`);
            console.log(`📤 Sending transaction...`);
            
            const tx = await this.router.exactInputSingle(params, {
                gasLimit: ethers.parseUnits("500000", "wei") // Set fixed gas limit
            });
            
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            
            console.log(`\n✅ Swap Success:`);
            console.log(`💱 ${amount} ${fromToken} → ${toToken}`);
            console.log(`🧾 Hash: ${receipt.hash}`);
            
            return receipt;
        } catch (error) {
            console.error('❌ Swap failed:', error.message);
            throw error;
        }
    }
}

// Add this function to get user input
async function getUserInput() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    try {
        const txCount = await question('Enter number of transactions to perform: ');
        const hours = await question('Enter time period in hours (optional, press Enter to skip): ');
        
        if (isNaN(txCount) || parseInt(txCount) <= 0) {
            throw new Error('Please enter a valid number of transactions');
        }

        rl.close();
        
        let delayInSeconds;
        if (hours && hours.trim() !== '') {
            if (isNaN(hours) || parseFloat(hours) <= 0) {
                throw new Error('Please enter a valid number of hours');
            }
            // Calculate delay based on period
            delayInSeconds = (parseFloat(hours) * 3600) / parseInt(txCount);
        } else {
            // Use random delay if no period specified
            delayInSeconds = 'random';
        }
        
        return {
            txCount: parseInt(txCount),
            delayInSeconds
        };
    } catch (error) {
        rl.close();
        throw error;
    }
}

// Update main function
async function main() {
    try {
        // Get user input first
        const { txCount, delayInSeconds } = await getUserInput();

        console.log('\n🚀 Initializing Swap Bot...');
        const bot = new ZeroGSwapBot();
        await bot.initialize();
        await bot.startRandomSwaps(txCount, delayInSeconds);
        
        console.log('\n🎉 Bot execution completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Bot execution failed:', error);
        process.exit(1);
    }
}

module.exports = ZeroGSwapBot;

// Run if called directly
if (require.main === module) {
    main();
}

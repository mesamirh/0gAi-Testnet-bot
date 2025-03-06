const ZeroGSwapBot = require('./ZeroGSwapBot');
const WalletManager = require('./WalletManager');
const readline = require('readline');
require('dotenv').config();

class MultiWalletSwapBot {
    constructor() {
        this.walletManager = new WalletManager();
        this.bots = new Map();
    }

    async getUserInput() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise((resolve) => rl.question(query, resolve));

        try {
            console.log('\n🤖 Multi-Wallet Swap Bot Configuration');
            console.log('=====================================');
            
            // First ask if user wants to use .env wallet
            const useEnvWallet = await question('Do you want to use wallet from .env file? (y/n): ');
            let wallets;
            
            if (useEnvWallet.toLowerCase() === 'y') {
                if (!process.env.WALLET_PRIVATE_KEY) {
                    throw new Error('No private key found in .env file');
                }
                wallets = [{
                    address: 'ENV_WALLET', // Actual address will be shown after initialization
                    privateKey: process.env.WALLET_PRIVATE_KEY
                }];
            } else {
                // Check for existing wallets
                const existingWallets = await this.walletManager.loadExistingWallets();
                
                if (existingWallets.length > 0) {
                    const useExisting = await question(`Found ${existingWallets.length} existing wallets. Use them? (y/n): `);
                    
                    if (useExisting.toLowerCase() === 'y') {
                        wallets = existingWallets;
                    } else {
                        const walletCount = await question('Enter number of new wallets to generate: ');
                        if (isNaN(walletCount) || parseInt(walletCount) <= 0) {
                            throw new Error('Please enter a valid number of wallets');
                        }
                        wallets = await this.walletManager.generateWallets(parseInt(walletCount));
                    }
                } else {
                    const walletCount = await question('Enter number of wallets to generate: ');
                    if (isNaN(walletCount) || parseInt(walletCount) <= 0) {
                        throw new Error('Please enter a valid number of wallets');
                    }
                    wallets = await this.walletManager.generateWallets(parseInt(walletCount));
                }
            }
            
            const txCount = await question('Enter number of transactions per wallet: ');
            const hours = await question('Enter time period in hours (optional, press Enter for random delays): ');

            if (isNaN(txCount) || parseInt(txCount) <= 0) {
                throw new Error('Please enter a valid number of transactions');
            }

            rl.close();

            let delayInSeconds;
            if (hours && hours.trim() !== '') {
                if (isNaN(hours) || parseFloat(hours) <= 0) {
                    throw new Error('Please enter a valid number of hours');
                }
                delayInSeconds = (parseFloat(hours) * 3600) / parseInt(txCount);
            } else {
                delayInSeconds = 'random';
            }

            return {
                wallets,
                txCount: parseInt(txCount),
                delayInSeconds
            };
        } catch (error) {
            rl.close();
            throw error;
        }
    }

    async initialize() {
        const { wallets, txCount, delayInSeconds } = await this.getUserInput();
        
        // Initialize bots for each wallet
        for (const wallet of wallets) {
            const bot = new ZeroGSwapBot();
            await bot.initializeWithPrivateKey(wallet.privateKey);
            
            // Update the address if it's from .env
            if (wallet.address === 'ENV_WALLET') {
                wallet.address = bot.wallet.address;
            }
            
            this.bots.set(wallet.address, bot);
        }

        return { txCount, delayInSeconds };
    }

    async startMultiWalletSwaps(txCount, delayInSeconds) {
        const promises = [];
        let walletIndex = 1;

        for (const [address, bot] of this.bots) {
            console.log(`\n🏃 Starting swaps for wallet ${walletIndex}/${this.bots.size}`);
            console.log(`📍 Address: ${address}`);
            
            // Start swaps for each wallet with a small initial delay to prevent rate limiting
            const promise = new Promise(async (resolve) => {
                await new Promise(r => setTimeout(r, walletIndex * 2000)); // 2 second delay between wallet starts
                await bot.startRandomSwaps(txCount, delayInSeconds);
                resolve();
            });

            promises.push(promise);
            walletIndex++;
        }

        // Wait for all wallets to complete their swaps
        await Promise.all(promises);
    }
}

module.exports = MultiWalletSwapBot;
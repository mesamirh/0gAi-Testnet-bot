require('dotenv').config();
const MultiWalletSwapBot = require('./src/MultiWalletSwapBot');

async function main() {
    try {
        console.log('\n🚀 Initializing 0gAi Testnet bot...');
        const multiBot = new MultiWalletSwapBot();
        const { txCount, delayInSeconds } = await multiBot.initialize();
        
        console.log('\n⚡ Starting swaps for all wallets...');
        await multiBot.startMultiWalletSwaps(txCount, delayInSeconds);
        
        console.log('\n🎉 All wallet operations completed successfully!');
        console.log('📝 Check generated_wallets.txt for wallet details');
        process.exit(0);
    } catch (error) {
        console.error('❌ Bot execution failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

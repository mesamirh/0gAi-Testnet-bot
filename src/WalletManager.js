const ethers = require('ethers');
const fs = require('fs').promises;
const path = require('path');

class WalletManager {
    constructor() {
        this.wallets = [];
        this.walletsFile = path.join(process.cwd(), 'generated_wallets.txt');
    }

    async loadExistingWallets() {
        try {
            const content = await fs.readFile(this.walletsFile, 'utf8');
            const walletEntries = content.split('\n\n').filter(entry => entry.trim());
            
            this.wallets = walletEntries.map(entry => {
                const addressMatch = entry.match(/Address: (0x[a-fA-F0-9]{40})/);
                const privateKeyMatch = entry.match(/Private Key: (0x[a-fA-F0-9]{64})/);
                
                if (addressMatch && privateKeyMatch) {
                    return {
                        address: addressMatch[1],
                        privateKey: privateKeyMatch[1]
                    };
                }
            }).filter(wallet => wallet !== undefined);

            console.log(`\n📂 Loaded ${this.wallets.length} existing wallets`);
            return this.wallets;
        } catch (error) {
            console.log('\n⚠️ No existing wallets found or file is invalid');
            return [];
        }
    }

    async generateWallets(count) {
        console.log(`\n🔐 Generating ${count} new wallets...`);
        
        this.wallets = [];
        for (let i = 0; i < count; i++) {
            const wallet = ethers.Wallet.createRandom();
            this.wallets.push({
                address: wallet.address,
                privateKey: wallet.privateKey
            });
            
            console.log(`✅ Generated wallet ${i + 1}/${count}: ${wallet.address}`);
        }

        await this.exportWallets();
        return this.wallets;
    }

    async exportWallets() {
        const content = this.wallets.map((wallet, index) => 
            `Wallet ${index + 1}:\nAddress: ${wallet.address}\nPrivate Key: ${wallet.privateKey}`
        ).join('\n\n');

        await fs.writeFile(this.walletsFile, content);
        console.log(`\n💾 Exported wallet details to ${this.walletsFile}`);
    }
}

module.exports = WalletManager;
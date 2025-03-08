# 0gAi-Testnet-bot

## Overview

A Node.js bot for automating token swaps on the 0G-Newton-Testnet using Uniswap V3. Supports multi-wallet operations with configurable transaction parameters and timing.

## Features

- Multi-wallet support with automatic wallet generation
- Automated token swaps with configurable amounts and delays
- Random delay distribution for natural trading patterns
- RPC failover and retry mechanisms
- Gas price optimization
- Wallet management and export

## Prerequisites

- Node.js v14+
- npm v6+
- Private key with testnet funds (optional)

## Installation

1. Clone and setup:

```bash
git clone https://github.com/mesamirh/0gAi-Testnet-bot.git
cd 0gAi-Testnet-bot
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment:

```bash
# .env file
WALLET_PRIVATE_KEY=your_private_key_here  # Optional
```

## Usage

Run the bot:

```bash
node main.js
```

Follow the interactive prompts to:

1. Choose wallet mode (generate new or use existing)
2. Set number of transactions
3. Configure timing parameters

## Configuration

Edit `src/config.js` to modify:

- RPC endpoints
- Token addresses
- Router/Factory contracts
- Network parameters
- Gas settings

Generated wallet details are saved to `generated_wallets.txt`.

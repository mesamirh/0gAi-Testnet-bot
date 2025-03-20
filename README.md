# 0gAi-Testnet-Bot

An automated trading bot for the 0G Newton Testnet that performs random swaps between available token pairs using Uniswap V3 protocol.

## Features

- Automated random swaps between supported token pairs (USDT, BTC, ETH)
- Dynamic gas price adjustment
- Optimal fee tier detection
- Configurable transaction count and time period
- Random or fixed delay between swaps
- Balance tracking and validation
- Error handling and automatic retries

## Prerequisites

- Node.js v16 or higher
- A wallet private key with testnet tokens
- Basic understanding of DeFi and Uniswap V3

## Installation

1. Clone the repository:

```bash
git clone https://github.com/mesamirh/0gAi-Testnet-bot.git
cd 0gAi-Testnet-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file:

```
WALLET_PRIVATE_KEY=your_private_key_here
SWAP_DELAY=60
MIN_BALANCE_FOR_SWAP=0.1
```

## Usage

Run the bot:

```bash
node main.js
```

Follow the prompts to:

1. Enter the number of transactions
2. Enter the time period (optional)

## Supported Tokens

- USDT
- BTC
- ETH
- A0GI (native token, not available for swaps)

## Available Trading Pairs

- USDT-BTC
- USDT-ETH
- BTC-USDT
- ETH-USDT

## Safety Features

- Minimum balance checks
- Maximum gas price limits
- Transaction timeout protection
- Automatic retry mechanism
- Slippage protection

## Disclaimer

This is a testnet bot. Use at your own risk.

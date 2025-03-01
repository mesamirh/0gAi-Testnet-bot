# 0gai-testnet-bot

## Overview

`0gai-testnet-bot` is a Node.js application designed to perform automated token swaps on the 0G-Newton-Testnet using Uniswap. The bot interacts with the Ethereum blockchain via the ethers.js library and supports multiple tokens and trading pairs.

## Features

- Automated token swaps with configurable delay
- Supports multiple tokens and trading pairs
- Randomized swap amounts and delays
- Balance checking and token approval
- Error handling and retry mechanism

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- A wallet private key with sufficient testnet tokens
- .env file with necessary environment variables

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

3. Create a `.env` file in the root directory and add the following variables:

    ```plaintext
    WALLET_PRIVATE_KEY=your_private_key_here
    SWAP_DELAY=60
    MIN_BALANCE_FOR_SWAP=0.1
    ```

## Usage

1. Run the bot:

    ```bash
    node main.js
    ```

2. Follow the prompts to enter the number of transactions and the time period (optional).

## Configuration

The bot can be configured via the `CONFIG` object in `main.js`:

- `CHAIN_ID`: The chain ID of the testnet.
- `RPC_URL`: The RPC URL of the testnet.
- `NETWORK_NAME`: The name of the network.
- `CURRENCY_SYMBOL`: The symbol of the network's currency.
- `TOKENS`: The addresses of the supported tokens.
- `UNISWAP`: The addresses of the Uniswap router, factory, and quoter.
- `FEE_TIERS`: The fee tiers for Uniswap pools.
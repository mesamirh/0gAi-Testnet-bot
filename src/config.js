const CONFIG = {
    CHAIN_ID: 16600,
    RPC_URLS: [
        'https://og-testnet-evm.itrocket.net',
        'https://lightnode-json-rpc-0g.grandvalleys.com',
        'https://evmrpc-testnet.0g.ai',
        'https://0g-json-rpc-public.originstake.com'
    ],
    NETWORK_NAME: '0G-Newton-Testnet',
    CURRENCY_SYMBOL: 'A0GI',
    UNISWAP: {
        ROUTER: '0xD86b764618c6E3C078845BE3c3fCe50CE9535Da7',
        FACTORY: '0xe1aAD0bac492F6F46BFE1992080949401e1E90aD',
        QUOTER: '0x8B4f88a752Fd407ec911A716075Ca7809ADdBadd'
    },
    FEE_TIERS: [500, 3000, 10000],
    GAS_SETTINGS: {
        BASE_GAS_PRICE: '0.002',
        MIN_GAS_PRICE: '0.001',
        MAX_GAS_PRICE: '0.05',  // Increased max gas price
        DEFAULT_GAS_LIMIT: 300000,
        CUSTOM_GAS_LIMIT: null,
        MAX_RETRY_COUNT: 3,     // Reduced retry count
        INITIAL_RETRY_DELAY: 10000, // Increased initial delay
        GAS_INCREASE_FACTOR: 3, // More aggressive increase
        MIN_SWAP_DELAY: 30,     // Increased minimum delay
        MAX_SWAP_DELAY: 120     // Increased maximum delay
    }
};

const TOKEN_DECIMALS = {
    WETH: 18,
    USDT: 6,
    USDC: 6
};

const AVAILABLE_PAIRS = [
    {
        token0: {
            symbol: 'USDT',
            address: '0x9A87C2412d500343c073E5Ae5394E3bE3874F76b',
            decimals: 18
        },
        token1: {
            symbol: 'BTC',
            address: '0x1e0d871472973c562650e991ed8006549f8cbefc',
            decimals: 18
        },
        fee: 3000
    }
];

const ROUTER_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
    "function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountIn)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

module.exports = {
    CONFIG,
    TOKEN_DECIMALS,
    AVAILABLE_PAIRS,
    ROUTER_ABI,
    ERC20_ABI
};
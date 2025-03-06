const CONFIG = {
    CHAIN_ID: 16600,
    RPC_URL: 'https://og-testnet-evm.itrocket.net',
    NETWORK_NAME: '0G-Testnet',
    CURRENCY_SYMBOL: 'OG',
    UNISWAP: {
        ROUTER: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', // Update with actual router address
        FACTORY: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', // Update with actual factory address
        QUOTER: '0x0000000000000000000000000000000000000000'  // Update with actual quoter address
    },
    FEE_TIERS: [500, 3000, 10000]
};

const TOKEN_DECIMALS = {
    WETH: 18,
    USDT: 6,
    USDC: 6
};

const AVAILABLE_PAIRS = [
    {
        token0: {
            symbol: 'WETH',
            address: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
            decimals: 18
        },
        token1: {
            symbol: 'USDC',
            address: '0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557',
            decimals: 6
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
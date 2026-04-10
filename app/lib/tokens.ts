export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  coingeckoId: string;
  logoUrl: string;
  isStable: boolean;
}

export const SUPPORTED_CHAINS = [8453, 42161, 1, 10] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number];

export const CHAIN_NAMES: Record<SupportedChainId, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
};

export const CHAIN_RPC_URLS: Record<SupportedChainId, string> = {
  1: "https://cloudflare-eth.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
};

// Token addresses per chain
export const TOKENS: TokenInfo[] = [
  // Ethereum (1)
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    chainId: 1,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    chainId: 1,
    coingeckoId: "tether",
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    isStable: true,
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    chainId: 1,
    coingeckoId: "dai",
    logoUrl: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
    isStable: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    chainId: 1,
    coingeckoId: "weth",
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    isStable: false,
  },
  {
    symbol: "wstETH",
    name: "Wrapped liquid staked Ether 2.0",
    address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    decimals: 18,
    chainId: 1,
    coingeckoId: "wrapped-steth",
    logoUrl: "https://assets.coingecko.com/coins/images/18834/small/wstETH.png",
    isStable: false,
  },
  // Base (8453)
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    chainId: 8453,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    chainId: 8453,
    coingeckoId: "weth",
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    isStable: false,
  },
  {
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    decimals: 18,
    chainId: 8453,
    coingeckoId: "coinbase-wrapped-staked-eth",
    logoUrl: "https://assets.coingecko.com/coins/images/27008/small/cbeth.png",
    isStable: false,
  },
  // Arbitrum (42161)
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    chainId: 42161,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
    chainId: 42161,
    coingeckoId: "tether",
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    isStable: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    decimals: 18,
    chainId: 42161,
    coingeckoId: "weth",
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    isStable: false,
  },
  {
    symbol: "wstETH",
    name: "Wrapped liquid staked Ether 2.0",
    address: "0x5979D7b546E38E414F7E9822514be443A4800529",
    decimals: 18,
    chainId: 42161,
    coingeckoId: "wrapped-steth",
    logoUrl: "https://assets.coingecko.com/coins/images/18834/small/wstETH.png",
    isStable: false,
  },
  // Optimism (10)
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    decimals: 6,
    chainId: 10,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    decimals: 6,
    chainId: 10,
    coingeckoId: "tether",
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    isStable: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    chainId: 10,
    coingeckoId: "weth",
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    isStable: false,
  },
];

export function getTokensByChain(chainId: number): TokenInfo[] {
  return TOKENS.filter((t) => t.chainId === chainId);
}

export function getToken(chainId: number, address: string): TokenInfo | undefined {
  return TOKENS.find(
    (t) => t.chainId === chainId && t.address.toLowerCase() === address.toLowerCase()
  );
}

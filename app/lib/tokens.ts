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

export const SUPPORTED_CHAINS = [8453, 42161, 1, 10, 137, 324] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number];

export const CHAIN_NAMES: Record<SupportedChainId, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
  324: "zkSync Era",
};

// Alchemy RPC URLs — populated at runtime from env var
export function getChainRpcUrl(chainId: SupportedChainId): string {
  const alchemyKey = typeof window !== "undefined"
    ? (import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined)
    : undefined;

  const isDev = typeof window !== "undefined" && import.meta.env.DEV;

  if (alchemyKey) {
    if (isDev) {
      // In dev, route through Vite proxy to avoid CORS
      const proxyPaths: Record<SupportedChainId, string> = {
        1: `/rpc/eth/v2/${alchemyKey}`,
        8453: `/rpc/base/v2/${alchemyKey}`,
        42161: `/rpc/arb/v2/${alchemyKey}`,
        10: `/rpc/opt/v2/${alchemyKey}`,
        137: `/rpc/polygon/v2/${alchemyKey}`,
        324: `https://mainnet.era.zksync.io`, // zkSync doesn't use Alchemy v2 proxy same way
      };
      return proxyPaths[chainId];
    }
    // In prod, call Alchemy directly
    const alchemyUrls: Record<SupportedChainId, string> = {
      1: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      8453: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      42161: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      10: `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      137: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      324: `https://mainnet.era.zksync.io`,
    };
    return alchemyUrls[chainId];
  }

  // Fallback public RPCs (no CORS issues)
  const fallbacks: Record<SupportedChainId, string> = {
    1: "https://ethereum.publicnode.com",
    8453: "https://mainnet.base.org",
    42161: "https://arb1.arbitrum.io/rpc",
    10: "https://mainnet.optimism.io",
    137: "https://polygon-rpc.com",
    324: "https://mainnet.era.zksync.io",
  };
  return fallbacks[chainId];
}

// Keep for backward compat
export const CHAIN_RPC_URLS: Record<SupportedChainId, string> = {
  1: "https://ethereum.publicnode.com",
  8453: "https://mainnet.base.org",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  137: "https://polygon-rpc.com",
  324: "https://mainnet.era.zksync.io",
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
  // LBTC on Ethereum
  {
    symbol: "LBTC",
    name: "Lombard Staked Bitcoin",
    address: "0x8236a87084f8B84306f72007F36F2618A5634494",
    decimals: 8,
    chainId: 1,
    coingeckoId: "lombard-staked-btc",
    logoUrl: "https://assets.coingecko.com/coins/images/39969/small/LBTC.jpg",
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
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    decimals: 8,
    chainId: 8453,
    coingeckoId: "coinbase-wrapped-btc",
    logoUrl: "https://ipfs.io/ipfs/QmZ7L8yd5j36oXXydUiYFiFsRHbi3EdgC4RuFwvM7dcqge",
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
  // Polygon (137)
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    chainId: 137,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "USDC.e",
    name: "Bridged USD Coin",
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6,
    chainId: 137,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    decimals: 18,
    chainId: 137,
    coingeckoId: "weth",
    logoUrl: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    isStable: false,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
    chainId: 137,
    coingeckoId: "tether",
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    isStable: true,
  },
  {
    symbol: "WMATIC",
    name: "Wrapped MATIC",
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    decimals: 18,
    chainId: 137,
    coingeckoId: "wmatic",
    logoUrl: "https://assets.coingecko.com/coins/images/14073/small/WMATIC.png",
    isStable: false,
  },
  // zkSync Era (324)
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4",
    decimals: 6,
    chainId: 324,
    coingeckoId: "usd-coin",
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    isStable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C",
    decimals: 6,
    chainId: 324,
    coingeckoId: "tether",
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    isStable: true,
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x5AEa09767a0023F9df404518EE091245ed11C2c1",
    decimals: 18,
    chainId: 324,
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

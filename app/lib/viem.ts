import { createPublicClient, http, fallback } from "viem";
import { mainnet, base, arbitrum, optimism, polygon, zkSync } from "viem/chains";
import { getChainRpcUrl, type SupportedChainId, CHAIN_RPC_URLS } from "./tokens";

export const VIEM_CHAINS = { 
  1: mainnet, 
  8453: base, 
  42161: arbitrum, 
  10: optimism, 
  137: polygon, 
  324: zkSync 
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<SupportedChainId, any>();

export function getPublicClient(chainId: SupportedChainId) {
  if (clientCache.has(chainId)) return clientCache.get(chainId)!;

  const alchemyRpcUrl = getChainRpcUrl(chainId);
  const publicRpcUrl = CHAIN_RPC_URLS[chainId];

  const client = createPublicClient({
    chain: VIEM_CHAINS[chainId],
    transport: fallback([
      http(alchemyRpcUrl, { timeout: 10000 }),
      http(publicRpcUrl, { timeout: 10000 }),
    ]),
  });

  clientCache.set(chainId, client);
  return client;
}

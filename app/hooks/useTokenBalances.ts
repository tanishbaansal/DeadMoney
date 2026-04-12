import { useEffect, useState } from "react";
import { erc20Abi } from "viem";
import type { TokenBalance } from "~/lib/deadMoney";
import { TOKENS, type SupportedChainId, type TokenInfo } from "~/lib/tokens";
import { getPrices } from "~/lib/prices";
import { getPublicClient } from "~/lib/viem";

// Native ETH token stubs — one per chain, address = zero address convention
const NATIVE_ETH_TOKENS: TokenInfo[] = [
  { symbol: "ETH", name: "Ether", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, chainId: 1, coingeckoId: "weth", logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", isStable: false },
  { symbol: "ETH", name: "Ether", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, chainId: 8453, coingeckoId: "weth", logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", isStable: false },
  { symbol: "ETH", name: "Ether", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, chainId: 42161, coingeckoId: "weth", logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", isStable: false },
  { symbol: "ETH", name: "Ether", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, chainId: 10, coingeckoId: "weth", logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", isStable: false },
  { symbol: "MATIC", name: "MATIC", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, chainId: 137, coingeckoId: "matic-network", logoUrl: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png", isStable: false },
  { symbol: "ETH", name: "Ether", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", decimals: 18, chainId: 324, coingeckoId: "weth", logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png", isStable: false },
];

export type BalanceStatus = "idle" | "loading" | "done" | "error";

export function useTokenBalances(address: string | null) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [status, setStatus] = useState<BalanceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function refetch() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function fetchBalances() {
      console.log("[useTokenBalances] starting fetch for address:", address);
      setStatus("loading");
      setError(null);

      try {
        const coingeckoIds = [...new Set([...TOKENS, ...NATIVE_ETH_TOKENS].map((t) => t.coingeckoId))];
        console.log("[useTokenBalances] fetching prices for", coingeckoIds.length, "ids");
        
        let prices: Record<string, number>;
        try {
          prices = await getPrices(coingeckoIds);
          console.log("[useTokenBalances] prices fetched successfully");
        } catch (pe) {
          console.error("[useTokenBalances] price fetch failed:", pe);
          if (!cancelled) {
             setError("Price data currently unavailable. Using fallbacks.");
             // Continue anyway with fallbacks in getPrice
             prices = {};
          } else return;
        }

        const chainIds = [1, 8453, 42161, 10, 137, 324] as SupportedChainId[];
        console.log("[useTokenBalances] scanning", chainIds.length, "chains");

        const chainPromises = chainIds.map(async (chainId) => {
          const chainResults: TokenBalance[] = [];
          try {
            const client = getPublicClient(chainId);
            const chainTokens = TOKENS.filter((t) => t.chainId === chainId);
            console.log(`[useTokenBalances] chain${chainId}: scanning ${chainTokens.length} tokens`);

            // 1. Native balance
            try {
              const nativeRaw = await client.getBalance({ address: address as `0x${string}` });
              const nativeToken = NATIVE_ETH_TOKENS.find((t) => t.chainId === chainId)!;
              const nativeBalance = Number(nativeRaw) / 1e18;
              const nativePrice = prices[nativeToken.coingeckoId] ?? (chainId === 137 ? 1 : 2000);
              const nativeUsd = nativeBalance * nativePrice;
              
              if (nativeBalance > 0) {
                console.log(`[useTokenBalances] chain${chainId}: found ${nativeToken.symbol} balance: ${nativeBalance}`);
              }

              if (nativeUsd >= 0.1 || (chainId === 137 && nativeBalance > 0)) {
                 chainResults.push({ token: nativeToken, rawBalance: nativeRaw, balance: nativeBalance, usdValue: nativeUsd });
              }
            } catch (e) {
              console.warn(`[useTokenBalances] chain${chainId} native failed:`, e);
            }

            // 2. Multicall for ERC20s
            if (chainTokens.length > 0) {
              try {
                const calls = chainTokens.map((token) => ({
                  address: token.address as `0x${string}`,
                  abi: erc20Abi,
                  functionName: "balanceOf" as const,
                  args: [address as `0x${string}`],
                }));
                const rawResults = await client.multicall({ contracts: calls });
                console.log(`[useTokenBalances] chain${chainId}: multicall returned ${rawResults.length} results`);

                for (let i = 0; i < chainTokens.length; i++) {
                  const token = chainTokens[i];
                  const res = rawResults[i];
                  if (res.status !== "success") continue;
                  const rawBalance = res.result as bigint;
                  if (rawBalance === 0n) continue;

                  const balance = Number(rawBalance) / Math.pow(10, token.decimals);
                  const price = prices[token.coingeckoId] ?? (token.isStable ? 1 : 0);
                  const usdValue = balance * price;
                  
                  console.log(`[useTokenBalances] chain${chainId}: found ${token.symbol} balance: ${balance} ($${usdValue.toFixed(2)})`);

                  if (usdValue >= 0.1 || chainId === 137) {
                    chainResults.push({ token, rawBalance, balance, usdValue });
                  }
                }
              } catch (e) {
                console.warn(`[useTokenBalances] chain${chainId} multicall failed:`, e);
              }
            }
          } catch (e) {
            console.error(`[useTokenBalances] fatal error on chain${chainId}:`, e);
          }
          return chainResults;
        });

        const allChainResults = await Promise.all(chainPromises);
        const results = allChainResults.flat();

        if (!cancelled) {
          console.log("[useTokenBalances] fetch complete. Found", results.length, "significant balances.");
          setBalances(results);
          setStatus("done");
        }
      } catch (err) {
        console.error("[useTokenBalances] fatal error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch balances");
          setStatus("error");
        }
      }
    }

    fetchBalances();
    return () => { 
      console.log("[useTokenBalances] effect cancelled");
      cancelled = true; 
    };
  }, [address, refreshKey]);

  return { balances, status, error, refetch };
}

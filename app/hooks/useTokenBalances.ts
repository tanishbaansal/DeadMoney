import { useEffect, useState } from "react";
import { createPublicClient, http, erc20Abi } from "viem";
import { mainnet, base, arbitrum, optimism } from "viem/chains";
import type { TokenBalance } from "~/lib/deadMoney";
import { TOKENS, CHAIN_RPC_URLS, type SupportedChainId } from "~/lib/tokens";
import { getPrices } from "~/lib/prices";

const clients = {
  1: createPublicClient({ chain: mainnet, transport: http(CHAIN_RPC_URLS[1]) }),
  8453: createPublicClient({ chain: base, transport: http(CHAIN_RPC_URLS[8453]) }),
  42161: createPublicClient({ chain: arbitrum, transport: http(CHAIN_RPC_URLS[42161]) }),
  10: createPublicClient({ chain: optimism, transport: http(CHAIN_RPC_URLS[10]) }),
} as const;

export type BalanceStatus = "idle" | "loading" | "done" | "error";

export function useTokenBalances(address: string | null) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [status, setStatus] = useState<BalanceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function fetchBalances() {
      setStatus("loading");
      setError(null);

      try {
        // Fetch all prices first
        const coingeckoIds = [...new Set(TOKENS.map((t) => t.coingeckoId))];
        const prices = await getPrices(coingeckoIds);

        const results: TokenBalance[] = [];

        // Group tokens by chain and do multicall per chain
        const chainIds = [1, 8453, 42161, 10] as SupportedChainId[];

        for (const chainId of chainIds) {
          const chainTokens = TOKENS.filter((t) => t.chainId === chainId);
          if (chainTokens.length === 0) continue;

          const client = clients[chainId];

          try {
            const calls = chainTokens.map((token) => ({
              address: token.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf" as const,
              args: [address as `0x${string}`],
            }));

            const rawResults = await client.multicall({ contracts: calls });

            for (let i = 0; i < chainTokens.length; i++) {
              const token = chainTokens[i];
              const result = rawResults[i];

              if (result.status !== "success") continue;

              const rawBalance = result.result as bigint;
              if (rawBalance === 0n) continue;

              const balance = Number(rawBalance) / Math.pow(10, token.decimals);
              const price = prices[token.coingeckoId] ?? (token.isStable ? 1 : 0);
              const usdValue = balance * price;

              if (usdValue < 10) continue; // Filter dust

              results.push({ token, rawBalance, balance, usdValue });
            }
          } catch {
            // Chain RPC failed — continue with others
          }
        }

        if (!cancelled) {
          setBalances(results);
          setStatus("done");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch balances");
          setStatus("error");
        }
      }
    }

    fetchBalances();
    return () => { cancelled = true; };
  }, [address]);

  return { balances, status, error };
}

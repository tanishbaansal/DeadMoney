import { useEffect, useState, useMemo } from "react";
import { getPortfolioPositions, getTransactionHistory, getAllVaults, type Position, type Vault } from "~/lib/earnApi";
import { synthesizePositionsFromHistory } from "~/lib/deposits";
import { getPublicClient } from "~/lib/viem";
import { erc20Abi, formatUnits } from "viem";

export type PortfolioStatus = "idle" | "loading" | "done" | "error";

export function usePortfolio(address: string | null) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PortfolioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function fetchAll() {
      setStatus("loading");
      setError(null);
      try {
        // Fetch everything in parallel
        const [indexedPositions, history, vaults] = await Promise.all([
          getPortfolioPositions(address!),
          getTransactionHistory(address!),
          getAllVaults(),
        ]);

        if (cancelled) {
          return;
        }

        // Create vault map for synthesis
        const vaultMap: Record<string, Vault> = {};
        for (const v of vaults) {
          const key = `${v.chainId}:${v.address.toLowerCase()}`;
          vaultMap[key] = v;
        }

        // Merge indexed positions with history-synthesized ones
        const rawMerged = synthesizePositionsFromHistory(history, indexedPositions, vaultMap);
        
        // Data cleanup: Ensure every position has a vault object
        const merged = rawMerged.map(p => {
          if (p.vault) return p;
          // Try to recover vault from vaultMap if possible
          // Some API responses might have vault address but not the full object
          const vaultKey = `${p.chainId}:${(p as any).vaultAddress?.toLowerCase()}`;
          const recovered = vaultMap[vaultKey];
          if (recovered) {
             return { ...p, vault: recovered };
          }
          return p;
        }).filter(p => !!p.vault);

        
        // Final verification pass: check real on-chain balances for synthesized positions
        const verified = await Promise.all(merged.map(async (p) => {
          if (!p || !p.vault) {
            console.warn("[usePortfolio] skipping position with missing vault:", p);
            return null;
          }

          try {
            const client = getPublicClient(p.chainId as any);
            const bal = await client.readContract({
              address: p.vault.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            }) as bigint;

            const decimals = p.vault.decimals || (p.vault as any).token?.decimals || 18;
            const liveAmountString = formatUnits(bal, decimals);
            const liveAmount = parseFloat(liveAmountString);

            // Drop dust. After a withdraw, rebasing aTokens leave a few wei
            // behind (LI.FI routes can't pull 100% cleanly). Anything below
            // $0.01 is counted as fully withdrawn so it doesn't show up as a
            // phantom active position in MyDeposits / Dead Money.
            const DUST_USD_THRESHOLD = 0.01;
            const priorUsdPerUnit =
              parseFloat(p.stakedTokenAmount) > 0
                ? (p.stakedTokenAmountUsd ?? 0) / parseFloat(p.stakedTokenAmount)
                : 0;
            const liveUsd = liveAmount * priorUsdPerUnit;

            if (liveAmount > 0 && liveUsd >= DUST_USD_THRESHOLD) {
              return {
                ...p,
                vault: {
                  ...p.vault,
                  decimals: decimals
                },
                stakedTokenAmount: liveAmountString,
                stakedTokenAmountUsd: liveUsd,
              };
            }
            return null;
          } catch (e) {
            console.warn(`[usePortfolio] check failed for ${p.vault?.name || "vault"} on chain ${p.chainId}:`, e);
            return p; // Keep it if we can't check
          }
        }));

        const finalPositions = verified.filter((p): p is Position => p !== null);
        
        if (!cancelled) {
          setPositions(finalPositions);
          setStatus("done");
        }
      } catch (err) {
        console.error("[usePortfolio] fatal error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
          setStatus("error");
          setPositions([]);
        }
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [address, refetchTick]);

  function refetch() {
    if (!address) return;
    setRefetchTick(t => t + 1);
  }

  return { positions, status, error, refetch };
}


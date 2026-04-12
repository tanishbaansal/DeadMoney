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

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function fetchAll() {
      console.log("[usePortfolio] starting fetch for address:", address);
      setStatus("loading");
      setError(null);
      try {
        console.log("[usePortfolio] fetching API data (positions, history, vaults)...");
        // Fetch everything in parallel
        const [indexedPositions, history, vaults] = await Promise.all([
          getPortfolioPositions(address!),
          getTransactionHistory(address!),
          getAllVaults(),
        ]);

        if (cancelled) {
          console.log("[usePortfolio] fetch cancelled after API calls");
          return;
        }

        console.log("[usePortfolio] API data received. Indexed:", indexedPositions.length, "History items:", history.length, "Total vaults:", vaults.length);

        // Create vault map for synthesis
        const vaultMap: Record<string, Vault> = {};
        for (const v of vaults) {
          const key = `${v.chainId}:${v.address.toLowerCase()}`;
          vaultMap[key] = v;
        }

        // Merge indexed positions with history-synthesized ones
        console.log("[usePortfolio] synthesizing positions from history...");
        const rawMerged = synthesizePositionsFromHistory(history, indexedPositions, vaultMap);
        
        // Data cleanup: Ensure every position has a vault object
        const merged = rawMerged.map(p => {
          if (p.vault) return p;
          // Try to recover vault from vaultMap if possible
          // Some API responses might have vault address but not the full object
          const vaultKey = `${p.chainId}:${(p as any).vaultAddress?.toLowerCase()}`;
          const recovered = vaultMap[vaultKey];
          if (recovered) {
             console.log(`[usePortfolio] Recovered missing vault for ${vaultKey}`);
             return { ...p, vault: recovered };
          }
          return p;
        }).filter(p => !!p.vault);

        console.log("[usePortfolio] merged positions count:", merged.length);
        
        // Final verification pass: check real on-chain balances for synthesized positions
        console.log("[usePortfolio] starting on-chain verification for", merged.length, "positions");
        const verified = await Promise.all(merged.map(async (p) => {
          if (!p || !p.vault) {
            console.warn("[usePortfolio] skipping position with missing vault:", p);
            return null;
          }

          try {
            const client = getPublicClient(p.chainId as any);
            console.log(`[usePortfolio] checking balance for ${p.vault.name} on chain ${p.chainId}`);
            const bal = await client.readContract({
              address: p.vault.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address as `0x${string}`],
            }) as bigint;
            
            // If balance is > 0, keep it. Also update the amount if it changed!
            const decimals = p.vault.decimals || (p.vault as any).token?.decimals || 18;
            const liveAmountString = formatUnits(bal, decimals);
            const liveAmount = parseFloat(liveAmountString);
            
            if (liveAmount > 0) {
              console.log(`[usePortfolio] VERIFIED: ${p.vault.name} has ${liveAmountString} balance`);
              return {
                ...p,
                vault: {
                  ...p.vault,
                  decimals: decimals
                },
                stakedTokenAmount: liveAmountString,
                stakedTokenAmountUsd: (liveAmount / (parseFloat(p.stakedTokenAmount) || liveAmount)) * p.stakedTokenAmountUsd
              };
            }
            console.log(`[usePortfolio] REMOVED: ${p.vault.name} has 0 live balance`);
            return null;
          } catch (e) {
            console.warn(`[usePortfolio] check failed for ${p.vault?.name || "vault"} on chain ${p.chainId}:`, e);
            return p; // Keep it if we can't check
          }
        }));

        const finalPositions = verified.filter((p): p is Position => p !== null);
        console.log("[usePortfolio] final positions count:", finalPositions.length);
        
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
  }, [address]);

  function refetch() {
    if (!address) return;
    setStatus("loading");
    // Simple refresh approach
    getPortfolioPositions(address)
      .then(setPositions)
      .catch(() => {})
      .finally(() => setStatus("done"));
  }

  return { positions, status, error, refetch };
}


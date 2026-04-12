import { useEffect, useRef, useState } from "react";
import { getBestVault, type Vault } from "~/lib/earnApi";
import type { TokenBalance } from "~/lib/deadMoney";

export function useVaults(balances: TokenBalance[], ready: boolean) {
  const [vaultMap, setVaultMap] = useState<Map<string, Vault | null>>(new Map());
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const fetchedRef = useRef(false);

  useEffect(() => {
    // If not ready, we reset fetchedRef so we can try again when it becomes ready
    if (!ready) {
      if (fetchedRef.current) {
        console.log("[useVaults] not ready — resetting fetchedRef");
        fetchedRef.current = false;
      }
      return;
    }

    if (fetchedRef.current) {
      console.log("[useVaults] already fetched or fetching — skipping");
      return;
    }

    console.log("[useVaults] starting fetch for", balances.length, "tokens");
    fetchedRef.current = true;
    let cancelled = false;

    async function fetchVaults() {
      setStatus("loading");
      const map = new Map<string, Vault | null>();

      try {
        if (balances.length === 0) {
          console.log("[useVaults] no balances found — marking done");
        } else {
          await Promise.allSettled(
            balances.map(async ({ token }) => {
              const key = `${token.chainId}:${token.address.toLowerCase()}`;
              try {
                console.log(`[useVaults] fetching vault for ${token.symbol} on chain ${token.chainId}`);
                const vault = await getBestVault(token.chainId, token.address);
                console.log(`[useVaults] ${token.symbol} → vault:`, vault?.name ?? "null");
                map.set(key, vault);
              } catch (err) {
                console.error(`[useVaults] error for ${token.symbol}:`, err);
                map.set(key, null);
              }
            })
          );
        }

        if (!cancelled) {
          console.log("[useVaults] fetch complete, map size:", map.size);
          setVaultMap(map);
          setStatus("done");
        }
      } catch (err) {
        console.error("[useVaults] fatal error during fetch:", err);
        if (!cancelled) {
          setStatus("error"); // Mark as error so scan can continue but we know it failed
        }
      }
    }

    fetchVaults();
    return () => { 
      console.log("[useVaults] effect cancelled");
      cancelled = true; 
    };
  }, [ready]); // only depend on `ready`

  return { vaultMap, status };
}

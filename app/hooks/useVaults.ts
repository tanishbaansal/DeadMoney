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
        fetchedRef.current = false;
      }
      return;
    }

    if (fetchedRef.current) {
      return;
    }

    fetchedRef.current = true;
    let cancelled = false;

    async function fetchVaults() {
      setStatus("loading");
      const map = new Map<string, Vault | null>();

      try {
        if (balances.length === 0) {
        } else {
          await Promise.allSettled(
            balances.map(async ({ token }) => {
              const key = `${token.chainId}:${token.address.toLowerCase()}`;
              try {
                const vault = await getBestVault(token.chainId, token.address);
                map.set(key, vault);
              } catch (err) {
                console.error(`[useVaults] error for ${token.symbol}:`, err);
                map.set(key, null);
              }
            })
          );
        }

        if (!cancelled) {
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
      cancelled = true; 
    };
  }, [ready]); // only depend on `ready`

  return { vaultMap, status };
}

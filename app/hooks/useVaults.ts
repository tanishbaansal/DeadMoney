import { useEffect, useState } from "react";
import { getBestVault, type Vault } from "~/lib/earnApi";
import type { TokenBalance } from "~/lib/deadMoney";

export function useVaults(balances: TokenBalance[], ready: boolean) {
  const [vaultMap, setVaultMap] = useState<Map<string, Vault | null>>(new Map());
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!ready || balances.length === 0) return;
    let cancelled = false;

    async function fetchVaults() {
      setStatus("loading");
      const map = new Map<string, Vault | null>();

      await Promise.allSettled(
        balances.map(async ({ token }) => {
          const key = `${token.chainId}:${token.address.toLowerCase()}`;
          try {
            const vault = await getBestVault(token.chainId, token.address);
            map.set(key, vault);
          } catch {
            map.set(key, null);
          }
        })
      );

      if (!cancelled) {
        setVaultMap(map);
        setStatus("done");
      }
    }

    fetchVaults();
    return () => { cancelled = true; };
  }, [ready, balances]);

  return { vaultMap, status };
}

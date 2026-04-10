import { useEffect, useState } from "react";
import { getPortfolioPositions, type Position } from "~/lib/earnApi";

export type PortfolioStatus = "idle" | "loading" | "done" | "error";

export function usePortfolio(address: string | null) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<PortfolioStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function fetch() {
      setStatus("loading");
      setError(null);
      try {
        const data = await getPortfolioPositions(address!);
        if (!cancelled) {
          setPositions(data);
          setStatus("done");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
          setStatus("error");
          setPositions([]);
        }
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [address]);

  function refetch() {
    if (!address) return;
    setStatus("loading");
    getPortfolioPositions(address)
      .then(setPositions)
      .catch(() => {})
      .finally(() => setStatus("done"));
  }

  return { positions, status, error, refetch };
}

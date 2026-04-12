// Simple price cache — stablecoins hardcoded, ETH-variants from CoinGecko free API
const priceCache: Record<string, { price: number; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const STABLE_IDS = new Set(["usd-coin", "tether", "dai", "usd-coin"]);

export async function getPrices(coingeckoIds: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  const toFetch: string[] = [];

  for (const id of coingeckoIds) {
    if (STABLE_IDS.has(id)) {
      results[id] = 1;
      continue;
    }
    const cached = priceCache[id];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      results[id] = cached.price;
      continue;
    }
    toFetch.push(id);
  }

  if (toFetch.length === 0) return results;

  try {
    // CoinGecko allows multiple IDs comma-separated
    const idsString = toFetch.join(",");
    console.log("[prices] Fetching CoinGecko for:", idsString);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${idsString}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );
    
    if (!res.ok) {
      console.warn("[prices] CoinGecko fetch failed:", res.status);
      throw new Error(`CG fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, { usd: number }>;
    console.log("[prices] CoinGecko data received for", Object.keys(data).length, "tokens");

    for (const [id, val] of Object.entries(data)) {
      if (val && typeof val.usd === "number") {
        priceCache[id] = { price: val.usd, ts: Date.now() };
        results[id] = val.usd;
      }
    }

    // Fill in zeros/fallbacks for items that failed to return from CG
    for (const id of toFetch) {
      if (!(id in results)) {
        const fallbacks: Record<string, number> = {
          weth: 2200,
          "wrapped-steth": 2300,
          "coinbase-wrapped-staked-eth": 2200,
          "lombard-staked-btc": 72000,
          "matic-network": 0.5,
        };
        results[id] = fallbacks[id] ?? 0;
        console.log(`[prices] No data for ${id}, using fallback: ${results[id]}`);
      }
    }
  } catch (e) {
    console.error("[prices] Price fetch error:", e);
    // Apply all fallbacks on error
    for (const id of toFetch) {
      const fallbacks: Record<string, number> = {
        weth: 2200,
        "wrapped-steth": 2300,
        "coinbase-wrapped-staked-eth": 2200,
        "lombard-staked-btc": 72000,
        "matic-network": 0.5,
      };
      results[id] = fallbacks[id] ?? 0;
    }
  }

  return results;
}

// Keep getPrice for backward compatibility if needed, but it's better to use getPrices
export async function getPrice(coingeckoId: string): Promise<number> {
  const prices = await getPrices([coingeckoId]);
  return prices[coingeckoId] ?? 0;
}

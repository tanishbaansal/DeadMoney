// Simple price cache — stablecoins hardcoded, ETH-variants from CoinGecko free API
const priceCache: Record<string, { price: number; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const STABLE_IDS = new Set(["usd-coin", "tether", "dai", "usd-coin"]);

export async function getPrice(coingeckoId: string): Promise<number> {
  if (STABLE_IDS.has(coingeckoId)) return 1;

  const cached = priceCache[coingeckoId];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.price;

  try {
    const ids = ["weth", "wrapped-steth", "coinbase-wrapped-staked-eth"].join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error("CoinGecko fetch failed");
    const data = (await res.json()) as Record<string, { usd: number }>;

    for (const [id, val] of Object.entries(data)) {
      priceCache[id] = { price: val.usd, ts: Date.now() };
    }

    return priceCache[coingeckoId]?.price ?? 0;
  } catch {
    // Fallback to a reasonable ETH price if API fails
    const fallbacks: Record<string, number> = {
      weth: 3200,
      "wrapped-steth": 3400,
      "coinbase-wrapped-staked-eth": 3300,
    };
    return fallbacks[coingeckoId] ?? 0;
  }
}

export async function getPrices(coingeckoIds: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  await Promise.all(
    coingeckoIds.map(async (id) => {
      results[id] = await getPrice(id);
    })
  );
  return results;
}
